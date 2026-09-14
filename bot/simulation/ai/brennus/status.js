import { BrennusBot } from "simulation/ai/brennus/brennus.js";

// ---------------------------------------------------------------- logging
BrennusBot.prototype.logStatus = function()
{
	const gameState = this.gameState;
	const counts = { "food": 0, "wood": 0, "stone": 0, "metal": 0 };
	let idle = 0;
	for (const ent of gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || !ent.position())
			continue;
		if (ent.isIdle())
			idle++;
		else if (this.economyManager.assignments[ent.id()])
			counts[this.economyManager.assignments[ent.id()]]++;
	}
	let houses = 0, fields = 0, town = 0;
	const houseType = gameState.applyCiv("structures/{civ}/house");
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.foundationProgress() !== undefined)
			continue;
		if (ent.templateName() === houseType)
			houses++;
		else if (ent.templateName() === fieldType)
			fields++;
		else if (ent.hasClass("Town"))
			town++;
	}
	const techs = this.boomTechs.filter(t => gameState.isResearched(t)).length;
	const res = this.arbiter.mirror();

	let gar = 0;
	for (const id in this.armyManager.army)
	{
		const e = gameState.getEntityById(+id);
		if (e && !e.position())
			gar++;
	}
	let demob = 0;
	for (const id in this.armyManager.demobilized)
		demob++;

	const rate = cls => {
		const s = this.economyManager.rateStats[cls];
		return s.theo > 0 ? `${Math.round(100 * s.amount / s.theo)}%` : "-";
	};
	const rates = `wood=${rate("wood")} grain=${rate("grain")} fruit=${rate("fruit")} stone=${rate("stone")} metal=${rate("metal")}`;

	const foodmix = ["fruit", "grain", "meat"].map(c => `${c}=${Math.round(this.economyManager.rateStats[c].amount)}`).join(" ");
	for (const s of Object.values(this.economyManager.rateStats))
	{
		s.amount = 0;
		s.theo = 0;
	}

	const dropsiteDist = this.meanDropsiteDistances();
	const terr = this.expansionManager.expansionOn() ? this.expansionManager.territoryPercent() : undefined;
	print(`[HARNESS] t=${Math.round(gameState.getTimeElapsed() / 60000)}m ` +
		`pop=${gameState.getPopulation()}/${gameState.getPopulationLimit()} idle=${idle} starved=${this.economyManager.starvedUnits || 0} ` +
		`gatherers food=${counts.food} wood=${counts.wood} stone=${counts.stone} metal=${counts.metal} ` +
		`houses=${houses} fields=${fields} town=${town} techs=${techs}/${this.boomTechs.length} ` +
		`rates ${rates} ` +
		`foodmix ${foodmix} ` +
		`dist wood=${dropsiteDist.wood}m grain=${dropsiteDist.grain}m fruit=${dropsiteDist.fruit}m ` +
		`founds=${gameState.getOwnFoundations().toEntityArray().length} failedSpots=${(this.placementManager.failedSpots || []).length} ` +
		`fruitStock=${Math.round(this.economyManager.fruitStock)} ` +
		`enemyArmy=${this.armyManager.enemyArmy || 0} siege=${this.armyManager.enemySiege || 0} enemyNear=${(this.armyManager.enemyNearestHome || 0).toFixed(0)}m ` +
		`army=${this.armyManager.armyCount ? this.armyManager.armyCount() : 0} gar=${gar} demob=${demob} ` +
		`terr=${terr ? terr.pct + "%(" + terr.own + "/" + terr.total + ")" : "-"} ` +
		`stock ${Math.floor(res.food)}/${Math.floor(res.wood)}/${Math.floor(res.stone)}/${Math.floor(res.metal)}\n`);

	// Storehouse-coverage alarm: wood walk distance is the biggest single
	// gatherer-efficiency factor, and a storehouse costs wood — a stalling
	// wood supply must be fixed before anything else can be. Latched per
	// episode (warn at 40m, clear at 30m) so a failing coverage prints once.
	const wd = dropsiteDist.wood;
	if (wd !== "-" && wd > this.woodDistWarn)
	{
		if (!this.woodDistWarned)
		{
			this.woodDistWarned = true;
			print(`[WARNING] t=${Math.round(gameState.getTimeElapsed() / 60000)}m lumberjacks work at mean ${wd}m from the nearest dropsite (>${this.woodDistWarn}m) — wood storehouse coverage is failing\n`);
		}
	}
	else if (wd === "-" || wd < this.woodDistWarnClear)
		this.woodDistWarned = false;

	// Mine-coverage alarm, per mine: a mean hides a far-mine minority, so each
	// supply with 2+ miners and a long dropsite walk warns once per episode
	// (latched per supply while it lasts). When a storehouse-served mine of
	// the same resource exists, say so — that is a drift/assignment failure,
	// not missing coverage, and the storehouse build order cannot fix it.
	const farMines = this.farMineGatherers();
	const farNow = {};
	for (const m of farMines)
	{
		farNow[m.id] = 1;
		if (this.mineFarWarned?.[m.id])
			continue;
		const why = m.served ?
			`${m.served} served ${m.res} mine(s) with free slots sit by a dropsite — miner drift` :
			`no served ${m.res} mine with free slots — mine storehouse coverage is failing`;
		const terr = m.terr ? "" : " — outside own territory, no storehouse can be ordered there";
		print(`[WARNING] t=${Math.round(gameState.getTimeElapsed() / 60000)}m ${m.n} miners on a ${m.res} mine at ${m.pos[0].toFixed(0)},${m.pos[1].toFixed(0)} — ${m.d}m from the nearest dropsite (>${this.mineDistWarn}m) — ${why}${terr}\n`);
	}
	this.mineFarWarned = farNow;
};

