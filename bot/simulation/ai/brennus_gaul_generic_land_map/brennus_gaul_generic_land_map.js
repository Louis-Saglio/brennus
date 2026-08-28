/**
 * Brennus: AI bot for 0 A.D. — goal 10: copy of the goal-9 bot, now facing
 * a real opponent (Petra, medium difficulty, aggressive behaviour) on
 * generic land maps. Survive the early pressure, boom, then convert the
 * economy into an army that eliminates Petra (all enemy civic centers) in
 * under 45 in-game minutes. The `[HARNESS] brennus: loaded` banner is the
 * headless smoke test's canary.
 */
import { BaseAI } from "simulation/ai/common-api/baseAI.js";

export function BrennusBot(settings)
{
	BaseAI.call(this, settings);
}

BrennusBot.prototype = Object.create(BaseAI.prototype);

BrennusBot.prototype.gathererShares = {
	1: { "food": 0.55, "wood": 0.45, "stone": 0.0, "metal": 0.0 },
	2: { "food": 0.47, "wood": 0.53, "stone": 0.0, "metal": 0.0 },
	3: { "food": 0.62, "wood": 0.36, "stone": 0.01, "metal": 0.01 }
};

BrennusBot.prototype.currentShares = function(total)
{
	const phase = this.gameState.currentPhase();

	if (this.expansionOn() && phase === 3)
		return this.expansionShares(total);
	let base = this.gathererShares[phase] || this.gathererShares[1];
	if (phase === 2)
	{
		const trioDone = this.trioTypes()
			.every(t => this.gameState.getOwnStructures().toEntityArray()
				.some(ent => ent.templateName() === t));
		if (trioDone)
			base = { "food": 0.66, "wood": 0.34, "stone": 0.0, "metal": 0.0 };
		const shares = { ...base };
		if (total)
		{
			const res = this.arbiter.books("shares");

			const bankingDone = this.gameState.isResearching("phase_city_generic");

			const early = this.gameState.getTimeElapsed() < 480000;
			const timeLeft = Math.max(60, (810000 - this.gameState.getTimeElapsed()) / 1000);

			let grainMetal = 0;
			for (const tech of ["gather_farming_plows", "gather_farming_training", "gather_farming_harvester"])
				if (!this.gameState.isResearched(tech) && !this.gameState.isResearching(tech))
					grainMetal += this.gameState.getTemplate(tech).cost().metal || 0;
			const target = { "stone": 850, "metal": 850 + grainMetal };
			let mining = 0;
			for (const res2 of ["stone", "metal"])
			{
				const needed = bankingDone || early ? 0 : target[res2] - res[res2];

				shares[res2] = needed > 0 ?
					Math.min(0.18, needed / (0.35 * timeLeft) / total) : 0;
				mining += shares[res2];
			}
			const scale = Math.max(0, 1 - mining) / (base.food + base.wood);
			shares.food = base.food * scale;
			shares.wood = base.wood * scale;
		}
		return shares;
	}
	// War-stage phase 3 (city researched, expansion not yet on): keep real
	// mining shares. Phase-3 base shares are 1% stone/metal — agg8 s2 banked
	// 40 metal for 11 minutes after city and the first ram trained at 31.4m,
	// 11 min after the arsenals were ordered. Rams, forge techs and towers
	// all eat metal/stone continuously; mine until a war chest is banked.
	if (phase === 3 && this.warOn())
	{
		const res = this.arbiter.books("shares");
		const shares = { ...base };
		let mining = 0;
		if (res.stone < 400)
		{
			shares.stone = 0.06;
			mining += 0.06;
		}
		if (res.metal < 800)
		{
			shares.metal = 0.12;
			mining += 0.12;
		}
		const scale = Math.max(0, 1 - mining) / (base.food + base.wood);
		shares.food = base.food * scale;
		shares.wood = base.wood * scale;
		return shares;
	}
	return { ...base };
};

BrennusBot.prototype.houseTrainingTech = "unlock_civilians_house_generic";

/** Boom techs in priority order; wood/stone/metal costs only (food goes to the woman stream). */
BrennusBot.prototype.boomTechs = [

	"gather_wicker_baskets",

	"gather_farming_plows",

	"gather_farming_training",

	"gather_farming_harvester",

	"gather_lumbering_ironaxes",

	"pop_house_01",

	"gather_capacity_basket",

	"gather_lumbering_strongeraxes",

	"pop_house_02",

	"gather_farming_fertilizer"
];

BrennusBot.prototype.phaseUpCost = {
	"phase_town_generic": { "food": 500, "wood": 500 },
	"phase_city_generic": { "stone": 750, "metal": 750 }
};

BrennusBot.prototype.houseMargin = 16;

BrennusBot.prototype.maxHouseFoundations = 4;

/** Furthest animal the herder targets from the CC (m). */
BrennusBot.prototype.herdMax = 200;

/** Skittish animals beyond this distance (m) are killed in place instead of herded. */
BrennusBot.prototype.herdCutoff = 200;

BrennusBot.prototype.herdPrefer = false;

/** Distance (m) from the pinned food dropsite at which a steered animal is killed. */
BrennusBot.prototype.herdKillDist = 25;

/** Wood a dropsite's ring must still serve before a new wood storehouse is allowed (rule 1). */
BrennusBot.prototype.ringGateWood = 250;

/** Distance (m) a dropsite serves wood within. */
BrennusBot.prototype.ringServeDist = 40;

/** Pinned stone and metal mines closer than this (m) share ONE storehouse. */
BrennusBot.prototype.minePairDist = 55;

/**
 * Resource arbiter: the single choke point for resource reads and spends.
 *
 * The engine mirrors player resources once per AI turn, so every
 * gameState.getResources() call inside a block returns the same numbers and
 * subtract() only ever edited that call's own copy — managers each spent
 * against private copies of the same pot, and priority emerged from the
 * OnUpdate call order plus ad-hoc flags (phaseReserve, banking,
 * constructionHold, fertPending...). The arbiter keeps those exact
 * semantics — books() hands out the same fresh per-call-site copies — but
 * routes every read and spend through one place that journals each grant
 * and denial. Behavior-preserving by construction: the golden timelines
 * (tools/golden/) must stay bit-identical.
 *
 * The journal is in-memory only: printing it would change the tagged
 * timeline (and hot-path prints measurably slow the sim). It exists to
 * audit a golden diff: journal holds the current turn's records, totals the
 * per-tag cumulative grant/deny counts.
 */
function ResourceArbiter(bot)
{
	this.bot = bot;
	this.reserves = {};      // name -> {resource: amount}; reset every block
	this.holds = {};         // name -> true; reset every block
	this.declarations = {};  // name -> payload; sticky until re-declared (mirrors the old instance-flag lifetimes)
	this.journal = [];
	this.journalTurn = -1;
	this.totals = {};
}

ResourceArbiter.prototype.resetBlock = function()
{
	this.reserves = {};
	this.holds = {};
};

/** A fresh copy of the frozen per-turn resource mirror: the same object gameState.getResources() returns. */
ResourceArbiter.prototype.books = function(tag)
{
	if (this.journalTurn !== this.bot.turn)
	{
		this.journalTurn = this.bot.turn;
		this.journal = [];
	}
	return this.bot.gameState.getResources();
};

ResourceArbiter.prototype.record = function(tag, what, cost, granted)
{
	this.journal.push({ "tag": tag, "what": what, "cost": cost, "granted": granted });
	const t = this.totals[tag] || (this.totals[tag] = { "grant": 0, "deny": 0 });
	t[granted ? "grant" : "deny"]++;
};

/** Spend from a books object (the old subtract) + journal the grant. */
ResourceArbiter.prototype.spend = function(books, tag, cost, what)
{
	books.subtract(cost);
	this.record(tag, what, cost, true);
};

/** Affordability gate + journaled denial. */
ResourceArbiter.prototype.check = function(books, tag, cost, what)
{
	const ok = books.canAfford(cost);
	this.record(tag, what, cost, ok);
	return ok;
};

/** Reserves: amounts later spenders must leave untouched. */
ResourceArbiter.prototype.reserve = function(name, amounts)
{
	this.reserves[name] = amounts;
};

ResourceArbiter.prototype.reserved = function(resource)
{
	let sum = 0;
	for (const r of Object.values(this.reserves))
		sum += r[resource] || 0;
	return sum;
};

/** All four reserved amounts as a cost-shaped object (the old phaseReserve reads). */
ResourceArbiter.prototype.reservedAll = function()
{
	return { "food": this.reserved("food"), "wood": this.reserved("wood"),
		"stone": this.reserved("stone"), "metal": this.reserved("metal") };
};

/** Holds: named per-block latches (e.g. construction paused after a research order). */
ResourceArbiter.prototype.hold = function(name)
{
	this.holds[name] = true;
	this.record("hold", name, null, true);
};

ResourceArbiter.prototype.held = function(name)
{
	return !!this.holds[name];
};

/** Declarations: sticky coordination state (demands, gaps) with the same lifetime as the instance flags they replace. */
ResourceArbiter.prototype.declare = function(name, payload)
{
	this.declarations[name] = payload;
};

ResourceArbiter.prototype.declared = function(name)
{
	return this.declarations[name];
};

ResourceArbiter.prototype.declaredAmount = function(name, resource)
{
	const p = this.declarations[name];
	return p ? p[resource] || 0 : 0;
};

/**
 * The spending pipeline, in priority order. Each stage gets fresh books on
 * the same frozen per-turn mirror and may declare reserves/holds/demands
 * that bind the later stages. Defense runs BEFORE the economy spenders
 * (research, women stream, construction): the early muster must draw from
 * the resource flow, not from stockpiles the boom never leaves behind
 * (agg1: floors of 250/250 never fired pre-boom — the boom spent everything
 * first — and the army stayed at 4 while Petra's 90-unit wave arrived).
 */
ResourceArbiter.prototype.spenders = [
	["defense", "manageDefense"],
	["phaseUp", "managePhaseUp"],
	["research", "manageResearch"],
	["workers", "trainWorkers"],
	["construction", "manageConstruction"],
	["barter", "manageBarter"],
	["expansion", "manageExpansion"],
	["trade", "manageTrade"]
];

ResourceArbiter.prototype.runSpenders = function()
{
	for (const [stage, fn] of this.spenders)
		this.bot[fn]();
};

BrennusBot.prototype.CustomInit = function(gameState)
{
	print(`[HARNESS] brennus: loaded for player ${this.player}\n`);

	this.arbiter = new ResourceArbiter(this);

	this.ccAngle = undefined;

	this.assignments = this.savedState?.assignments || {}; // entityID -> resource

	this.builderAssignments = this.savedState?.builderAssignments || {};

	this.pendingBuilds = this.savedState?.pendingBuilds || []; // [{template, x, z, turn}]

	this.rushBuilds = this.savedState?.rushBuilds || []; // [{x, z, turn}] woodline storehouses whose builders come from the choppers

	this.failedSpots = this.savedState?.failedSpots || [];

	this.carry = this.savedState?.carry || {};

	this.gatherTarget = this.savedState?.gatherTarget || {};

	this.lastDelivery = this.savedState?.lastDelivery || {};

	this.rateStats = this.savedState?.rateStats ||
		{ "wood": { "amount": 0, "theo": 0 }, "grain": { "amount": 0, "theo": 0 },
		  "fruit": { "amount": 0, "theo": 0 }, "meat": { "amount": 0, "theo": 0 },
		  "stone": { "amount": 0, "theo": 0 }, "metal": { "amount": 0, "theo": 0 } };

	this.herderId = this.savedState?.herderId;
	this.herdTarget = this.savedState?.herdTarget;
	this.herdingDone = this.savedState?.herdingDone || false;
	this.herdCmdTurn = 0;
	this.herdStartTurn = 0;
	this.herdStartDist = Infinity;
	this.herdBestDist = Infinity;
	this.herdWoundTurn = this.savedState?.herdWoundTurn || 0;
	this.herdFast = this.savedState?.herdFast || false;
	this.herdKill = this.savedState?.herdKill || false;
	this.herdLastPos = this.savedState?.herdLastPos;

	// Pinned food dropsite the steer pushes toward (an unpinned target zigzags between dropsites).
	this.herdDrop = this.savedState?.herdDrop;
	this.herdWoundDist = this.savedState?.herdWoundDist || Infinity;

	this.fruitStock = 0;

	this.mineId = this.savedState?.mineId || {}; // resource -> pinned mine (miners concentrate until full)

	this.expPlan = this.savedState?.expPlan || null; // {spots, next, done, simPct}

	this.expOn = this.savedState?.expOn || false;

	// Defense (goal 9): standing army roster (entityID -> 1), command throttle, shelter memory.
	this.army = this.savedState?.army || {};
	this.rams = this.savedState?.rams || {};
	this.healers = this.savedState?.healers || {};
	this.armyCmdTurn = 0;
	this.shelterDanger = {};
	this.spearNext = true;

};

BrennusBot.prototype.OnUpdate = function()
{
	if (this.gameState.playerData.state !== "active")
		return;

	if (this.turn % 5 === 0)
	{
		this.updateEnemyPositions();

		// Failed build spots expire after 1500 turns (5 min): most failures are
		// war damage (a raided storehouse, a razed CC foundation), and the spot
		// is fine once the frontier moves — permanent poisoning starved the
		// expansion plan (def14: 7-20 dead spots).
		this.failedSpots = this.failedSpots.filter(f => this.turn - (f[2] || 0) < 1500);

		// A research or defense-building order holds construction for the rest of the block: research + construct in the same block would overdraw the pre-command resource snapshot.
		this.arbiter.resetBlock();
		this.updateWoodline();
		this.assignGatherers();
		this.manageHerding();
		this.sampleGatherRates();
		this.arbiter.runSpenders();
	}
	const phase = this.gameState.currentPhase();
	if (phase !== this.lastPhase)
	{
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m phase=${this.gameState.getPhaseName(phase)}\n`);
		this.lastPhase = phase;
	}

	if (!this.pop300Logged && this.gameState.getPopulation() >= 300)
	{
		this.pop300Logged = true;
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m population=300\n`);
	}
	if (this.turn % 750 === 0)
		this.logStatus();
	this.turn++;
};

// ---------------------------------------------------------------- gathering
BrennusBot.prototype.assignGatherers = function()
{
	const counts = { "food": 0, "wood": 0, "stone": 0, "metal": 0 };
	const idle = [];

	// The city bank is spent once the research starts: release all miners once so the shares reassign them.
	if (!this.minersFreed && (this.gameState.isResearching("phase_city_generic") ||
		this.gameState.isResearched("phase_city_generic")))
	{
		this.minersFreed = true;
		for (const ent of this.gameState.getOwnUnits().values())
			if ((this.assignments[ent.id()] === "stone" || this.assignments[ent.id()] === "metal") &&
				ent.isGatherer() && !ent.isIdle() && ent.position())
				ent.stopMoving();
	}

	{
		// The engine's gather autocontinue drifts pickers to far unserved supplies: stop empty-handed fruit/meat gatherers working > 45 m from every food dropsite.
		const sites = this.foodDropsitePositions();
		for (const ent of this.gameState.getOwnUnits().values())
		{
			if (this.assignments[ent.id()] !== "food" || !ent.isGatherer() ||
				ent.isIdle() || !ent.position())
				continue;

			if (ent.id() === this.herderId && !this.herdingDone)
				continue;
			if (ent.unitAIState()?.split(".")[1] !== "GATHER")
				continue;
			if ((ent.resourceCarrying() || []).some(c => c.amount > 0))
				continue;
			const tgt = this.gatherTarget[ent.id()];
			if (tgt?.generic !== "food" ||
				(tgt?.specific !== "fruit" && tgt?.specific !== "meat"))
				continue;
			const anchor = this.gameState.getEntityById(tgt.supplyId)?.position() || ent.position();
			if (!sites.some(d => SquareDistance(anchor, d) < 45 * 45))
				ent.stopMoving();
		}
	}

	for (const ent of this.gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || !ent.position() || this.army[ent.id()])
			continue;

		if (ent.id() === this.herderId && !this.herdingDone)
			continue;
		if (ent.isIdle())
		{
			delete this.assignments[ent.id()];
			idle.push(ent);
		}
		else if (this.assignments[ent.id()])
			counts[this.assignments[ent.id()]]++;
	}
	if (!idle.length)
		return;

	const total = idle.length + counts.food + counts.wood + counts.stone + counts.metal;
	const shares = this.currentShares(total);
	this.starvedUnits = 0;
	for (const ent of idle)
	{

		const order = ["food", "wood", "stone", "metal"]
			.filter(res => ent.canGather(res))
			.sort((a, b) =>
				(shares[b] * total - counts[b]) -
				(shares[a] * total - counts[a]));
		let assigned = false;
		for (const resource of order)
		{
			const supply = this.findSupply(ent, resource);
			if (!supply)
				continue;
			if (resource === "food" && supply.isHuntable() && supply.get("Health"))
			{

				const sp = supply.position();
				const drop = this.nearestFoodDropsite(sp);
				const dx = sp[0] - drop[0], dz = sp[1] - drop[1];
				const n = Math.hypot(dx, dz) || 1;
				// Approach a huntable from the far side so it flees toward the base.
				ent.move(sp[0] + dx / n * 10, sp[1] + dz / n * 10);
				ent.gather(supply, true);
			}
			else
				ent.gather(supply);
			this.assignments[ent.id()] = resource;
			counts[resource]++;
			assigned = true;
			break;
		}
		if (!assigned)
			this.starvedUnits++;
	}
};

