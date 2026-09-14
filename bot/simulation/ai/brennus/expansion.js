import { BrennusBot } from "simulation/ai/brennus/brennus.js";
import { SquareDistance } from "simulation/ai/brennus/helpers.js";

// ---------------------------------------------------------------- expansion
BrennusBot.prototype.expansionOn = function()
{
	if (this.expOn)
		return true;
	if (this.gameState.isResearched("phase_city_generic") &&
		this.gameState.getPopulation() >= 300)
	{
		this.expOn = true;
		const cc = this.getCivicCentre();
		if (cc)
			this.expansionRegion = this.accessibility.getAccessValue(cc.position());
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m expansion stage on (city researched, pop 300)\n`);
	}
	return this.expOn;
};

/**
 * The defense stage starts at the town phase (~5 min), not at the
 * end of the boom — aggressive Petra must be met by a standing army and
 * towers from her first raids on (~10-15 min), not by a muster that starts
 * when her army is already camping the base.
 */
BrennusBot.prototype.defenseOn = function()
{
	if (this.defOn)
		return true;
	if (this.gameState.isResearched("phase_town_generic"))
	{
		this.defOn = true;
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m defense stage on (town researched)\n`);
	}
	return this.defOn;
};

/**
 * The war stage starts at the city phase, WITHOUT the pop-300
 * requirement of expansionOn — against aggressive Petra the waves arrive
 * before 300 pop ever lands (agg2/agg3: city at ~14.5m, pop stuck at
 * 240-290 under raid, so the whole post-boom war machine stayed off while
 * the base burned). City unlocks fanatics/arsenal/rams; that is all the
 * war machine needs.
 */
