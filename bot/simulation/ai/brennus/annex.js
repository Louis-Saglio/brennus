import { SquareDistance } from "simulation/ai/brennus/helpers.js";

/**
 * AnnexManager — the town-phase second civic centre: a continuation of the
 * home town, not a new settlement. The base runs out of building land
 * around minute 15 (lots full, houses spilling, the market and arsenal
 * waiting for a relief CC that only came at 16-26 min), so as soon as the
 * town phase is in and the early-muster barracks are placed, a second CC
 * goes up at the minimum legal distance from home (BuildRestrictions: 200 m
 * between civic centres) on a node of the home town-plan lattice: the two
 * 140 m territory bubbles overlap into one town and the streets continue.
 *
 * Where, among the lattice nodes 204-240 m from home (own or neutral land,
 * home land region, buildable):
 *  - new land: passable 8 m territory tiles within annexReach of the spot
 *    that are not ours yet — the open side of the base, not the map edge
 *    or a lake we are already backed against;
 *  - forward: toward the map centre (and Petra), to take the land she would
 *    expand into — only while the area is quiet (no enemy soldiers seen
 *    near it in the last 3 min, no enemy building within 250 m);
 *  - contested ground (soldiers seen there, or an enemy building near)
 *    is penalized — the flank wins when the middle is dangerous — and
 *    ground under heavy traffic is skipped;
 *  - resources: mines and wood the new territory brings within reach.
 * No towers: the annex is a land grab next to home, inside the army's
 * defensive reach, and a tower is 200 resources the boom needs more.
 *
 * Funding: stone and metal are reserved from the stage after the phase-up
 * (they are idle before the city phase), wood only once stone and metal
 * are in — the boom's wood is what the town phase lives on.
 */
export function AnnexManager(bot)
{
	this.bot = bot;
	// {x, z, turn} of the order, the attempt count, the done latch.
	this.state = { "attempts": 0, "done": false, "order": undefined, "id": undefined };
	// Transient: candidate cache and enemy-soldier sightings [x, z, turn].
	this.cache = undefined;
	this.sightings = [];
	this.lastSighting = undefined;
	this.waitLog = undefined;
}

AnnexManager.prototype.serialize = function()
{
	return this.state;
};

AnnexManager.prototype.deserialize = function(data)
{
	if (data)
		this.state = data;
};

/** Lattice nodes are searched in this distance band from home (m): the 200 m CC spacing rule plus slack for float rounding. */
AnnexManager.prototype.minDist = 204;
AnnexManager.prototype.maxDist = 240;
/** Radius (m) of the land the annex is credited with: its own territory where the home bubble does not already reach. */
AnnexManager.prototype.annexReach = 120;
/** Early-muster barracks that must be placed before the annex competes for wood. */
AnnexManager.prototype.barracksFirst = 3;
/** Attempts (orders) before giving up: a CC that keeps dying is a war, not a land grab. */
AnnexManager.prototype.maxAttempts = 3;

/** Whether `ent` (a CC) is the annex — the expansion-CC tower rule skips it. */
AnnexManager.prototype.isAnnex = function(ent)
{
	return this.state.id !== undefined && ent.id() === this.state.id;
};

/**
 * Off until the defense stops treating the annex like the home CC: in the
 * first 36-seed batch it lured the army 300 m out to garrison it while
 * Petra's first wave sacked the home economy (s54, s61 losses).
 */
AnnexManager.prototype.enabled = false;