BrennusBot.prototype.findSupply = function(unit, resource)
{
	const pos = unit.position();
	const region = this.accessibility.getAccessValue(pos);

	// Wood: the zone tree minimizing the full walk cycle (unit -> tree + tree -> nearest dropsite).
	if (resource === "wood" && this.woodline)
	{
		const drops = this.woodDropsitePositions();
		let best, bestD = Infinity;
		for (const id of this.woodline.ids)
		{
			const supply = this.gameState.getEntityById(id);
			const supplyPos = supply?.position();
			if (!supplyPos || this.accessibility.getAccessValue(supplyPos) !== region)
				continue;
			if (!supply.resourceSupplyAmount() || supply.isFull())
				continue;
			if (!this.canGatherSupply(unit, supply))
				continue;
			let dd = Infinity;
			for (const dp of drops)
			{
				const d2 = SquareDistance(supplyPos, dp);
				if (d2 < dd)
					dd = d2;
			}
			const d = Math.hypot(pos[0] - supplyPos[0], pos[1] - supplyPos[1]) + Math.sqrt(dd);
			if (d < bestD)
			{
				bestD = d;
				best = supply;
			}
		}
		if (best)
			return best;
	}

	// Food: served fruit and dead in-territory animals are one pool; fields fall through to the generic path below.
	if (resource === "food")
	{
		const dropsites = this.foodDropsitePositions();
		let best, bestD = Infinity;
		for (const s of this.gameState.getResourceSupplies("food").values())
		{
			const supplyPos = s.position();
			if (!supplyPos || this.accessibility.getAccessValue(supplyPos) !== region)
				continue;
			const specific = s.resourceSupplyType()?.specific;
			if (specific !== "fruit" &&
				!(specific === "meat" && !s.get("Health") &&
					this.inOwnTerritory(supplyPos[0], supplyPos[1]) &&
					!(s.id() === this.herdTarget && !this.herdingDone)))
				continue;
			if (this.nearEnemy(supplyPos, 100, 60))
				continue;
			if (!s.resourceSupplyAmount() || s.isFull())
				continue;
			if (!this.canGatherSupply(unit, s))
				continue;
			if (!dropsites.some(d => SquareDistance(supplyPos, d) < 40 * 40))
				continue;
			const d = SquareDistance(pos, supplyPos);
			if (d < bestD)
			{
				bestD = d;
				best = s;
			}
		}
		if (best)
			return best;
	}

	if ((resource === "stone" || resource === "metal") && this.mineId[resource] !== undefined)
	{
		const mine = this.gameState.getEntityById(this.mineId[resource]);
		const minePos = mine?.position();
		if (minePos && mine.resourceSupplyAmount() && !mine.isFull() &&
			this.accessibility.getAccessValue(minePos) === region &&
			!this.nearEnemy(minePos, 100, 60) &&
			this.canGatherSupply(unit, mine))
			return mine;
	}

	let candidates = this.gameState.getResourceSupplies(resource).filterNearest(pos, 10).toEntityArray();
	if (resource === "food")

		candidates = candidates.concat(this.gameState.getHuntableSupplies().filterNearest(pos, 10).toEntityArray());
	const foodSites = resource === "food" ? this.foodDropsitePositions() : null;

	for (const supply of candidates)
	{
		const supplyPos = supply.position();
		if (!supplyPos || this.accessibility.getAccessValue(supplyPos) !== region)
			continue;
		if (this.nearEnemy(supplyPos, 100, 60))
			continue;
		if (!supply.resourceSupplyAmount() || supply.isFull())
			continue;
		if (!this.canGatherSupply(unit, supply))
			continue;

		if (foodSites &&
			(supply.resourceSupplyType()?.specific === "fruit" ||
				supply.resourceSupplyType()?.specific === "meat") &&
			!foodSites.some(d => SquareDistance(supplyPos, d) < 45 * 45))
			continue;

		if ((resource === "stone" || resource === "metal") && this.expansionOn() &&
			this.servedMineIds && !this.servedMineIds.has(supply.id()))
			continue;

		// Civilians never leave the territory for meat.
		if (resource === "food" && supply.isHuntable() && !unit.hasClass("Cavalry") &&
			!this.inOwnTerritory(supplyPos[0], supplyPos[1]))
			continue;
		return supply;
	}
	return undefined;
};

BrennusBot.prototype.woodDropsitePositions = function()
{
	const gameState = this.gameState;
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	const sites = [];
	for (const ent of gameState.getOwnStructures().values())
		if (ent.position() && (ent.templateName() === storeType || ent.hasClass("CivCentre")))
			sites.push(ent.position());
	return sites;
};

BrennusBot.prototype.foodDropsitePositions = function()
{
	const gameState = this.gameState;
	const farmType = gameState.applyCiv("structures/{civ}/farmstead");
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const sites = [];
	for (const ent of gameState.getOwnStructures().values())
		if (ent.position() && (ent.hasClass("Farmstead") || ent.hasClass("CivCentre")))
			sites.push(ent.position());
	for (const f of gameState.getOwnFoundations().values())
	{
		if (!f.position())
			continue;
		const built = gameState.getBuiltTemplate(f.templateName()).templateName();
		if (built === farmType || built === ccType)
			sites.push(f.position());
	}
	return sites;
};

BrennusBot.prototype.nearestFoodDropsite = function(pos)
{
	let best = pos, bestD = Infinity;
	for (const site of this.foodDropsitePositions())
	{
		const d = SquareDistance(pos, site);
		if (d < bestD)
		{
			bestD = d;
			best = site;
		}
	}
	return best;
};

/**
 * Herding: skittish animals are wound-then-steered — a wounded animal flees
 * away from its attacker until it reaches the flee distance fixed at wound
 * time; the cavalry shoots once from the far side, follows without attacking,
 * and kills near the pinned food dropsite. Other animals are killed in place.
 */
BrennusBot.prototype.manageHerding = function()
{
	const gameState = this.gameState;
	if (this.herdingDone)
		return;
	const cc = this.getCivicCentre();
	if (!cc)
		return;
	const ccPos = cc.position();
	const region = this.accessibility.getAccessValue(ccPos);
	let herder = this.herderId !== undefined ? gameState.getEntityById(this.herderId) : undefined;
	if (herder && (!herder.position() || !herder.isGatherer()))
		herder = undefined;
	if (!herder)
	{
		for (const ent of gameState.getOwnUnits().values())
			if (ent.position() && ent.isGatherer() && ent.hasClass("Cavalry"))
			{
				herder = ent;
				break;
			}
		this.herderId = herder?.id();
		if (herder)

			delete this.assignments[herder.id()];
		if (!herder)
		{
			this.herdingDone = true;
			return;
		}
	}
	let target = this.herdTarget !== undefined ? gameState.getEntityById(this.herdTarget) : undefined;
	if (target && (!target.position() || !target.isHuntable() || !target.resourceSupplyAmount()))
		target = undefined;
	// A dead animal becomes a NEW corpse entity: adopt the carcass by position (within 25 m).
	if (!target && this.herdTarget !== undefined && this.herdLastPos)
	{

		let best, bestD = Infinity;
		for (const s of gameState.getHuntableSupplies().values())
		{
			if (s.get("Health") || !s.resourceSupplyAmount() || s.isFull())
				continue;
			const sp = s.position();
			if (!sp || this.accessibility.getAccessValue(sp) !== region)
				continue;
			const d = SquareDistance(sp, this.herdLastPos);
			if (d < bestD)
			{
				bestD = d;
				best = s;
			}
		}
		if (best && bestD < 25 * 25)
		{
			target = best;
			this.herdTarget = target.id();
			const tp = target.position();
			const dr = this.nearestFoodDropsite(tp);
			print(`[HUNT] t=${(gameState.getTimeElapsed() / 60000).toFixed(2)}m adopted carcass ${target.templateName()} at ${tp[0].toFixed(0)},${tp[1].toFixed(0)} mode=${this.herdKill ? "collect" : "herd"} dropDist=${Math.hypot(tp[0] - dr[0], tp[1] - dr[1]).toFixed(0)}\n`);
		}
	}
	if (target && !target.get("Health"))
	{
		if (!this.huntDbgLog)
		{
			this.huntDbgLog = true;
			const tp = target.position();
			const dr = this.nearestFoodDropsite(tp);
			print(`[HUNT] t=${(gameState.getTimeElapsed() / 60000).toFixed(2)}m carcass ${target.templateName()} at ${tp[0].toFixed(0)},${tp[1].toFixed(0)} mode=${this.herdKill ? "collect" : "herd"} inTerr=${this.inOwnTerritory(tp[0], tp[1])} dropDist=${Math.hypot(tp[0] - dr[0], tp[1] - dr[1]).toFixed(0)}\n`);
		}

		if (this.herdKill || !this.inOwnTerritory(target.position()[0], target.position()[1]))
		{
			if (this.turn >= this.herdCmdTurn)
			{
				this.herdCmdTurn = this.turn + 25;
				const st = herder.unitAIState() || "";
				if (st.indexOf("GATHER") === -1 && st.indexOf("RETURNRESOURCE") === -1)
					herder.gather(target);
			}
			return;
		}
		target = undefined;
	}
	if (!target)
	{

		const nearest = (herdableOnly, inBand) => {
			let best, bestD = Infinity;
			for (const s of gameState.getHuntableSupplies().values())
			{
				const pos = s.position();
				if (!pos || !s.get("Health") || !s.isHuntable())
					continue;
				if (this.accessibility.getAccessValue(pos) !== region || this.nearEnemy(pos, 100, 60))
					continue;
				const d = SquareDistance(pos, ccPos);
				if (d < 35 * 35 || (inBand && d > this.herdMax * this.herdMax) || d >= bestD)
					continue;
				const skittish = s.get("UnitAI/DefaultStance") === "skittish";
				if (herdableOnly &&
					!(skittish && d <= this.herdCutoff * this.herdCutoff))
					continue;
				bestD = d;
				best = s;
			}
			return best;
		};
		target = (this.herdPrefer ? nearest(true, true) : undefined) ||
			nearest(false, true) || nearest(false, false);
		this.herdTarget = target?.id();
		if (!target)
		{

			this.herdingDone = true;
			this.herderId = undefined;
			print(`[HERDDONE] t=${(gameState.getTimeElapsed() / 60000).toFixed(2)}m no targets left in region\n`);
			return;
		}
		this.herdCmdTurn = 0;
		this.herdStartTurn = this.turn;
		this.herdStartDist = Math.sqrt(SquareDistance(target.position(), ccPos));
		this.herdBestDist = this.herdStartDist;
		this.herdWoundTurn = 0;
		this.huntDbgLog = false;
		this.herdKillLog = false;
		this.herdDrop = undefined;
		this.herdWoundDist = Infinity;

		this.herdFast = target.get("UnitAI/DefaultStance") === "skittish";
		this.herdKill = !this.herdFast || this.herdStartDist > this.herdCutoff;
		this.herdLastPos = target.position();
		{
			const tp = target.position();
			print(`[HUNT] t=${(gameState.getTimeElapsed() / 60000).toFixed(2)}m target ${target.templateName()} ${this.herdKill ? "collect" : "herd"} at ${tp[0].toFixed(0)},${tp[1].toFixed(0)} dist=${this.herdStartDist.toFixed(0)}\n`);
		}
	}
	if (this.herdKill)
	{

		this.herdLastPos = target.position();
		if (this.turn >= this.herdCmdTurn)
		{
			this.herdCmdTurn = this.turn + 10;
			herder.attack(target.id(), false);
		}
		return;
	}

	const pos = target.position();
	this.herdLastPos = pos;
	const drop = this.herdDrop || this.nearestFoodDropsite(pos);
	const dist = Math.hypot(pos[0] - drop[0], pos[1] - drop[1]);
	this.herdBestDist = Math.min(this.herdBestDist, dist);
	if (target.isHurt() && !this.herdWoundTurn)
	{

		this.herdWoundTurn = this.turn;
		this.herdCmdTurn = 0;
		this.herdDrop = drop;
		this.herdWoundDist = dist;
		herder.stopMoving();
		print(`[HUNT] t=${(gameState.getTimeElapsed() / 60000).toFixed(2)}m wounded ${target.templateName()} at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} dropDist=${dist.toFixed(0)}\n`);
		return;
	}
	if (this.turn < this.herdCmdTurn)
		return;
	if (!target.isHurt())
	{

		this.herdCmdTurn = this.turn + 10;
		const dx = pos[0] - drop[0], dz = pos[1] - drop[1];
		const n = Math.hypot(dx, dz) || 1;
		const bx = pos[0] + dx / n * 6, bz = pos[1] + dz / n * 6;
		const hp = herder.position();
		const hd = Math.hypot(hp[0] - drop[0], hp[1] - drop[1]);
		if (hd < dist - 2 || Math.hypot(hp[0] - bx, hp[1] - bz) > 6)
			herder.move(bx, bz);
		else
			herder.attack(target.id(), false);
		return;
	}
	const fleeing = (target.unitAIState() || "").indexOf("FLEEING") !== -1;

	if (dist < this.herdKillDist ||
		(!fleeing && this.turn - this.herdWoundTurn > 10) ||
		(this.turn - this.herdStartTurn > 150 && dist > this.herdWoundDist + 5))
	{
		if (!this.herdKillLog)
		{
			this.herdKillLog = true;
			print(`[HUNT] t=${(gameState.getTimeElapsed() / 60000).toFixed(2)}m kill ${target.templateName()} at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} dropDist=${dist.toFixed(0)} inTerr=${this.inOwnTerritory(pos[0], pos[1])} fleeing=${fleeing}\n`);
		}
		this.herdCmdTurn = this.turn + 10;
		const hp = herder.position();

		const hd = Math.hypot(hp[0] - drop[0], hp[1] - drop[1]);
		if (hd < dist - 2)
		{
			const dx = pos[0] - drop[0], dz = pos[1] - drop[1];
			const n = Math.hypot(dx, dz) || 1;
			herder.move(pos[0] + dx / n * 6, pos[1] + dz / n * 6);
			return;
		}

		if (Math.hypot(hp[0] - pos[0], hp[1] - pos[1]) > 5 && !this.woodPoor)
		{
			const dx = pos[0] - drop[0], dz = pos[1] - drop[1];
			const n = Math.hypot(dx, dz) || 1;
			herder.move(pos[0] + dx / n * 2, pos[1] + dz / n * 2);
			return;
		}
		herder.attack(target.id(), false);
		return;
	}

	this.herdCmdTurn = this.turn + 10;
	const dx = pos[0] - drop[0], dz = pos[1] - drop[1];
	const n = Math.hypot(dx, dz) || 1;
	const bx = pos[0] + dx / n * 6, bz = pos[1] + dz / n * 6;
	const hp = herder.position();
	if (Math.hypot(hp[0] - bx, hp[1] - bz) > 5)
		herder.move(bx, bz);
	else
		herder.stopMoving();
};

BrennusBot.prototype.canGatherSupply = function(unit, supply)
{
	const rates = unit.get("ResourceGatherer/Rates");
	const type = supply.resourceSupplyType();
	if (!rates || !type)
		return false;
	return !!(+rates[type.generic + "." + type.specific] || +rates[type.generic]);
};

/**
 * The one woodline every chopper works: wood supplies binned into 30 m
 * cells, the richest 90 m neighbourhood is the hotspot, the zone is the
 * trees within 45 m of its centre. Re-picked below 800 wood (ring zones:
 * the ringGateWood floor).
 */
