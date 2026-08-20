import { BaseAI } from "simulation/ai/common-api/baseAI.js";

/**
 * Brennus: AI bot for 0 A.D.
 *
 * Current stage — goal 6 (economy mastery): on top of goal-2 gathering
 * (every worker kept busy, reassigned to the most-needed resource, away
 * from enemies and aggressive animals), goal-3 population growth
 * (uninterrupted woman training, houses ahead of the cap, fields when
 * natural food runs low), goal-4 town phase and goal-5 city phase
 * (Town-class structures: market, forge, temple), the bot researches
 * every economic technology (storehouse, farmstead, corral, house and
 * market techs), builds three markets on opposite territory edges and
 * runs a trader fleet between them, and barters surplus wood against
 * stone. Drop sites are placed next to the resources they serve.
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

/** Share of all gatherers each resource should have, in priority order. */
BrennusBot.prototype.gathererShares = { "food": 0.46, "wood": 0.32, "stone": 0.1, "metal": 0.12 };

BrennusBot.prototype.houseTrainingTech = "unlock_civilians_house_generic";

/**
 * Every economic technology available to gaul, in research priority order
 * (chains are ordered tier by tier; phase gating is enforced by
 * canResearch inside findResearchers). Fertility Festival first: house
 * training doubles worker production.
 */
BrennusBot.prototype.econTechs = [
	"unlock_civilians_house_generic",
	// village
	"gather_lumbering_ironaxes", "gather_capacity_basket",
	"gather_mining_servants", "gather_mining_wedgemallet",
	"gather_wicker_baskets", "gather_farming_plows",
	"gather_animals_stockbreeding", "health_civilians_01",
	// town (trade_gain_01 first: +15% trade income over the whole window)
	"trade_gain_01",
	"gather_lumbering_strongeraxes", "gather_capacity_wheelbarrow",
	"gather_mining_serfs", "gather_mining_shaftmining",
	"gather_farming_training", "gather_farming_harvester",
	"pop_house_01", "trader_health", "trade_commercial_treaty",
	// city
	"gather_lumbering_sharpaxes", "gather_capacity_carts",
	"gather_mining_slaves", "gather_mining_silvermining",
	"gather_farming_fertilizer", "pop_house_02", "trade_gain_02"
];

BrennusBot.prototype.traderType = "units/{civ}/support_trader";

/** Trader fleet size: the goal needs 10; extra traders add trade income. */
BrennusBot.prototype.targetTraders = 14;

/** True while the trader fleet is incomplete and markets exist to train it. */
BrennusBot.prototype.needsTraders = function()
{
	if (this.gameState.currentPhase() < 2 || this.completedMarkets().length < 2)
		return false;
	let traders = 0;
	for (const ent of this.gameState.getOwnUnits().values())
		if (ent.hasClass("Trader"))
			traders++;
	return traders < this.targetTraders;
};

/**
 * Threat positions, refreshed at the start of each 5-turn block: enemy
 * structures, enemy mobile units, and aggressive gaia animals. (Gaia is an
 * "enemy" diplomatically, so getEnemyEntities includes every tree on the
 * map — filter owner 0 out, keeping only animals that can attack.)
 * Unarmed gatherers sent near the enemy get slaughtered even by a sandbox
 * opponent's defensive units (seen: 37 workers lost on seed 5), and units
 * posted at a supply are chased down from further than a snapshot radius
 * of 45 m — structures keep a 100 m exclusion, mobiles 60 m.
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

/**
 * Population slots to keep free for the trader fleet: from town phase on,
 * a capped share of the traders still missing from the target. Uncapped,
 * the headroom (18) exceeds the whole early-town population limit and
 * freezes woman training (seen: pop stuck at 32 from t=5 to t=15).
 */
BrennusBot.prototype.traderHeadroom = function()
{
	if (this.gameState.currentPhase() < 2)
		return 0;
	let traders = 0;
	for (const ent of this.gameState.getOwnUnits().values())
		if (ent.hasClass("Trader"))
			traders++;
	return Math.min(6, Math.max(0, this.targetTraders - traders));
};

/** Completed own markets (getOwnStructures includes foundations). */
BrennusBot.prototype.completedMarkets = function()
{
	return this.gameState.getOwnStructures().toEntityArray()
		.filter(ent => ent.hasClass("Market") && ent.foundationProgress() === undefined);
};

/**
 * True while the city-phase requirement of 3 completed Town-class
 * structures is unmet. During that window, wood spending (houses, wood
 * techs) must leave the market/forge/temple costs banked, or the trio
 * never fires and the city phase slips (goal 5 regression).
 */