BrennusBot.prototype.meanDropsiteDistances = function()
{
	const gameState = this.gameState;
	const halfDiag = ent => {
		const o = ent.get("Obstruction/Static");
		return o ? Math.hypot(+o["@width"], +o["@depth"]) / 2 : 8;
	};
	const cc = this.getCivicCentre();
	if (!cc)
		return { "wood": "-", "grain": "-" };
	const woodSites = [{ "pos": cc.position(), "half": halfDiag(cc) }];
	const foodSites = [{ "pos": cc.position(), "half": halfDiag(cc) }];
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	const farmType = gameState.applyCiv("structures/{civ}/farmstead");
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	for (const ent of gameState.getOwnStructures().values())
	{
		if (!ent.position())
			continue;
		if (ent.templateName() === storeType)
			woodSites.push({ "pos": ent.position(), "half": halfDiag(ent) });
		else if (ent.templateName() === farmType)
			foodSites.push({ "pos": ent.position(), "half": halfDiag(ent) });
	}
	const minEdge = (pos, sites) =>
		Math.min(...sites.map(s => Math.hypot(pos[0] - s.pos[0], pos[1] - s.pos[1]) - s.half));
	let wSum = 0, wN = 0;
	for (const ent of gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || ent.isIdle() || !ent.position())
			continue;
		const tgt = this.economyManager.gatherTarget[ent.id()];
		if (tgt?.generic !== "wood")
			continue;
		const anchor = gameState.getEntityById(tgt.supplyId)?.position() || ent.position();
		wSum += Math.max(0, minEdge(anchor, woodSites));
		wN++;
	}
	let gSum = 0, gN = 0;
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === fieldType && ent.foundationProgress() === undefined && ent.position())
		{
			gSum += Math.max(0, minEdge(ent.position(), foodSites) - 15.5);
			gN++;
		}
	let fSum = 0, fN = 0;
	for (const ent of gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || ent.isIdle() || !ent.position())
			continue;
		const tgt = this.economyManager.gatherTarget[ent.id()];
		if (tgt?.generic !== "food" || tgt?.specific !== "fruit")
			continue;
		const anchor = gameState.getEntityById(tgt.supplyId)?.position() || ent.position();
		fSum += Math.max(0, minEdge(anchor, foodSites));
		fN++;
	}
	return {
		"wood": wN ? Math.round(wSum / wN) : "-",
		"grain": gN ? Math.round(gSum / gN) : "-",
		"fruit": fN ? Math.round(fSum / fN) : "-"
	};
};

/**
 * Miners working a mine far from every dropsite, for the mine-coverage alarm
 * in logStatus. Per-supply episodes: a supply is "far" when its nearest
 * storehouse/CC edge is beyond mineDistWarn and 2+ miners work it (one stray
 * is anecdote, two is coverage). Foundations count as sites — a storehouse
 * being built is coverage in flight, not a gap. Also counts served mines
 * (edge within mineGatherServeDist, the underserved threshold manageDropSites
 * uses) of the same resource: the "gathers far while a served mine sits
 * unused" case the alarm must distinguish from missing coverage.
 */
BrennusBot.prototype.farMineGatherers = function()
{
	const gameState = this.gameState;
	const sites = this.economyManager.dropsiteEdgeList();
	if (!sites.length)
		return [];
	const edge = pos => this.economyManager.edgeDistToSites(pos, sites);
	const miners = {};	// supplyId -> {res, pos, n}
	for (const ent of gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || ent.isIdle() || !ent.position())
			continue;
		const res = this.economyManager.assignments[ent.id()];
		if (res !== "stone" && res !== "metal")
			continue;
		const tgt = this.economyManager.gatherTarget[ent.id()];
		if (tgt?.generic !== res)
			continue;
		const pos = gameState.getEntityById(tgt.supplyId)?.position();
		if (!pos)
			continue;
		const m = miners[tgt.supplyId] = miners[tgt.supplyId] || { "res": res, "pos": pos, "n": 0 };
		m.n++;
	}
	const bad = [];
	for (const id in miners)
	{
		const m = miners[id];
		const d = Math.max(0, edge(m.pos));
		if (m.n < 2 || d <= this.mineDistWarn)
			continue;
		let served = 0;
		for (const s of gameState.getResourceSupplies(m.res).values())
			if (s.position() && s.resourceSupplyAmount() && !s.isFull() &&
				edge(s.position()) <= this.mineGatherServeDist)
				served++;
		bad.push({ "id": +id, "res": m.res, "pos": m.pos, "n": m.n, "d": Math.round(d), "served": served,
			"terr": this.inOwnTerritory(m.pos[0], m.pos[1]) });
	}
	return bad;
};