BrennusBot.prototype.updateWoodline = function()
{
	if (this.turn < (this.woodlineRefresh || 0))
		return;
	this.woodlineRefresh = this.turn + 25;

	{
		const cc = this.getCivicCentre();
		let stock = 0;
		if (cc)
		{
			const region = this.accessibility.getAccessValue(cc.position());
			const sites = this.foodDropsitePositions();
			for (const s of this.gameState.getResourceSupplies("food").values())
			{
				if (s.resourceSupplyType()?.specific !== "fruit")
					continue;
				const pos = s.position();
				if (pos && s.resourceSupplyAmount() > 30 &&
					this.accessibility.getAccessValue(pos) === region &&
					!this.nearEnemy(pos, 100, 60) &&
					sites.some(d => SquareDistance(pos, d) < 45 * 45))
					stock += s.resourceSupplyAmount();
			}
		}
		this.fruitStock = stock;
	}

	{
		const cc = this.getCivicCentre();
		if (cc)
		{
			const ccPos = cc.position();
			for (const resource of ["stone", "metal"])
			{
				const pinned = this.mineId[resource] !== undefined ?
					this.gameState.getEntityById(this.mineId[resource]) : undefined;
				const pinnedPos = pinned?.position();
				if (pinnedPos && pinned.resourceSupplyAmount() > 0 &&
					!this.nearEnemy(pinnedPos, 100, 60))
					continue;
				let best, bestD = Infinity;
				for (const s of this.gameState.getResourceSupplies(resource).values())
				{
					const pos = s.position();
					if (!pos || !s.resourceSupplyAmount() || this.nearEnemy(pos, 100, 60))
						continue;
					const d = SquareDistance(pos, ccPos);
					if (d < bestD)
					{
						bestD = d;
						best = s.id();
					}
				}
				this.mineId[resource] = best;
			}
		}
	}
	if (this.woodline)
	{
		let remaining = 0;
		for (const id of this.woodline.ids)
			remaining += this.gameState.getEntityById(id)?.resourceSupplyAmount() || 0;

		const keep = this.woodline.kind === "store" ?
			(this.expansionOn() ? 800 : this.ringGateWood) : 800;
		if (remaining > keep)
		{
			this.woodline.total = remaining;
			return;
		}
	}
	const scan = inTerritory => {
		const supplies = this.gameState.getResourceSupplies("wood").toEntityArray()
			.filter(s => s.position() && s.resourceSupplyAmount() >= 20 &&
				!this.nearEnemy(s.position(), 100, 60) &&
				(!inTerritory || this.inOwnTerritory(s.position()[0], s.position()[1])));
		const cells = new Map();
		for (const s of supplies)
		{
			const pos = s.position();
			const key = Math.floor(pos[0] / 30) + ":" + Math.floor(pos[1] / 30);
			let cell = cells.get(key);
			if (!cell)
			{
				cell = { "total": 0, "sx": 0, "sz": 0, "n": 0 };
				cells.set(key, cell);
			}
			cell.total += s.resourceSupplyAmount();
			cell.sx += pos[0];
			cell.sz += pos[1];
			cell.n++;
		}
		let best, bestScore = 0;
		for (const entry of cells)
		{
			const coords = entry[0].split(":");
			const cx = +coords[0], cz = +coords[1];
			let score = 0;
			for (let dx = -1; dx <= 1; ++dx)
				for (let dz = -1; dz <= 1; ++dz)
					score += cells.get((cx + dx) + ":" + (cz + dz))?.total || 0;
			if (score > bestScore)
			{
				bestScore = score;
				best = entry[1];
			}
		}
		if (!best)
			return null;
		const hx = best.sx / best.n, hz = best.sz / best.n;
		const ids = [];
		let total = 0, sx = 0, sz = 0;
		for (const s of supplies)
		{
			const pos = s.position();
			if (Math.hypot(pos[0] - hx, pos[1] - hz) > 45)
				continue;
			ids.push(s.id());
			total += s.resourceSupplyAmount();
			sx += pos[0];
			sz += pos[1];
		}
		if (!ids.length)
			return null;
		return { "ids": new Set(ids), "total": total, "center": [sx / ids.length, sz / ids.length] };
	};

	// Rule 1: keep cutting the ring an existing dropsite already serves while it holds >= ringGateWood; else fall back to the biggest hotspot.
	const dropSites = [];
	const ccEntity = this.getCivicCentre();
	if (ccEntity?.position())
		dropSites.push(ccEntity.position());
	const storeName = this.gameState.applyCiv("structures/{civ}/storehouse");
	for (const ent of this.gameState.getOwnStructures().values())
		if (ent.templateName() === storeName && ent.position())
			dropSites.push(ent.position());
	for (const f of this.gameState.getOwnFoundations().values())
		if (f.position() && this.gameState.getBuiltTemplate(f.templateName()).templateName() === storeName)
			dropSites.push(f.position());
	const r2 = this.ringServeDist * this.ringServeDist;
	let bestRing, bestRingWood = this.ringGateWood;
	for (const site of dropSites)
	{
		let wood = 0, ids = new Set();
		for (const s of this.gameState.getResourceSupplies("wood").values())
		{
			const pos = s.position();
			if (!pos || s.resourceSupplyAmount() < 20 || this.nearEnemy(pos, 100, 60))
				continue;
			if (SquareDistance(pos, site) >= r2)
				continue;
			wood += s.resourceSupplyAmount();
			ids.add(s.id());
		}
		if (wood > bestRingWood)
		{
			bestRingWood = wood;
			bestRing = { "ids": ids, "total": wood, "center": site, "kind": "store" };
		}
	}
	this.woodline = bestRing || scan(true) || scan(false);

	if (this.woodPoor === undefined)
	{
		let poor = true;
		for (const s of this.gameState.getResourceSupplies("wood").values())
			if ((+s.resourceSupplyMax() || 0) >= 200)
			{
				poor = false;
				break;
			}
		this.woodPoor = poor;
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(2)}m woodPoor=${this.woodPoor}\n`);
	}
};

BrennusBot.prototype.inOwnTerritory = function(x, z)
{
	const terr = this.territoryMap;
	const i = Math.floor(x / terr.cellSize), j = Math.floor(z / terr.cellSize);
	if (i < 0 || j < 0 || i >= terr.width || j >= terr.height)
		return false;
	return (terr.data[i + j * terr.width] & 0x1F) === this.player;
};

// ------------------------------------------------- gather-rate telemetry
/**
 * Telemetry: a delivery (carried load resets) yields effective rate =
 * amount / cycle time; theoretical = template rate x the diminishing-
 * returns multiplier. Aggregated per class; read in logStatus.
 */
BrennusBot.prototype.sampleGatherRates = function()
{
	const gameState = this.gameState;
	const now = gameState.getTimeElapsed();
	const seen = {};
	for (const ent of gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer())
			continue;
		const id = ent.id();
		seen[id] = 1;

		if (ent.unitAIState()?.split(".")[1] === "GATHER")
		{
			for (const order of ent.unitAIOrderData() || [])
			{
				if (!order || order.target === undefined)
					continue;
				const supply = gameState.getEntityById(order.target);
				const type = supply?.resourceSupplyType();
				if (!type)
					continue;
				this.gatherTarget[id] = {
					"generic": type.generic, "specific": type.specific,
					"supplyId": order.target,
					"dr": +supply.get("ResourceSupply/DiminishingReturns") || 0
				};
				break;
			}
		}

		const carrying = (ent.resourceCarrying() || []).find(c => c.amount > 0);
		const prev = this.carry[id];
		if (prev && prev.amount > 0 && (!carrying || carrying.type !== prev.type || carrying.amount < prev.amount))
		{

			const last = this.lastDelivery[id];
			this.lastDelivery[id] = now;
			const tgt = this.gatherTarget[id];
			if (prev.amount >= 3 && last !== undefined && now - last > 5000 && tgt && tgt.generic === prev.type)
			{
				const rate = (+ent.get("ResourceGatherer/BaseSpeed") || 1) *
					(+ent.get(`ResourceGatherer/Rates/${tgt.generic}.${tgt.specific}`) ||
					 +ent.get(`ResourceGatherer/Rates/${tgt.generic}`));
				let mult = 1;
				if (rate && tgt.dr)
				{
					const supply = gameState.getEntityById(tgt.supplyId);
					const n = supply?.resourceSupplyNumGatherers() || 0;
					if (n > 1)
						mult = (1 - Math.pow(tgt.dr, n)) / (1 - tgt.dr) / n;
				}
				const cls = prev.type === "wood" && tgt.specific === "tree" ? "wood" :
					prev.type === "food" && ["grain", "fruit", "meat"].includes(tgt.specific) ? tgt.specific :
					prev.type === "stone" || prev.type === "metal" ? prev.type : undefined;
				if (cls && rate)
				{
					this.rateStats[cls].amount += prev.amount;
					this.rateStats[cls].theo += rate * mult * (now - last) / 1000;
				}
			}
		}
		else if (carrying && this.lastDelivery[id] === undefined)
			this.lastDelivery[id] = now;
		if (carrying)
			this.carry[id] = { "type": carrying.type, "amount": carrying.amount };
		else
			delete this.carry[id];
	}

	for (const map of [this.carry, this.gatherTarget, this.lastDelivery])
		for (const id in map)
			if (!seen[id])
				delete map[id];
};

// ---------------------------------------------------------------- phases
BrennusBot.prototype.nextPhaseTech = function()
{
	return { 1: "phase_town_generic", 2: "phase_city_generic" }[this.gameState.currentPhase()];
};

/** Town: a short hard bank (pause spending, fill, research). City: a
 * reserve that training/construction only spend above. */
BrennusBot.prototype.managePhaseUp = function()
{
	const gameState = this.gameState;
	const tech = this.nextPhaseTech();
	// Goal-10 war fund: while the early-muster buildings (barracks, temple)
	// are still missing, hold 150 wood out of the boom's reach — the house
	// stream spends wood at cost level every block, so the 300-wood barracks
	// gate almost never fires on its own before ~14 min (agg4: barracks at
	// 9.1/9.5m, then starved). 300 strangled the house stream (agg5 s1: pop
	// cap stalled at 120); 150 is one barracks at a time. Must be set before
	// the early returns below so the money accumulates through every hold.
	if (!this.warOn() && this.arbiter.declared("defenseGap"))
		this.arbiter.reserve("phaseBank", { "wood": 150 });
	if (!tech || gameState.isResearching(tech) || gameState.isResearched(tech))
		return;
	if (!gameState.canResearch(tech))
		return;

	if (tech === "phase_town_generic")
	{
		const fert = this.houseTrainingTech;
		// Delay the town bank until the house-training tech is at least researching.
		const t = gameState.getTimeElapsed();
		if (!gameState.isResearched(fert) && !gameState.isResearching(fert) &&
			gameState.canResearch(fert) && t >= 240000 && t < 540000)
			return;

		const fieldType = gameState.applyCiv("structures/{civ}/field");
		// Hold the town bank until 2 bootstrap fields stand while the served fruit is low.
		let bootstrapFields = 0;
		for (const ent of gameState.getOwnStructures().values())
			if (ent.templateName() === fieldType)
				bootstrapFields++;
		if (t < 300000 && bootstrapFields < 2 && this.fruitStock < 1500)
			return;
	}
	const cost = this.phaseUpCost[tech];
	if (tech === "phase_town_generic")
	{
		this.arbiter.hold("banking");
		this.arbiter.reserve("phaseBank", { "food": 500, "wood": 500 });
	}
	else
		this.arbiter.reserve("phaseBank", { ...cost,
			"wood": (cost.wood || 0) + this.arbiter.reserved("wood") });

	// City: the goal-8/9 boom held the research start until the grain-rate and
	// house-cap techs were out (fallback 13:20). Goal 10 cannot wait: city
	// unlocks fanatics/arsenal/rams and the 100-army war stage, and the war
	// fund starves those very techs (agg5 s1: plows at 16.4m, city never —
	// the bot died in town phase with 1000 stone and 1800 metal banked).
	if (!this.arbiter.check(this.arbiter.books("phaseUp"), "phaseUp", cost, tech))
		return;

	this.arbiter.hold("phaseReady");
	const cc = this.getCivicCentre();
	if (cc && !cc.trainingQueue()?.length)
	{
		cc.research(tech);
		this.arbiter.hold("construction");
	}
	else if (cc && gameState.getPopulation() >= gameState.getPopulationLimit())

		// Pinned at the pop cap: cancel the full CC queue so it can drain and the research can start.
		for (const item of cc.trainingQueue() || [])
			cc.stopProduction(item.id);
};

BrennusBot.prototype.getCivicCentre = function()
{
	const ccType = this.gameState.applyCiv("structures/{civ}/civil_centre");
	for (const ent of this.gameState.getOwnStructures().values())
		if (ent.templateName() === ccType)
			return ent;
	return undefined;
};

// ---------------------------------------------------------------- training
BrennusBot.prototype.trainWorkers = function()
{
	const gameState = this.gameState;
	const resources = this.arbiter.books("workers");

	// Leave pop room for the mustering army and its refills: stop the civilian
	// stream at the cap once the war stage is on. Gating this on army <
	// target yo-yoed (army full → train to the cap → dismiss for the next
	// batch → retrain…).
	if (this.warOn() &&
		gameState.getPopulation() >= gameState.getPopulationLimit() - 5)
		return;

	// War-stage pop discipline: hold workers at 150 and leave the rest of the
	// 300 cap free for the army (120) + healers (10) + rams (6 × 3 pop) =
	// 298 total. 175 workers pop-blocked the army at ~60 until dismissal
	// kicked in 15 min after city (agg11 s3), and the war economy runs a
	// 10k+ food surplus anyway.
	// Refilling army losses with women only to dismiss them on the next
	// soldier batch is a pure food leak — def10-12 logged 400-900 dismissals
	// per game (≈ 20-45k food).
	if (this.warOn())
	{
		let workers = 0;
		for (const u of gameState.getOwnUnits().values())
			if (u.isGatherer() && !u.hasClass("Soldier") && !u.hasClass("Trader") &&
				u.id() !== this.herderId)
				workers++;
		if (workers >= 150)
			return;
	}

	// Pre-war (town phase): cap the woman stream at 150 — the early muster
	// needs the food more than the boom needs a 150th worker (agg4 s1: the
	// house stream drained food at cost level every block and the barracks
	// starved; 8 infantry trained all game). But not lower: agg5's cap of
	// 100 starved the boom techs and stalled city phase, and agg6's 130
	// still meant city at 18.5-20.2m — city gates fanatics/rams/raids, so
	// every minute here is a minute off the kill clock.
	if (this.defenseOn() && !this.warOn())
	{
		let workers = 0;
		for (const u of gameState.getOwnUnits().values())
			if (u.isGatherer() && !u.hasClass("Soldier") && !u.hasClass("Trader") &&
				u.id() !== this.herderId)
				workers++;
		if (workers >= 150)
			return;
	}

	const reserveFood = this.arbiter.reserved("food");

	const fertFloor = this.arbiter.declaredAmount("fert", "food");
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const houseTraining = gameState.isResearched(this.houseTrainingTech);

	for (const ent of gameState.getOwnStructures().values())
	{
		let type, batch;
		if (ent.templateName() === ccType)
		{

			if (this.arbiter.held("phaseReady"))
				continue;
			type = gameState.applyCiv("units/{civ}/support_civilian");
			batch = 5;
		}
		else if (houseTraining && ent.hasClass("House") && ent.foundationProgress() === undefined)
		{
			type = gameState.applyCiv("units/{civ}/support_civilian_house");
			batch = 1;
		}
		else
			continue;

		const queue = ent.trainingQueue();
		if (queue && !queue.length && resources.food >= reserveFood + fertFloor + 50 * batch)
		{
			ent.train(gameState.getPlayerCiv(), type, batch, {});
			this.arbiter.spend(resources, "workers", { "food": 50 * batch }, `women x${batch}`);
		}
	}
};

// ---------------------------------------------------------------- research
/** Boom techs, one per block, from genuine surplus only (reserve and
 * pending wood kept intact); Fertility Festival first. */
BrennusBot.prototype.manageResearch = function()
{
	const gameState = this.gameState;
	const resources = this.arbiter.books("research");
	const reserve = this.arbiter.reservedAll();
	if (this.arbiter.held("banking"))
		return;

	const fert = this.houseTrainingTech;
	this.arbiter.declare("fert", null);
	if (!gameState.isResearched(fert) && !gameState.isResearching(fert) &&
		gameState.getTimeElapsed() >= 240000)
	{
		const affordable = resources.canAfford({ "food": 260, "wood": 110, "metal": 110 });
		const facility = gameState.findResearchers(fert)?.toEntityArray()
			.filter(ent => ent.foundationProgress() === undefined && (ent.trainingQueue()?.length || 0) <= 1)[0];
		this.arbiter.declare("fert", !!facility && gameState.canResearch(fert) && !affordable ? { "food": 300 } : null);
		if (affordable && facility)
		{
			facility.research(fert);
			this.arbiter.spend(resources, "research", { "food": 250, "wood": 100, "metal": 100 }, fert);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m research ${fert}\n`);
			this.arbiter.hold("construction");
		}
		return;
	}

	if (this.manageExpansionTechs())
		return;

	const techOrder = this.woodPoor ?
		["gather_wicker_baskets", "gather_lumbering_ironaxes",
			...this.boomTechs.filter(t => t !== "gather_wicker_baskets" && t !== "gather_lumbering_ironaxes")] :
		this.boomTechs;
	for (const tech of techOrder)
	{
		if (gameState.isResearched(tech) || gameState.isResearching(tech))
			continue;
		const researchers = gameState.findResearchers(tech);
		if (!researchers)
			continue;
		const cost = gameState.getTemplate(tech).cost();

		const bankFloor = gameState.currentPhase() === 2 ? 300 : 0;

		// Food-rate and house-cap techs may spend into the city bank: the miners pre-fill for them and the city research waits for them.
		const bankTech = ["gather_farming_plows", "gather_farming_training",
			"gather_farming_harvester", "pop_house_01"].includes(tech);
		if (!resources.canAfford({
			"food": (cost.food || 0) + (reserve.food || 0),
			"wood": (cost.wood || 0) + (reserve.wood || 0),
			"stone": (cost.stone || 0) + (bankTech ? bankFloor : Math.max(reserve.stone || 0, bankFloor)),
			"metal": (cost.metal || 0) + (bankTech ? bankFloor : Math.max(reserve.metal || 0, bankFloor)) }))
			continue;
		const facility = researchers.toEntityArray()
			.filter(ent => ent.foundationProgress() === undefined && (ent.trainingQueue()?.length || 0) <= 1)
			.sort((a, b) => (a.trainingQueue()?.length || 0) - (b.trainingQueue()?.length || 0))[0];
		if (facility)
		{
			facility.research(tech);
			this.arbiter.spend(resources, "research", cost, tech);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m research ${tech}\n`);
			this.arbiter.hold("construction");
		}
		return;
	}

	this.manageExpansionTechs();
};

BrennusBot.prototype.nextTrioWood = function()
{
	if (this.gameState.currentPhase() < 2)
		return 0;
	const foundations = this.gameState.getOwnFoundations().toEntityArray();
	const next = this.trioTypes()
		.find(t => !this.hasStructureOrFoundation(t, foundations));
	return next ? (this.gameState.getTemplate(next).cost().wood || 0) : 0;
};

BrennusBot.prototype.trioTypes = function()
{
	if (!this._trioTypes)
	{
		const third = this.gameState.getTemplate(this.gameState.applyCiv("structures/{civ}/tavern")) ?
			"tavern" : "temple";
		this._trioTypes = ["forge", "market", third]
			.map(t => this.gameState.applyCiv(`structures/{civ}/${t}`));
	}
	return this._trioTypes;
};

// ---------------------------------------------------------------- construction
BrennusBot.prototype.manageConstruction = function()
{
	const gameState = this.gameState;
	const resources = this.arbiter.books("construction");
	const foundations = gameState.getOwnFoundations().toEntityArray();

	// Sticky, non-overlapping builders per foundation (dropsites 4, houses 2-3, fields 2, CC 10, wonder 16); the herder is excluded.
	const assigned = this.builderAssignments;
	for (const fId in assigned)
	{
		const f = gameState.getEntityById(+fId);
		if (!f)
			delete assigned[fId];
		else
			assigned[fId] = assigned[fId].filter(id => gameState.getEntityById(id));
	}
	const taken = new Set();
	for (const ids of Object.values(assigned))
		for (const id of ids)
			taken.add(id);
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	for (const foundation of foundations)
	{
		const built = gameState.getBuiltTemplate(foundation.templateName());
		const isField = built.hasClass("Field");
		const isHouse = built.hasClass("House");
		const isCC = built.hasClass("CivCentre");
		const isWonder = built.hasClass("Wonder");
		const fpos = foundation.position();

		const rush = this.rushBuilds.some(r => Math.abs(r.x - fpos[0]) < 6 && Math.abs(r.z - fpos[1]) < 6);

		const target = (isField ? 2 : isHouse ? (this.gameState.currentPhase() === 1 ? 2 : 3) :
			isCC ? 10 : isWonder ? 16 : rush ? 8 : 4);
		let cur = assigned[foundation.id()];
		if (!cur)
			cur = assigned[foundation.id()] = [];
		const needed = target - cur.length;
		if (needed <= 0)
			continue;
		const builders = gameState.getOwnUnits()
			.filter(ent => ent.isGatherer() && ent.isBuilder() && ent.position() &&
				!(ent.id() === this.herderId && !this.herdingDone) &&
				!this.army[ent.id()] &&
				!taken.has(ent.id()) &&
				(!rush || this.assignments[ent.id()] === "wood"))
			.filterNearest(fpos, needed);
		if (rush && !cur.length)
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m rush-building storehouse at ${fpos[0].toFixed(0)},${fpos[1].toFixed(0)} (${needed} wood choppers)\n`);
		for (const unit of builders.values())
		{
			cur.push(unit.id());
			taken.add(unit.id());
			unit.repair(foundation);
		}
	}

	this.rushBuilds = this.rushBuilds.filter(r => {
		const done = gameState.getOwnStructures().toEntityArray().some(s =>
			s.templateName() === storeType && s.position() &&
			Math.abs(s.position()[0] - r.x) < 6 && Math.abs(s.position()[1] - r.z) < 6);
		return !done && this.turn - r.turn < 200;
	});

	this.pendingBuilds = this.pendingBuilds.filter(pb => {
		const nearSpot = ent => {
			const pos = ent.position();
			return pos && Math.abs(pos[0] - pb.x) < 4 && Math.abs(pos[1] - pb.z) < 4;
		};
		if (foundations.some(nearSpot) ||
			gameState.getOwnStructures().toEntityArray().some(nearSpot))
			return false;
		// CC timeout must cover builder travel: at ~1.8 m per turn a distant
		// frontier spot needs minutes, and a premature timeout poisoned the
		// spot while the party was still walking (def15 s5: the same far spot
		// failed and re-poisoned itself every recompute cycle).
		const home = this.getCivicCentre()?.position() || [384, 384];
		const ccTimeout = 150 + Math.ceil(Math.hypot(pb.x - home[0], pb.z - home[1]) / 1.5);
		if (this.turn - pb.turn > (pb.template.indexOf("civil_centre") !== -1 ? ccTimeout : 50))
		{
			print(`[HARNESS] construct FAILED: ${pb.template} at ${pb.x.toFixed(0)},${pb.z.toFixed(0)}\n`);
			this.failedSpots.push([pb.x, pb.z, this.turn]);
			return false;
		}
		return true;
	});

	if (this.arbiter.held("construction"))
		return;

	if (this.arbiter.held("banking"))
		return;

	const houseType = gameState.applyCiv("structures/{civ}/house");
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	const reserve = this.arbiter.reservedAll();

	let queuedPop = 0;
	for (const ent of gameState.getOwnStructures().values())
		for (const item of ent.trainingQueue() || [])
			if (item.unitTemplate)
				queuedPop += item.count;
	const margin = gameState.getPopulationLimit() - gameState.getPopulation() - queuedPop;
	const houseFoundations = foundations.filter(f =>
		gameState.getBuiltTemplate(f.templateName()).templateName() === houseType).length;
	const houseCost = 75;
	const tryHouse = () => {
		if (this.tryConstruct(houseType, "house"))
			this.arbiter.spend(resources, "construction", { "wood": houseCost }, "house");
		else if (this.turn % 750 === 0)
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m house placement FAILED (margin=${margin})\n`);
		return true;

	};

	for (const name of ["farmstead", "storehouse"])
	{
		const type = gameState.applyCiv(`structures/{civ}/${name}`);
		if (this.hasStructureOrFoundation(type, foundations))
			continue;
		if (!resources.canAfford({
			"food": reserve.food || 0, "wood": (reserve.wood || 0) + 100,
			"stone": reserve.stone || 0, "metal": reserve.metal || 0 }))
			continue;
		const placed = name === "farmstead" ?
			this.placeFirstFarmstead(type) :
			this.placeWoodStorehouse(type);
		if (placed)
		{
			this.arbiter.spend(resources, "construction", { "wood": 100 }, name);
			return;
		}
	}

	if (gameState.currentPhase() >= 2)
	{
		const trioType = this.trioTypes()
			.find(t => !this.hasStructureOrFoundation(t, foundations));
		if (trioType)
		{
			const cost = gameState.getTemplate(trioType).cost();
			if (resources.canAfford({
				"food": reserve.food || 0, "wood": (cost.wood || 0) + (reserve.wood || 0),
				"stone": (cost.stone || 0) + (reserve.stone || 0), "metal": (cost.metal || 0) + (reserve.metal || 0) }))
			{
				if (this.tryConstruct(trioType, "civic"))
				{
					this.arbiter.spend(resources, "construction", cost, trioType.split("/").pop());
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m building ${trioType.split("/").pop()}\n`);
				}
				return;
			}
		}
	}

	if (this.manageDropSites(foundations, reserve))
		return;

	if (margin < 2 && houseFoundations < this.maxHouseFoundations &&
		gameState.getPopulationLimit() < gameState.getPopulationMax() &&
		resources.wood >= houseCost + this.arbiter.declaredAmount("field", "wood"))
		return tryHouse();

	this.arbiter.declare("techWood", null);
	for (const tech of ["gather_farming_plows", "gather_farming_training",
		"gather_farming_harvester", "gather_lumbering_ironaxes"])
	{
		if (gameState.isResearched(tech) || gameState.isResearching(tech) ||
			!gameState.canResearch(tech))
			continue;
		const techWood = gameState.getTemplate(tech).cost().wood || 0;
		if (resources.wood < techWood + 100)
			this.arbiter.declare("techWood", techWood ? { "wood": techWood } : null);
		break;
	}

	const cc = this.getCivicCentre();
	if (!cc)
		return;
	const ccPos = cc.position();
	let foodGatherers = 0;
	for (const res of Object.values(this.assignments))
		if (res === "food")
			foodGatherers++;
	const fieldCap = this.expansionOn() ? 60 : (gameState.currentPhase() === 1 ? 4 : 30);
	// Fields open at t=1:30 or when served fruit runs low: they must stand before the fruit runs out.
	const desiredFields = this.fruitStock < 4000 || gameState.getTimeElapsed() > 90000 ?
		Math.min(fieldCap, Math.max(2, Math.ceil(foodGatherers / 3) + 1)) : 0;
	let fields = 0;
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === fieldType)
			fields++;
	const fieldFoundations = foundations.filter(f =>
		gameState.getBuiltTemplate(f.templateName()).templateName() === fieldType).length;

	// Bootstrap only: the first 2 fields outrank the house stream while served fruit is nearly out.
	this.arbiter.declare("field", (fields + fieldFoundations) < Math.min(2, desiredFields) &&
		this.fruitStock < 800 ? { "wood": 100 } : null);

	this.fieldStallTurns = fields === this.lastFields ? (this.fieldStallTurns || 0) + 1 : 0;
	this.lastFields = fields;
	if (this.woodPoor && fields + fieldFoundations < desiredFields / 2 &&
		this.fieldStallTurns > 100)
		this.arbiter.declare("field", { "wood": 100 });

	// On wood-poor biomes fields leave the town trio's wood untouched.
	const fieldTrioWood = gameState.currentPhase() === 2 && this.woodPoor ?
		this.nextTrioWood() : 0;
	if (fields < desiredFields && fieldFoundations < 2 &&
		resources.wood >= 100 + fieldTrioWood)
	{

		const farmType = gameState.applyCiv("structures/{civ}/farmstead");
		const farms = gameState.getOwnStructures().toEntityArray()
			.filter(ent => ent.templateName() === farmType &&
				ent.foundationProgress() === undefined && ent.position())
			.map(farm => {
				let near = 0;
				for (const other of gameState.getOwnStructures().values())
					if (other.templateName() === fieldType && other.position() &&
						SquareDistance(other.position(), farm.position()) < 30 * 30)
						near++;
				return [near, farm.position()];
			})
			.sort((a, b) => a[0] - b[0]);
		const region = this.accessibility.getAccessValue(ccPos);
		for (const farm of farms)
		{
			const spot = this.findBuildingPosition(fieldType, farm[1], 16, 36, true, region);
			if (spot && this.placeOrder(fieldType, spot))
				return;
		}
		this.tryConstruct(fieldType, "field");
		return;
	}

	if (this.arbiter.declared("fert"))
		return;

	const sprintCap = gameState.getTimeElapsed() > 600000 &&
		gameState.getPopulationLimit() < gameState.getPopulationMax();
	if ((margin < this.houseMargin || sprintCap) && houseFoundations < this.maxHouseFoundations &&
		!this.arbiter.declared("techWood") &&
		gameState.getPopulationLimit() < gameState.getPopulationMax() &&
		resources.wood >= (reserve.wood || 0) + this.nextTrioWood() + this.arbiter.declaredAmount("dropsite", "wood") + this.arbiter.declaredAmount("field", "wood") + houseCost)
		return tryHouse();
};