BrennusBot.prototype.townTrioPending = function()
{
	if (this.gameState.currentPhase() !== 2)
		return false;
	let townBuilt = 0;
	for (const ent of this.gameState.getOwnStructures().values())
		if (ent.hasClass("Town") && ent.foundationProgress() === undefined)
			townBuilt++;
	return townBuilt < 3;
};

/**
 * True until two markets stand (or one stands and another is on the way):
 * a trade route needs a market pair. Like the town trio, market 2 is a
 * priority building that houses must not starve of wood — without the
 * bank, house construction eats every wood surplus and trading starts
 * minutes late (seen: 1 market at t=20, traders ~0 at t=25).
 */
BrennusBot.prototype.tradePending = function()
{
	if (this.gameState.currentPhase() < 2)
		return false;
	const marketType = this.gameState.applyCiv("structures/{civ}/market");
	let standing = 0;
	for (const ent of this.gameState.getOwnStructures().values())
		if (ent.templateName() === marketType)
			standing++;
	if (standing >= 2)
		return false;
	for (const f of this.gameState.getOwnFoundations().values())
		if (this.gameState.getBuiltTemplate(f.templateName()).templateName() === marketType)
			standing++;
	return standing < 2;
};

/** True while a priority building (town trio or the market pair) is pending. */
BrennusBot.prototype.priorityBuildPending = function()
{
	return this.townTrioPending() || this.tradePending();
};

BrennusBot.prototype.CustomInit = function(gameState)
{
	print(`[HARNESS] brennus: loaded for player ${this.player}\n`);
	// entityID -> resource this unit was ordered to gather.
	this.assignments = this.savedState?.assignments || {};
	// Last construct order awaiting its foundation: {template, x, z, turn}.
	this.pendingBuild = this.savedState?.pendingBuild || null;
	// [x, z] spots where a construct command failed; never retried.
	this.failedSpots = this.savedState?.failedSpots || [];
	// Wood sold at the market against stone, in 100-unit deals.
	this.woodBartered = this.savedState?.woodBartered || 0;
};

BrennusBot.prototype.OnUpdate = function()
{
	if (this.gameState.playerData.state !== "active")
		return;

	if (this.turn % 5 === 0)
	{
		this.updateEnemyPositions();
		// Research and construction in the same block both see the pre-
		// command resource snapshot: a 300w tech + a 300w market ordered
		// together overdraw, the engine rejects the construct at processing,
		// and the spot lands on the failedSpots blacklist. Hold construction
		// for one block after any research order.
		this.constructionHold = false;
		this.assignGatherers();
		this.manageResearch();
		this.trainWorkers();
		this.manageConstruction();
		this.managePhaseUp();
		this.manageTrade();
		this.manageBarter();
		// The time-limit trigger ends the game before the t=30m logStatus,
		// so report completion of the tech tree as soon as it happens.
		if (!this.allTechsLogged && this.econTechs.every(t => this.gameState.isResearched(t)))
		{
			this.allTechsLogged = true;
			print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m all ${this.econTechs.length} econ techs researched\n`);
		}
	}
	const phase = this.gameState.currentPhase();
	if (phase !== this.lastPhase)
	{
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m phase=${this.gameState.getPhaseName(phase)}\n`);
		this.lastPhase = phase;
	}
	if (this.turn % 1500 === 0)
		this.logStatus();
	this.turn++;
};

// ---------------------------------------------------------------- gathering

