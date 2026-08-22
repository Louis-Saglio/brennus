import { BaseAI } from "simulation/ai/common-api/baseAI.js";

/**
 * Brennus: AI bot for 0 A.D.
 *
 * Current stage — goal 7 (the boom): City Phase AND 300 population by 15
 * in-game minutes. Everything is subordinated to population growth speed:
 *
 * - Houses are the boom engine: +5 pop cap each (6 with Home Garden, 7 with
 *   Manors) and, once Fertility Festival is researched, a 30 s woman each.
 *   They are mass-built on an aligned grid around the CC (straight rows
 *   leave room for the big 22x22 fields — Louis's placement tip).
 * - Worker training outranks phase research (Louis's tip): training never
 *   pauses; phase costs are accumulated as a resource reserve that training
 *   and construction spend only above.
 * - Technologies are picked for gather-rate impact only (Louis's tip):
 *   Fertility Festival, then food/wood rate and capacity techs, mining
 *   techs once miners are out, and the two house-population techs.
 * - Drop sites go next to the resources they serve (Louis's tip), and keep
 *   following them: a farmstead by the berries, storehouses rebuilt at the
 *   receding woodline AND at the stone/metal mines, farmsteads by each new
 *   field cluster, and depleted storehouses are destroyed. Served berries/
 *   fruit and dead in-territory animals are ONE food pool (Louis: same
 *   gather rate, carcasses never rot — interchangeable): the nearest
 *   served supply wins, fields only once the pool is empty. Fields go next
 *   to a farmstead with free space; woodcutters all work the single
 *   biggest woodline in territory. Verified by telemetry: effective vs
 *   theoretical gather rate (delivery events), reported in the status log
 *   (bar: wood >= 75%, grain >= 85%).
 * - Hunting (Louis's tips): slow animals (chicken/sheep/pig) are killed in
 *   place and collected by the cavalry itself, one at a time; fast fleers
 *   (deer/gazelle) are wounded once, then steered toward the nearest food
 *   dropsite and killed there — in-territory kills go to the civilians,
 *   outside-territory ones the cavalry collects itself. The band reaches
 *   200 m from the CC (probed 200/240/280; 200 is the sweet spot): the
 *   food pool makes far kills pay, and herding beats collecting at every
 *   distance (see the herdMax/herdCutoff/herdPrefer constants).
 * - Trade/barter stay available: a market is part of the town trio, and
 *   surplus wood is bartered for the stone/metal the city phase needs.
 *
 * The init banner is the load canary used by the headless smoke test: if it
 * appears in stdout, the bot was constructed and initialized without script
 * errors.
 */
export function BrennusBot(settings)
{
	BaseAI.call(this, settings);
}

BrennusBot.prototype = Object.create(BaseAI.prototype);

/** Share of all gatherers each resource should have, per phase. Mining is
 * deliberately thin in town phase: the 750/750 city bank is filled mostly
 * by bartering food/wood surpluses, not by 0.35/s women on rock. */
BrennusBot.prototype.gathererShares = {
	1: { "food": 0.55, "wood": 0.45, "stone": 0.0, "metal": 0.0 },
	2: { "food": 0.47, "wood": 0.53, "stone": 0.0, "metal": 0.0 },
	3: { "food": 0.62, "wood": 0.36, "stone": 0.01, "metal": 0.01 }
};

/**
 * Phase shares, with two dynamic overrides:
 * - Town phase splits by trio status: wood-heavy while forge/market/temple
 *   are missing (the city deadline needs their 800 wood in one block each),
 *   food-heavy once they stand (the pop sprint is food-limited — v26 hit
 *   city 14.9 but pop300 17.2 on fixed shares, v27 the reverse).
 * - Mining is rate-matched to the city bank (Louis's bar: 750/750 in hand
 *   by ~13.5 so the research lands before 15.0): just enough miners to
 *   fill the bank (+100 tech allowance) in the time left, zero once full.
 *   Fixed mining shares always lose — too few early (v37/v38: city 16+)
 *   or they starve the wood the boom runs on (v39/v40: pop300 16+).
 */