BrennusBot.prototype.hasStructureOrFoundation = function(type, foundations)
{
	return this.gameState.getOwnStructures().toEntityArray().some(ent => ent.templateName() === type) ||
		foundations.some(f => this.gameState.getBuiltTemplate(f.templateName()).templateName() === type);
};

BrennusBot.prototype.placeFirstFarmstead = function(type)
{
	const gameState = this.gameState;
	const cc = this.getCivicCentre();
	if (!cc)
		return false;
	const region = this.accessibility.getAccessValue(cc.position());
	const fruits = gameState.getResourceSupplies("food").toEntityArray()
		.filter(s => s.resourceSupplyType()?.specific === "fruit" && s.position() &&
			s.resourceSupplyAmount() > 30 && !this.nearEnemy(s.position(), 100, 60) &&
			this.inOwnTerritory(s.position()[0], s.position()[1]) &&
			this.accessibility.getAccessValue(s.position()) === region);
	const scored = fruits.map(f => {
		let score = 0;
		for (const g of fruits)
			if (SquareDistance(f.position(), g.position()) < 30 * 30)
				score += g.resourceSupplyAmount();
		return [score, f.position()];
	}).sort((a, b) => b[0] - a[0]);
	const tried = [];
	for (const cand of scored)
	{
		if (tried.some(p => SquareDistance(p, cand[1]) < 30 * 30))
			continue;
		tried.push(cand[1]);
		if (this.tryConstruct(type, "dropsite", cand[1]))
			return true;
		if (tried.length >= 5)
			break;
	}
	return false;
};