BrennusBot.prototype.warOn = function()
{
	if (this.war)
		return true;
	if (this.gameState.isResearched("phase_city_generic"))
	{
		this.war = true;
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m war stage on (city researched)\n`);
	}
	return this.war;
};

BrennusBot.prototype.expBarterTarget = 52000;

BrennusBot.prototype.targetTraders = 40;
BrennusBot.prototype.traderType = "units/{civ}/support_trader";

BrennusBot.prototype.expMarkets = 2;

/** Expansion shares: mine crews sized to deplete every served mine by t=30
 * at ~0.4 effective rate, capped at 26% of the workforce; the rest splits
 * food/wood evenly. */
BrennusBot.prototype.expansionShares = function(total)
{
	if (!total)
		return { "food": 0.5, "wood": 0.33, "stone": 0.1, "metal": 0.07 };
	const gameState = this.gameState;
	const timeLeft = Math.max(90, (1800000 - gameState.getTimeElapsed()) / 1000);

	const rate = 0.4;
	const region = this.expansionRegion;
	// "Served" is the alarm metric — edge within mineDistWarn of a dropsite:
	// crews are never sized on mines whose staffing would trip the far-mine
	// warning; coverage extends to new mines first (proactive storehouse).
	const sites = this.dropsiteEdgeList();
	const served = { "stone": 0, "metal": 0 };
	this.servedMineIds = new Set();
	for (const res of ["stone", "metal"])
		for (const s of gameState.getResourceSupplies(res).values())
		{
			const pos = s.position();
			if (!pos || !s.resourceSupplyAmount() || this.armyManager.nearEnemy(pos, 100, 60))
				continue;
			if (region !== undefined && this.accessibility.getAccessValue(pos) !== region)
				continue;
			if (this.edgeDistToSites(pos, sites) > this.mineDistWarn)
				continue;
			// Mines outside own territory can never get a storehouse
			// (BuildRestrictions "own"): sizing the mining shares on them sends
			// crews where coverage cannot follow — the drift pull-back funnels
			// strays back in-territory.
			if (!this.inOwnTerritory(pos[0], pos[1]))
				continue;
			served[res] += s.resourceSupplyAmount();
			this.servedMineIds.add(s.id());
		}
	const shares = { "food": 0.3, "wood": 0.2, "stone": 0.0, "metal": 0.0 };
	let mining = 0;
	for (const res of ["stone", "metal"])
	{
		shares[res] = Math.min(0.31, served[res] / (rate * timeLeft) / total);
		mining += shares[res];
	}

	if (mining > 0.26)
	{
		const scale = 0.26 / mining;
		shares.stone *= scale;
		shares.metal *= scale;
		mining = 0.26;
	}
	const rest = 1 - mining;

	const woodFrac = this.bankAwareWoodFrac(this.arbiter.books("shares"), 0.5);
	shares.food = rest * (1 - woodFrac);
	shares.wood = rest * woodFrac;
	return shares;
};

/** CC lattice: hex-packed grid on ~210 m spacing (the engine's min CC
 * distance is 200 m) tiling the 768 m map. */
BrennusBot.prototype.expansionCandidates = function()
{
	const spots = [];
	for (let gz = -3; gz <= 3; ++gz)
		for (let gx = -3; gx <= 3; ++gx)
		{
			const x = 384 + gx * 210 + (gz & 1 ? 105 : 0);
			const z = 384 + gz * 182;

			if (Math.hypot(x - 384, z - 384) > 430)
				continue;
			spots.push([x, z]);
		}
	return spots;
};

/** CC placement check: clear rotated footprint on own OR neutral territory (a CC is a territory root). */
BrennusBot.prototype.expansionSpotOK = function(spot, halfW, halfD)
{
	const pass = this.gameState.getPassabilityMap();
	const mask = this.gameState.getPassabilityClassMask("building-land");
	const terr = this.territoryMap;
	const angle = this.getPlacementAngle();
	const cosa = Math.cos(angle), sina = Math.sin(angle);
	const ex = halfW + 0.75, ez = halfD + 0.75;
	const pc = pass.cellSize, tc = terr.cellSize;
	const px0 = Math.floor((spot[0] - ex) / pc), px1 = Math.floor((spot[0] + ex) / pc);
	const pz0 = Math.floor((spot[1] - ez) / pc), pz1 = Math.floor((spot[1] + ez) / pc);
	if (px0 < 0 || pz0 < 0 || px1 >= pass.width || pz1 >= pass.height)
		return false;
	for (let j = pz0; j <= pz1; ++j)
		for (let i = px0; i <= px1; ++i)
		{
			const dx = (i + 0.5) * pc - spot[0];
			const dz = (j + 0.5) * pc - spot[1];
			const u = dx * cosa + dz * sina;
			const v = -dx * sina + dz * cosa;
			if (Math.abs(u) <= halfW + 0.75 && Math.abs(v) <= halfD + 0.75 &&
				(pass.data[i + j * pass.width] & mask))
				return false;
		}
	const tx0 = Math.floor((spot[0] - ex) / tc), tx1 = Math.floor((spot[0] + ex) / tc);
	const tz0 = Math.floor((spot[1] - ez) / tc), tz1 = Math.floor((spot[1] + ez) / tc);
	if (tx0 < 0 || tz0 < 0 || tx1 >= terr.width || tz1 >= terr.height)
		return false;
	for (let j = tz0; j <= tz1; ++j)
		for (let i = tx0; i <= tx1; ++i)
		{
			const owner = terr.data[i + j * terr.width] & 0x1F;
			if (owner !== this.player && owner !== 0)
				return false;
		}
	return true;
};

BrennusBot.prototype.expansionSpotNear = function(anchor, halfW, halfD, ccSpots)
{
	for (let r = 0; r <= 60; r += 4)
		for (let a = 0; a < 24; ++a)
		{
			const ang = a * 2 * Math.PI / 24;
			const spot = [anchor[0] + r * Math.cos(ang), anchor[1] + r * Math.sin(ang)];
			if (this.failedSpots.some(f => Math.abs(f[0] - spot[0]) < 6 && Math.abs(f[1] - spot[1]) < 6))
				continue;
			if (ccSpots.some(c => SquareDistance(c, spot) < 200 * 200))
				continue;
			if (this.armyManager.nearEnemy(spot, 100, 60))
				continue;
			if (this.expansionRegion !== undefined &&
				this.accessibility.getAccessValue(spot) !== this.expansionRegion)
				continue;
			if (this.expansionSpotOK(spot, halfW, halfD))
				return spot;
		}
	return undefined;
};

/** Greedy marginal-coverage CC plan over the lattice, scored with a
 * simulation of the engine's territory influence (linear-falloff
 * floodfill); target 72% of the passable map. */
BrennusBot.prototype.computeExpansionPlan = function()
{
	const gameState = this.gameState;
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const template = gameState.getTemplate(ccType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;

	const ccSpots = [];
	for (const ent of gameState.getStructures().values())
		if (ent.hasClass("CivCentre") && ent.position())
			ccSpots.push(ent.position());

	const lattice = this.expansionCandidates();
	const candidates = [];
	for (const anchor of lattice)
	{
		const found = this.expansionSpotNear(anchor, halfW, halfD, ccSpots);
		if (found)
			candidates.push(found);
	}
	print(`[HARNESS] expansion candidates: ${candidates.length} of ${lattice.length} lattice anchors yield a buildable spot\n`);
	for (const c of ccSpots)
		print(`[HARNESS]   existing CC at ${c[0].toFixed(0)},${c[1].toFixed(0)}\n`);

	const terr = this.territoryMap;
	const pass = gameState.getPassabilityMap();
	const tmask = gameState.getPassabilityClassMask("default-terrain-only");
	// Territory cost grid (8 m tiles): 1 passable, 4 impassable — the engine's own downsampling.
	const terrW = terr.width, terrH = terr.height;
	const tcell = terr.cellSize / pass.cellSize;
	const costGrid = new Uint8Array(terrW * terrH);
	let totalPassable = 0;
	for (let j = 0; j < terrH; ++j)
		for (let i = 0; i < terrW; ++i)
		{
			let c = 0;
			for (let dj = 0; dj < tcell; ++dj)
				for (let di = 0; di < tcell; ++di)
					c |= pass.data[((i * tcell + di) + (j * tcell + dj) * pass.width)];
			if (c & tmask)
				costGrid[i + j * terrW] = 4;
			else
			{
				costGrid[i + j * terrW] = 1;
				totalPassable++;
			}
		}

	const own = new Uint8Array(terrW * terrH);
	let ownCount = 0;
	for (let j = 0; j < terrH; ++j)
		for (let i = 0; i < terrW; ++i)
		{
			const idx = i + j * terrW;
			if (costGrid[idx] === 1 && (terr.data[idx] & 0x1F) === this.player)
			{
				own[idx] = 1;
				ownCount++;
			}
		}

	const falloff = 10000 * 8 / 140; // weight x 8 / radius per orthogonal tile

	const DIAG = 362 / 256;
	const influence = spots => {
		const w = new Float32Array(terrW * terrH);
		const queue = new Int32Array(terrW * terrH);
		let head = 0, tail = 0;
		const push = (i, val) => {
			if (val > w[i])
			{
				w[i] = val;
				queue[tail++] = i;
			}
		};
		for (const spot of spots)
			push(Math.floor(spot[1] / 8) * terrW + Math.floor(spot[0] / 8), 10000);
		while (head < tail)
		{
			const i = queue[head++];
			const x = i % terrW, y = (i / terrW) | 0;
			const val = w[i];
			for (let dx = -1; dx <= 1; ++dx)
				for (let dy = -1; dy <= 1; ++dy)
				{
					if (!dx && !dy)
						continue;
					const nx = x + dx, ny = y + dy;
					if (nx < 0 || ny < 0 || nx >= terrW || ny >= terrH)
						continue;
					const c = costGrid[nx + ny * terrW];
					if (c === 4)
						continue;
					const step = (dx && dy) ? DIAG : 1;
					push(nx + ny * terrW, val - falloff * step);
				}
		}
		return w;
	};

	const cov = new Uint8Array(own);
	let covered = ownCount;
	const spots = [];
	const target = Math.ceil(totalPassable * 0.72);
	while (candidates.length)
	{
		let best = -1, bestGain = 0, bestW = null;
		for (const cand of candidates)
		{

			if (spots.some(s => SquareDistance(s, cand) < 200 * 200))
				continue;
			const w = influence([cand]);
			let gain = 0;
			for (let i = 0; i < w.length; ++i)
				if (w[i] > 0 && !cov[i] && costGrid[i] === 1 &&
					(terr.data[i] & 0x1F) === 0)
					gain++;
			if (gain > bestGain)
			{
				bestGain = gain;
				best = cand;
				bestW = w;
			}
		}
		if (bestGain < 60 && covered >= target)
			break;
		if (best === -1)
			break;

		const idx = candidates.indexOf(best);
		candidates.splice(idx, 1);
		spots.push(best);
		for (let i = 0; i < bestW.length; ++i)
			if (bestW[i] > 0 && costGrid[i] === 1 && (terr.data[i] & 0x1F) === 0)
				cov[i] = 1;
		covered += bestGain;
	}

	const base = this.getCivicCentre()?.position() || [384, 384];
	spots.sort((a, b) => SquareDistance(a, base) - SquareDistance(b, base));
	print(`[HARNESS] expansion plan: ${spots.length} CCs, sim coverage ${(100 * covered / totalPassable).toFixed(1)}% of ${totalPassable} passable tiles (bar 70%)\n`);
	return { "spots": spots, "next": 0, "done": false, "simPct": 100 * covered / totalPassable };
};

/**
 * Relief expansion: found a CC before the pop-300 milestone when the base is
 * demonstrably stuck — the FIRST market or arsenal unplaceable for a long
 * continuous stretch, houses unplaceable while pop is pinned at the limit
 * (tracked at record time in tryConstruct), or a resource the dropsites once
 * served is exhausted (had it, lost it — a map that never had served stone
 * is not a reason to expand). Only true capability deadlocks count: capacity
 * wishes for a 2nd+ building and capped fields ride themselves out in
 * healthy wins (relief1/relief2 goldens false-fired on field/house/
 * temple/barracks), and even a first arsenal lands after 3.5 min of
 * crowding in a normal game (golden s2) — hence the longer arsenal latch.
 * Unlocks only the CC stream of manageExpansion; the expansion economy
 * still waits for pop 300. (c8e6d31 sweep: s55/s87/s47/s20 deadlocked
 * here — no room, pop stalled under 300, expansion never on, timeout.)
 */
BrennusBot.prototype.checkReliefExpansion = function()
{
	if (!this.gameState.isResearched("phase_town_generic"))
		return;
	const gameState = this.gameState;
	const stuck = (templateType, latch) =>
		this.placeFailSince[templateType] !== undefined &&
		this.turn - this.placeFailSince[templateType] >= latch;
	for (const [building, latch] of [["market", 750], ["arsenal", 1200]])
	{
		const type = gameState.applyCiv(`structures/{civ}/${building}`);
		if (!stuck(type, latch))
			continue;
		let owned = false;
		for (const ent of gameState.getOwnStructures().values())
			if (ent.templateName() === type && ent.foundationProgress() === undefined)
			{
				owned = true;
				break;
			}
		if (!owned)
		{
			this.reliefFire(`no room: first ${building} placement failing ${((this.turn - this.placeFailSince[type]) / 300).toFixed(1)}m`);
			return;
		}
	}
	const houseType = gameState.applyCiv("structures/{civ}/house");
	if (stuck(houseType, 750))
	{
		this.reliefFire(`no room: houses unplaceable at the pop cap for ${((this.turn - this.placeFailSince[houseType]) / 300).toFixed(1)}m`);
		return;
	}
	if (this.turn - (this.reliefResourceCheck || 0) < 150)
		return;
	this.reliefResourceCheck = this.turn;
	const sites = this.dropsiteEdgeList();
	for (const res of ["stone", "metal"])
	{
		let supply = 0;
		for (const s of gameState.getResourceSupplies(res).values())
			if (s.position() && s.resourceSupplyAmount() &&
				this.edgeDistToSites(s.position(), sites) <= this.mineDistWarn)
				supply += s.resourceSupplyAmount();
		if (supply > (this.reliefServedPeak[res] || 0))
			this.reliefServedPeak[res] = supply;
		if (supply === 0 && this.reliefServedPeak[res] > 0)
		{
			this.reliefFire(`no served ${res} left (peak ${this.reliefServedPeak[res]})`);
			return;
		}
	}
	let wood = 0;
	for (const s of gameState.getResourceSupplies("wood").values())
		if (s.position() && s.resourceSupplyAmount() &&
			this.edgeDistToSites(s.position(), sites) <= this.woodStrategy.gateRadius)
			wood += s.resourceSupplyAmount();
	if (wood > (this.reliefServedPeak.wood || 0))
		this.reliefServedPeak.wood = wood;
	if (wood < this.woodStrategy.minWoodMass && this.reliefServedPeak.wood >= this.woodStrategy.minWoodMass)
		this.reliefFire(`wood near dropsites exhausted (${wood} of peak ${this.reliefServedPeak.wood} left)`);
};

BrennusBot.prototype.reliefFire = function(why)
{
	this.reliefOn = true;
	// Same land-region pin as expansionOn: a relief CC across a cliff or river
	// would strand its builder party on an unreachable foundation.
	const cc = this.getCivicCentre();
	if (cc && this.expansionRegion === undefined)
		this.expansionRegion = this.accessibility.getAccessValue(cc.position());
	print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m relief expansion on (${why})\n`);
};