/** Find idle gatherers and send them to the most-needed resource. */
BrennusBot.prototype.assignGatherers = function()
{
	const counts = { "food": 0, "wood": 0, "stone": 0, "metal": 0 };
	const idle = [];

	for (const ent of this.gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || !ent.position())
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
	this.starvedUnits = 0;
	for (const ent of idle)
	{
		// Resources this unit can gather, most unmet need first; take the
		// first one with an available supply (surplus workers spill over to
		// less-needed resources rather than idling).
		const order = ["food", "wood", "stone", "metal"]
			.filter(res => ent.canGather(res))
			.sort((a, b) =>
				(this.gathererShares[b] * total - counts[b]) -
				(this.gathererShares[a] * total - counts[a]));
		let assigned = false;
		for (const resource of order)
		{
			const supply = this.findSupply(ent, resource);
			if (!supply)
				continue;
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
	// filterNearest returns entities sorted nearest-first.
	let candidates = this.gameState.getResourceSupplies(resource).filterNearest(pos, 10).toEntityArray();
	if (resource === "food")
		// byResource excludes huntable animals; add them explicitly.
		candidates = candidates.concat(this.gameState.getHuntableSupplies().filterNearest(pos, 10).toEntityArray());

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
		return supply;
	}
	return undefined;
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

// ---------------------------------------------------------------- training

/** Keep every worker trainer producing women without interruption. */
BrennusBot.prototype.trainWorkers = function()
{
	// While saving up for a phase-up, all training pauses so the bank
	// fills as fast as possible.
	if (this.wantsPhaseUp)
		return;

	const gameState = this.gameState;
	const resources = gameState.getResources();
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const houseTraining = gameState.isResearched(this.houseTrainingTech);

	// Liquidity for techs: while a tech waits for its food cost, train
	// women only above that cost (plus one woman), so the bank fills
	// without ever pausing training entirely.
	if (this.techReserve && resources.food < (this.techReserve.food || 0) + 50)
		return;

	// While the trader fleet is incomplete, women also leave one trader's
	// food cost in the bank: the markets get their share instead of
	// trailing the woman stream (seen: 0 traders at t=25 with food pinned
	// at ~20 by the final pop flood). The fleet completes in a minute or
	// two, then women reclaim the food.
	if (this.needsTraders() && resources.food < 150)
		return;

	// From town phase on, keep population headroom for the traders (goal 6):
	// women fill only up to the limit minus the missing traders, so trader
	// training is never blocked by a maxed population.
	const headroom = this.traderHeadroom();
	if (headroom > 0)
	{
		let queuedPop = 0;
		for (const ent of gameState.getOwnStructures().values())
		{
			const queue = ent.trainingQueue();
			if (queue)
				queuedPop += queue.length;
		}
		if (gameState.getPopulation() + queuedPop > gameState.getPopulationLimit() - headroom)
			return;
	}

	for (const ent of gameState.getOwnStructures().values())
	{
		let type;
		if (ent.templateName() === ccType)
			type = gameState.applyCiv("units/{civ}/support_civilian");
		else if (houseTraining && ent.hasClass("House"))
			type = gameState.applyCiv("units/{civ}/support_civilian_house");
		else
			continue;

		const queue = ent.trainingQueue();
		if (queue && !queue.length && resources.canAfford({ "food": 50 }))
			ent.train(gameState.getPlayerCiv(), type, 1, {});
	}
};

// ---------------------------------------------------------------- construction

BrennusBot.prototype.manageConstruction = function()
{
	const gameState = this.gameState;
	const foundations = gameState.getOwnFoundations().toEntityArray();

	// Send builders to foundations that lack them.
	for (const foundation of foundations)
	{
		const needed = 2 - foundation.getBuildersNb();
		if (needed <= 0)
			continue;
		const builders = gameState.getOwnUnits()
			.filter(ent => ent.isGatherer() && ent.isBuilder() && ent.position())
			.filterNearest(foundation.position(), needed);
		for (const unit of builders.values())
			unit.repair(foundation);
	}

	// Track the last construct order: success once its foundation or the
	// finished building exists at the ordered spot.
	if (this.pendingBuild)
	{
		const nearSpot = ent => {
			const pos = ent.position();
			return pos && Math.abs(pos[0] - this.pendingBuild.x) < 4 &&
				Math.abs(pos[1] - this.pendingBuild.z) < 4;
		};
		const done = foundations.some(nearSpot) ||
			gameState.getOwnStructures().toEntityArray().some(nearSpot);
		if (done)
			this.pendingBuild = null;
		else if (this.turn - this.pendingBuild.turn > 50)
		{
			const res = gameState.getResources();
			print(`[HARNESS] construct FAILED: ${this.pendingBuild.template} at ` +
				`${this.pendingBuild.x.toFixed(0)},${this.pendingBuild.z.toFixed(0)} ` +
				`stock ${Math.floor(res.food)}/${Math.floor(res.wood)}/${Math.floor(res.stone)}/${Math.floor(res.metal)}\n`);
			this.failedSpots.push([this.pendingBuild.x, this.pendingBuild.z]);
			this.pendingBuild = null;
		}
		else
			return; // wait for the outcome before ordering anything else
	}

	const houseType = gameState.applyCiv("structures/{civ}/house");
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	const hasFoundationOf = type => foundations.some(f =>
		gameState.getBuiltTemplate(f.templateName()).templateName() === type);

	// A research order was sent earlier in this block: the resource snapshot
	// predates it, so a construct order now could overdraw and be rejected
	// at processing time (and the spot permanently blacklisted). Wait one
	// block — 1 sim second.
	if (this.constructionHold)
		return;

	// Houses ahead of the population cap. The margin threshold includes the
	// trader headroom: while women training is paused to leave room for
	// traders, the cap must keep growing anyway.
	let queuedPop = 0;
	for (const ent of gameState.getOwnStructures().values())
	{
		const queue = ent.trainingQueue();
		if (queue)
			queuedPop += queue.length;
	}
	const pop = gameState.getPopulation();
	const houseFoundations = foundations.filter(f =>
		gameState.getBuiltTemplate(f.templateName()).templateName() === houseType).length;
	// Count each house being built as the +5 cap it will provide.
	const margin = gameState.getPopulationLimit() + 5 * houseFoundations - pop - queuedPop;
	const hasStructureOrFoundation = type =>
		gameState.getOwnStructures().toEntityArray().some(ent => ent.templateName() === type) ||
		foundations.some(f => gameState.getBuiltTemplate(f.templateName()).templateName() === type);

	// Markets and the town trio come before houses from the town phase on:
	// construction is serialized through pendingBuild, so a hungry house
	// stream evaluated first would never leave a free cycle for the market
	// orders (seen: markets stuck at 1 while houses rebuilt after a pop
	// stall). In village phase these blocks are no-ops, so the goal-3/4
	// bootstrap order is unchanged.
	if (gameState.currentPhase() >= 2)
	{
		// The first market near the CC (it doubles as one of the three
		// Town-class structures the city phase needs), the second right
		// after — a market pair starts trade income early —, the third once
		// the town trio is complete, as far as possible from the first:
		// trade gain grows with the square of the route distance, and each
		// market's territory influence lets the next one be placed farther.
		const marketType = gameState.applyCiv("structures/{civ}/market");
		const completedMarkets = gameState.getOwnStructures().toEntityArray()
			.filter(ent => ent.templateName() === marketType);
		if (completedMarkets.length < 3 && !hasFoundationOf(marketType) &&
			(completedMarkets.length < 2 || !this.townTrioPending()) &&
			gameState.getResources().canAfford(gameState.getTemplate(marketType).cost()))
		{
			// The CC's root territory reaches 140 m, so search the whole
			// disk: every market goes to the buildable spot farthest from
			// the previous one (Louis: "build markets on the edge of the
			// territory"). Trade gain grows with the square of the route
			// distance — a 30-90 m ring capped routes at ~90 m and starved
			// trade income (~930 with 15 traders).
			this.tryConstruct(marketType, 40, 140, completedMarkets.at(-1)?.position());
			return;
		}

		// The other two Town-class structures (forge, temple; wood-only for
		// gaul). Foundations do not count toward the city-phase requirement,
		// but count them here to avoid ordering duplicates.
		const nextType = ["forge", "temple"]
			.map(t => gameState.applyCiv(`structures/{civ}/${t}`))
			.find(t => !hasStructureOrFoundation(t));
		if (this.townTrioPending() && nextType &&
			gameState.getResources().canAfford(gameState.getTemplate(nextType).cost()))
		{
			this.tryConstruct(nextType, 15, 90);
			return;
		}
	}

	// Up to 3 concurrent house foundations (4 in an emergency): the cap must
	// grow ~20/min or the woman stream pins the population at the limit.
	// Once the limit is at the population maximum, houses are pure waste.
	if (margin < 12 + this.traderHeadroom() && houseFoundations < (margin < 4 ? 4 : 3) &&
		gameState.getPopulationLimit() < gameState.getPopulationMax())
	{
		// While a priority building (town trio, market pair) is pending,
		// houses must not eat the wood the 300-wood market needs: build only
		// once the market cost is banked too, except when the population is
		// about to hit the cap. When the house must wait, fall through so
		// the economic buildings below can still be evaluated. Never order
		// without the 75 wood in hand: the engine rejects unaffordable
		// construct commands at processing time, and a rejected order burns
		// the spot permanently (failedSpots) — seen on seed 5: 17 rejected
		// house orders blacklisted the whole building ring.
		if ((!this.priorityBuildPending() || margin < 4 ||
			gameState.getResources().canAfford({ "wood": 375 })) &&
			gameState.getResources().canAfford({ "wood": 75 }))
		{
			this.tryConstruct(houseType, 15, 90);
			return;
		}
	}

	// Economic buildings (research sites for the goal-6 tech tree): one
	// storehouse, one farmstead, one corral. After houses so population
	// growth keeps priority. Drop sites belong next to the resources they
	// serve — the storehouse next to a woodline, the farmstead next to
	// fruit — so gatherers drop off without walking back to the CC.
	for (const name of ["storehouse", "farmstead", "corral"])
	{
		const type = gameState.applyCiv(`structures/{civ}/${name}`);
		if (hasStructureOrFoundation(type) ||
			!gameState.getResources().canAfford(gameState.getTemplate(type).cost()))
			continue;
		let center;
		if (name !== "corral")
		{
			const res = name === "storehouse" ? "wood" : "food";
			const cc = this.getCivicCentre();
			const supply = cc && gameState.getResourceSupplies(res)
				.filterNearest(cc.position(), 20).toEntityArray()
				.find(s => s.position() && s.resourceSupplyAmount() > 200 &&
					!this.nearEnemy(s.position(), 100, 60) &&
					this.accessibility.getAccessValue(s.position()) ===
						this.accessibility.getAccessValue(cc.position()));
			center = supply?.position();
		}
		// Near the supply if possible, else fall back to the CC ring.
		if (!this.tryConstruct(type, 10, 30, undefined, center) && center)
			this.tryConstruct(type, 15, 90);
		return;
	}

	// Fields when natural food near the CC runs low or the food workforce grows.
	const cc = this.getCivicCentre();
	if (!cc)
		return;
	const ccPos = cc.position();
	let bushes = 0;
	for (const supply of gameState.getResourceSupplies("food").values())
	{
		if (supply.resourceSupplyType()?.specific !== "fruit")
			continue;
		const pos = supply.position();
		if (pos && supply.resourceSupplyAmount() > 30 &&
			SquareDistance(pos, ccPos) < 100 * 100)
			bushes++;
	}
	let foodGatherers = 0;
	for (const res of Object.values(this.assignments))
		if (res === "food")
			foodGatherers++;
	const desiredFields = foodGatherers >= 6 || bushes < 2 ?
		Math.min(10, Math.max(1, Math.ceil(foodGatherers / 5))) : 0;
	let fields = 0;
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === fieldType)
			fields++;
	// Fields must not starve priority buildings: a 100-wood field order as
	// soon as 130 wood is banked pins the stock below the 300-wood market
	// cost and stalls the whole town build-out, so only order a field well
	// above the most expensive pending building (the threshold can relax
	// once the town trio and the market pair stand).
	if (fields < desiredFields && !hasFoundationOf(fieldType) &&
		gameState.getResources().canAfford({ "wood": this.priorityBuildPending() ? 450 : 250 }))
		this.fieldPlacementFailed = !this.tryConstruct(fieldType, 25, 75);
};

// ---------------------------------------------------------------- phases

/** The phase-up tech for the current phase, if any. */
BrennusBot.prototype.nextPhaseTech = function()
{
	return { 1: "phase_town_generic", 2: "phase_city_generic" }[this.gameState.currentPhase()];
};

/** Resource thresholds (cost + training buffer) before starting a phase-up. */
BrennusBot.prototype.phaseUpBuffers = {
	"phase_town_generic": { "food": 700, "wood": 600 },
	"phase_city_generic": { "stone": 850, "metal": 850 }
};

/**
 * Research the next phase as soon as possible. Once the requirements are
 * met (and the economy has had a few minutes to spin up), all training
 * pauses to bank the cost quickly, then the CC researches it. Training
 * resumes as soon as the research starts (the cost is already paid).
 */
BrennusBot.prototype.managePhaseUp = function()
{
	const gameState = this.gameState;
	const tech = this.nextPhaseTech();
	if (!tech || gameState.isResearching(tech) || gameState.isResearched(tech))
	{
		this.wantsPhaseUp = false;
		return;
	}
	if (!this.wantsPhaseUp)
	{
		if (gameState.getTimeElapsed() > 180000 && gameState.canResearch(tech))
			this.wantsPhaseUp = true;
		return;
	}
	if (!gameState.getResources().canAfford(this.phaseUpBuffers[tech]))
		return;
	const cc = this.getCivicCentre();
	if (cc && !cc.trainingQueue()?.length)
	{
		cc.research(tech);
		this.wantsPhaseUp = false;
	}
};

BrennusBot.prototype.getCivicCentre = function()
{
	const ccType = this.gameState.applyCiv("structures/{civ}/civil_centre");
	for (const ent of this.gameState.getOwnStructures().values())
		if (ent.templateName() === ccType)
			return ent;
	return undefined;
};

// ---------------------------------------------------------------- research

/**
 * Work through the economic tech list. Each missing tech goes to the
 * research facility with the shortest queue: research appends to the
 * production queue, so houses and markets keep training while a tech
 * waits its turn.
 *
 * Liquidity: the woman stream consumes food income as fast as it comes
 * in, so a 200-food tech is never affordable. Instead of pausing
 * training, the first unaffordable researchable tech is recorded in
 * techReserve and woman/trader training is throttled to stay above that
 * cost — the stock climbs to the reserve, the tech fires, repeat.
 */
BrennusBot.prototype.manageResearch = function()
{
	this.techReserve = null;
	if (this.wantsPhaseUp)
		return;
	const gameState = this.gameState;
	const resources = gameState.getResources();

	// Village phase: Fertility Festival as early as the economy absorbs it
	// (house training doubles worker production — the goal-3 bootstrap).
	if (gameState.currentPhase() === 1)
	{
		const fert = this.houseTrainingTech;
		if (!gameState.isResearched(fert) && !gameState.isResearching(fert))
		{
			if (resources.canAfford({ "food": 400, "wood": 250, "metal": 150 }))
			{
				const researchers = gameState.findResearchers(fert);
				const facility = researchers && researchers.toEntityArray()
					.filter(ent => ent.foundationProgress() === undefined && (ent.trainingQueue()?.length || 0) <= 1)[0];
				if (facility)
				{
					facility.research(fert);
					this.constructionHold = true;
				}
			}
			return;
		}
		// Then the village-tier techs, from surplus only: never eat into the
		// town-phase bank (500f/500w), so the goal-4 timeline is undisturbed,
		// and never set techReserve — woman training is not throttled here.
		for (const tech of this.econTechs)
		{
			if (gameState.isResearched(tech) || gameState.isResearching(tech))
				continue;
			const researchers = gameState.findResearchers(tech);
			if (!researchers)
				continue;
			const cost = gameState.getTemplate(tech).cost();
			if (!resources.canAfford({
				"food": (cost.food || 0) + 500, "wood": (cost.wood || 0) + 400,
				"stone": cost.stone || 0, "metal": cost.metal || 0 }))
				continue;
			const facility = researchers.toEntityArray()
				.filter(ent => ent.foundationProgress() === undefined && (ent.trainingQueue()?.length || 0) <= 1)
				.sort((a, b) => (a.trainingQueue()?.length || 0) - (b.trainingQueue()?.length || 0))[0];
			if (facility)
			{
				facility.research(tech);
				resources.subtract(cost);
				this.constructionHold = true;
			}
		}
		return;
	}

	for (const tech of this.econTechs)
	{
		if (gameState.isResearched(tech) || gameState.isResearching(tech))
			continue;
		const researchers = gameState.findResearchers(tech);
		if (!researchers)
			continue;
		const cost = gameState.getTemplate(tech).cost();
		// While the town trio is pending, a wood tech may not eat into the
		// 300-wood market bank; a stone/metal tech may not eat into the
		// 850/850 city-phase bank (phaseUpBuffers). Deferring is not banking:
		// such a tech must not become techReserve (it would throttle
		// woman/trader training for a tech we deliberately postpone).
		if (gameState.currentPhase() === 2 &&
			((cost.wood && this.townTrioPending() &&
				!resources.canAfford({ "wood": cost.wood + 300 })) ||
			((cost.stone || cost.metal) &&
				!resources.canAfford({ "stone": (cost.stone || 0) + 850, "metal": (cost.metal || 0) + 850 }))))
			continue;
		if (!resources.canAfford(cost))
		{
			if (!this.techReserve)
				this.techReserve = cost;
			continue;
		}
		const facility = researchers.toEntityArray()
			.filter(ent => ent.foundationProgress() === undefined && (ent.trainingQueue()?.length || 0) <= 1)
			.sort((a, b) => (a.trainingQueue()?.length || 0) - (b.trainingQueue()?.length || 0))[0];
		if (facility)
		{
			facility.research(tech);
			// The command applies next turn; keep the local snapshot in
			// sync so later techs in this loop don't overdraw.
			resources.subtract(cost);
			this.constructionHold = true;
		}
	}
};

// ---------------------------------------------------------------- trade & barter

/**
 * Keep a trader fleet shuttling between the two markets farthest apart
 * (trade gain grows with the square of the route distance). Idle traders
 * are the ones without a route yet, so no bookkeeping is needed.
 */
BrennusBot.prototype.manageTrade = function()
{
	const gameState = this.gameState;
	const markets = this.completedMarkets();
	if (markets.length < 2)
		return;

	if (!this.wantsPhaseUp)
	{
		let traders = 0;
		for (const ent of gameState.getOwnUnits().values())
			if (ent.hasClass("Trader"))
				traders++;
		// Liquidity: food stays guarded by the tech reserve (the food techs
		// alone cost 2400, and the woman stream eats the rest), so traders
		// spend only the surplus above it. Metal techs total just 850, so a
		// small fixed metal buffer suffices — binding traders to the metal
		// reserve starved the fleet (1-4 traders by t=25) whenever a metal
		// tech was pending.
		const reserve = this.techReserve;
		const canAffordTrader = () => {
			const res = gameState.getResources();
			return res.canAfford({ "food": 100, "metal": 80 }) &&
				(!reserve || res.food >= (reserve.food || 0) + 50) &&
				res.metal >= 230;
		};
		if (traders < this.targetTraders)
			for (const market of markets)
			{
				const queue = market.trainingQueue();
				if ((queue?.length || 0) <= 1 && canAffordTrader())
					market.train(gameState.getPlayerCiv(), gameState.applyCiv(this.traderType), 1, {});
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
	for (const ent of gameState.getOwnUnits().values())
		if (ent.hasClass("Trader") && ent.isIdle())
		{
			if (!this.routeLogged)
			{
				this.routeLogged = true;
				print(`[HARNESS] trade route distance ${Math.sqrt(best).toFixed(0)}m\n`);
			}
			ent.tradeRoute(far, near);
		}
};

/**
 * Sell surplus wood against stone in 100-unit deals (the barter command
 * only accepts 100 or 500). Five deals sell 500 wood for ~390 stone at
 * equal true prices, comfortably over the 300 required on both sides.
 */
BrennusBot.prototype.manageBarter = function()
{
	if (this.woodBartered >= 500 || this.gameState.getResources().wood < 1000)
		return;
	const market = this.gameState.getOwnStructures().toEntityArray()
		.find(ent => ent.hasClass("Market") && ent.foundationProgress() === undefined);
	if (!market)
		return;
	market.barter("stone", "wood", 100);
	this.woodBartered += 100;
};

/**
 * Order the construct command for a building near the civic centre.
 * Returns true if a spot was found and the order was sent.
 */
BrennusBot.prototype.tryConstruct = function(templateType, minRadius, maxRadius, farFrom, center)
{
	const cc = this.getCivicCentre();
	const anchor = center || cc?.position();
	if (!anchor)
		return false;
	const pos = this.findBuildingPosition(templateType, anchor, minRadius, maxRadius, farFrom);
	if (!pos)
		return false;
	const builder = this.gameState.getOwnUnits().filterNearest(pos, 1).toEntityArray()[0];
	if (!builder)
		return false;
	builder.construct(templateType, pos[0], pos[1], 0, undefined);
	this.pendingBuild = { "template": templateType, "x": pos[0], "z": pos[1], "turn": this.turn };
	return true;
};

/**
 * Free spot on rings around `center`: passable for buildings
 * ("building-land" passability class over the whole footprint) and inside
 * own territory. Without `farFrom`, the first valid spot wins; with it,
 * the valid spot farthest from `farFrom` is returned (trade gain grows
 * with distance between markets).
 */
BrennusBot.prototype.findBuildingPosition = function(templateType, center, minRadius, maxRadius, farFrom)
{
	const gameState = this.gameState;
	const template = gameState.getTemplate(templateType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const pass = gameState.getPassabilityMap();
	const mask = gameState.getPassabilityClassMask("building-land");
	const terr = this.territoryMap;

	let best, bestDist = -1;
	for (let r = minRadius; r <= maxRadius; r += 3)
		for (let a = 0; a < 32; ++a)
		{
			const angle = a * Math.PI / 16;
			const x = center[0] + r * Math.cos(angle);
			const z = center[1] + r * Math.sin(angle);
			if (this.failedSpots.some(f => Math.abs(f[0] - x) < 6 && Math.abs(f[1] - z) < 6))
				continue;
			if (this.nearEnemy([x, z], 100, 60))
				continue;
			if (!this.placementOK(x, z, halfW, halfD, pass, mask, terr))
				continue;
			if (!farFrom)
				return [x, z];
			const dist = SquareDistance([x, z], farFrom);
			if (dist > bestDist)
			{
				bestDist = dist;
				best = [x, z];
			}
		}
	return best;
};

BrennusBot.prototype.placementOK = function(x, z, halfW, halfD, pass, mask, terr)
{
	const cell = pass.cellSize;
	const x0 = Math.floor((x - halfW) / cell), x1 = Math.floor((x + halfW) / cell);
	const z0 = Math.floor((z - halfD) / cell), z1 = Math.floor((z + halfD) / cell);
	if (x0 < 0 || z0 < 0 || x1 >= pass.width || z1 >= pass.height)
		return false;
	for (let j = z0; j <= z1; ++j)
		for (let i = x0; i <= x1; ++i)
			if (pass.data[i + j * pass.width] & mask)
				return false;

	const tcell = terr.cellSize;
	const tx0 = Math.floor((x - halfW) / tcell), tx1 = Math.floor((x + halfW) / tcell);
	const tz0 = Math.floor((z - halfD) / tcell), tz1 = Math.floor((z + halfD) / tcell);
	if (tx0 < 0 || tz0 < 0 || tx1 >= terr.width || tz1 >= terr.height)
		return false;
	for (let j = tz0; j <= tz1; ++j)
		for (let i = tx0; i <= tx1; ++i)
			if ((terr.data[i + j * terr.width] & 0x1F) !== this.player)
				return false;
	return true;
};

// ---------------------------------------------------------------- telemetry

BrennusBot.prototype.logStatus = function()
{
	const counts = { "food": 0, "wood": 0, "stone": 0, "metal": 0 };
	let idle = 0;
	let traders = 0;
	for (const ent of this.gameState.getOwnUnits().values())
	{
		if (ent.hasClass("Trader"))
		{
			traders++;
			continue;
		}
		if (!ent.isGatherer() || !ent.position())
			continue;
		if (ent.isIdle())
			idle++;
		else if (this.assignments[ent.id()])
			counts[this.assignments[ent.id()]]++;
	}
	const markets = this.gameState.getOwnStructures().toEntityArray()
		.filter(ent => ent.hasClass("Market") && ent.foundationProgress() === undefined).length;
	const fieldType = this.gameState.applyCiv("structures/{civ}/field");
	let fields = 0;
	for (const ent of this.gameState.getOwnStructures().values())
		if (ent.templateName() === fieldType)
			fields++;
	const techs = this.econTechs.filter(t => this.gameState.isResearched(t)).length;
	// Debug: distance from the CC to the nearest enemy structure (seed 5's
	// fields never place — suspected enemy proximity excluding the ring).
	const cc = this.getCivicCentre();
	let enemyDist = -1;
	if (cc)
		for (const epos of this.enemyStructuresPos || [])
		{
			const d = Math.sqrt(SquareDistance(epos, cc.position()));
			if (enemyDist < 0 || d < enemyDist)
				enemyDist = d;
		}
	const res = this.gameState.getResources();
	const gameState = this.gameState;
	print(`[HARNESS] t=${Math.round(gameState.getTimeElapsed() / 60000)}m ` +
		`pop=${gameState.getPopulation()}/${gameState.getPopulationLimit()} idle=${idle} starved=${this.starvedUnits || 0} ` +
		`gatherers food=${counts.food} wood=${counts.wood} stone=${counts.stone} metal=${counts.metal} ` +
		`markets=${markets} traders=${traders} fields=${fields} techs=${techs}/${this.econTechs.length} ` +
		`enemyDist=${enemyDist < 0 ? "-" : enemyDist.toFixed(0)} fieldFail=${this.fieldPlacementFailed ? 1 : 0} ` +
		`founds=${this.gameState.getOwnFoundations().toEntityArray().length} failedSpots=${(this.failedSpots || []).length} ` +
		`stock ${Math.floor(res.food)}/${Math.floor(res.wood)}/${Math.floor(res.stone)}/${Math.floor(res.metal)}\n`);
};

// ---------------------------------------------------------------- save/load

BrennusBot.prototype.Serialize = function()
{
	return {
		"assignments": this.assignments,
		"pendingBuild": this.pendingBuild,
		"failedSpots": this.failedSpots,
		"wantsPhaseUp": this.wantsPhaseUp,
		"woodBartered": this.woodBartered
	};
};

BrennusBot.prototype.Deserialize = function(data, sharedScript)
{
	this.savedState = data;
	this.wantsPhaseUp = data.wantsPhaseUp;
	this.isDeserialized = true;
};

function SquareDistance(a, b)
{
	return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]);
}