/** Continuous dropsite coverage: one order per block at the centroid of an underserved gatherer clump. */
BrennusBot.prototype.manageDropSites = function(foundations, reserve)
{
	const gameState = this.gameState;
	const resources = this.arbiter.books("dropsites");
	const cc = this.getCivicCentre();
	if (!cc)
		return false;

	const woodFloor = 100 + (reserve.wood || 0);

	this.arbiter.declare("dropsite", null);

	const halfDiag = ent => {
		const o = ent.get("Obstruction/Static");
		return o ? Math.hypot(+o["@width"], +o["@depth"]) / 2 : 8;
	};
	const centroid = points => {
		let sx = 0, sz = 0;
		for (const p of points)
		{
			sx += p[0];
			sz += p[1];
		}
		return [sx / points.length, sz / points.length];
	};
	const minEdgeDist = (pos, sites) =>
		Math.min(...sites.map(s => Math.hypot(pos[0] - s.pos[0], pos[1] - s.pos[1]) - s.half));

	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	const woodSites = [{ "pos": cc.position(), "half": halfDiag(cc) }];
	const storePositions = [];
	const storeFoundations = [];
	let storeCount = 0;
	for (const f of foundations)
		if (gameState.getBuiltTemplate(f.templateName()).templateName() === storeType && f.position())
		{
			woodSites.push({ "pos": f.position(), "half": halfDiag(f) });
			storePositions.push(f.position());
			storeFoundations.push(f.position());
			storeCount++;
		}
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === storeType && ent.position())
		{
			woodSites.push({ "pos": ent.position(), "half": halfDiag(ent) });
			storePositions.push(ent.position());
			storeCount++;
		}

	const storePending = center => this.pendingBuilds.some(pb =>
		pb.template === storeType && Math.hypot(pb.x - center[0], pb.z - center[1]) < 30);

	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.templateName() !== storeType || ent.foundationProgress() !== undefined || !ent.position())
			continue;
		const pos = ent.position();
		let nearest = Infinity;
		for (const res of ["wood", "stone", "metal"])
		{
			const s = gameState.getResourceSupplies(res).filterNearest(pos, 1).toEntityArray()[0];
			const sp = s?.position();
			if (sp)
				nearest = Math.min(nearest, Math.hypot(pos[0] - sp[0], pos[1] - sp[1]));
		}
		if (nearest > 60)
		{
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse destroyed at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} (nearest supply ${nearest.toFixed(0)} m)\n`);
			ent.destroy();
			return true;
		}
	}

	let servedWood = 0;
	const ringSites = [cc.position(), ...storePositions];
	const r2 = this.ringServeDist * this.ringServeDist;
	for (const site of ringSites)
	{
		let ring = 0;
		for (const s of gameState.getResourceSupplies("wood").values())
		{
			const sp = s.position();
			if (!sp || s.resourceSupplyAmount() < 20)
				continue;
			if (SquareDistance(sp, site) < r2)
				ring += s.resourceSupplyAmount();
		}
		if (ring > servedWood)
			servedWood = ring;
	}
	if (storeCount < (this.expansionOn() ? 40 : 18) &&
		(this.expansionOn() || (servedWood < this.ringGateWood && this.woodline?.kind !== "store")))
	{
		let worst, worstDist = 18;
		const underserved = [];
		for (const ent of gameState.getOwnUnits().values())
		{
			if (!ent.isGatherer() || ent.isIdle() || !ent.position())
				continue;
			const tgt = this.gatherTarget[ent.id()];
			if (tgt?.generic !== "wood")
				continue;
			const anchor = gameState.getEntityById(tgt.supplyId)?.position() || ent.position();
			const d = minEdgeDist(anchor, woodSites);
			if (d > 18)
				underserved.push(anchor);
			if (d > worstDist)
			{
				worstDist = d;
				worst = anchor;
			}
		}
		if (underserved.length >= 4 && !(this.expansionOn() &&
			(this.turn - (this.lastWoodStoreTurn || -1000) < 150 ||

				(this.woodline?.kind === "store" && (this.woodline.total || 0) < 2000))))
		{
			this.arbiter.declare("dropsite", { "wood": 100 });
			const clump = underserved.filter(p => Math.hypot(p[0] - worst[0], p[1] - worst[1]) < 25);

			const center = this.woodlineDropSpot() || centroid(clump);

			const trioWood = this.gameState.currentPhase() === 2 && this.woodPoor ?
				this.nextTrioWood() : 0;
			const planned = storeFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 60) ||
				storePending(center);

			const pos = resources.wood >= woodFloor + trioWood && !planned &&
				(this.expansionOn() ?
					this.findExpansionWoodStorehouse(storeType, center) :
					this.tryConstruct(storeType, "dropsite", center, !this.expansionOn()));
			if (pos)
			{
				this.lastWoodStoreTurn = this.turn;
				this.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/woodline");
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for woodline ${center[0].toFixed(0)},${center[1].toFixed(0)} (${underserved.length} underserved)\n`);
				return true;
			}
		}
	}

	if (storeCount < (this.expansionOn() ? 40 : 18))
	{
		let worst, worstDist = 18;
		const underserved = [];
		for (const ent of gameState.getOwnUnits().values())
		{
			if (!ent.isGatherer() || ent.isIdle() || !ent.position())
				continue;
			const tgt = this.gatherTarget[ent.id()];
			if (tgt?.generic !== "stone" && tgt?.generic !== "metal")
				continue;
			const anchor = gameState.getEntityById(tgt.supplyId)?.position() || ent.position();
			const d = minEdgeDist(anchor, woodSites);
			if (d > 18)
				underserved.push(anchor);
			if (d > worstDist)
			{
				worstDist = d;
				worst = anchor;
			}
		}
		if (underserved.length >= (this.expansionOn() ? 5 : 2) &&
			!(this.expansionOn() && this.turn - (this.lastMineStoreTurn || -1000) < 40))
		{
			this.arbiter.declare("dropsite", { "wood": 100 });
			const sMine = this.mineId.stone !== undefined ?
				gameState.getEntityById(this.mineId.stone) : undefined;
			const mMine = this.mineId.metal !== undefined ?
				gameState.getEntityById(this.mineId.metal) : undefined;
			const sPos = sMine?.position(), mPos = mMine?.position();
			// Pinned stone and metal mines close together share ONE storehouse between them.
			const pairNear = sPos && mPos &&
				Math.hypot(sPos[0] - mPos[0], sPos[1] - mPos[1]) < this.minePairDist;
			if (pairNear)
			{
				const mid = [(sPos[0] + mPos[0]) / 2, (sPos[1] + mPos[1]) / 2];
				const planned = storeFoundations.some(p => Math.hypot(p[0] - mid[0], p[1] - mid[1]) < 30) ||
					storePending(mid);
				if (!planned && resources.wood >= woodFloor)
				{
					const spot = this.findMinimaxSpot(storeType, [sPos, mPos],
						this.accessibility.getAccessValue(cc.position()));
					if (spot && this.placeOrder(storeType, spot))
					{
						this.lastMineStoreTurn = this.turn;
						this.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/mine-pair");
						print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} between stone ${sPos[0].toFixed(0)},${sPos[1].toFixed(0)} and metal ${mPos[0].toFixed(0)},${mPos[1].toFixed(0)} (${underserved.length} underserved)\n`);
						return true;
					}
				}
			}
			const clump = underserved.filter(p => Math.hypot(p[0] - worst[0], p[1] - worst[1]) < 25);
			const center = centroid(clump);
			const planned = storeFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 45) ||
				storePending(center);
			const pos = resources.wood >= woodFloor && !planned &&
				this.tryConstruct(storeType, "dropsite", center);
			if (pos)
			{
				this.lastMineStoreTurn = this.turn;
				this.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/mine");
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for mine ${center[0].toFixed(0)},${center[1].toFixed(0)} (${underserved.length} underserved)\n`);
				return true;
			}
		}
	}

	if (this.expansionOn() && resources.wood >= woodFloor &&
		storeCount < 40 && this.turn - (this.lastMineStoreTurn || -1000) > 40)
	{
		const region = this.accessibility.getAccessValue(cc.position());
		const r2 = this.mineServeDist * this.mineServeDist;
		let best, bestAmt = 1500;
		for (const res of ["stone", "metal"])
			for (const s of gameState.getResourceSupplies(res).values())
			{
				const pos = s.position();
				if (!pos || s.resourceSupplyAmount() <= bestAmt || this.nearEnemy(pos, 100, 60))
					continue;
				if (this.accessibility.getAccessValue(pos) !== region ||
					!this.inOwnTerritory(pos[0], pos[1]))
					continue;
				if (woodSites.some(d => SquareDistance(pos, d.pos) < r2))
					continue;
				bestAmt = s.resourceSupplyAmount();
				best = pos;
			}
		if (best)
		{
			this.arbiter.declare("dropsite", { "wood": 100 });
			const planned = storeFoundations.some(p => Math.hypot(p[0] - best[0], p[1] - best[1]) < 45) ||
				storePending(best);
			if (!planned)
			{
				const spot = this.findMinimaxSpot(storeType, [best], region);
				if (spot && this.placeOrder(storeType, spot))
				{
					this.lastMineStoreTurn = this.turn;
					this.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/unserved-mine");
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} for mine ${best[0].toFixed(0)},${best[1].toFixed(0)} (${bestAmt} left)\n`);
					return true;
				}
			}
		}
	}

	const farmType = gameState.applyCiv("structures/{civ}/farmstead");
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	const foodSites = [{ "pos": cc.position(), "half": halfDiag(cc) }];
	const farmFoundations = [];
	let farmCount = 0;
	for (const f of foundations)
		if (gameState.getBuiltTemplate(f.templateName()).templateName() === farmType && f.position())
		{
			foodSites.push({ "pos": f.position(), "half": halfDiag(f) });
			farmFoundations.push(f.position());
			farmCount++;
		}
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === farmType && ent.position())
		{
			foodSites.push({ "pos": ent.position(), "half": halfDiag(ent) });
			farmCount++;
		}
	let worstField, worstFieldDist = 15;
	const unservedFields = [];
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.templateName() !== fieldType || ent.foundationProgress() !== undefined || !ent.position())
			continue;
		const d = minEdgeDist(ent.position(), foodSites) - 15.5;
		if (d > 15)
			unservedFields.push(ent.position());
		if (d > worstFieldDist)
		{
			worstFieldDist = d;
			worstField = ent.position();
		}
	}
	if (unservedFields.length >= 2 && farmCount < 12)
	{
		const cluster = unservedFields.filter(p => Math.hypot(p[0] - worstField[0], p[1] - worstField[1]) < 30);
		const center = centroid(cluster);
		const planned = farmFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 25);
		const pos = !planned && resources.wood >= woodFloor &&
			this.tryConstruct(farmType, "dropsite", center);
		if (pos)
		{
			this.arbiter.spend(resources, "dropsites", { "wood": 100 }, "farmstead/fields");
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m farmstead at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for fields ${center[0].toFixed(0)},${center[1].toFixed(0)} (${unservedFields.length} underserved)\n`);
			return true;
		}
	}

	let worstFruit, worstFruitDist = 18;
	const unservedFruit = [];
	for (const ent of gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || ent.isIdle() || !ent.position())
			continue;
		const tgt = this.gatherTarget[ent.id()];
		if (tgt?.generic !== "food" || tgt?.specific !== "fruit")
			continue;
		const anchor = gameState.getEntityById(tgt.supplyId)?.position() || ent.position();
		const d = minEdgeDist(anchor, foodSites);
		if (d > 18)
			unservedFruit.push(anchor);
		if (d > worstFruitDist)
		{
			worstFruitDist = d;
			worstFruit = anchor;
		}
	}
	if (unservedFruit.length >= 3 && farmCount < 12)
	{
		this.arbiter.declare("dropsite", { "wood": 100 });
		const cluster = unservedFruit.filter(p => Math.hypot(p[0] - worstFruit[0], p[1] - worstFruit[1]) < 25);
		const center = centroid(cluster);
		const planned = farmFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 25);
		const pos = !planned && resources.wood >= woodFloor &&
			this.tryConstruct(farmType, "dropsite", center);
		if (pos)
		{
			this.arbiter.spend(resources, "dropsites", { "wood": 100 }, "farmstead/fruit");
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m farmstead at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for fruit ${center[0].toFixed(0)},${center[1].toFixed(0)} (${unservedFruit.length} underserved)\n`);
			return true;
		}
	}

	if (this.fruitStock < 600 && farmCount < 12 && resources.wood >= woodFloor)
	{
		const region = this.accessibility.getAccessValue(cc.position());
		const fruits = gameState.getResourceSupplies("food").toEntityArray()
			.filter(s => s.resourceSupplyType()?.specific === "fruit" && s.position() &&
				s.resourceSupplyAmount() > 30 && !this.nearEnemy(s.position(), 100, 60) &&
				this.inOwnTerritory(s.position()[0], s.position()[1]) &&
				this.accessibility.getAccessValue(s.position()) === region &&
				!foodSites.some(site => SquareDistance(s.position(), site.pos) < 45 * 45));
		let best, bestScore = 250;
		for (const f of fruits)
		{
			let score = 0;
			for (const g of fruits)
				if (SquareDistance(f.position(), g.position()) < 30 * 30)
					score += g.resourceSupplyAmount();
			if (score > bestScore)
			{
				bestScore = score;
				best = f.position();
			}
		}
		if (best)
		{
			this.arbiter.declare("dropsite", { "wood": 100 });
			const planned = farmFoundations.some(p => Math.hypot(p[0] - best[0], p[1] - best[1]) < 25);
			const pos = !planned && this.tryConstruct(farmType, "dropsite", best);
			if (pos)
			{
				this.arbiter.spend(resources, "dropsites", { "wood": 100 }, "farmstead/next-fruit");
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m farmstead at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for next fruit patch ${best[0].toFixed(0)},${best[1].toFixed(0)} (stock ${Math.round(this.fruitStock)})\n`);
				return true;
			}
		}
	}
	return false;
};

/** Barter: while banking, surplus food/wood buys the missing stone/metal;
 * mining surplus far past the bank is sold back for wood/food. */
BrennusBot.prototype.manageBarter = function()
{
	const gameState = this.gameState;
	if (gameState.currentPhase() < 2)
		return;
	const market = gameState.getOwnStructures().toEntityArray()
		.find(ent => ent.hasClass("Market") && ent.foundationProgress() === undefined);
	if (!market)
		return;
	const res = this.arbiter.books("barter");

	// One deal per block; 500-unit deals drift prices ~8%, so alternate the sold resource.
	if (!gameState.isResearched("phase_city_generic"))
	{

		if ((res.stone < 750 || res.metal < 750))
		{
			const want = res.stone <= res.metal ? "stone" : "metal";
			const sell = res.food >= res.wood ? "food" : "wood";
			if (res[sell] >= 700)
			{
				market.barter(want, sell, 500);
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 ${sell} -> ${want}\n`);
				return;
			}
			if (res[sell] >= 400)
			{
				market.barter(want, sell, 100);
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 100 ${sell} -> ${want}\n`);
				return;
			}
		}

		const excess = res.stone - 800 >= res.metal - 800 ? "stone" : "metal";
		if (res[excess] >= 1300 && (res.wood < 250 || res.food < 200))
		{
			const want = res.wood < 250 ? "wood" : "food";
			market.barter(want, excess, 500);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 ${excess} -> ${want}\n`);
			return;
		}
	}
	else if (this.expansionOn())
	{

		if (!this.manageExpansionBarter(market) && (res.stone >= 600 || res.metal >= 600))
		{

			const excess = res.stone >= res.metal ? "stone" : "metal";
			if (res[excess] >= 1000 && (res.wood < 250 || res.food < 200))
			{
				const want = res.wood < 250 ? "wood" : "food";
				market.barter(want, excess, 500);
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 ${excess} -> ${want}\n`);
			}
		}
	}
};

// ---------------------------------------------------------------- placement
BrennusBot.prototype.placeWoodStorehouse = function(type)
{
	const spot = this.woodlineDropSpot();

	return spot ? this.tryConstruct(type, "dropsite", spot, false) : false;
};

BrennusBot.prototype.woodlineDropSpot = function()
{
	const zone = this.woodline;
	if (!zone || zone.kind === "store")
		return null;
	const trees = [];
	for (const id of zone.ids)
	{
		const ent = this.gameState.getEntityById(id);
		const pos = ent?.position();
		const amt = ent?.resourceSupplyAmount() || 0;
		if (pos && amt > 0)
			trees.push([pos[0], pos[1], amt]);
	}
	if (!trees.length)
		return null;
	return this.weightedMedian(trees);
};

BrennusBot.prototype.weightedMedian = function(points)
{
	let sx = 0, sz = 0, sw = 0;
	for (const p of points)
	{
		sx += p[0] * p[2];
		sz += p[1] * p[2];
		sw += p[2];
	}
	let x = sx / sw, z = sz / sw;
	for (let it = 0; it < 30; ++it)
	{
		let nx = 0, nz = 0, nw = 0;
		for (const p of points)
		{
			const d = Math.hypot(p[0] - x, p[1] - z);
			if (d < 0.5)
				continue;
			const w = p[2] / d;
			nx += p[0] * w;
			nz += p[1] * w;
			nw += w;
		}
		if (!nw)
			break;
		x = nx / nw;
		z = nz / nw;
	}
	return [x, z];
};