/**
 * Raze storehouses the resource frontier has left behind: no wood/stone/metal
 * supply within 55 m and no gatherer working within 45 m. The old self-raze
 * rule (supply-only, any stage) threw away dropsites the choppers still used
 * and collapsed the woodline mid-war (2026-08-29 findloss note); the worker
 * gate and the expansion-stage latch keep this to genuinely dead buildings.
 * One raze per 150 turns, so a scan sweep can never cascade.
 */
BrennusBot.prototype.manageStorehouseCleanup = function()
{
	if (this.turn < (this.nextCleanupTurn || 0))
		return;
	this.nextCleanupTurn = this.turn + 150;
	const gameState = this.gameState;
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	const supplies = [];
	for (const res of ["wood", "stone", "metal"])
		for (const s of gameState.getResourceSupplies(res).values())
			if (s.position() && s.resourceSupplyAmount())
				supplies.push(s.position());
	const workers = [];
	for (const ent of gameState.getOwnUnits().values())
		if (ent.isGatherer() && ent.position())
			workers.push(ent.position());
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.templateName() !== storeType || !ent.position() ||
			ent.foundationProgress() !== undefined)
			continue;
		const pos = ent.position();
		if (supplies.some(p => SquareDistance(p, pos) < 55 * 55))
			continue;
		if (workers.some(p => SquareDistance(p, pos) < 45 * 45))
			continue;
		if (this.armyManager.nearEnemy(pos, 80, 60))
			continue;
		print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m razing dead storehouse at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} (no supply within 55m, no workers within 45m)\n`);
		ent.destroy();
		return;
	}
};

/** Expansion program, one order per block: wonder, far markets, then the next planned CC. Under relief only the CC stream runs, one project at a time. */
BrennusBot.prototype.manageExpansion = function()
{
	const full = this.expansionOn();
	if (!full && !this.reliefOn)
		this.checkReliefExpansion();
	if (!full && !this.reliefOn)
		return;
	if (full)
		this.manageStorehouseCleanup();
	if (!this.expPlan || this.turn - (this.expPlan.turn || 0) >= 750)
		// Recompute every 750 turns (2.5 min): raids raze Petra CCs and their
		// territory reverts to neutral, opening spots the original plan —
		// computed while Petra held half the map — could never claim (def14:
		// plans of 7 spots, 2 orders in 25 min). The freed land must be claimed
		// before Petra rebuilds. wonder/market flags are re-derived from
		// live state, so nothing is lost on rebuild.
		this.expPlan = Object.assign(this.computeExpansionPlan(), { "turn": this.turn });
	const gameState = this.gameState;
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const plan = this.expPlan;

	// Wonder (Glorious Expansion +20% pop): ordered once Will to Fight is
	// funded — the spend order is forge line, Will, wonder — and the
	// expansion stage can pay for it (waiting for the first expansion CC to
	// stand first pushed the pop tech minutes past the point the +60 pop
	// mattered).
	if (full && !plan.wonderDone)
	{
		const wonderType = gameState.applyCiv("structures/{civ}/wonder");
		const builtWonder = gameState.getOwnStructures().toEntityArray()
			.some(ent => ent.templateName() === wonderType);
		if (builtWonder)
			plan.wonderDone = true;
		else if (gameState.getOwnFoundations().toEntityArray().some(f =>
			gameState.getBuiltTemplate(f.templateName()).templateName() === wonderType))
		{

		}
		else if (!this.buildupManager.willToFightPending(gameState) &&
			!this.pendingBuilds.some(pb => pb.template === wonderType) &&
			!this.arbiter.held("construction"))
		{
			const res = this.arbiter.books("expansion");

			if (res.canAfford({ "wood": 1100, "stone": 1550, "metal": 1100 }))
			{
				const spot = this.findWonderSpot(wonderType);
				if (spot && this.placeOrder(wonderType, spot))
				{
					this.arbiter.spend(res, "expansion", { "wood": 1000, "stone": 1500, "metal": 1000 }, "wonder");
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m wonder order at ${spot[0].toFixed(0)},${spot[1].toFixed(0)}\n`);
					return;
				}
			}
		}
	}

	if (full && (plan.marketsPlaced || 0) < this.expMarkets)
	{
		const marketType = gameState.applyCiv("structures/{civ}/market");
		const base = this.getCivicCentre()?.position() || [384, 384];
		const marketSpots = [];

		for (const ent of gameState.getOwnStructures().values())
			if (ent.hasClass("Market") && ent.position() && ent.foundationProgress() === undefined)
				marketSpots.push(ent.position());
		for (const f of gameState.getOwnFoundations().values())
			if (f.position() && gameState.getBuiltTemplate(f.templateName()).hasClass("Market"))
				marketSpots.push(f.position());
		if (marketSpots.length >= 1 + this.expMarkets)

			plan.marketsPlaced = this.expMarkets;
		else if (!this.pendingBuilds.some(pb => pb.template === marketType &&
				SquareDistance([pb.x, pb.z], base) > 150 * 150) &&
			!this.arbiter.held("construction"))
		{
			const res = this.arbiter.books("expansion");
			if (res.wood >= 600)
			{

				const ccType2 = gameState.applyCiv("structures/{civ}/civil_centre");
				const anchors = gameState.getOwnStructures().toEntityArray()
					.filter(ent => ent.templateName() === ccType2 && ent.position() &&
						!marketSpots.some(m => SquareDistance(m, ent.position()) < 150 * 150))
					.sort((a, b) => SquareDistance(b.position(), base) - SquareDistance(a.position(), base))
					.slice(0, this.expMarkets);
				for (const anchor of anchors)
				{
					const pos = this.findBuildingPosition(marketType, anchor.position(), 20, 80, true, this.expansionRegion);
					if (pos && this.placeOrder(marketType, pos))
					{
						this.arbiter.spend(res, "expansion", { "wood": 300 }, "market");
						print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m market at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for the trade routes\n`);
						return;
					}
				}
			}
		}
	}

	if (plan.next < plan.spots.length)
	{
		// Two CC projects run concurrently (three once their army is broken):
		// under Petra pressure a single sequential cursor starves the expansion
		// (def9: 2 orders in 30 min). All entity collections are scanned once
		// per call, not per spot. Relief expansion runs one project at a time:
		// it fires mid-boom, when the economy cannot feed concurrent CCs yet.
		const ccConcurrency = full ? ((this.armyManager.enemyArmy || 0) < 60 ? 3 : 2) : 1;
		const ownCCPos = [];
		for (const ent of gameState.getOwnStructures().values())
			if (ent.templateName() === ccType && ent.position())
				ownCCPos.push(ent.position());
		const ccFoundationPos = [];
		for (const f of gameState.getOwnFoundations().values())
			if (f.position() && gameState.getBuiltTemplate(f.templateName()).hasClass("CivCentre"))
				ccFoundationPos.push(f.position());
		const ccPending = this.pendingBuilds.filter(pb => pb.template === ccType);
		const ccSpots = ownCCPos.concat(ccFoundationPos);
		for (const ent of gameState.getStructures().values())
			if (ent.hasClass("CivCentre") && ent.position())
				ccSpots.push(ent.position());
		let slots = ccConcurrency - ccFoundationPos.length - ccPending.length;
		// Refresh the contested-spot memory: an entry stays hot while enemies
		// remain near it (checked directly, independent of scan visits — a
		// failed spot is skipped by the scan for 5 min). Scan-sourced entries
		// die 150 turns after the area cools; proven ones live their 3 min
		// regardless — patrols drift off and return. An entry with an active
		// clearing op is never pruned.
		for (const key in this.expContested)
		{
			if (this.offenseManager.clearOp && key === this.offenseManager.clearOp.key)
				continue;
			const c = this.expContested[key];
			if (this.armyManager.nearEnemy([c.x, c.z], 100, 60))
				c.seen = this.turn;
			else if (this.turn - c.seen > 150 && (!c.proven || this.turn > c.until))
				delete this.expContested[key];
		}
		let scanned = 0;
		while (slots > 0 && plan.next < plan.spots.length && scanned++ < plan.spots.length)
		{
			const spot = plan.spots[plan.next];
			const near = pos => pos && Math.abs(pos[0] - spot[0]) < 6 && Math.abs(pos[1] - spot[1]) < 6;
			if (ownCCPos.some(near))
			{
				plan.next++;
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m CC ${plan.next}/${plan.spots.length} completed at ${spot[0].toFixed(0)},${spot[1].toFixed(0)}\n`);
				continue;
			}
			// In progress (foundation laid or order pending): rotate to the
			// back so other spots can be ordered while this one builds.
			const pending = ccPending.some(pb => Math.hypot(pb.x - spot[0], pb.z - spot[1]) < 30);
			if (ccFoundationPos.some(near) || pending)
			{
				plan.spots.splice(plan.next, 1);
				plan.spots.push(spot);
				continue;
			}

			if (this.failedSpots.some(f => Math.abs(f[0] - spot[0]) < 6 && Math.abs(f[1] - spot[1]) < 6))
			{
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m CC spot ${spot[0].toFixed(0)},${spot[1].toFixed(0)} failed, skipping\n`);
				plan.next++;
				continue;
			}

			// Hot area: enemies proved lethal near a contested spot — the
			// clearing op owns that area now, so don't feed it another builder
			// party (s47: 5 parties of 6 walked into the same midfield blob).
			// Scan-sourced entries guard while hot; proven ones for their whole
			// life. Exception: the bubble around an active op — the army is
			// there, orders inside it are the escorted re-order we wait for.
			let hot = false;
			for (const key in this.expContested)
			{
				const c = this.expContested[key];
				if (this.offenseManager.clearOp &&
					Math.abs(c.x - this.offenseManager.clearOp.x) < 100 && Math.abs(c.z - this.offenseManager.clearOp.z) < 100)
					continue;
				const alive = c.proven ? this.turn <= c.until : this.turn - c.seen <= 150;
				if (alive && Math.abs(c.x - spot[0]) < 80 && Math.abs(c.z - spot[1]) < 80)
				{
					hot = true;
					break;
				}
			}
			if (hot)
			{
				plan.spots.splice(plan.next, 1);
				plan.spots.push(spot);
				continue;
			}

			{
				// Re-validate the spot against the live state before ordering (borders and the 200 m rule move).
				const template = gameState.getTemplate(ccType);
				const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
				const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
				const nearCC = ccSpots.some(c => SquareDistance(c, spot) < 200 * 200);
				// Once their army is broken, lone stragglers must not stale a spot.
				const enemyNear = this.armyManager.nearEnemy(spot, 100, this.armyManager.enemyArmy > 40 ? 60 : 0);
				const stale = nearCC || enemyNear ||
					(this.expansionRegion !== undefined &&
						this.accessibility.getAccessValue(spot) !== this.expansionRegion) ||
					!this.expansionSpotOK(spot, halfW, halfD);
				if (stale)
				{
					const terr = this.territoryMap;
					const ti = Math.floor(spot[0] / terr.cellSize) + Math.floor(spot[1] / terr.cellSize) * terr.width;
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m CC spot ${spot[0].toFixed(0)},${spot[1].toFixed(0)} stale (owner=${terr.data[ti] & 0x1F} nearCC=${nearCC} nearEnemy=${enemyNear} spotOK=${this.expansionSpotOK(spot, halfW, halfD)}) skipping\n`);
					// Stale spots rotate to the back of the queue instead of
					// blocking the plan; nearEnemy clears when their patrol moves,
					// nearCC clears when the raid razes their CC. Only terrain-level
					// failures (bad spot, wrong region) are dropped immediately.
					if (this.expansionSpotOK(spot, halfW, halfD) &&
						(this.expansionRegion === undefined ||
							this.accessibility.getAccessValue(spot) === this.expansionRegion))
					{
						plan.staleRetries = plan.staleRetries || {};
						const key = `${spot[0].toFixed(0)},${spot[1].toFixed(0)}`;
						// Vetoed by enemy presence alone (a nearCC veto is the
						// raid's job to clear): remember it for the clearing op.
						if (enemyNear && !nearCC)
						{
							const c = this.expContested[key];
							this.expContested[key] = {
								"x": spot[0], "z": spot[1],
								"since": c ? c.since : this.turn, "seen": this.turn
							};
						}
						plan.staleRetries[key] = (plan.staleRetries[key] || 0) + 1;
						if (plan.staleRetries[key] < 100)
						{
							plan.spots.splice(plan.next, 1);
							plan.spots.push(spot);
							continue;
						}
					}
					plan.next++;
					continue;
				}
			}
			const res = this.arbiter.books("expansion");

			if (this.arbiter.held("construction"))
				return;
			// Frontier projects need escort conditions: while Petra masses an
			// army we cannot cover, far CCs get captured rather than razed —
			// gifting her the territory and killing the builder party (def16
			// s3: 4 CCs captured, 856 civilians lost). Spots adjacent to an
			// existing CC are safe enough to keep the first ring (and the
			// wonder) flowing; gated spots rotate to the back of the queue.
			// Exempt the bubble an active clearing op is holding: the army on
			// the spot IS the coverage.
			const covered = this.offenseManager.clearOp &&
				Math.abs(this.offenseManager.clearOp.x - spot[0]) < 100 && Math.abs(this.offenseManager.clearOp.z - spot[1]) < 100;
			if (!covered && !ownCCPos.some(c => SquareDistance(c, spot) < 260 * 260) &&
				((this.armyManager.enemyArmy || 0) > 100 || this.armyManager.armyCount() < 50))
			{
				plan.spots.splice(plan.next, 1);
				plan.spots.push(spot);
				continue;
			}
			// Floors above the raw cost: the engine checks the real stock at processing.
			// While the wonder is pending it holds first claim on the ores —
			// that is what lets 1550 stone and 1100 metal ever coexist in the
			// bank (val s1: three expansion CCs ate 1200 stone while the
			// wonder waited from t=35.6 to the end of the game).
			const stoneReserve = this.buildupManager.wonderHoldActive(gameState) ? 1550 : 0;
			if (!res.canAfford({ "wood": 400, "stone": 400 + stoneReserve, "metal": 300 + (stoneReserve ? 1100 : 0) }))
				return;
			if (!this.placeOrder(ccType, spot))
				return;
			// A lone builder dies or gets sheltered en route: send a party of 6.
			const party = gameState.getOwnUnits()
				.filter(ent => ent.isGatherer() && ent.position() &&
					!this.armyManager.army[ent.id()] && ent.id() !== this.herderId)
				.filterNearest(spot, 6).toEntityArray();
			for (const ent of party)
				ent.construct(ccType, spot[0], spot[1], this.getPlacementAngle(), undefined);
			this.arbiter.spend(res, "expansion", { "wood": 300, "stone": 300, "metal": 250 }, "CC");
			slots--;
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m CC order at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} (${plan.next + 1}/${plan.spots.length}, slot ${ccConcurrency - slots}/${ccConcurrency})\n`);
			// Ordered: rotate so the next call scans the remaining spots.
			plan.spots.splice(plan.next, 1);
			plan.spots.push(spot);
		}
		return;
	}
};

/** Traders shuttle the farthest market pair; at the cap pin an idle civilian is dismissed to make room. */
BrennusBot.prototype.manageTrade = function()
{
	if (!this.expansionOn())
		return;
	const gameState = this.gameState;
	const markets = gameState.getOwnStructures().toEntityArray()
		.filter(ent => ent.hasClass("Market") && ent.foundationProgress() === undefined);
	if (markets.length < 2)
		return;
	let traders = 0;
	for (const ent of gameState.getOwnUnits().values())
		if (ent.hasClass("Trader"))
			traders++;
	if (traders < this.targetTraders)
	{
		const res = this.arbiter.books("trade");
		if (res.food >= 40000 + 100 && res.metal >= 1200)
		{
			// Pop room for the trader — only when one is actually trained now;
			// dismissing without training (food below the bar) was a pure leak
			// (def15 s3: 51 pointless dismissals).
			if (gameState.getPopulation() >= gameState.getPopulationLimit())
				for (const ent of gameState.getOwnUnits().values())
					if (ent.isGatherer() && !ent.hasClass("Cavalry") && ent.isIdle() && !this.armyManager.army[ent.id()] &&
						!(ent.id() === this.herderId && !this.herdingDone))
					{
						print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m dismissing idle civilian for a trader\n`);
						ent.destroy();
						break;
					}
			for (const market of markets)
				if ((market.trainingQueue()?.length || 0) <= 1)
				{
					market.train(gameState.getPlayerCiv(), gameState.applyCiv(this.traderType), 1, {});
					this.arbiter.spend(res, "trade", { "food": 100, "metal": 80 }, "trader");
					break;
				}
		}
	}
	let far = markets[0], near = markets[1], best = -1;
	for (const a of markets)
		for (const b of markets)
		{
			if (a === b)
				continue;
			const dist = SquareDistance(a.position(), b.position());
			if (dist > best)
			{
				best = dist;
				far = a;
				near = b;
			}
		}
	if (best > 0 && !this.routeLogged)
	{
		this.routeLogged = true;
		print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m trade route ${Math.sqrt(best).toFixed(0)}m (${markets.length} markets)\n`);
	}
	for (const ent of gameState.getOwnUnits().values())
		if (ent.hasClass("Trader") && ent.isIdle())
			ent.tradeRoute(far, near);
};

BrennusBot.prototype.expansionTechs = [
	// +20% pop first: once the wonder stands, nothing else multiplies both the
	// economy and the army ceiling — and the pop room unblocks the ram queue.
	"wonder_population_cap",
	"gather_mining_servants",

	"gather_mining_serfs",

	"gather_mining_slaves",

	"gather_mining_wedgemallet",

	"gather_mining_shaftmining",

	"gather_mining_silvermining",

	"gather_lumbering_sharpaxes",

	"gather_capacity_wheelbarrow",

	"gather_capacity_carts",

	"trade_gain_01",

	"trade_gain_02",

	"trade_commercial_treaty",

	"trader_health",
	"health_civilians_01"

];

BrennusBot.prototype.manageExpansionTechs = function()
{
	if (!this.expansionOn())
		return false;
	const gameState = this.gameState;
	const resources = this.arbiter.books("expansionTechs");

	let researching = 0;
	for (const tech of this.expansionTechs)
		if (gameState.isResearching(tech))
			researching++;
	if (researching >= 3)
		return false;
	for (const tech of this.expansionTechs)
	{
		if (gameState.isResearched(tech) || gameState.isResearching(tech))
			continue;
		const researchers = gameState.findResearchers(tech);
		if (!researchers)
			continue;
		const cost = gameState.getTemplate(tech).cost();

		if (!resources.canAfford({
			"food": (cost.food || 0) + 150,
			"wood": (cost.wood || 0) + 400,
			"stone": (cost.stone || 0) + 150,
			"metal": (cost.metal || 0) + 150 }))
			continue;
		const facility = researchers.toEntityArray()
			.filter(ent => ent.foundationProgress() === undefined && (ent.trainingQueue()?.length || 0) <= 1)
			.sort((a, b) => (a.trainingQueue()?.length || 0) - (b.trainingQueue()?.length || 0))[0];
		if (facility)
		{
			facility.research(tech);
			this.arbiter.spend(resources, "expansionTechs", cost, tech);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m research ${tech}\n`);
			this.arbiter.hold("construction");
			return true;
		}
	}
	return false;
};