BrennusBot.prototype.currentShares = function(total)
{
	const phase = this.gameState.currentPhase();
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
			const res = this.gameState.getResources();
			// Once the city research is running the bank is spent: re-mining
			// it stole ~50 workers from the boom at the worst moment (v41).
			const bankingDone = this.gameState.isResearching("phase_city_generic");
			// No mining before t=8: the bank fills in the last minutes easily,
			// and every early miner costs triple in un-trained women (v41/v42:
			// mining from t=4 put the boom ~40 pop behind by t=15).
			const early = this.gameState.getTimeElapsed() < 480000;
			const timeLeft = Math.max(60, (810000 - this.gameState.getTimeElapsed()) / 1000);
			// Metal target: the 750 bank plus whatever the pending grain-rate
			// techs still cost — they are spent from the bank before the city
			// research starts, so the miners pre-fill for them.
			let grainMetal = 0;
			for (const tech of ["gather_farming_plows", "gather_farming_training", "gather_farming_harvester"])
				if (!this.gameState.isResearched(tech) && !this.gameState.isResearching(tech))
					grainMetal += this.gameState.getTemplate(tech).cost().metal || 0;
			const target = { "stone": 850, "metal": 850 + grainMetal };
			let mining = 0;
			for (const res2 of ["stone", "metal"])
			{
				const needed = bankingDone || early ? 0 : target[res2] - res[res2];
				// Women mine ~0.35/s before techs.
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
	return { ...base };
};

BrennusBot.prototype.houseTrainingTech = "unlock_civilians_house_generic";

/**
 * Boom technologies in priority order (phase gating is enforced by
 * findResearchers returning nothing before the phase unlocks). Only
 * wood/stone/metal costs: food goes to the woman stream, so food-costing
 * techs (capacity, mining) are deliberately out — women at 50 food are
 * worth more than +25% on a dozen miners.
 */
BrennusBot.prototype.boomTechs = [
	// village
	"gather_wicker_baskets",       // +50% fruit rate (berries are the early food)
	"gather_farming_plows",        // +20% grain rate
	// town — grain-rate techs first: food income is the pop bottleneck, and
	// they cost the metal the city bank wants, so they must land before the
	// 750 reserve activates (v41-v43: queued behind, fired at 14.7, useless)
	"gather_farming_training",     // +20% grain rate
	"gather_farming_harvester",    // +10% grain rate (gaul, town)
	"gather_lumbering_ironaxes",   // +25% wood rate (houses eat wood)
	"pop_house_01",                // houses +20% pop: 5 -> 6
	"gather_capacity_basket",      // +5 carry capacity: fewer walk trips
	"gather_lumbering_strongeraxes",
	// city
	"pop_house_02",                // houses +20% pop: 6 -> 7
	"gather_farming_fertilizer"
];

/**
 * Phase-up costs kept as a reserve: training and construction may only
 * spend above it, so the bank fills without ever pausing production.
 */
BrennusBot.prototype.phaseUpCost = {
	"phase_town_generic": { "food": 500, "wood": 500 },
	"phase_city_generic": { "stone": 750, "metal": 750 }
};

/** Population margin below which houses are ordered (they ARE production). */
BrennusBot.prototype.houseMargin = 16;
/** Concurrent house foundations allowed (houses are both cap and trainers).
 * 3, not more: each foundation pulls 4 gatherers as builders, and the house
 * order rate must stay below the wood income so trio/techs see a surplus. */
BrennusBot.prototype.maxHouseFoundations = 4;
/** Furthest animal the herder targets, from the CC (m). Probed 200/240/280
 * (2026-08-22): 200 captures the meat gains at no measurable boom cost;
 * beyond, the extra targets pay but the metrics go flat-to-worse (seed 3
 * city 14.1/14.3/14.6 at 200/240/280). v71's 200 m regression (-0.2 min)
 * was BEFORE the food pool — in-territory kills now feed civilians
 * immediately, which is what makes the extension cheap. */
BrennusBot.prototype.herdMax = 200;
/** Skittish animals beyond this distance (m) are not herded: killed in place
 * and collected by the cavalry, like the non-fleeing animals. Probed (140/
 * 160/200 vs 280): herding WINS at every distance — the chase pushes the
 * carcass ~50 m farther out and the cavalry's collection round trips cost
 * far more than the steer (1 vs 6 far deer processed on seed 5). Set equal
 * to herdMax: everything in the band is herded. */
BrennusBot.prototype.herdCutoff = 200;
/** Prefer herdable targets (skittish within the cutoff) over nearer
 * collectable ones. Probed (2026-08-22): the preference redirected the
 * herder from 37 m chickens to 127 m deer and cost seed 5 city +0.5 min —
 * nearest-first stays. */
BrennusBot.prototype.herdPrefer = false;

BrennusBot.prototype.CustomInit = function(gameState)
{
	print(`[HARNESS] brennus: loaded for player ${this.player}\n`);
	// Placement orientation (Louis): every building is aligned on the civic
	// centre's own angle. Cached lazily on first use — the CC never turns,
	// and after a save/load the world state is identical, so re-deriving is
	// deterministic and nothing needs serializing.
	this.ccAngle = undefined;
	// entityID -> resource this unit was ordered to gather.
	this.assignments = this.savedState?.assignments || {};
	// foundationID -> [entityID] of its sticky builders (never overlapping).
	this.builderAssignments = this.savedState?.builderAssignments || {};
	// Construct orders awaiting their foundation: [{template, x, z, turn}].
	this.pendingBuilds = this.savedState?.pendingBuilds || [];
	// [x, z] spots where a construct command failed; never retried.
	this.failedSpots = this.savedState?.failedSpots || [];
	// Gather-rate telemetry (Louis's dropsite verification: effective rate
	// must be >= 75% of theoretical for wood, >= 85% for grain).
	this.carry = this.savedState?.carry || {};               // id -> {type, amount} last block
	this.gatherTarget = this.savedState?.gatherTarget || {}; // id -> {generic, specific, supplyId, dr}
	this.lastDelivery = this.savedState?.lastDelivery || {}; // id -> sim ms of last drop-off
	this.rateStats = this.savedState?.rateStats ||
		{ "wood": { "amount": 0, "theo": 0 }, "grain": { "amount": 0, "theo": 0 },
		  "fruit": { "amount": 0, "theo": 0 }, "meat": { "amount": 0, "theo": 0 },
		  "stone": { "amount": 0, "theo": 0 }, "metal": { "amount": 0, "theo": 0 } };
	// Cavalry herding (Louis: the starting cavalry pushes wild animals toward
	// the CC; civilians collect the kills). herderId is exempt from the
	// gatherer shares until herdingDone (no more animals in range).
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
	// Cached in-territory fruit stock (updateWoodline refresh): berries out-
	// rank fields while they last (Louis).
	this.fruitStock = 0;
	// Pinned mine per resource (Louis: concentrate all miners on ONE mine,
	// like the woodline, until it is full — never spread over several).
	this.mineId = this.savedState?.mineId || {};
};

BrennusBot.prototype.OnUpdate = function()
{
	if (this.gameState.playerData.state !== "active")
		return;

	if (this.turn % 5 === 0)
	{
		this.updateEnemyPositions();
		// Research and construction in the same block both see the pre-
		// command resource snapshot: a research order + a construct order
		// together overdraw, the engine rejects the construct at processing,
		// and the spot lands on the failedSpots blacklist. Hold construction
		// for one block after any research order.
		this.constructionHold = false;
		this.updateWoodline();
		this.assignGatherers();
		this.manageHerding();
		this.sampleGatherRates();
		this.managePhaseUp();
		this.manageResearch();
		this.trainWorkers();
		this.manageConstruction();
		this.manageBarter();
	}
	const phase = this.gameState.currentPhase();
	if (phase !== this.lastPhase)
	{
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m phase=${this.gameState.getPhaseName(phase)}\n`);
		this.lastPhase = phase;
	}
	// Goal-7 telemetry: the boom deadline is measured on this line and the
	// phase line above (end-of-game statistics carry no timestamps).
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

/** Find idle gatherers and send them to the most-needed resource. */
BrennusBot.prototype.assignGatherers = function()
{
	const counts = { "food": 0, "wood": 0, "stone": 0, "metal": 0 };
	const idle = [];

	// The city bank is spent the moment the research starts: stop every
	// miner once so the shares reassign them to the boom (~25 workers
	// mined a bank nobody needed anymore until the deadline — v52).
	if (!this.minersFreed && (this.gameState.isResearching("phase_city_generic") ||
		this.gameState.isResearched("phase_city_generic")))
	{
		this.minersFreed = true;
		for (const ent of this.gameState.getOwnUnits().values())
			if ((this.assignments[ent.id()] === "stone" || this.assignments[ent.id()] === "metal") &&
				ent.isGatherer() && !ent.isIdle() && ent.position())
				ent.stopMoving();
	}

	// Same persistence problem as the miners, but continuous: the engine's
	// gather autocontinue drifts berry pickers (and now carcass gatherers)
	// to ever-farther unserved supplies without consulting findSupply (v57:
	// pickers at 214 m, 20% rate). Stop food gatherers of the served-pool
	// subtypes working > 45 m from every food dropsite — the shares
	// reassign them to served food or the fields. Only while actively
	// gathering and empty-handed: stopping a returner kills its whole
	// loaded cycle (v58 food collapse).
	{
		const sites = this.foodDropsitePositions();
		for (const ent of this.gameState.getOwnUnits().values())
		{
			if (this.assignments[ent.id()] !== "food" || !ent.isGatherer() ||
				ent.isIdle() || !ent.position())
				continue;
			// The herding cavalry carries a stale turn-0 "food" assignment
			// and works carcasses beyond 45 m of every dropsite: exempt it,
			// or the drift stop halts it on every walk back to the carcass
			// (the micro-pauses Louis saw).
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
		if (!ent.isGatherer() || !ent.position())
			continue;
		// The herding cavalry is on animal duty, not in the shares (Louis).
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
		// Resources this unit can gather, most unmet need first; take the
		// first one with an available supply (surplus workers spill over to
		// less-needed resources rather than idling).
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
				// Louis: an attacked animal flees the attacker — approach from
				// the side opposite the nearest dropsite so it runs TOWARD the
				// base instead of away from it.
				const sp = supply.position();
				const drop = this.nearestFoodDropsite(sp);
				const dx = sp[0] - drop[0], dz = sp[1] - drop[1];
				const n = Math.hypot(dx, dz) || 1;
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

/** Nearest gatherable supply of the given resource in the unit's land region. */
BrennusBot.prototype.findSupply = function(unit, resource)
{
	const pos = unit.position();
	const region = this.accessibility.getAccessValue(pos);
	// Louis: all choppers on the ONE biggest woodline in territory — never
	// spread over scattered sites; the line is re-picked when it runs out.
	if (resource === "wood" && this.woodline)
	{
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
			const d = SquareDistance(pos, supplyPos);
			if (d < bestD)
			{
				bestD = d;
				best = supply;
			}
		}
		if (best)
			return best;
	}
	// Louis: served berries/fruit and dead in-territory animals are ONE food
	// pool — same gather rate, carcasses never rot, so they are
	// interchangeable. The nearest SERVED supply (within 40 m of a food
	// dropsite) wins: trekking 100+ m to unserved food runs at ~20% rate,
	// worse than the fields (v55). Unserved patches are made served by the
	// farmstead chaining in manageDropSites. Alive animals stay the herder's
	// job. Fields (grain) fall through to the generic path below.
	// Carve-out: the carcass the herding cavalry is actively collecting (its
	// slow kills, fast kills landed outside the territory) stays the
	// herder's — a civilian walking to it only duplicates the collection and
	// wastes a berry walk. In-territory fast kills are deliberately dropped
	// by the herder (herdTarget moves on the same block) and stay in the
	// pool.
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
	// Pinned mine first (Louis: concentrate miners on one mine until it is
	// full — isFull() spills the surplus to the nearest other mine).
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
	// filterNearest returns entities sorted nearest-first.
	let candidates = this.gameState.getResourceSupplies(resource).filterNearest(pos, 10).toEntityArray();
	if (resource === "food")
		// byResource excludes huntable animals; add them explicitly.
		candidates = candidates.concat(this.gameState.getHuntableSupplies().filterNearest(pos, 10).toEntityArray());
	const foodSites = resource === "food" ? this.foodDropsitePositions() : null;

	// Note (Louis tip 5, v79/v80, discarded): spreading field workers to the
	// least-crowded field was probed — global spread gave seed 1 pop300
	// 14.9 -> 15.1, and a 25 m cluster-window version pushed city back ~0.7
	// on both probe seeds. The extra walk costs more than the diminishing-
	// returns gain; nearest-first stays.
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
		// Louis: never trek across the map for unserved food — a field by a
		// farmstead beats a 100 m walk (v56: ~6 pickers idling at 17%
		// effective rate 140+ m out once the fields filled up). Served-only
		// for fruit AND meat (v84): the drift stop halts any food worker
		// whose supply sits beyond 45 m of every dropsite, so returning an
		// unserved supply here loops the unit (stop → reassign → drift →
		// stop, every block — the micro-pauses Louis saw). Fields (grain)
		// are exempt: the farmstead chaining serves them.
		if (foodSites &&
			(supply.resourceSupplyType()?.specific === "fruit" ||
				supply.resourceSupplyType()?.specific === "meat") &&
			!foodSites.some(d => SquareDistance(supplyPos, d) < 45 * 45))
			continue;
		// Louis: civilians never leave the territory for meat — the walk
		// costs more than the carcass pays, and non-fleeing animals killed
		// far out would pull them across the map. The cavalry herds animals
		// in and gathers the outside-territory carcasses itself.
		if (resource === "food" && supply.isHuntable() && !unit.hasClass("Cavalry") &&
			!this.inOwnTerritory(supplyPos[0], supplyPos[1]))
			continue;
		return supply;
	}
	return undefined;
};

/** Positions of food-accepting dropsites, built or foundation. */
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

/** Nearest food-accepting dropsite position to pos (CC + farmsteads). */
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
 * Hunting, two target classes (Louis's strategy):
 * - Herd (preferred): skittish animals (deer/gazelle at 6.3 m/s) up to the
 *   herd cutoff. Wound-then-steer (Louis's idea): a wounded animal flees
 *   directly away from its attacker and keeps fleeing while the attacker
 *   stays within the flee distance (UnitAI.js FLEEING: distanceToFlee =
 *   distance at wound time + FleeDistance 24, fixed at enter — the order
 *   only finishes when the animal reaches that range). So the cav shoots
 *   ONCE from the far side, then follows closely without attacking: the
 *   animal's flight carries it to the nearest food dropsite, where the kill
 *   shot lands (a deer is left at 7/25 HP by the first javelin). Killed
 *   inside the territory they are left to the civilians (the food pool
 *   collects them like berries), killed outside the cavalry gathers the
 *   carcass itself. Stall detection (stopped fleeing, or 30 s without
 *   closing on the dropsite) falls back to killing in place.
 * - Collect: non-fleeing animals (passive-stance domestics — chicken/sheep/
 *   pig — crawl when fleeing, source-verified: flee speed = WalkSpeed x
 *   1.67, so 1.6-4.7 m/s) anywhere in the band, AND skittish animals
 *   beyond the herd cutoff (too far to steer home — Louis: prefer
 *   collecting when the herdable is too far). Killed in place with no
 *   positioning (the attack pursuit chases the far fleer down) and the
 *   cavalry collects each carcass fully BEFORE moving to the next — one at
 *   a time, never batch kills left behind.
 * Civilians collect served in-territory carcasses exactly like berries
 * (findSupply's combined food pool); they never leave the territory for
 * meat (Louis).
 * One herder, exempt from the gatherer shares; when the band runs dry it
 * keeps hunting beyond it in collect mode (the shares have nothing for a
 * meat-only gatherer — it would just idle) until no animals remain in the
 * region at all. Targets are picked in two passes: nearest herdable first,
 * nearest collectable otherwise — herding wins unless every skittish
 * animal sits beyond the cutoff.
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
			// Clear the stale turn-0 gatherer assignment so the food
			// telemetry never mistakes the herder for a food worker.
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
	if (!target && this.herdTarget !== undefined && this.herdLastPos)
	{
		// The animal died and the engine replaced it with a NEW corpse entity
		// (the old id is gone — verified in-game): adopt the carcass by
		// position so the kill can be collected before the next animal
		// (Louis: one at a time, never batch kills left behind). Nearest dead
		// huntable within 25 m of where the animal was last seen.
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
			print(`[HUNT] t=${(gameState.getTimeElapsed() / 60000).toFixed(2)}m adopted carcass ${target.templateName()} at ${tp[0].toFixed(0)},${tp[1].toFixed(0)} mode=${this.herdKill ? "collect" : "herd"}\n`);
		}
	}
	if (target && !target.get("Health"))
	{
		if (!this.huntDbgLog)
		{
			this.huntDbgLog = true;
			const tp = target.position();
			print(`[HUNT] t=${(gameState.getTimeElapsed() / 60000).toFixed(2)}m carcass ${target.templateName()} at ${tp[0].toFixed(0)},${tp[1].toFixed(0)} mode=${this.herdKill ? "collect" : "herd"} inTerr=${this.inOwnTerritory(tp[0], tp[1])}\n`);
		}
		// Carcass: collect-mode kills (non-fleeing animals, far skittish) are
		// ALWAYS collected by the cavalry, fully, before the next animal (one
		// at a time — Louis); herd-mode kills only when they landed outside
		// the territory (in-territory ones are the civilians' — see the
		// findSupply food pool).
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
		// Next animal. Two classes (Louis: prefer herding in general, collect
		// when the herdable is too far): herdables = skittish animals within
		// the herd cutoff (wound-then-steer); collectables = non-fleeing
		// animals anywhere in the band and skittish beyond the cutoff (killed
		// in place, cavalry collects). With herdPrefer the nearest herdable
		// wins over nearer collectables; otherwise it is plain nearest-first
		// and the cutoff only picks the treatment. The band is 35 to herdMax m
		// from the CC. (200 m was probed as v71 and regressed ~0.2 min —
		// before the food pool, when in-territory kills sat uncollected until
		// the berries ran out.) When the band runs dry, keep hunting beyond
		// it (collect mode) instead of joining the economy: the cavalry's
		// only gather rate is food.meat, so with no served carcass left the
		// shares have NOTHING to assign it and it would idle forever while
		// game remains in sight (Louis's report — steppe horses).
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
			// No animals left anywhere in the region: release the cavalry to
			// the economy (it will idle — a meat-only gatherer with no meat —
			// which is fine, there is nothing left to hunt).
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
		// Fleer class by template stance (source-verified, 0.28.0): domestic
		// animals (chicken/sheep/pig) are passive and crawl when fleeing
		// (1.6-4.7 m/s); deer/gazelle are skittish and run (6.3 m/s). Rabbits
		// are skittish too but die to the first javelin — herded like any
		// fast animal, which is harmless: they die where they stand.
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
		// Collect mode: kill in place, no positioning — a non-fleeing animal
		// barely moves while dying, a far skittish is chased down by the
		// attack pursuit. The carcass branch above makes the cavalry collect
		// it right after. Re-attack at most every 10 turns until it dies.
		this.herdLastPos = target.position();
		if (this.turn >= this.herdCmdTurn)
		{
			this.herdCmdTurn = this.turn + 10;
			herder.attack(target.id(), false);
		}
		return;
	}
	// Herd mode: skittish within the cutoff, wound-then-steer (Louis). The
	// wounded animal flees away from the attacker and keeps fleeing while
	// the attacker stays within the flee distance — so shoot once from the
	// far side, then follow closely without attacking, and kill once the
	// animal is near the nearest food dropsite. One javelin leaves a deer
	// at 7/25 HP: the kill shot is the last re-aim. Stall (stopped fleeing,
	// or 30 s without closing 10 m on the dropsite) → kill in place.
	const pos = target.position();
	this.herdLastPos = pos;
	const drop = this.nearestFoodDropsite(pos);
	const dist = Math.hypot(pos[0] - drop[0], pos[1] - drop[1]);
	this.herdBestDist = Math.min(this.herdBestDist, dist);
	if (target.isHurt() && !this.herdWoundTurn)
	{
		// First detection of the wound: cancel the attack order NOW. The
		// engine's attack keeps firing on its own (javelin RepeatTime is
		// 1.5 s) and the second shot would kill the animal before any
		// steering happens.
		this.herdWoundTurn = this.turn;
		this.herdCmdTurn = 0;
		herder.stopMoving();
		print(`[HUNT] t=${(gameState.getTimeElapsed() / 60000).toFixed(2)}m wounded ${target.templateName()} at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} dropDist=${dist.toFixed(0)}\n`);
		return;
	}
	if (this.turn < this.herdCmdTurn)
		return;
	if (!target.isHurt())
	{
		// Position on the far side, then shoot until the first hit connects
		// (misses wound nothing, so keep trying). 6 m, not more: the javelin
		// spread scales with distance and the wound shot must land reliably
		// (Louis's report: from the old 12 m standoff the kill shot often
		// missed).
		this.herdCmdTurn = this.turn + 10;
		const dx = pos[0] - drop[0], dz = pos[1] - drop[1];
		const n = Math.hypot(dx, dz) || 1;
		const bx = pos[0] + dx / n * 6, bz = pos[1] + dz / n * 6;
		const hp = herder.position();
		if (Math.hypot(hp[0] - bx, hp[1] - bz) > 6 && dist > 25)
			herder.move(bx, bz);
		else
			herder.attack(target.id(), false);
		return;
	}
	const fleeing = (target.unitAIState() || "").indexOf("FLEEING") !== -1;
	// Kill: near the dropsite, or the flee stalled, or the steer made no
	// progress for 30 s.
	if (dist < 25 ||
		(!fleeing && this.turn - this.herdWoundTurn > 10) ||
		(this.turn - this.herdStartTurn > 150 && this.herdBestDist > this.herdStartDist - 10))
	{
		this.herdCmdTurn = this.turn + 10;
		// Close in before the kill shot (Louis): attacking from the standoff
		// fires at the javelin's long-range spread and misses — approach to
		// ~2 m on the far side first (the animal keeps fleeing TOWARD the
		// dropsite while we do), shoot only from within 5 m. On wood-poor
		// biomes attack straight away: the approach's stop-and-go churn is
		// what lets a horse stay ahead, while the attack pursuit moves the
		// cavalry CONTINUOUSLY (walk 12.6 vs horse flee ~9.4 m/s) and closes
		// the gap for the kill.
		const hp = herder.position();
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
	// Steer: stay on the far side, close enough that the animal never
	// reaches its flee distance (fixed at wound time: ~dist + 24 m), and
	// close enough that the kill shot won't miss (6 m, Louis's report).
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

/** Whether the unit has a non-zero gather rate for this supply's subtype. */
BrennusBot.prototype.canGatherSupply = function(unit, supply)
{
	const rates = unit.get("ResourceGatherer/Rates");
	const type = supply.resourceSupplyType();
	if (!rates || !type)
		return false;
	return !!(+rates[type.generic + "." + type.specific] || +rates[type.generic]);
};

/**
 * The one woodline every chopper works (Louis: concentrate on the biggest
 * woodline in the territory, move on only when it is depleted — never
 * spread over scattered sites). Recomputed every 25 turns: wood supplies
 * are binned into 30 m cells, the cell with the most wood in its 90 m
 * neighbourhood is the hotspot, and the zone is the trees within 45 m of
 * its centre — concentrated enough that a single storehouse serves all.
 * (Binning the whole connected forest as one "line" spread the choppers
 * over 200 m of woodland — v36.) The zone is kept until under 800 wood
 * remains, then the next hotspot is picked.
 */
BrennusBot.prototype.updateWoodline = function()
{
	if (this.turn < (this.woodlineRefresh || 0))
		return;
	this.woodlineRefresh = this.turn + 25;
	// Served fruit stock (Louis: berries outrank fields while they last;
	// fields start only when this runs low). SERVED = within 45 m of a food
	// dropsite — distant fruit nobody should walk to must not hold the
	// fields back (v55). CC-region, no enemies.
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
	// Mine concentration (Louis: all miners on ONE mine per resource, like
	// the woodline, until it can't take more gatherers — spreading miners
	// over several mines spreads the storehouses thin too). The pin is the
	// nearest mine to the CC; re-picked only when it is depleted or lost.
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
		if (remaining > 800)
		{
			this.woodline.total = remaining;
			return;
		}
	}
	const scan = inTerritory => {
		const supplies = this.gameState.getResourceSupplies("wood").toEntityArray()
			.filter(s => s.position() && s.resourceSupplyAmount() > 100 &&
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
	this.woodline = scan(true) || scan(false);
	// Wood-poor biome detection (goal 7-S): on the steppe the "trees" are
	// bushes at ~100 wood each (temperate trees are 200-600). Flag the map
	// wood-poor when no wood supply can hold 200 — used to gate the field
	// stream behind the town trio's wood on such biomes. Deterministic and
	// biome-agnostic (works on any bush-wood map).
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
 * Effective vs theoretical gather rates. Every block, watch each gatherer's
 * carried load: when it drops from >0 to 0, a delivery just happened and
 * amount / time-since-previous-delivery is that worker's effective rate over
 * a full gather-walk-drop cycle. The theoretical rate is the template rate
 * for the gathered subtype (technologies included via ent.get), times the
 * supply's diminishing-returns multiplier (fields: dr 0.9), i.e. the rate a
 * worker standing at the supply with a zero-distance dropsite would achieve.
 * Aggregated as sum(delivered) / sum(theoRate * cycleTime) per class; read
 * in logStatus. Louis's bar: wood >= 75%, grain >= 85%.
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

		// While gathering, remember the target supply: its subtype sets the
		// theoretical rate and fields carry diminishing returns. (Same order-
		// data lookup as entity.currentGatherRate.)
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
			// Drop-off: any delivery resets the cycle clock; only full-ish
			// loads become samples (partial drops after supply exhaustion
			// include idle time and would pollute the metric).
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
	// Prune state of dead units.
	for (const map of [this.carry, this.gatherTarget, this.lastDelivery])
		for (const id in map)
			if (!seen[id])
				delete map[id];
};

// ---------------------------------------------------------------- phases

/** The phase-up tech for the current phase, if any. */
BrennusBot.prototype.nextPhaseTech = function()
{
	return { 1: "phase_town_generic", 2: "phase_city_generic" }[this.gameState.currentPhase()];
};

/**
 * Phase research, two regimes:
 * - Town (500f/500w): a short hard bank — all spending pauses once the
 *   tech is researchable, the bank fills in under a minute at early-game
 *   income, research fires, everything resumes. The reserve approach
 *   fought the boom for 3-4 minutes instead (v6-v8: town at 5.8-7.7).
 * - City (750s/750m): a resource reserve that training/construction spend
 *   only above — it taxes stone/metal only, which the woman stream and
 *   the houses don't touch, so the boom never stalls for it.
 */
BrennusBot.prototype.managePhaseUp = function()
{
	const gameState = this.gameState;
	const tech = this.nextPhaseTech();
	this.phaseReserve = null;
	this.phaseReady = false;
	this.banking = false;
	if (!tech || gameState.isResearching(tech) || gameState.isResearched(tech))
		return;
	if (!gameState.canResearch(tech))
		return;
	// Fertility before the town bank: the house trainers it unlocks ARE the
	// boom (v24/v25: banking first pushed fertility to t=10-11). Delay the
	// town bank until fertility is at least researching — hard fallback at
	// t=4 so a resource-starved fertility can't deadlock the phase-up.
	if (tech === "phase_town_generic")
	{
		const fert = this.houseTrainingTech;
		const t = gameState.getTimeElapsed();
		if (!gameState.isResearched(fert) && !gameState.isResearching(fert) &&
			gameState.canResearch(fert) && t >= 240000 && t < 540000)
			return;
		// Sticky-builder re-tune: hold the hard bank until the 2 bootstrap
		// fields are COMPLETED while the served fruit is running down. The
		// bank freezes all construction, and the sticky crews complete the
		// houses fast enough to trigger it before wicker/fields get ordered
		// (seed 1: bank at 1.5m, first field 3.9m, pop300 16.0). The fruit
		// gate leaves berry-rich seeds on the houses-first path, and the
		// t=5m fallback keeps a placement failure from stalling the phase.
		const fieldType = gameState.applyCiv("structures/{civ}/field");
		let bootstrapFields = 0;
		for (const ent of gameState.getOwnStructures().values())
			if (ent.templateName() === fieldType)
				bootstrapFields++;
		if (t < 300000 && bootstrapFields < 2 && this.fruitStock < 1500)
			return;
	}
	const cost = this.phaseUpCost[tech];
	if (tech === "phase_town_generic")
		this.banking = true;
	else
		this.phaseReserve = cost;
	// City: hold the research start until the grain-rate and house-cap techs
	// (the pop bottleneck multipliers) are out — the bank fills minutes
	// before the deadline, so spend the wait on them instead of sitting on
	// it. Hard fallback at 13:20 so a starved tech can't deadlock the phase.
	if (tech === "phase_city_generic" && gameState.getTimeElapsed() < 800000 &&
		["gather_farming_plows", "gather_farming_training", "gather_farming_harvester",
			"pop_house_01"].some(t2 =>
			gameState.canResearch(t2) && !gameState.isResearched(t2) && !gameState.isResearching(t2)))
		return;
	if (!gameState.getResources().canAfford(cost))
		return;
	// The cost is banked: stop feeding the CC queue so it drains and the
	// research can start (a full queue would postpone the phase forever —
	// trainWorkers refills it every block otherwise). Houses keep training
	// during the city banking (only the CC queue must drain).
	this.phaseReady = true;
	const cc = this.getCivicCentre();
	if (cc && !cc.trainingQueue()?.length)
	{
		cc.research(tech);
		this.constructionHold = true;
	}
	else if (cc && gameState.getPopulation() >= gameState.getPopulationLimit())
		// Pinned at the pop cap: the queued batch can never progress, so the
		// queue never drains and the phase research waits forever — a full
		// deadlock while banking freezes construction (seed 3: pop 30/30,
		// town never researched, resources piling to 5000). Cancel the queue
		// (refunded) so the research starts.
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

/**
 * Keep every woman trainer producing. The CC trains in batches of 5 (its
 * BatchTimeModifier is 0.8: 5 women in ~29 s instead of 40); houses train
 * singly (their house-woman takes 30 s and batching has no discount).
 * Training spends only food above the phase reserve.
 */
BrennusBot.prototype.trainWorkers = function()
{
	const gameState = this.gameState;
	const resources = gameState.getResources();
	// Town banking: training keeps running above the 500-food floor (the
	// hard pause of v11/v12 threw away ~15 women at the worst moment of the
	// boom); only construction orders and techs pause for the bank. Once
	// the bank is full (phaseReady) the CC queue must drain so the research
	// can start — houses may keep training, they don't block the CC queue.
	const reserveFood = this.banking ? 500 : (this.phaseReserve?.food || 0);
	// Fertility Festival outranks the woman stream: while fertPending, the CC
	// trains only above its 300-food cost. Construction is frozen at the same
	// time (see manageResearch/manageConstruction) so wood accumulates too.
	const fertFloor = this.fertPending ? 300 : 0;
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const houseTraining = gameState.isResearched(this.houseTrainingTech);

	for (const ent of gameState.getOwnStructures().values())
	{
		let type, batch;
		if (ent.templateName() === ccType)
		{
			// While the phase-up waits for the queue to drain, stop feeding it.
			if (this.phaseReady)
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
			resources.subtract({ "food": 50 * batch });
		}
	}
};

// ---------------------------------------------------------------- research

/**
 * Boom techs, one per block, from genuine surplus only: every cost must
 * leave the phase reserve, the pending trio wood and a house buffer intact,
 * so techs never stall construction or the woman stream (seen in v3: a wood
 * tech reserve starved houses/fields for minutes — the boom engine must
 * always win). Unaffordable techs are skipped, not blocking — in v11 one
 * expensive tech plus the 750/750 city reserve froze the whole list at 2/9.
 * Fertility Festival comes first, at the first completed
 * house — doubling the trainer count is worth banking for.
 */
BrennusBot.prototype.manageResearch = function()
{
	const gameState = this.gameState;
	const resources = gameState.getResources();
	const reserve = this.phaseReserve || {};
	if (this.banking)
		return;

	// Fertility Festival first — but not before t=5: earlier the food income
	// can't feed extra trainers anyway and the 250 f + banking freeze just
	// slows the bootstrap (v32: fertility at 1.1, pop behind all game).
	const fert = this.houseTrainingTech;
	this.fertPending = false;
	if (!gameState.isResearched(fert) && !gameState.isResearching(fert) &&
		gameState.getTimeElapsed() >= 240000)
	{
		const affordable = resources.canAfford({ "food": 260, "wood": 110, "metal": 110 });
		const facility = gameState.findResearchers(fert)?.toEntityArray()
			.filter(ent => ent.foundationProgress() === undefined && (ent.trainingQueue()?.length || 0) <= 1)[0];
		this.fertPending = !!facility && gameState.canResearch(fert) && !affordable;
		if (affordable && facility)
		{
			facility.research(fert);
			resources.subtract({ "food": 250, "wood": 100, "metal": 100 });
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m research ${fert}\n`);
			this.constructionHold = true;
		}
		return;
	}

	// On wood-poor biomes the wood rate is the whole economy: ironaxes
	// (+25% wood) jumps ahead of the grain-rate techs (goal 7-S) — the
	// grain techs feed the pop stream, but wood pays for everything.
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
		// Priority order, but an unaffordable tech only defers itself — in
		// v11 returning here let one expensive tech block every cheaper one
		// behind it for the whole game. Stone/metal have a floor even before
		// the phase reserve kicks in: the city bank (750/750) is coming, and
		// metal techs that spend below it pushed city past the deadline
		// (v29/v30: bank 33-700 short at t=15).
		const bankFloor = gameState.currentPhase() === 2 ? 300 : 0;
		// Food-rate and house-cap techs may spend into the city bank: the
		// miners pre-fill for them (see currentShares) and the city research
		// waits for them (see managePhaseUp) — they multiply the boom's
		// binding constraints. Without this they stall behind the 750
		// reserve until past the deadline (v46: plows at 12.1).
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
			resources.subtract(cost);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m research ${tech}\n`);
			this.constructionHold = true;
		}
		return;
	}
};

/**
 * Wood cost of the next missing town-trio structure (0 once forge, temple
 * and market all exist). Discretionary spending must leave this untouched:
 * the trio is on the critical path to the city deadline, and in v11 houses
 * at 75 wood a pop kept the stock below the 300 the market needed until
 * t=16.5.
 */
BrennusBot.prototype.nextTrioWood = function()
{
	if (this.gameState.currentPhase() < 2)
		return 0;
	const foundations = this.gameState.getOwnFoundations().toEntityArray();
	const next = this.trioTypes()
		.find(t => !this.hasStructureOrFoundation(t, foundations));
	return next ? (this.gameState.getTemplate(next).cost().wood || 0) : 0;
};

/**
 * The three Town structures the city phase needs: forge, market, and the
 * gaul tavern where it exists — 100w+100s with +10 pop and class House (it
 * trains women too) where the temple costs 300w for nothing else.
 */
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
	const resources = gameState.getResources();
	const foundations = gameState.getOwnFoundations().toEntityArray();

	// Send builders to foundations that lack them (trio/dropsites 4, houses
	// 3, fields 2 — every builder is a gatherer not gathering). Assignments
	// are sticky and never overlap: the old nearest-per-foundation sweep
	// re-issued repair orders every block, and when two foundations stood
	// close together the same units were the nearest to BOTH — the last
	// order won, and the workers ping-ponged between the sites without ever
	// building (Louis's report). Now a unit claimed by one foundation is
	// never re-targeted to another until the first is done or gone. The
	// herder is excluded: its hunting orders override repair every block,
	// so a claim on it would be a phantom builder. Sticky-builder re-tune:
	// houses take 2 builders in village phase — the crews otherwise hold
	// 3 workers off gathering exactly while the wood for wicker/fields is
	// being accumulated — and 3 from town phase on (the sprint needs the
	// house build rate; see LESSONS_LEARNED).
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
	for (const foundation of foundations)
	{
		const built = gameState.getBuiltTemplate(foundation.templateName());
		const isField = built.hasClass("Field");
		const isHouse = built.hasClass("House");
		const target = (isField ? 2 : isHouse ? (this.gameState.currentPhase() === 1 ? 2 : 3) : 4);
		let cur = assigned[foundation.id()];
		if (!cur)
			cur = assigned[foundation.id()] = [];
		const needed = target - cur.length;
		if (needed <= 0)
			continue;
		const builders = gameState.getOwnUnits()
			.filter(ent => ent.isGatherer() && ent.isBuilder() && ent.position() &&
				!(ent.id() === this.herderId && !this.herdingDone) &&
				!taken.has(ent.id()))
			.filterNearest(foundation.position(), needed);
		for (const unit of builders.values())
		{
			cur.push(unit.id());
			taken.add(unit.id());
			unit.repair(foundation);
		}
	}

	// Track construct orders: success once the foundation exists at the
	// ordered spot; on timeout blacklist the spot (rejected orders used to
	// burn it silently).
	this.pendingBuilds = this.pendingBuilds.filter(pb => {
		const nearSpot = ent => {
			const pos = ent.position();
			return pos && Math.abs(pos[0] - pb.x) < 4 && Math.abs(pos[1] - pb.z) < 4;
		};
		if (foundations.some(nearSpot) ||
			gameState.getOwnStructures().toEntityArray().some(nearSpot))
			return false;
		if (this.turn - pb.turn > 50)
		{
			print(`[HARNESS] construct FAILED: ${pb.template} at ${pb.x.toFixed(0)},${pb.z.toFixed(0)}\n`);
			this.failedSpots.push([pb.x, pb.z]);
			return false;
		}
		return true;
	});

	if (this.constructionHold)
		return;

	// Hard bank for the town phase: no new construct orders until the 500
	// wood are in hand (builders keep working existing foundations above).
	if (this.banking)
		return;

	const houseType = gameState.applyCiv("structures/{civ}/house");
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	const reserve = this.phaseReserve || {};

	// Population margin: queued unit batches reserve their slots only when
	// they reach the head of the queue, so count queued units explicitly.
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
			resources.subtract({ "wood": houseCost });
		else if (this.turn % 750 === 0)
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m house placement FAILED (margin=${margin})\n`);
		return true; // one order per block either way
	};

	// 1. One-time drop sites, next to what they serve (Louis: walking time is
	// the real efficiency loss). Farmstead where the food within 30 m is
	// maximal, storehouse at the assigned woodline. Before houses: they pay
	// for themselves immediately. A failed placement must NOT block the rest
	// of construction (v35: a top-scoring fruit patch outside the territory
	// froze ALL building for the whole game).
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
			!!this.tryConstruct(type, "dropsite", this.woodline?.center);
		if (placed)
		{
			resources.subtract({ "wood": 100 });
			return;
		}
	}

	// 2. Town phase: the three Town-class structures the city phase needs
	// (forge 200w, market 300w, tavern 100w+100s for gaul — see trioTypes).
	// Market before the third: it unlocks barter for topping up the
	// stone/metal bank. Ahead of houses: the trio is on the critical path to
	// the city deadline (in v4/v6 urgent houses kept eating the bank at 75
	// wood a pop and the trio never finished).
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
					resources.subtract(cost);
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m building ${trioType.split("/").pop()}\n`);
				}
				return;
			}
		}
	}

	// 2.5. Continuous dropsites (Louis: the #1 economy blocker — effective
	// gather rate collapses with walk distance). Storehouses must follow the
	// receding woodline; farmsteads must sit by the field clusters.
	if (this.manageDropSites(foundations, reserve))
		return;

	// 3. Emergency houses when the population is truly pinned. They leave the
	// bootstrap field's 100 wood (the queue-inflated margin fires this branch
	// most early blocks and would otherwise hold wood under 100 forever —
	// v63/v65: fields=0 until t=5.5). Safe because fieldDemand is bootstrap-
	// only (2 fields): the pin lasts ~1 min, not the whole game (v64: demand
	// for 5 fields delayed town to 5.6).
	if (margin < 2 && houseFoundations < this.maxHouseFoundations &&
		gameState.getPopulationLimit() < gameState.getPopulationMax() &&
		resources.wood >= houseCost + (this.fieldDemand ? 100 : 0))
		return tryHouse();

	// Rate techs outrank discretionary construction: while one is wanted but
	// unaffordable, the house/field stream would eat the wood it needs (the
	// house trainers are food-starved at this stage anyway — the wood is
	// worth more as +20% grain / +25% wood). v45: farming_training slipped
	// to 15.1 because the house stream kept wood under its 300 cost.
	this.techPendingWood = 0;
	for (const tech of ["gather_farming_plows", "gather_farming_training",
		"gather_farming_harvester", "gather_lumbering_ironaxes"])
	{
		if (gameState.isResearched(tech) || gameState.isResearching(tech) ||
			!gameState.canResearch(tech))
			continue;
		const techWood = gameState.getTemplate(tech).cost().wood || 0;
		if (resources.wood < techWood + 100)
			this.techPendingWood = techWood;
		break;
	}

	// 4. Fields: Louis — pickers take the berries first while they last (the
	// assignment priority handles that; early fields stand empty, they don't
	// steal pickers). But they must STAND before the fruit runs out: the
	// town bank + fertility freeze block all construction from ~t=2.5 to
	// ~t=5.5 (v59: gate opened at t=2.5, first field only after the freeze,
	// 10 pickers piled onto 1 field at 22% rate). So open at t=1:30 or when
	// the served stock drops under ~4 minutes of runway. Exempt from every
	// wood reserve (phase, trio) — starving fields flatlines food within
	// minutes (v3, v5). In village, cap at 4 so they don't drain the
	// 500-wood town bank (v7).
	const cc = this.getCivicCentre();
	if (!cc)
		return;
	const ccPos = cc.position();
	let foodGatherers = 0;
	for (const res of Object.values(this.assignments))
		if (res === "food")
			foodGatherers++;
	const fieldCap = gameState.currentPhase() === 1 ? 4 : 30;
	const desiredFields = this.fruitStock < 4000 || gameState.getTimeElapsed() > 90000 ?
		Math.min(fieldCap, Math.max(2, Math.ceil(foodGatherers / 3) + 1)) : 0;
	let fields = 0;
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === fieldType)
			fields++;
	const fieldFoundations = foundations.filter(f =>
		gameState.getBuiltTemplate(f.templateName()).templateName() === fieldType).length;
	// Bootstrap reserve only: the FIRST 2 fields outrank the house stream,
	// and only when the served fruit is nearly out (v62 deadlock: berries
	// gone at t=3.5 with zero fields). When berries abound, houses come
	// first — pinning the 25-cap to save wood for unneeded fields stalls
	// the village boom (seed 2: houses=1 at t=3, town 5.0). Demanding ALL
	// desired fields would pin the cap for minutes (v64: town 5.6) and
	// throttle the sprint houses (v65: cap 195 at t=15).
	this.fieldDemand = (fields + fieldFoundations) < Math.min(2, desiredFields) &&
		this.fruitStock < 800;
	// Steppe fix (goal 7-S): on wood-poor biomes (bush "trees", detected
	// in updateWoodline), fields in town phase with the trio pending must
	// leave the trio's wood untouched — the field stream ate every 100 w
	// window (~2000 w on steppe seed 5) and the trio waited 12 min for its
	// 300 w (trio 19.5m, city never). Delaying grain for the trio is
	// Louis's accepted trade (city is the slower metric). Village-phase
	// bootstrap fields are untouched, and on wood-rich biomes the gate is
	// off entirely.
	const fieldTrioWood = gameState.currentPhase() === 2 && this.woodPoor ?
		this.nextTrioWood() : 0;
	if (fields < desiredFields && fieldFoundations < 2 &&
		resources.wood >= 100 + fieldTrioWood)
	{
		// Louis: fields go next to an existing farmstead that still has room —
		// the walk to the dropsite is the grain-rate killer. Least crowded
		// farmstead first; the grid is the fallback when none has free space.
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

	// Fertility Festival freeze: while the research is wanted but
	// unaffordable, construction pauses so wood accumulates for it (the
	// training half is the fertFloor in trainWorkers). BELOW the fields on
	// purpose: fields cost wood only, and they are the food income that pays
	// fertility's 250 food — freezing them deadlocks the freeze itself (v61:
	// berries out at t=3.5, fert=1 from t=4 to t=7.5, zero fields).
	if (this.fertPending)
		return;

	// 6. Discretionary houses, at raw cost: the boom wants the cap growing
	// always. But leave the trio's wood untouched (the v11 stall: houses at
	// 75 a pop kept the stock under the 300 the market needed); the
	// 3-foundation cap throttles the house drain below wood income. While a
	// dropsite is demanded, houses must also leave its 100 wood (v19: the
	// house stream pinned wood under 100 and the woodline receded unserved).
	// And while a rate tech is pending they wait entirely (see step 4).
	// From t=10, keep the cap climbing to the 300 max regardless of margin:
	// queued women block the margin for minutes (the food can't pop them
	// faster) and the sprint then ends cap-short (v48/v49/v51: cap 260-278
	// at t=15, pop300 ~0.5 min late).
	const sprintCap = gameState.getTimeElapsed() > 600000 &&
		gameState.getPopulationLimit() < gameState.getPopulationMax();
	if ((margin < this.houseMargin || sprintCap) && houseFoundations < this.maxHouseFoundations &&
		!this.techPendingWood &&
		gameState.getPopulationLimit() < gameState.getPopulationMax() &&
		resources.wood >= (reserve.wood || 0) + this.nextTrioWood() + (this.dropsiteDemand ? 100 : 0) + (this.fieldDemand ? 100 : 0) + houseCost)
		return tryHouse();
};

BrennusBot.prototype.hasStructureOrFoundation = function(type, foundations)
{
	return this.gameState.getOwnStructures().toEntityArray().some(ent => ent.templateName() === type) ||
		foundations.some(f => this.gameState.getBuiltTemplate(f.templateName()).templateName() === type);
};

/**
 * Louis: the first farm goes where there is room to build AND the food in a
 * 30 m radius is maximal. Only in-territory, reachable patches are scored
 * (a far richer patch outside the territory can never place and must not
 * starve the base). Distinct patches are tried best-first — positions 30 m
 * apart are the same patch. Returns true when an order went out.
 */
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

/**
 * Continuous dropsite coverage. The initial farmstead/storehouse pair is
 * block 1 above; this keeps coverage as the economy moves: the woodline
 * recedes as trees die and new fields appear far from the first farmstead.
 * One order per block when a group of gatherers is underserved (nearest
 * accepting dropsite farther than ~20 m edge-to-edge), placed at the
 * centroid of the underserved anchors. Costs leave the phase reserve
 * untouched; the caps keep it from draining the boom.
 */
BrennusBot.prototype.manageDropSites = function(foundations, reserve)
{
	const gameState = this.gameState;
	const resources = gameState.getResources();
	const cc = this.getCivicCentre();
	if (!cc)
		return false;
	// Gated on raw wood + phase reserve only — never on the trio reserve:
	// dropsites ARE the income (Louis's #1 blocker); reserving them behind
	// the trio starves the economy that pays for the trio (v14: wood stock
	// pinned at 30-110, zero dropsites built, wood rate fell to 27%).
	const woodFloor = 100 + (reserve.wood || 0);
	// Set when a dropsite is needed: discretionary houses must then leave 100
	// wood or the storehouse never gets built (v19: houses at 75 a pop kept
	// the stock under 100 while the woodline receded past 60 m).
	this.dropsiteDemand = false;

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

	// Wood: a storehouse by the woodline being cut. Anchors are the target
	// trees when known (gatherTarget), else the unit's own position. Target
	// ONE local clump: the worst-served anchor and the anchors within 25 m of
	// it — the centroid of the whole cutting front lands between clumps and
	// serves none (v20: 13 storehouses, mean distance still 40+ m).
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	const woodSites = [{ "pos": cc.position(), "half": halfDiag(cc) }];
	const storeFoundations = [];
	let storeCount = 0;
	for (const f of foundations)
		if (gameState.getBuiltTemplate(f.templateName()).templateName() === storeType && f.position())
		{
			woodSites.push({ "pos": f.position(), "half": halfDiag(f) });
			storeFoundations.push(f.position());
			storeCount++;
		}
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === storeType && ent.position())
		{
			woodSites.push({ "pos": ent.position(), "half": halfDiag(ent) });
			storeCount++;
		}
	// Louis: a storehouse whose wood/stone/metal is gone is dead weight —
	// destroy it (one per block), it only serves as a far-away fallback.
	// Depleted = under 200 resources within 40 m (checking only THE nearest
	// supply misfires on a half-eaten tree at an active woodline — v36).
	// Never destroy while gatherers still work within 40 m: they are the
	// proof the site is alive, and destroying under them oscillates
	// build/destroy at the receding woodline (v37).
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.templateName() !== storeType || ent.foundationProgress() !== undefined || !ent.position())
			continue;
		const pos = ent.position();
		const half = halfDiag(ent);
		let busy = false;
		for (const unit of gameState.getOwnUnits().values())
		{
			if (!unit.isGatherer() || unit.isIdle() || !unit.position())
				continue;
			if (Math.hypot(pos[0] - unit.position()[0], pos[1] - unit.position()[1]) < 40)
			{
				busy = true;
				break;
			}
		}
		if (busy)
			continue;
		let nearby = 0;
		for (const res of ["wood", "stone", "metal"])
			for (const s of gameState.getResourceSupplies(res).filterNearest(pos, 10).toEntityArray())
			{
				if (!s.position())
					continue;
				if (Math.hypot(pos[0] - s.position()[0], pos[1] - s.position()[1]) - half >= 40)
					break; // filterNearest is sorted nearest-first
				nearby += s.resourceSupplyAmount();
			}
		if (nearby < 200)
		{
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse destroyed at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} (depleted)\n`);
			ent.destroy();
			return true;
		}
	}
	if (storeCount < 18)
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
		if (underserved.length >= 4)
		{
			this.dropsiteDemand = true;
			const clump = underserved.filter(p => Math.hypot(p[0] - worst[0], p[1] - worst[1]) < 25);
			const center = centroid(clump);
			// Wood storehouses leave the town trio's wood on wood-poor
			// biomes (goal 7-S): on the steppe the storehouse stream ate
			// every 100 w window (10 storehouses before the market could
			// order on seed 5) — same treatment as the fields. The trio
			// reserve only binds in town phase with the trio pending.
			const trioWood = this.gameState.currentPhase() === 2 && this.woodPoor ?
				this.nextTrioWood() : 0;
			const planned = storeFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 30);
			const pos = resources.wood >= woodFloor + trioWood && !planned &&
				this.tryConstruct(storeType, "dropsite", center);
			if (pos)
			{
				resources.subtract({ "wood": 100 });
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for woodline ${center[0].toFixed(0)},${center[1].toFixed(0)} (${underserved.length} underserved)\n`);
				return true;
			}
		}
	}

	// Stone/metal (Louis: miners need a storehouse at the mine — watch their
	// effective rate). Same underserved-anchor clump logic as the woodline;
	// storehouses accept stone and metal too, so the wood sites list applies.
	if (storeCount < 18)
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
		if (underserved.length >= 2)
		{
			this.dropsiteDemand = true;
			const clump = underserved.filter(p => Math.hypot(p[0] - worst[0], p[1] - worst[1]) < 25);
			const center = centroid(clump);
			const planned = storeFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 30);
			const pos = resources.wood >= woodFloor && !planned &&
				this.tryConstruct(storeType, "dropsite", center);
			if (pos)
			{
				resources.subtract({ "wood": 100 });
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for mine ${center[0].toFixed(0)},${center[1].toFixed(0)} (${underserved.length} underserved)\n`);
				return true;
			}
		}
	}

	// Grain: a farmstead by each field cluster. A field is underserved when
	// its edge is over 15 m from the nearest farmstead/CC edge (field half-
	// diagonal is 15.5 m). Target one local cluster (same clump logic as
	// storehouses); farmstead foundations suppress re-orders nearby.
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
			resources.subtract({ "wood": 100 });
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m farmstead at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for fields ${center[0].toFixed(0)},${center[1].toFixed(0)} (${unservedFields.length} underserved)\n`);
			return true;
		}
	}
	// Fruit (Louis: berry/fruit pickers need a farmstead at the patch — watch
	// their effective rate). Same clump logic as the wood storehouses.
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
		this.dropsiteDemand = true;
		const cluster = unservedFruit.filter(p => Math.hypot(p[0] - worstFruit[0], p[1] - worstFruit[1]) < 25);
		const center = centroid(cluster);
		const planned = farmFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 25);
		const pos = !planned && resources.wood >= woodFloor &&
			this.tryConstruct(farmType, "dropsite", center);
		if (pos)
		{
			resources.subtract({ "wood": 100 });
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m farmstead at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for fruit ${center[0].toFixed(0)},${center[1].toFixed(0)} (${unservedFruit.length} underserved)\n`);
			return true;
		}
	}
	// Fruit chaining (Louis: when the served berry groups run out, look for
	// the next group in the territory, build a farmstead by it, then collect
	// it — the farmstead goes up BEFORE the pickers trek over, so they never
	// walk the round trip). Best patch = most fruit within 30 m, unserved =
	// no food dropsite within 45 m.
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
			this.dropsiteDemand = true;
			const planned = farmFoundations.some(p => Math.hypot(p[0] - best[0], p[1] - best[1]) < 25);
			const pos = !planned && this.tryConstruct(farmType, "dropsite", best);
			if (pos)
			{
				resources.subtract({ "wood": 100 });
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m farmstead at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for next fruit patch ${best[0].toFixed(0)},${best[1].toFixed(0)} (stock ${Math.round(this.fruitStock)})\n`);
				return true;
			}
		}
	}
	return false;
};

/**
 * Barter converts whatever piles up into whatever is scarce — the market
 * from the town trio unlocks it. While banking the city phase, surplus
 * food/wood (500-deals from 700, 100-deals from 400) buys the missing
 * stone/metal; stone/metal mined far past the bank (1300+) is sold back
 * for wood (the boom's bottleneck) or food.
 * Kept from goal 6: the ability stays even when a run doesn't need it.
 */
BrennusBot.prototype.manageBarter = function()
{
	const gameState = this.gameState;
	if (gameState.currentPhase() < 2)
		return;
	const market = gameState.getOwnStructures().toEntityArray()
		.find(ent => ent.hasClass("Market") && ent.foundationProgress() === undefined);
	if (!market)
		return;
	const res = gameState.getResources();
	// One deal per 5-turn block; 500-unit deals drift prices ~8% each, so
	// alternate what is sold instead of hammering one resource.
	if (!gameState.isResearched("phase_city_generic"))
	{
		// The 750/750 bank comes from the boom's surpluses: sell whichever
		// of food/wood is rich for whichever of stone/metal is short.
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
		// Sell mining surplus only far above the bank: a 500-deal at 1000
		// would drop the stock under 750 and trigger an immediate buy-back
		// at a worse rate.
		const excess = res.stone - 800 >= res.metal - 800 ? "stone" : "metal";
		if (res[excess] >= 1300 && (res.wood < 250 || res.food < 200))
		{
			const want = res.wood < 250 ? "wood" : "food";
			market.barter(want, excess, 500);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 ${excess} -> ${want}\n`);
			return;
		}
	}
	else if (res.stone >= 600 || res.metal >= 600)
	{
		const excess = res.stone >= res.metal ? "stone" : "metal";
		if (res[excess] >= 600 && (res.wood < 250 || res.food < 200))
		{
			const want = res.wood < 250 ? "wood" : "food";
			market.barter(want, excess, 500);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 ${excess} -> ${want}\n`);
		}
	}
};

// ---------------------------------------------------------------- placement

/**
 * Order the construct command for a building. `kind` selects the placement
 * policy: "house" and "field" go on the aligned grids, "dropsite" near the
 * given supply centroid, "civic" anywhere handy. Returns true if the order
 * was sent.
 */
BrennusBot.prototype.tryConstruct = function(templateType, kind, center)
{
	const cc = this.getCivicCentre();
	if (!cc)
		return false;
	const ccPos = cc.position();
	// Reachability: a spot across a cliff or river is buildable on paper but
	// its foundation sits unbuilt forever (the v10 market, 7 min at 0
	// builders). Only place in the CC's land region.
	const region = this.accessibility.getAccessValue(ccPos);
	let pos;
	if (kind === "house")
		pos = this.findGridSpot(templateType, this.housePlots(ccPos), region);
	else if (kind === "field")
		pos = this.findGridSpot(templateType, this.fieldPlots(ccPos), region);
	else if (kind === "dropsite")
		// A dropsite's whole value is its location: search tightly around the
		// target and never fall back to the base — a farmstead dumped 45 m
		// from its fields serves nothing but still counts against the cap
		// (v16/v19). No fallback: a failed order retries next block for free.
		pos = this.findBuildingPosition(templateType, center || ccPos, 10, 28, true, region);
	else
		// Big civic buildings (temple/market footprints are 20+ m) need a
		// wide, fine search — a coarse 90 m ring in a packed base finds
		// nothing and the city requirement silently stalls (v8).
		pos = this.findBuildingPosition(templateType, center || ccPos, 10, 130, true, region);
	if (!pos && kind !== "dropsite")
		// Grid exhausted (terrain): fall back to the free ring search.
		pos = this.findBuildingPosition(templateType, ccPos, 12, 120, true, region);
	if (!pos)
		return false;
	return this.placeOrder(templateType, pos) ? pos : false;
};

/** Send the nearest unit to build templateType at pos; track the order. */
BrennusBot.prototype.placeOrder = function(templateType, pos)
{
	const builder = this.gameState.getOwnUnits().filterNearest(pos, 1).toEntityArray()[0];
	if (!builder)
		return false;
	builder.construct(templateType, pos[0], pos[1], this.getPlacementAngle(), undefined);
	this.pendingBuilds.push({ "template": templateType, "x": pos[0], "z": pos[1], "turn": this.turn });
	return true;
};

/**
 * Buildings are aligned on the civic centre's orientation (Louis): one
 * shared angle keeps the base coherent AND keeps the aligned plot grids
 * grid-consistent — since every structure rotates by the same angle, the
 * relative geometry of the grid is exactly the unrotated one (a rigid
 * rotation of the whole plot set preserves all distances).
 */
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

/**
 * Aligned house plots (Louis: houses in straight rows free up base space).
 * A square grid with 14 m pitch (11 m footprint + 3 m lanes) around the CC,
 * near plots first, skipping the CC footprint and the field wedge. The grid
 * is rotated onto the CC's orientation: the houses share that angle, so the
 * rows stay aligned with the footprints (axis-aligned rows would overlap at
 * the corners once the buildings rotate).
 */
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

/**
 * Field plots: aligned 24 m pitch (22 m footprint) on the far side of the
 * base from the house core, 30-80 m out, rotated with the CC like the
 * houses.
 */
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

/** First grid plot that is free, in territory, reachable and away from enemies. */
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

/**
 * Free spot on rings around `center`: passable for buildings
 * ("building-land" passability class over the whole footprint), inside
 * own territory and in the CC's land region (reachable by builders).
 */
BrennusBot.prototype.findBuildingPosition = function(templateType, center, minRadius, maxRadius, fine, region)
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
			if (this.placementOK(x, z, halfW, halfD, angle, pass, mask, terr))
				return [x, z];
		}
	return undefined;
};

/**
 * Placement prefilter for the rotated footprint (angle = the CC
 * orientation). Passability uses the TRUE rotated rectangle, inflated by
 * half a navcell diagonal (0.75 m) so that any navcell the footprint
 * overlaps is caught by its centre — conservative, but barely larger than
 * the footprint itself, so the tight farmstead field clusters and the
 * 14/24 m grids keep packing exactly as before the rotation. (The rotated
 * axis-aligned box would be up to 41% larger and pushes near-tree
 * placements outward, which measurably slows the boom.) Territory keeps
 * the conservative box semantics of the original check: every 4 m cell
 * under the rotated box must be own. The engine's own validation is the
 * final arbiter either way.
 */
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
			// Inverse-rotate the cell centre into the footprint frame.
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

/**
 * Threat positions, refreshed at the start of each 5-turn block: enemy
 * structures, enemy mobile units, and aggressive gaia animals. (Gaia is an
 * "enemy" diplomatically, so getEnemyEntities includes every tree on the
 * map — filter owner 0 out, keeping only animals that can attack.)
 */
BrennusBot.prototype.updateEnemyPositions = function()
{
	this.enemyStructuresPos = [];
	this.enemyMobilesPos = [];
	for (const ent of this.gameState.getEnemyEntities().values())
	{
		if (ent.owner() === 0 && !(ent.hasClass("Animal") && ent.get("Attack")))
			continue;
		const pos = ent.position();
		if (!pos)
			continue;
		if (ent.hasClass("Structure"))
			this.enemyStructuresPos.push(pos);
		else
			this.enemyMobilesPos.push(pos);
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
	const res = gameState.getResources();
	// Effective/theoretical gather rates over the last window (Louis's
	// dropsite check): aggregate deliveries / aggregate theoretical output.
	const rate = cls => {
		const s = this.rateStats[cls];
		return s.theo > 0 ? `${Math.round(100 * s.amount / s.theo)}%` : "-";
	};
	const rates = `wood=${rate("wood")} grain=${rate("grain")} fruit=${rate("fruit")} stone=${rate("stone")} metal=${rate("metal")}`;
	// Food composition of the window (delivered amounts by subtype).
	const foodmix = ["fruit", "grain", "meat"].map(c => `${c}=${Math.round(this.rateStats[c].amount)}`).join(" ");
	for (const s of Object.values(this.rateStats))
	{
		s.amount = 0;
		s.theo = 0;
	}
	// Placement telemetry: mean edge distance of active woodcutters' trees to
	// the nearest wood dropsite, and of fields to the nearest food dropsite
	// (minus the field half-diagonal) — separates "no dropsite nearby" from
	// other cycle losses (construction churn, retargeting).
	const dropsiteDist = this.meanDropsiteDistances();
	print(`[HARNESS] t=${Math.round(gameState.getTimeElapsed() / 60000)}m ` +
		`pop=${gameState.getPopulation()}/${gameState.getPopulationLimit()} idle=${idle} starved=${this.starvedUnits || 0} ` +
		`gatherers food=${counts.food} wood=${counts.wood} stone=${counts.stone} metal=${counts.metal} ` +
		`houses=${houses} fields=${fields} town=${town} techs=${techs}/${this.boomTechs.length} ` +
		`rates ${rates} ` +
		`foodmix ${foodmix} ` +
		`dist wood=${dropsiteDist.wood}m grain=${dropsiteDist.grain}m fruit=${dropsiteDist.fruit}m ` +
		`founds=${gameState.getOwnFoundations().toEntityArray().length} failedSpots=${(this.failedSpots || []).length} ` +
		`fruitStock=${Math.round(this.fruitStock)} ` +
		`stock ${Math.floor(res.food)}/${Math.floor(res.wood)}/${Math.floor(res.stone)}/${Math.floor(res.metal)}\n`);
};

/** Mean edge distance (m) from active woodcutters / fields to their nearest
 * serving dropsite; "-" when no workers/fields. Diagnostic for logStatus. */
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
		"mineId": this.mineId
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