BrennusBot.prototype.findMinimaxSpot = function(templateType, points, region)
{
	const template = this.gameState.getTemplate(templateType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const angle = this.getPlacementAngle();
	const pass = this.gameState.getPassabilityMap();
	const mask = this.gameState.getPassabilityClassMask("building-land");
	const terr = this.territoryMap;
	let sx = 0, sz = 0;
	for (const p of points)
	{
		sx += p[0];
		sz += p[1];
	}
	const cx = sx / points.length, cz = sz / points.length;
	let best, bestScore = Infinity;
	for (let r = 4; r <= 40; r += 2)
		for (let a = 0; a < 64; ++a)
		{
			const ang = a * 2 * Math.PI / 64;
			const x = cx + r * Math.cos(ang);
			const z = cz + r * Math.sin(ang);
			if (this.failedSpots.some(f => Math.abs(f[0] - x) < 6 && Math.abs(f[1] - z) < 6))
				continue;
			if (this.nearEnemy([x, z], 100, 60))
				continue;
			if (this.accessibility.getAccessValue([x, z]) !== region)
				continue;
			if (!this.placementOK(x, z, halfW, halfD, angle, pass, mask, terr))
				continue;
			let score = 0;
			for (const p of points)
			{
				const d = Math.hypot(x - p[0], z - p[1]);
				if (d > score)
					score = d;
			}
			if (score < bestScore)
			{
				bestScore = score;
				best = [x, z];
			}
		}
	return best;
};

BrennusBot.prototype.tryConstruct = function(templateType, kind, center, rush)
{
	const cc = this.getCivicCentre();
	if (!cc)
		return false;
	const ccPos = cc.position();

	const region = this.accessibility.getAccessValue(ccPos);
	// Only place in the CC's land region: a spot across a cliff or river sits unbuilt forever.
	let pos;
	if (kind === "house")
		pos = this.findGridSpot(templateType, this.housePlots(ccPos), region);
	else if (kind === "field")
		pos = this.findGridSpot(templateType, this.fieldPlots(ccPos), region);
	else if (kind === "dropsite")

		pos = this.findBuildingPosition(templateType, center || ccPos, 10, 28, true, region);
	else

		pos = this.findBuildingPosition(templateType, center || ccPos, 10, 130, true, region);
	if (!pos && kind !== "dropsite")

		pos = this.findBuildingPosition(templateType, ccPos, 12, 120, true, region);
	if (!pos)
		return false;
	return this.placeOrder(templateType, pos, rush) ? pos : false;
};

BrennusBot.prototype.placeOrder = function(templateType, pos, rush)
{
	const builder = this.gameState.getOwnUnits().filter(ent =>
		(!this.army || !this.army[ent.id()]) && (!this.rams || !this.rams[ent.id()]) &&
		(!this.healers || !this.healers[ent.id()])).filterNearest(pos, 1).toEntityArray()[0];
	if (!builder)
		return false;
	builder.construct(templateType, pos[0], pos[1], this.getPlacementAngle(), undefined);
	this.pendingBuilds.push({ "template": templateType, "x": pos[0], "z": pos[1], "turn": this.turn });
	if (rush)
		this.rushBuilds.push({ "x": pos[0], "z": pos[1], "turn": this.turn });
	return true;
};

/** All buildings share the CC's orientation angle (keeps the grids consistent). */
BrennusBot.prototype.getPlacementAngle = function()
{
	if (this.ccAngle === undefined)
	{
		const cc = this.getCivicCentre();
		if (!cc)
			return 0;
		this.ccAngle = cc.angle() ?? 0;
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(2)}m placement angle=${(this.ccAngle * 180 / Math.PI).toFixed(1)}°\n`);
	}
	return this.ccAngle;
};

BrennusBot.prototype.housePlots = function(ccPos)
{
	if (this._housePlots)
		return this._housePlots;
	const angle = this.getPlacementAngle();
	const cosa = Math.cos(angle), sina = Math.sin(angle);
	const plots = [];
	for (let gx = -5; gx <= 5; ++gx)
		for (let gz = -5; gz <= 5; ++gz)
		{
			const dx = gx * 14, dz = gz * 14;
			const dist2 = dx * dx + dz * dz;
			if (dist2 < 18 * 18 || dist2 > 70 * 70)
				continue;
			plots.push([
				ccPos[0] + dx * cosa - dz * sina,
				ccPos[1] + dx * sina + dz * cosa,
				dist2]);
		}
	plots.sort((a, b) => a[2] - b[2]);
	this._housePlots = plots;
	return plots;
};

BrennusBot.prototype.fieldPlots = function(ccPos)
{
	if (this._fieldPlots)
		return this._fieldPlots;
	const angle = this.getPlacementAngle();
	const cosa = Math.cos(angle), sina = Math.sin(angle);
	const plots = [];
	for (let gx = -4; gx <= 4; ++gx)
		for (let gz = -4; gz <= 4; ++gz)
		{
			const dx = gx * 24, dz = gz * 24;
			const dist2 = dx * dx + dz * dz;
			if (dist2 < 58 * 58 || dist2 > 96 * 96)
				continue;
			plots.push([
				ccPos[0] + dx * cosa - dz * sina,
				ccPos[1] + dx * sina + dz * cosa,
				dist2]);
		}
	plots.sort((a, b) => a[2] - b[2]);
	this._fieldPlots = plots;
	return plots;
};

BrennusBot.prototype.findGridSpot = function(templateType, plots, region)
{
	const template = this.gameState.getTemplate(templateType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const angle = this.getPlacementAngle();
	const pass = this.gameState.getPassabilityMap();
	const mask = this.gameState.getPassabilityClassMask("building-land");
	for (const [x, z] of plots)
	{
		if (this.failedSpots.some(f => Math.abs(f[0] - x) < 6 && Math.abs(f[1] - z) < 6))
			continue;
		if (this.nearEnemy([x, z], 100, 60))
			continue;
		if (this.accessibility.getAccessValue([x, z]) !== region)
			continue;
		if (this.placementOK(x, z, halfW, halfD, angle, pass, mask, this.territoryMap))
			return [x, z];
	}
	return undefined;
};

BrennusBot.prototype.findBuildingPosition = function(templateType, center, minRadius, maxRadius, fine, region, extraCheck)
{
	const gameState = this.gameState;
	const template = gameState.getTemplate(templateType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const angle = this.getPlacementAngle();
	const pass = gameState.getPassabilityMap();
	const mask = gameState.getPassabilityClassMask("building-land");
	const terr = this.territoryMap;
	const angles = fine ? 64 : 32;
	const step = fine ? 2 : 3;

	for (let r = minRadius; r <= maxRadius; r += step)
		for (let a = 0; a < angles; ++a)
		{
			const ang = a * 2 * Math.PI / angles;
			const x = center[0] + r * Math.cos(ang);
			const z = center[1] + r * Math.sin(ang);
			if (this.failedSpots.some(f => Math.abs(f[0] - x) < 6 && Math.abs(f[1] - z) < 6))
				continue;
			if (this.nearEnemy([x, z], 100, 60))
				continue;
			if (region !== undefined && this.accessibility.getAccessValue([x, z]) !== region)
				continue;
			if (extraCheck && !extraCheck(x, z))
				continue;
			if (this.placementOK(x, z, halfW, halfD, angle, pass, mask, terr))
				return [x, z];
		}
	return undefined;
};

/** Placement prefilter: true rotated footprint (inflated 0.75 m) passable, territory box own. */
BrennusBot.prototype.placementOK = function(x, z, halfW, halfD, angle, pass, mask, terr)
{
	const hw = halfW + 0.75, hd = halfD + 0.75;
	const ex = hw * Math.abs(Math.cos(angle)) + hd * Math.abs(Math.sin(angle));
	const ez = hw * Math.abs(Math.sin(angle)) + hd * Math.abs(Math.cos(angle));

	const cell = pass.cellSize;
	const x0 = Math.floor((x - ex) / cell), x1 = Math.floor((x + ex) / cell);
	const z0 = Math.floor((z - ez) / cell), z1 = Math.floor((z + ez) / cell);
	if (x0 < 0 || z0 < 0 || x1 >= pass.width || z1 >= pass.height)
		return false;
	const cosa = Math.cos(angle), sina = Math.sin(angle);
	for (let j = z0; j <= z1; ++j)
		for (let i = x0; i <= x1; ++i)
		{

			const dx = (i + 0.5) * cell - x;
			const dz = (j + 0.5) * cell - z;
			const u = dx * cosa + dz * sina;
			const v = -dx * sina + dz * cosa;
			if (Math.abs(u) <= hw && Math.abs(v) <= hd &&
				(pass.data[i + j * pass.width] & mask))
				return false;
		}

	const tcell = terr.cellSize;
	const tx0 = Math.floor((x - ex) / tcell), tx1 = Math.floor((x + ex) / tcell);
	const tz0 = Math.floor((z - ez) / tcell), tz1 = Math.floor((z + ez) / tcell);
	if (tx0 < 0 || tz0 < 0 || tx1 >= terr.width || tz1 >= terr.height)
		return false;
	for (let j = tz0; j <= tz1; ++j)
		for (let i = tx0; i <= tx1; ++i)
			if ((terr.data[i + j * terr.width] & 0x1F) !== this.player)
				return false;
	return true;
};

// ---------------------------------------------------------------- threats
/** Threat lists refreshed each block; owner 0 is gaia — only animals with Attack count (every tree is "enemy"). */
BrennusBot.prototype.updateEnemyPositions = function()
{
	this.enemyStructuresPos = [];
	this.enemyMobilesPos = [];
	let army = 0, siege = 0, nearest = Infinity;
	const ccPos = this.getCivicCentre()?.position();
	for (const ent of this.gameState.getEnemyEntities().values())
	{
		if (ent.owner() === 0 && !(ent.hasClass("Animal") && ent.get("Attack")))
			continue;
		const pos = ent.position();
		if (!pos)
			continue;
		if (ent.hasClass("Structure"))
		{
			this.enemyStructuresPos.push(pos);
			continue;
		}
		this.enemyMobilesPos.push(pos);
		if (ent.owner() === 0)
			continue;
		if (ent.hasClass("Siege"))
			siege++;
		else if (ent.hasClass("Soldier"))
			army++;
		if (ccPos)
			nearest = Math.min(nearest, SquareDistance(pos, ccPos));
	}
	this.enemyArmy = army;
	this.enemySiege = siege;
	this.enemyNearestHome = Math.sqrt(nearest);

	// First-contact telemetry: log once per threshold crossing (tightening).
	for (const th of [400, 250, 150, 80])
		if (this.enemyNearestHome < th && (this.threatLogged === undefined || this.threatLogged > th))
		{
			this.threatLogged = th;
			print(`[THREAT] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m enemy army=${army} siege=${siege} nearest=${Math.sqrt(nearest).toFixed(0)}m from home CC\n`);
		}
};

BrennusBot.prototype.nearEnemy = function(pos, structureDist, mobileDist)
{
	const sd2 = structureDist * structureDist;
	for (const epos of this.enemyStructuresPos || [])
		if (SquareDistance(epos, pos) < sd2)
			return true;
	const md2 = mobileDist * mobileDist;
	for (const epos of this.enemyMobilesPos || [])
		if (SquareDistance(epos, pos) < md2)
			return true;
	return false;
};

// ---------------------------------------------------------------- defense
/** War-stage standing army size. Pop math under the 300 cap: 150 workers + 10 healers + 6 rams (3 pop each) + 120 = 298. 100 was not enough to raid through a camped Petra (agg11 s3: three raids at 60-63 bounced off 19-37 defenders + CC arrows; the one raid that razed a CC had to wait for a quiet window). */
BrennusBot.prototype.defenseArmyTarget = 120;

BrennusBot.prototype.armyCount = function()
{
	let n = 0;
	for (const id in this.army)
		n++;
	return n;
};

/**
 * Goal-10 defense: the muster starts at the town phase — aggressive Petra's
 * first waves arrive around 15-17 min, long before the boom completes, and
 * starting defense at city+300pop (goal 9) meant meeting a 90-unit army with
 * 4 soldiers (baseline: all 5 seeds defeated at 26-33 min). A standing army
 * mustered from town phase (barracks spearmen/javelineers, temple fanatics
 * after the boom), workers sheltering in garrisonable structures when
 * enemies are close, and the army blob sent to whichever CC has enemies
 * near it.
 */
BrennusBot.prototype.manageDefense = function()
{
	const gameState = this.gameState;

	// Roster: drop the dead; once the defense stage is on, every Soldier joins the army.
	for (const id in this.army)
		if (!gameState.getEntityById(+id))
			delete this.army[id];
	for (const id in this.rams)
		if (!gameState.getEntityById(+id))
			delete this.rams[id];
	for (const id in this.healers)
		if (!gameState.getEntityById(+id))
			delete this.healers[id];
	if (this.defenseOn())
		for (const ent of gameState.getOwnUnits().values())
		{
			const id = ent.id();
			if (ent.hasClass("Siege") && !this.rams[id])
			{
				this.rams[id] = 1;
				continue;
			}
			if (ent.hasClass("Healer"))
			{
				this.healers[id] = 1;
				delete this.assignments[id];
				continue;
			}
			if (this.army[id] || !ent.hasClass("Soldier") || id === this.herderId)
				continue;
			this.army[id] = 1;
			delete this.assignments[id];
			if (ent.position())
				ent.setStance("defensive");
		}

	this.manageDefenseBuildings();
	this.manageDefenseTraining();
	this.manageMilitaryTechs();

	// Enemy soldiers/siege in the world, once for the threat scan and the shelter.
	const mil = [];
	const milSiege = [];
	for (const ent of gameState.getEnemyUnits().values())
	{
		if (ent.owner() === 0 || (!ent.hasClass("Soldier") && !ent.hasClass("Siege")))
			continue;
		const pos = ent.position();
		if (!pos)
			continue;
		mil.push(pos);
		if (ent.hasClass("Siege"))
			milSiege.push(pos);
	}

	// Threat: enemies within 120 m of an own CC; the CC nearest home wins.
	// Serious means a real assault (8+ units, or siege within 160 m) — only a
	// serious threat cancels or blocks a raid; small probing parties are the
	// standing army's everyday job and must not pin it at home forever.
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const homePos = this.getCivicCentre()?.position();
	let threat;
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.templateName() !== ccType || !ent.position())
			continue;
		const cp = ent.position();
		let n = 0, sx = 0, sz = 0;
		for (const p of mil)
		{
			if (SquareDistance(p, cp) > 120 * 120)
				continue;
			n++;
			sx += p[0];
			sz += p[1];
		}
		let siegeN = 0;
		for (const p of milSiege)
			if (SquareDistance(p, cp) < 160 * 160)
				siegeN++;
		if (!n && !siegeN)
			continue;
		const score = homePos ? SquareDistance(cp, homePos) : -(n + siegeN);
		if (!threat || score < threat.score)
			threat = { "x": sx / Math.max(n, 1), "z": sz / Math.max(n, 1), "n": n, "siegeN": siegeN, "score": score, "ccx": cp[0], "ccz": cp[1], "ccId": ent.id() };
	}

	const armyEnts = [];
	for (const id in this.army)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			armyEnts.push(ent);
	}
	// Healers trail the army everywhere it is sent; they heal passively.
	const healerEnts = [];
	for (const id in this.healers)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			healerEnts.push(ent);
	}
	const serious = threat && (threat.n >= 8 || threat.siegeN > 0);
	if (serious)
	{
		// Defense takes precedence over any raid.
		if (this.offense)
		{
			this.offense = undefined;
			for (const ent of armyEnts)
				ent.setStance("defensive");
			if (homePos)
				for (const id in this.rams)
				{
					const ram = gameState.getEntityById(+id);
					if (ram?.position())
						ram.move(homePos[0], homePos[1]);
				}
		}
		if (!this.hadThreat)
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m engaging ${threat.n} enemies (siege=${threat.siegeN}) near CC ${threat.x.toFixed(0)},${threat.z.toFixed(0)} (army=${armyEnts.length})\n`);
		if (this.turn >= this.armyCmdTurn)
		{
			this.armyCmdTurn = this.turn + 10;
			// threat.n counts only enemies already within 120 m of the CC;
			// the rest of the wave is still marching in (agg9 s3: threat.n=8
			// hid a 105-unit wave — the 59-strong army attack-moved into the
			// open and melted in 1.5 min). Compare against everyone within
			// 150 m of the threat centroid instead.
			let nearThreat = 0;
			for (const p of mil)
				if (SquareDistance(p, [threat.x, threat.z]) < 150 * 150)
					nearThreat++;
			nearThreat = Math.max(nearThreat, threat.n);
			// Garrisoned soldiers (not the ungarrisoned remainder) decide
			// superiority — 20 in the CC is +20 arrows, and they eject into
			// the fight once the balance flips.
			// Shelters: the threatened CC, then built defense towers within
			// 120 m of it. A stone tower holds 5 infantry at +1 arrow each
			// (default 4, GarrisonArrowMultiplier 1, GarrisonArrowClasses
			// Infantry) — five full towers shelter 25 soldiers behind ~45
			// extra arrows; the CC alone could not hold the army (agg10 s3:
			// the 39-man overflow stood outside and was slaughtered).
			const shelters = [];
			{
				const ccEnt0 = gameState.getEntityById(threat.ccId);
				if (ccEnt0)
					shelters.push(ccEnt0);
				const towerType = gameState.applyCiv("structures/{civ}/defense_tower");
				for (const ent of gameState.getOwnStructures().values())
					if (ent.templateName() === towerType && ent.position() &&
						ent.foundationProgress() === undefined &&
						SquareDistance(ent.position(), [threat.ccx, threat.ccz]) < 120 * 120)
						shelters.push(ent);
			}
			if (this.armyCount() >= nearThreat)
			{
				// Local superiority: eject the garrisons and take the fight to them.
				for (const s of shelters)
					for (const gid of s.garrisoned() || [])
					{
						const g = gameState.getEntityById(gid);
						if (g?.hasClass("Soldier") || g?.hasClass("Healer"))
							s.unload(gid);
					}
				for (const ent of armyEnts)
					ent.attackMove(threat.x, threat.z, "Unit", false);
				for (const ent of healerEnts)
					ent.move(threat.x, threat.z);
			}
			else
			{
				// Outnumbered: garrison the shelters, CC first. Each
				// garrisoned soldier is +1 arrow (civil_centre and tower
				// GarrisonArrowMultiplier), the CC garrison heals at 1 hp/s
				// and the CC cannot be captured while manned — standing
				// outside and trading against a bigger blob is a donation
				// (agg3 s3: 34 basics melted into a 106-unit wave at 16m
				// while the CC idled).
				const frees = shelters.map(s => Math.max(0, (+s.garrisonMax() || 0) - s.garrisonedSlots()));
				const garrisonIn = ent =>
				{
					for (let i = 0; i < shelters.length; i++)
						if (frees[i] > 0)
						{
							ent.garrison(shelters[i]);
							frees[i]--;
							return true;
						}
					return false;
				};
				for (const ent of armyEnts)
				{
					ent.setStance("defensive");
					if (!garrisonIn(ent) && SquareDistance(ent.position(), [threat.ccx, threat.ccz]) > 40 * 40)
						ent.move(threat.ccx, threat.ccz);
				}
				for (const ent of healerEnts)
					if (!garrisonIn(ent))
						ent.move(threat.ccx, threat.ccz);
			}
		}
	}
	else if (this.manageOffense(gameState, armyEnts, healerEnts, mil, homePos))
	{
		// raid in progress, commands issued there
	}
	else if (threat)
	{
		// Minor probes while no raid is on: swat them.
		if (this.turn >= this.armyCmdTurn)
		{
			this.armyCmdTurn = this.turn + 10;
			for (const ent of armyEnts)
				ent.attackMove(threat.x, threat.z, "Unit", false);
			for (const ent of healerEnts)
				ent.move(threat.x, threat.z);
		}
	}
	else if (homePos)
	{
		// No threat: if a siege camp loiters near home (Petra piles its
		// army just outside our territory, which both blocks the raid windows and
		// farms our outlying storehouses), sortie against it once we are strong
		// enough — the fight happens under our towers and CC arrows.
		// War-stage only: before city the sortie is a donation — agg5 s1 sent
		// the whole 60-strong muster into Petra's 75-106 blob at 16m and the
		// base fell 9 minutes later.
		if (!this.warOn())
		{
			// stand down: fall through to the rally below
		}
		else
		{
		let campN = 0, cx = 0, cz = 0;
		for (const p of mil)
			if (SquareDistance(p, homePos) < 220 * 220)
			{
				campN++;
				cx += p[0];
				cz += p[1];
			}
		// Sortie only with clear superiority: the camp GROWS while the army
		// marches (Petra converges), and agg8 s2's 20.7m sortie at 60-vs-32
		// turned into 60-vs-83 mid-field and donated ~30 soldiers. 1.5x or
		// stay home and let the towers and CC arrows bleed the camp instead.
		if (campN >= 15 && this.armyCount() >= 100 && this.armyCount() >= campN * 1.5 && this.turn >= this.armyCmdTurn)
		{
			this.armyCmdTurn = this.turn + 10;
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m sortie against siege camp ${(cx / campN).toFixed(0)},${(cz / campN).toFixed(0)} (camp=${campN}, army=${armyEnts.length})\n`);
			for (const ent of armyEnts)
				ent.attackMove(cx / campN, cz / campN, "Unit", false);
			for (const ent of healerEnts)
				ent.move(cx / campN, cz / campN);
		}
		else if (this.turn >= this.armyCmdTurn)
		{
			// Rally: at a pending expansion CC (escort the builders) else home.
			let rally = homePos;
			for (const pb of this.pendingBuilds)
				if (pb.template === ccType)
				{
					rally = [pb.x, pb.z];
					break;
				}
			if (rally === homePos)
				for (const f of gameState.getOwnFoundations().values())
					if (f.position() && gameState.getBuiltTemplate(f.templateName()).templateName() === ccType)
					{
						rally = f.position();
						break;
					}
			if (rally)
			{
				let far = false;
				for (const ent of armyEnts)
					if (SquareDistance(ent.position(), rally) > 60 * 60)
					{
						far = true;
						break;
					}
				if (far)
				{
					this.armyCmdTurn = this.turn + 25;
					for (const ent of armyEnts)
						if (SquareDistance(ent.position(), rally) > 60 * 60)
							ent.move(rally[0], rally[1]);
					for (const ent of healerEnts)
						ent.move(rally[0], rally[1]);
				}
			}
		}
		}
	}
	this.hadThreat = !!serious;

	// Shelter: workers garrison the nearest holder with room when enemies are
	// close (60 m); holders eject once no enemy has been within 100 m for 20 turns.
	const holders = [];
	for (const ent of gameState.getOwnStructures().values())
	{
		if (!ent.position() || ent.foundationProgress() !== undefined || !ent.isGarrisonHolder())
			continue;
		if (ent.healthLevel() < 0.15)
			continue;
		holders.push({ "ent": ent, "pos": ent.position(),
			"free": (+ent.garrisonMax() || 0) - ent.garrisonedSlots() });
	}
	for (const h of holders)
		for (const p of mil)
			if (SquareDistance(p, h.pos) < 100 * 100)
			{
				this.shelterDanger[h.ent.id()] = this.turn;
				break;
			}
	for (const h of holders)
		if (h.ent.garrisonedSlots() > 0 &&
			this.turn - (this.shelterDanger[h.ent.id()] ?? -1000) > 20)
			h.ent.unloadAll();
	if (!mil.length)
		return;
	for (const ent of gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || !ent.position() || this.army[ent.id()] || ent.id() === this.herderId)
			continue;
		const state = ent.unitAIState() || "";
		if (state.indexOf("GARRISON") !== -1 || state.indexOf("REPAIR") !== -1)
			continue;
		const wp = ent.position();
		let danger = false;
		for (const p of mil)
			if (SquareDistance(p, wp) < 60 * 60)
			{
				danger = true;
				break;
			}
		if (!danger)
			continue;
		let best, bestD = 90 * 90;
		for (const h of holders)
		{
			if (h.free <= 0)
				continue;
			const d2 = SquareDistance(h.pos, wp);
			if (d2 < bestD)
			{
				bestD = d2;
				best = h;
			}
		}
		if (best)
		{
			best.free--;
			ent.garrison(best.ent);
		}
	}
};

/**
 * Offense: with no serious threat at home and a strong army, raze the
 * least defended enemy CC — enemy CCs claim the spots our expansion plan
 * needs (200 m rule) and their territory caps our map control. Raid at 75+
 * soldiers with at least 2 rams ready (basic infantry cannot raze a
 * garrisoned CC before reinforcements arrive; 60-strong raids bounced off
 * 19-37 defenders + CC arrows in agg11 s3); retreat and regroup below 50.
 * Goal 10: the last enemy CC is razed too — under conquest_civic_centers
 * eliminating Petra is the win condition. Returns true while a raid is
 * commanded.
 */
BrennusBot.prototype.manageOffense = function(gameState, armyEnts, healerEnts, mil, homePos)
{
	if (!this.warOn() || !armyEnts.length)
		return false;

	const ramEnts = [];
	for (const id in this.rams)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			ramEnts.push(ent);
	}
	const sendRamsHome = () => {
		if (homePos)
			for (const ram of ramEnts)
				ram.move(homePos[0], homePos[1]);
	};
	const sendHealersHome = () => {
		if (homePos)
			for (const ent of healerEnts)
				ent.move(homePos[0], homePos[1]);
	};

	// Goal 10: raze every enemy CC, including the last — under
	// conquest_civic_centers eliminating Petra wins the match.
	const enemyCCs = [];
	for (const ent of gameState.getEnemyStructures().values())
		if (ent.hasClass("CivCentre") && ent.position() &&
			ent.foundationProgress() === undefined)
			enemyCCs.push(ent);

	if (this.offense)
	{
		const target = gameState.getEntityById(this.offense.id);
		if (!target || !target.position())
		{
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m razed enemy CC at ${this.offense.x.toFixed(0)},${this.offense.z.toFixed(0)}\n`);
			this.offense = undefined;
			this.armyCmdTurn = 0;	// rally home next block
			for (const ent of armyEnts)
				ent.setStance("defensive");
			sendRamsHome();
			sendHealersHome();
		}
		else if (ramEnts.length < 1 || this.turn - (this.offense.turn || 0) > 1800)
		{
			// Abort a stalled raid: no rams left means nobody razes the CC —
			// the infantry just dies under its arrows while Petra reinforces
			// (agg7 s1: one raid ground on for 12+ min at full army). The age
			// cap is 6 min, not 2: the walk alone to a far CC takes ~2 min, and
			// agg8 s1 abort/relaunched twice at the 2-min mark — the army walked
			// home and back each time and the second CC never even got attacked.
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raid aborted at ${this.offense.x.toFixed(0)},${this.offense.z.toFixed(0)} (rams=${ramEnts.length}, age=${((this.turn - (this.offense.turn || 0)) / 300).toFixed(1)}m, army=${armyEnts.length})\n`);
			this.offense = undefined;
			this.armyCmdTurn = 0;
			for (const ent of armyEnts)
				ent.setStance("defensive");
			sendRamsHome();
			sendHealersHome();
			return false;
		}
	}
	if (!this.offense)
	{
		if (this.armyCount() < 75)
			return false;
		// No rams, no raze: basic infantry cannot burn a garrisoned CC before
		// reinforcements arrive — agg6 s2 raided with 0 rams at 20-21m and
		// spent the army twice for nothing (the "arsenal not built yet"
		// exception let those raids fire).
		if (ramEnts.length < 2)
			return false;
		if (enemyCCs.length < 1)
			return false;
		let best, bestScore;
		for (const ent of enemyCCs)
		{
			const cp = ent.position();
			let defenders = 0;
			for (const p of mil)
				if (SquareDistance(p, cp) < 100 * 100)
					defenders++;
			const score = defenders * 10000 + (homePos ? SquareDistance(cp, homePos) : 0);
			if (best === undefined || score < bestScore)
			{
				best = ent;
				bestScore = score;
			}
		}
		if (!best)
			return false;
		const bp = best.position();
		this.offense = { "id": best.id(), "x": bp[0], "z": bp[1], "turn": this.turn };
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raiding enemy CC ${bp[0].toFixed(0)},${bp[1].toFixed(0)} (defenders=${Math.floor(bestScore / 10000)}, army=${armyEnts.length}, rams=${ramEnts.length})\n`);
		for (const ent of armyEnts)
			ent.setStance("aggressive");
	}
	if (this.armyCount() < 50)
	{
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raid spent, regrouping (army=${armyEnts.length})\n`);
		this.offense = undefined;
		this.armyCmdTurn = 0;
		for (const ent of armyEnts)
			ent.setStance("defensive");
		sendRamsHome();
		sendHealersHome();
		return false;
	}
	if (this.turn < this.armyCmdTurn)
		return true;
	this.armyCmdTurn = this.turn + 10;
	for (const ent of armyEnts)
	{
		if (SquareDistance(ent.position(), [this.offense.x, this.offense.z]) < 60 * 60)
			ent.attack(this.offense.id, false);
		else
			ent.attackMove(this.offense.x, this.offense.z, "Unit", false);
	}
	for (const ram of ramEnts)
	{
		if (SquareDistance(ram.position(), [this.offense.x, this.offense.z]) < 50 * 50)
			ram.attack(this.offense.id, false);
		else
			ram.attackMove(this.offense.x, this.offense.z, "Structure", false);
	}
	for (const ent of healerEnts)
		ent.move(this.offense.x, this.offense.z);
	return true;
};

/** Military buildings: 3 barracks + 5 home towers from the town phase on (the early-muster package — 5 towers because a garrisoned stone tower is 9 arrows, and the wave arrives before the war stage does); after the boom the full set — 4 barracks, temples, forge, arsenal + 4 towers per expansion CC. Stone is plentiful on mainland; towers are our cheapest defense. */
BrennusBot.prototype.manageDefenseBuildings = function()
{
	if (!this.defenseOn() || this.arbiter.held("construction"))
		return;
	const gameState = this.gameState;
	const boom = this.warOn();
	const wants = [
		[gameState.applyCiv("structures/{civ}/barracks"), boom ? 4 : 3],
		// Arsenal before temples post-city: the raid gate is rams, and agg6
		// s2's arsenal landed ~10 min after city, pushing the first real raid
		// to 33.7m.
		[gameState.applyCiv("structures/{civ}/arsenal"), boom ? 2 : 0],
		[gameState.applyCiv("structures/{civ}/temple"), boom ? 3 : 1],
		[gameState.applyCiv("structures/{civ}/forge"), boom ? 1 : 0]
	];
	// While any of these is missing, training holds a wood reserve (see
	// manageDefenseTraining) so the buildings actually get funded — otherwise
	// unit batches burn the stock below the wood gate for minutes on end
	// and the temples/forge/arsenal land 10 minutes late (def11, seed 5).
	let missingAny = false;
	const haveByType = {};
	for (const [type, want] of wants)
	{
		let have = 0;
		for (const ent of gameState.getOwnStructures().values())
			if (ent.templateName() === type)
				have++;
		// getOwnStructures misses foundations' built name: count them separately.
		for (const f of gameState.getOwnFoundations().values())
			if (gameState.getBuiltTemplate(f.templateName()).templateName() === type)
				have++;
		haveByType[type] = have;
		if (have < want && !this.pendingBuilds.some(pb => pb.template === type))
			missingAny = true;
	}
	this.arbiter.declare("defenseGap", missingAny);
	for (const [type, want] of wants)
	{
		if (haveByType[type] >= want || this.pendingBuilds.some(pb => pb.template === type))
			continue;
		if (this.arbiter.books("defenseBuildings").wood < (boom ? 350 : 320))
			return;
		if (this.tryConstruct(type, "military"))
		{
			// Per-call-site books: this spend accounts against a throwaway copy,
			// exactly like the old anonymous getResources().subtract().
			this.arbiter.spend(this.arbiter.books("defenseBuildings"), "defenseBuildings", { "wood": 300 }, type.split("/").pop());
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m defense building ${type.split("/").pop()}\n`);
			this.arbiter.hold("construction");
		}
		return;
	}

	// Towers: 5 around the home CC from the town phase on (they double as
	// garrisoned arrow platforms when the big wave lands), 4 per expansion
	// CC once the army can reach them.
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const home = this.getCivicCentre();
	if (!home)
		return;
	for (const cc of gameState.getOwnStructures().values())
	{
		if (cc.templateName() !== ccType || !cc.position() ||
			cc.foundationProgress() !== undefined)
			continue;
		const isHome = cc.id() === home.id();
		if (!isHome && (this.armyCount() < 30 || !this.warOn()))
			continue;	// no point fortifying a frontier the army cannot reach yet
		if (this.placeTower(cc.position(), isHome ? 5 : 4))
			return;
	}
};