/** Arbiter stage (right after the phase-up): fund and order the annex CC. */
AnnexManager.prototype.update = function()
{
	if (!this.enabled)
		return;
	const bot = this.bot;
	const gameState = bot.gameState;
	this.recordSightings();
	if (this.state.done || !gameState.isResearched("phase_town_generic"))
		return;
	const home = bot.getCivicCentre();
	if (!home)
		return;
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");

	// Done once a second own CC stands; waiting while one is being built
	// (ours or a relief one — either way the town has its second CC).
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === ccType && ent.id() !== home.id() && ent.position())
		{
			if (this.state.order && Math.hypot(ent.position()[0] - this.state.order.x, ent.position()[1] - this.state.order.z) < 8)
				this.state.id = ent.id();
			this.state.done = true;
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m annex: second CC stands at ${ent.position()[0].toFixed(0)},${ent.position()[1].toFixed(0)}${this.state.id === ent.id() ? "" : " (not the annex order)"}\n`);
			return;
		}
	for (const f of gameState.getOwnFoundations().values())
		if (f.position() && gameState.getBuiltTemplate(f.templateName()).hasClass("CivCentre"))
			return;
	if (bot.constructionManager.pendingBuilds.some(pb => pb.template === ccType))
		return;
	if (this.state.attempts >= this.maxAttempts)
	{
		this.state.done = true;
		print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m annex: giving up after ${this.state.attempts} orders\n`);
		return;
	}
	// A dead order waits 3 min before the next attempt.
	if (this.state.order && bot.turn - this.state.order.turn < 900)
		return;

	// Gates: the early-muster barracks first, and never while a serious
	// threat stands at a CC (the party would walk into it).
	const barracksType = gameState.applyCiv("structures/{civ}/barracks");
	let barracks = 0;
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === barracksType)
			barracks++;
	for (const f of gameState.getOwnFoundations().values())
		if (gameState.getBuiltTemplate(f.templateName()).templateName() === barracksType)
			barracks++;
	if (barracks < this.barracksFirst)
		return;
	if (bot.turn - (bot.defenseManager.lastSeriousTurn || -Infinity) < 300)
		return;

	const pick = this.pickSpot(home.position());
	if (!pick)
	{
		if (this.waitLog === undefined || bot.turn - this.waitLog >= 600)
		{
			this.waitLog = bot.turn;
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m annex: no buildable lattice node ${this.minDist}-${this.maxDist} m from home\n`);
		}
		return;
	}

	const cost = gameState.getTemplate(ccType).cost();
	const full = { "food": cost.food || 0, "wood": cost.wood || 0, "stone": cost.stone || 0, "metal": cost.metal || 0 };
	const books = bot.arbiter.books("annex");
	if (!bot.arbiter.check(books, "annex", full, "annex CC"))
	{
		const oresIn = books.stone >= full.stone && books.metal >= full.metal;
		bot.arbiter.reserve("annex", { "stone": full.stone, "metal": full.metal, "wood": oresIn ? full.wood : 0 });
		return;
	}
	if (!bot.placementManager.placeOrder(ccType, pick.pos))
		return;
	const party = gameState.getOwnUnits()
		.filter(ent => ent.isGatherer() && ent.position() &&
			!bot.armyManager.army[ent.id()] && ent.id() !== bot.economyManager.herderId &&
			!bot.raidManager?.isRaider(ent.id()))
		.filterNearest(pick.pos, 6).toEntityArray();
	for (const ent of party)
		ent.construct(ccType, pick.pos[0], pick.pos[1], bot.placementManager.getPlacementAngle(), undefined);
	bot.arbiter.spend(books, "annex", full, "annex CC");
	bot.arbiter.hold("construction");
	this.state.attempts++;
	this.state.order = { "x": pick.pos[0], "z": pick.pos[1], "turn": bot.turn };
	if (bot.expansionManager.expansionRegion === undefined)
		bot.expansionManager.expansionRegion = bot.accessibility.getAccessValue(home.position());
	print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m annex CC order at ${pick.pos[0].toFixed(0)},${pick.pos[1].toFixed(0)} ` +
		`(${pick.kind}: newLand ${pick.newLand} tiles, forward ${pick.forward.toFixed(2)}, res ${pick.res.toFixed(2)}, ` +
		`soldiers seen ${pick.danger}, enemy buildings ${pick.enemyBld}; ${pick.n} candidates; attempt ${this.state.attempts})\n`);
};

/** Enemy soldiers seen, sampled every 50 turns and kept 3 min: where the fighting has been is where the annex should not go. */
AnnexManager.prototype.recordSightings = function()
{
	const bot = this.bot;
	if (this.lastSighting !== undefined && bot.turn - this.lastSighting < 50)
		return;
	this.lastSighting = bot.turn;
	this.sightings = this.sightings.filter(s => bot.turn - s[2] < 900);
	if (this.state.done)
		return;
	for (const ent of bot.gameState.getEnemyEntities().values())
	{
		if (ent.owner() === 0 || !ent.position() || !(ent.hasClass("Soldier") || ent.hasClass("Siege")))
			continue;
		const p = ent.position();
		this.sightings.push([p[0], p[1], bot.turn]);
	}
	if (this.sightings.length > 3000)
		this.sightings = this.sightings.slice(-3000);
};