/** Price-aware stone/metal buying: pick the better-ratio seller, pause
 * below 0.35 so prices recover, spend only above the stockpile floors. */
BrennusBot.prototype.manageExpansionBarter = function(market)
{
	const gameState = this.gameState;
	const res = this.arbiter.books("expansionBarter");
	if (res.stone < this.expBarterTarget || res.metal < this.expBarterTarget)
	{
		const want = res.stone <= res.metal ? "stone" : "metal";
		const prices = gameState.getBarterPrices();
		const ratio = sell => prices.sell[sell] / prices.buy[want];
		const foodRatio = ratio("food");
		const woodRatio = ratio("wood");
		const sell = foodRatio >= woodRatio ? "food" : "wood";
		const bestRatio = Math.max(foodRatio, woodRatio);

		if (bestRatio >= 0.35 && res[sell] >= 47000 && this.turn % 15 === 0)
		{
			market.barter(want, sell, 500);
			this.arbiter.spendSell("barter", sell, 500, `barter ${sell}->${want}`);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 ${sell} -> ${want} (ratio ${bestRatio.toFixed(2)})\n`);
			return true;
		}
	}
	return false;
};

/** percentMapControlled equivalent: own + connected + passable tiles over all passable tiles. */
BrennusBot.prototype.territoryPercent = function()
{
	const terr = this.territoryMap;
	if (!this.terrPassable)
	{
		const pass = this.gameState.getPassabilityMap();
		const mask = this.gameState.getPassabilityClassMask("default-terrain-only");
		const tcell = terr.cellSize / pass.cellSize;
		const g = new Uint8Array(terr.width * terr.height);
		for (let j = 0; j < terr.height; ++j)
			for (let i = 0; i < terr.width; ++i)
			{
				let c = 0;
				for (let dj = 0; dj < tcell; ++dj)
					for (let di = 0; di < tcell; ++di)
						c |= pass.data[((i * tcell + di) + (j * tcell + dj) * pass.width)];
				if (!(c & mask))
					g[i + j * terr.width] = 1;
			}
		this.terrPassable = g;
	}
	let own = 0, total = 0;
	for (let i = 0; i < this.terrPassable.length; ++i)
	{
		if (!this.terrPassable[i])
			continue;
		total++;
		const v = terr.data[i];
		if ((v & 0x1F) === this.player && (v & 0x20))
			own++;
	}
	return { "own": own, "total": total, "pct": total ? Math.floor(100 * own / total) : 0 };
};