/**
 * Order one defense tower near `center` if fewer than `want` stand (or are
 * planned) within 60 m. Towers must be ≥ 60 m from any other Tower
 * (BuildRestrictions) — the generic placer ignores that, so the candidate
 * filter enforces 65 m against built, foundation and pending towers.
 */
BrennusBot.prototype.placeTower = function(center, want)
{
	const gameState = this.gameState;
	const towerType = gameState.applyCiv("structures/{civ}/defense_tower");
	const towers = [];
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === towerType && ent.position())
			towers.push(ent.position());
	for (const f of gameState.getOwnFoundations().values())
		if (f.position() && gameState.getBuiltTemplate(f.templateName()).templateName() === towerType)
			towers.push(f.position());
	for (const pb of this.pendingBuilds)
		if (pb.template === towerType)
			towers.push([pb.x, pb.z]);
	let near = 0;
	for (const p of towers)
		if (SquareDistance(p, center) < 60 * 60)
			near++;
	if (near >= want)
		return false;
	const res = this.arbiter.books("towers");
	if (res.wood < 300 || res.stone < 300)
		return false;
	const clearOfTowers = (x, z) => !towers.some(p => SquareDistance(p, [x, z]) < 65 * 65);
	const spot = this.findBuildingPosition(towerType, center, 12, 80, true,
		this.accessibility.getAccessValue(center), clearOfTowers);
	if (!spot || !this.placeOrder(towerType, spot))
		return false;
	this.arbiter.spend(res, "towers", { "wood": 100, "stone": 100 }, "tower");
	print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m tower at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} for CC ${center[0].toFixed(0)},${center[1].toFixed(0)}\n`);
	return true;
};

/** Forge upgrades for the standing army, cheapest first. */
BrennusBot.prototype.militaryTechs = [
	["soldier_attack_melee_01", { "food": 200, "metal": 100 }],
	["soldier_attack_ranged_01", { "wood": 200, "metal": 100 }],
	["soldier_resistance_hack_01", { "food": 200, "metal": 100 }],
	["soldier_resistance_pierce_01", { "wood": 200, "metal": 100 }],
	["soldier_attack_melee_02", { "food": 350, "metal": 250 }],
	["soldier_attack_ranged_02", { "wood": 350, "metal": 250 }],
	["soldier_resistance_hack_02", { "food": 350, "metal": 250 }],
	["soldier_resistance_pierce_02", { "wood": 350, "metal": 250 }]
];

BrennusBot.prototype.manageMilitaryTechs = function()
{
	if (!this.warOn() || this.arbiter.held("construction"))
		return;
	const gameState = this.gameState;
	const res = this.arbiter.books("milTechs");
	for (const [tech, cost] of this.militaryTechs)
	{
		if (gameState.isResearched(tech) || gameState.isResearching(tech))
			continue;
		const facility = gameState.findResearchers(tech)?.toEntityArray()
			.filter(ent => ent.foundationProgress() === undefined &&
				(ent.trainingQueue()?.length || 0) <= 1)[0];
		if (!facility || !gameState.canResearch(tech))
			return;
		if (!res.canAfford(cost) || res.metal < (cost.metal || 0) + 150)
			return;
		facility.research(tech);
		this.arbiter.spend(res, "milTechs", cost, tech);
		print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m research ${tech}\n`);
		this.arbiter.hold("construction");
		return;
	}
};