/** The best annex spot, cached 150 turns: { pos, kind, newLand, forward, res, danger, enemyBld, n }. */
AnnexManager.prototype.pickSpot = function(homePos)
{
	const bot = this.bot;
	if (this.cache && bot.turn - this.cache.turn < 150)
		return this.cache.pick;
	const gameState = bot.gameState;
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const template = gameState.getTemplate(ccType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const region = bot.accessibility.getAccessValue(homePos);
	const pass = gameState.getPassabilityMap();
	const tmask = gameState.getPassabilityClassMask("default-terrain-only");
	const terr = bot.territoryMap;
	const mapSize = terr.width * terr.cellSize;
	const centre = [mapSize / 2, mapSize / 2];

	const allCC = [];
	for (const ent of gameState.getStructures().values())
		if (ent.hasClass("CivCentre") && ent.position())
			allCC.push(ent.position());
	const enemyBld = [];
	for (const ent of gameState.getEnemyStructures().values())
		if (ent.owner() !== 0 && ent.position())
			enemyBld.push(ent.position());
	const mines = [];
	for (const res of ["stone", "metal"])
		for (const s of gameState.getResourceSupplies(res).values())
			if (s.position())
				mines.push([s.position(), s.resourceSupplyAmount() || 0]);
	const woods = [];
	for (const s of gameState.getResourceSupplies("wood").values())
		if (s.position())
			woods.push([s.position(), s.resourceSupplyAmount() || 0]);

	// New land: passable tiles within annexReach of the spot that are not
	// ours and lie beyond the home territory bubble's reach.
	const tc = terr.cellSize, pc = pass.cellSize;
	const newLand = pos => {
		let n = 0;
		const r = this.annexReach;
		const i0 = Math.max(0, Math.floor((pos[0] - r) / tc)), i1 = Math.min(terr.width - 1, Math.floor((pos[0] + r) / tc));
		const j0 = Math.max(0, Math.floor((pos[1] - r) / tc)), j1 = Math.min(terr.height - 1, Math.floor((pos[1] + r) / tc));
		for (let j = j0; j <= j1; ++j)
			for (let i = i0; i <= i1; ++i)
			{
				const x = (i + 0.5) * tc, z = (j + 0.5) * tc;
				if ((x - pos[0]) * (x - pos[0]) + (z - pos[1]) * (z - pos[1]) > r * r)
					continue;
				if ((terr.data[i + j * terr.width] & 0x1F) !== 0)
					continue;
				const pi = Math.floor(x / pc), pj = Math.floor(z / pc);
				if (pass.data[pi + pj * pass.width] & tmask)
					continue;
				n++;
			}
		return n;
	};

	const nodes = bot.placementManager.latticeNodesNear(homePos, this.maxDist) || [];
	const scored = [];
	for (const pos of nodes)
	{
		const d = Math.hypot(pos[0] - homePos[0], pos[1] - homePos[1]);
		if (d < this.minDist)
			continue;
		if (allCC.some(c => SquareDistance(c, pos) < this.minDist * this.minDist))
			continue;
		if (bot.placementManager.failedSpots.some(f => Math.abs(f[0] - pos[0]) < 6 && Math.abs(f[1] - pos[1]) < 6))
			continue;
		if (bot.accessibility.getAccessValue(pos) !== region)
			continue;
		if (bot.armyManager.nearEnemy(pos, 100, 60))
			continue;
		if (!bot.expansionManager.expansionSpotOK(pos, halfW, halfD))
			continue;
		let danger = 0;
		for (const s of this.sightings)
			if (SquareDistance(s, pos) < 180 * 180)
				danger++;
		let enemyNear = 0, enemyFar = 0;
		for (const b of enemyBld)
		{
			const dd = SquareDistance(b, pos);
			if (dd < 160 * 160)
				enemyNear++;
			if (dd < 250 * 250)
				enemyFar++;
		}
		// Sightings are samples (every 50 turns over 3 min = up to 18 per
		// soldier): heavy traffic is a battlefield, skip it.
		if (danger >= 60)
			continue;
		const land = newLand(pos);
		const forward = (Math.hypot(homePos[0] - centre[0], homePos[1] - centre[1]) -
			Math.hypot(pos[0] - centre[0], pos[1] - centre[1])) / this.minDist;
		const quiet = danger === 0 && enemyFar === 0;
		let ores = 0, wood = 0;
		for (const [p, amt] of mines)
			if (SquareDistance(p, pos) < 100 * 100 && SquareDistance(p, homePos) > 130 * 130)
				ores += amt;
		for (const [p, amt] of woods)
			if (SquareDistance(p, pos) < 100 * 100 && SquareDistance(p, homePos) > 130 * 130)
				wood += amt;
		const res = Math.min(1, ores / 6000) + Math.min(1, wood / 15000);
		const contested = danger > 0 || enemyNear > 0;
		const score = land + (quiet ? 60 * forward : 0) + 40 * res -
			(contested ? 80 + 2 * danger + 60 * enemyNear : 0);
		scored.push({ "pos": pos, "score": score, "newLand": land, "forward": forward, "res": res,
			"danger": danger, "enemyBld": enemyNear,
			"kind": contested ? "contested" : quiet && forward > 0.3 ? "forward" : "flank" });
	}
	scored.sort((a, b) => b.score - a.score);
	const pick = scored[0];
	if (pick)
		pick.n = scored.length;
	this.cache = { "turn": bot.turn, "pick": pick };
	return pick;
};