/** Army production: barracks spearmen/javelineers (alternating) from the town phase on, temple fanatics after the boom; dismiss women for pop room only once the boom is done. */
BrennusBot.prototype.manageDefenseTraining = function()
{
	if (!this.defenseOn())
		return;
	const gameState = this.gameState;
	const res = this.arbiter.books("defenseTraining");
	const barracksType = gameState.applyCiv("structures/{civ}/barracks");
	const templeType = gameState.applyCiv("structures/{civ}/temple");
	let queued = 0;
	const trainers = [];
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.foundationProgress() !== undefined)
			continue;
		if (ent.templateName() !== barracksType && ent.templateName() !== templeType)
			continue;
		for (const item of ent.trainingQueue() || [])
			queued += item.count;
		if ((ent.trainingQueue()?.length || 0) <= 1)
			trainers.push(ent);
	}
	// Early muster: 60 soldiers until the war stage (city) — Petra aggressive
	// arrives at ~16 min with ~100 units, so 40 was still half a wave (agg3) —
	// 100 after.
	const target = this.warOn() ? this.defenseArmyTarget : 60;
	const missing = target - this.armyCount() - queued;
	// Healers first: 10 of them halve the effective churn of the standing army.
	let healerCount = 0;
	for (const id in this.healers)
		healerCount++;
	// No stockpile floors before the war stage: the boom spends the flow to
	// near zero every block, so any floor above cost level can never fire
	// (agg1/agg2: zero infantry trained). The early muster draws from the
	// flow instead: batches of 1 at cost-level floors, which splits the
	// income fairly with the woman stream (same 50/50 unit cost, same
	// per-block cadence). After city, batches of 5 with a wood reserve while
	// temples/forge/arsenal are outstanding (def11-13: starving the
	// construction budget froze the muster).
	const boom = this.warOn();
	const milBatch = boom ? 5 : 1;
	const floorF = boom ? 300 : 50;
	const floorW = boom ? (this.arbiter.declared("defenseGap") ? 400 : 300) : 50;
	if (missing > 0 && res.food >= floorF && res.wood >= floorW)
		for (const ent of trainers)
		{
			if (ent.templateName() === barracksType)
			{
				const type = gameState.applyCiv(this.spearNext ?
					"units/{civ}/infantry_spearman_b" : "units/{civ}/infantry_javelineer_b");
				this.spearNext = !this.spearNext;
				ent.train(gameState.getPlayerCiv(), type, milBatch, {});
				this.arbiter.spend(res, "defenseTraining", { "food": 50 * milBatch, "wood": 50 * milBatch }, `infantry x${milBatch}`);
				continue;
			}
			if (healerCount < (boom ? 10 : 4))
			{
				ent.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/support_healer_b"), boom ? 2 : 1, {});
				this.arbiter.spend(res, "defenseTraining", boom ? { "food": 200, "metal": 60 } : { "food": 100, "metal": 30 }, `healer x${boom ? 2 : 1}`);
				healerCount += boom ? 2 : 1;
				continue;
			}
			ent.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/champion_fanatic"), 5, {});
			this.arbiter.spend(res, "defenseTraining", { "food": 600, "wood": 500 }, "fanatics x5");
		}
	// Rams for the raid: keep 6, started early — they are slow and must be
	// mustered before the army hits raid size or every raid goes in without
	// them. Rams are the only thing that razes CCs fast enough; 4 made for
	// 3-7-minute kills in agg6 (first razed CC at 40.2m on s2 — too slow).
	const arsenalType = gameState.applyCiv("structures/{civ}/arsenal");
	let rams = 0;
	const arsenals = [];
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.templateName() !== arsenalType || ent.foundationProgress() !== undefined)
			continue;
		this.arsenalBuilt = true;
		for (const item of ent.trainingQueue() || [])
			rams += item.count;
		if ((ent.trainingQueue()?.length || 0) <= 1)
			arsenals.push(ent);
	}
	for (const id in this.rams)
		rams++;
	if (this.armyCount() >= 40 && rams < 6 && arsenals.length &&
		res.wood >= 350 && res.metal >= 200)
		for (const arsenal of arsenals)
		{
			if (rams >= 6 || res.wood < 350 || res.metal < 200)
				break;
			arsenal.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/siege_ram"), 1, {});
			this.arbiter.spend(res, "defenseTraining", { "wood": 300, "metal": 150 }, "ram");
			rams++;
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m training a ram (${rams}/6)\n`);
		}
	// Pop room for a batch of 5: dismiss workers (idle first) until 5 slots are
	// free, throttled and never below a floor that keeps the economy alive.
	// Post-boom only: before city+300 the women are still racing to pop 300 and
	// dismissing them would deadlock the boom (army pop counts toward 300).
	if (boom && missing > 0 &&
		gameState.getPopulation() > gameState.getPopulationLimit() - 6 &&
		this.turn >= (this.nextDismissTurn || 0))
	{
		let victim, fallback, workers = 0;
		for (const ent of gameState.getOwnUnits().values())
		{
			if (!ent.position() || !ent.isGatherer() || this.army[ent.id()] ||
				ent.id() === this.herderId || ent.hasClass("Soldier") || ent.hasClass("Trader"))
				continue;
			workers++;
			if (ent.isIdle())
			{
				victim = victim || ent;
				continue;
			}
			fallback = fallback || ent;
		}
		victim = victim || fallback;
		if (victim && workers > 145)
		{
			this.nextDismissTurn = this.turn + 3;
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m dismissing a civilian for army pop room (workers=${workers})\n`);
			delete this.assignments[victim.id()];
			victim.destroy();
		}
	}
};

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
		else if (this.assignments[ent.id()])
			counts[this.assignments[ent.id()]]++;
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
	const res = this.arbiter.books("status");

	const rate = cls => {
		const s = this.rateStats[cls];
		return s.theo > 0 ? `${Math.round(100 * s.amount / s.theo)}%` : "-";
	};
	const rates = `wood=${rate("wood")} grain=${rate("grain")} fruit=${rate("fruit")} stone=${rate("stone")} metal=${rate("metal")}`;

	const foodmix = ["fruit", "grain", "meat"].map(c => `${c}=${Math.round(this.rateStats[c].amount)}`).join(" ");
	for (const s of Object.values(this.rateStats))
	{
		s.amount = 0;
		s.theo = 0;
	}

	const dropsiteDist = this.meanDropsiteDistances();
	const terr = this.expansionOn() ? this.territoryPercent() : undefined;
	print(`[HARNESS] t=${Math.round(gameState.getTimeElapsed() / 60000)}m ` +
		`pop=${gameState.getPopulation()}/${gameState.getPopulationLimit()} idle=${idle} starved=${this.starvedUnits || 0} ` +
		`gatherers food=${counts.food} wood=${counts.wood} stone=${counts.stone} metal=${counts.metal} ` +
		`houses=${houses} fields=${fields} town=${town} techs=${techs}/${this.boomTechs.length} ` +
		`rates ${rates} ` +
		`foodmix ${foodmix} ` +
		`dist wood=${dropsiteDist.wood}m grain=${dropsiteDist.grain}m fruit=${dropsiteDist.fruit}m ` +
		`founds=${gameState.getOwnFoundations().toEntityArray().length} failedSpots=${(this.failedSpots || []).length} ` +
		`fruitStock=${Math.round(this.fruitStock)} ` +
		`enemyArmy=${this.enemyArmy || 0} siege=${this.enemySiege || 0} enemyNear=${(this.enemyNearestHome || 0).toFixed(0)}m ` +
		`army=${this.armyCount ? this.armyCount() : 0} ` +
		`woodline=${this.woodline ? this.woodline.kind + "@" +
			(this.woodline.center ? this.woodline.center[0].toFixed(0) + "," + this.woodline.center[1].toFixed(0) : "-") +
			"=" + Math.round(this.woodline.total) : "none"} ` +
		`terr=${terr ? terr.pct + "%(" + terr.own + "/" + terr.total + ")" : "-"} ` +
		`stock ${Math.floor(res.food)}/${Math.floor(res.wood)}/${Math.floor(res.stone)}/${Math.floor(res.metal)}\n`);
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
		const tgt = this.gatherTarget[ent.id()];
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
		const tgt = this.gatherTarget[ent.id()];
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

BrennusBot.prototype.findExpansionWoodStorehouse = function(storeType, center)
{
	const pos = this.findBuildingPosition(storeType, center, 10, 90, true, this.expansionRegion);
	return pos && this.placeOrder(storeType, pos, false) ? pos : false;
};

BrennusBot.prototype.findWonderSpot = function(wonderType)
{
	const template = this.gameState.getTemplate(wonderType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const angle = this.getPlacementAngle();
	const pass = this.gameState.getPassabilityMap();
	const mask = this.gameState.getPassabilityClassMask("building-land");
	const terr = this.territoryMap;
	const ccType = this.gameState.applyCiv("structures/{civ}/civil_centre");
	const anchors = [];
	const cc = this.getCivicCentre();
	if (cc)
		anchors.push([cc.position(), 95]);
	for (const ent of this.gameState.getOwnStructures().values())
		if (ent.templateName() === ccType && ent.position() && ent.id() !== cc?.id())
			anchors.push([ent.position(), 60]);
	for (const anchor of anchors)
		for (let r = 12; r <= anchor[1]; r += 2)
			for (let a = 0; a < 64; ++a)
			{
				const ang = a * 2 * Math.PI / 64;
				const x = anchor[0][0] + r * Math.cos(ang);
				const z = anchor[0][1] + r * Math.sin(ang);
				if (this.failedSpots.some(f => Math.abs(f[0] - x) < 6 && Math.abs(f[1] - z) < 6))
					continue;
				if (this.nearEnemy([x, z], 100, 60))
					continue;
				if (!this.placementOK(x, z, halfW, halfD, angle, pass, mask, terr))
					continue;
				return [x, z];
			}
	return undefined;
};

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
 * Goal 10: the defense stage starts at the town phase (~5 min), not at the
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
 * Goal 10: the war stage starts at the city phase, WITHOUT the pop-300
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

/** Distance (m) from a CC/storehouse at which a mine counts as served. */
BrennusBot.prototype.mineServeDist = 130;

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
	const sites = this.expansionMineDropsites();
	const r2 = this.mineServeDist * this.mineServeDist;
	const served = { "stone": 0, "metal": 0 };
	this.servedMineIds = new Set();
	for (const res of ["stone", "metal"])
		for (const s of gameState.getResourceSupplies(res).values())
		{
			const pos = s.position();
			if (!pos || !s.resourceSupplyAmount() || this.nearEnemy(pos, 100, 60))
				continue;
			if (region !== undefined && this.accessibility.getAccessValue(pos) !== region)
				continue;
			if (!sites.some(d => SquareDistance(pos, d) < r2))
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

	shares.food = rest * 0.50;
	shares.wood = rest * 0.50;
	return shares;
};

BrennusBot.prototype.expansionMineDropsites = function()
{
	const gameState = this.gameState;
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const sites = [];
	for (const ent of gameState.getOwnStructures().values())
		if (ent.position() && (ent.templateName() === storeType || ent.templateName() === ccType))
			sites.push(ent.position());
	for (const f of gameState.getOwnFoundations().values())
	{
		if (!f.position())
			continue;
		const built = gameState.getBuiltTemplate(f.templateName()).templateName();
		if (built === storeType || built === ccType)
			sites.push(f.position());
	}
	return sites;
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
			if (this.nearEnemy(spot, 100, 60))
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

/** Expansion program, one order per block: wonder, far markets, corral, then the next planned CC. */
BrennusBot.prototype.manageExpansion = function()
{
	if (!this.expansionOn())
		return;
	if (!this.expPlan || this.turn - (this.expPlan.turn || 0) >= 750)
		// Recompute every 750 turns (2.5 min): raids raze Petra CCs and their
		// territory reverts to neutral, opening spots the original plan —
		// computed while Petra held half the map — could never claim (def14:
		// plans of 7 spots, 2 orders in 25 min). The freed land must be claimed
		// before Petra rebuilds. wonder/corral/market flags are re-derived from
		// live state, so nothing is lost on rebuild.
		this.expPlan = Object.assign(this.computeExpansionPlan(), { "turn": this.turn });
	const gameState = this.gameState;
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const plan = this.expPlan;

	// Wonder (Glorious Expansion +20% pop): ordered once the first expansion CC stands, before the CC stream.
	if (!plan.wonderDone && plan.next >= 1)
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
		else if (!this.pendingBuilds.some(pb => pb.template === wonderType) &&
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

	if ((plan.marketsPlaced || 0) < this.expMarkets)
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

	if (plan.corralDone === undefined)
		plan.corralDone = false;
	if (plan.corralDone === false)
	{
		const corralType = gameState.applyCiv("structures/{civ}/corral");
		const built = gameState.getOwnStructures().toEntityArray()
			.some(ent => ent.templateName() === corralType);
		if (built || gameState.isResearched("gather_animals_stockbreeding"))
			plan.corralDone = true;
		else if (!this.pendingBuilds.some(pb => pb.template === corralType) &&
			!this.arbiter.held("construction") && this.arbiter.books("expansion").wood >= 300)
		{
			const spot = this.findBuildingPosition(corralType, this.getCivicCentre().position(), 12, 120, true, this.expansionRegion);
			if (spot && this.placeOrder(corralType, spot))
			{
				this.arbiter.spend(this.arbiter.books("expansion"), "expansion", { "wood": 100 }, "corral");
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m corral at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} for the tech tree\n`);
			}
		}
	}
	if (plan.next < plan.spots.length)
	{
		// Two CC projects run concurrently (three once their army is broken):
		// under Petra pressure a single sequential cursor starves the expansion
		// (def9: 2 orders in 30 min). All entity collections are scanned once
		// per call, not per spot.
		const ccConcurrency = (this.enemyArmy || 0) < 60 ? 3 : 2;
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

			{
				// Re-validate the spot against the live state before ordering (borders and the 200 m rule move).
				const template = gameState.getTemplate(ccType);
				const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
				const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
				const nearCC = ccSpots.some(c => SquareDistance(c, spot) < 200 * 200);
				// Once their army is broken, lone stragglers must not stale a spot.
				const enemyNear = this.nearEnemy(spot, 100, this.enemyArmy > 40 ? 60 : 0);
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
			if (!ownCCPos.some(c => SquareDistance(c, spot) < 260 * 260) &&
				((this.enemyArmy || 0) > 100 || this.armyCount() < 50))
			{
				plan.spots.splice(plan.next, 1);
				plan.spots.push(spot);
				continue;
			}
			// Floors above the raw cost: the engine checks the real stock at processing.
			if (!res.canAfford({ "wood": 400, "stone": 400, "metal": 300 }))
				return;
			if (!this.placeOrder(ccType, spot))
				return;
			// A lone builder dies or gets sheltered en route: send a party of 6.
			const party = gameState.getOwnUnits()
				.filter(ent => ent.isGatherer() && ent.position() &&
					!this.army[ent.id()] && ent.id() !== this.herderId)
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
					if (ent.isGatherer() && !ent.hasClass("Cavalry") && ent.isIdle() && !this.army[ent.id()] &&
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
	"gather_animals_stockbreeding",
	"health_civilians_01",
	"wonder_population_cap"

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

// ---------------------------------------------------------------- save/load
BrennusBot.prototype.Serialize = function()
{
	return {
		"assignments": this.assignments,
		"builderAssignments": this.builderAssignments,
		"pendingBuilds": this.pendingBuilds,
		"failedSpots": this.failedSpots,
		"carry": this.carry,
		"gatherTarget": this.gatherTarget,
		"lastDelivery": this.lastDelivery,
		"rateStats": this.rateStats,
		"herderId": this.herderId,
		"herdTarget": this.herdTarget,
		"herdingDone": this.herdingDone,
		"herdStartTurn": this.herdStartTurn,
		"herdStartDist": this.herdStartDist,
		"herdBestDist": this.herdBestDist,
		"herdWoundTurn": this.herdWoundTurn,
		"herdFast": this.herdFast,
		"herdKill": this.herdKill,
		"herdLastPos": this.herdLastPos,
		"herdDrop": this.herdDrop,
		"herdWoundDist": this.herdWoundDist,
		"mineId": this.mineId,
		"expPlan": this.expPlan,
		"expOn": this.expOn,
		"army": this.army,
		"rams": this.rams,
		"healers": this.healers
	};
};

BrennusBot.prototype.Deserialize = function(data, sharedScript)
{
	this.savedState = data;
	this.isDeserialized = true;
};

function SquareDistance(a, b)
{
	return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]);
}
