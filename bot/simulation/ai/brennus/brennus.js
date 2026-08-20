import { BaseAI } from "simulation/ai/common-api/baseAI.js";

/**
 * Brennus: AI bot for 0 A.D.
 *
 * Current stage — goal 3 (population growth): on top of goal-2 gathering
 * (every worker kept busy, reassigned to the most-needed resource), the bot
 * trains women without interruption at the civil centre (and at houses once
 * Fertility Festival is researched), builds houses ahead of the population
 * cap, and builds fields when natural food runs low.
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
BrennusBot.prototype.gathererShares = { "food": 0.5, "wood": 0.3, "stone": 0.1, "metal": 0.1 };

BrennusBot.prototype.houseTrainingTech = "unlock_civilians_house_generic";

BrennusBot.prototype.CustomInit = function(gameState)
{
	print(`[HARNESS] brennus: loaded for player ${this.player}\n`);
	// entityID -> resource this unit was ordered to gather.
	this.assignments = this.savedState?.assignments || {};
	// Last construct order awaiting its foundation: {template, x, z, turn}.
	this.pendingBuild = this.savedState?.pendingBuild || null;
	// [x, z] spots where a construct command failed; never retried.
	this.failedSpots = this.savedState?.failedSpots || [];
};

BrennusBot.prototype.OnUpdate = function()
{
	if (this.gameState.playerData.state !== "active")
		return;

	if (this.turn % 5 === 0)
	{
		this.assignGatherers();
		this.trainWorkers();
		this.manageConstruction();
		this.managePhaseUp();
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
		for (const resource of order)
		{
			const supply = this.findSupply(ent, resource);
			if (!supply)
				continue;
			ent.gather(supply);
			this.assignments[ent.id()] = resource;
			counts[resource]++;
			break;
		}
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

	// Houses ahead of the population cap.
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
	if (margin < 10 && houseFoundations < (margin < 4 ? 3 : 2))
	{
		this.tryConstruct(houseType, 15, 90);
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
		Math.min(4, Math.max(1, Math.ceil(foodGatherers / 5))) : 0;
	let fields = 0;
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === fieldType)
			fields++;
	if (fields < desiredFields && !hasFoundationOf(fieldType) &&
		gameState.getResources().canAfford({ "wood": 130 }))
		this.tryConstruct(fieldType, 20, 70);

	// Unlock house training once the economy can absorb the cost.
	if (gameState.currentPhase() === 1 &&
		!gameState.isResearched(this.houseTrainingTech) &&
		!gameState.isResearching(this.houseTrainingTech) &&
		gameState.getResources().canAfford({ "food": 400, "wood": 250, "metal": 150 }))
	{
		for (const ent of gameState.getOwnStructures().values())
			if (ent.hasClass("House") && !ent.trainingQueue()?.length)
			{
				ent.research(this.houseTrainingTech);
				break;
			}
	}
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

/**
 * Order the construct command for a building near the civic centre.
 * Returns true if a spot was found and the order was sent.
 */
BrennusBot.prototype.tryConstruct = function(templateType, minRadius, maxRadius)
{
	const cc = this.getCivicCentre();
	if (!cc)
		return false;
	const pos = this.findBuildingPosition(templateType, cc.position(), minRadius, maxRadius);
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
 * First free spot on rings around `center`: passable for buildings
 * ("building-land" passability class over the whole footprint) and inside
 * own territory.
 */
BrennusBot.prototype.findBuildingPosition = function(templateType, center, minRadius, maxRadius)
{
	const gameState = this.gameState;
	const template = gameState.getTemplate(templateType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const pass = gameState.getPassabilityMap();
	const mask = gameState.getPassabilityClassMask("building-land");
	const terr = this.territoryMap;

	for (let r = minRadius; r <= maxRadius; r += 3)
		for (let a = 0; a < 32; ++a)
		{
			const angle = a * Math.PI / 16;
			const x = center[0] + r * Math.cos(angle);
			const z = center[1] + r * Math.sin(angle);
			if (this.failedSpots.some(f => Math.abs(f[0] - x) < 6 && Math.abs(f[1] - z) < 6))
				continue;
			if (this.placementOK(x, z, halfW, halfD, pass, mask, terr))
				return [x, z];
		}
	return undefined;
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
	for (const ent of this.gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || !ent.position())
			continue;
		if (ent.isIdle())
			idle++;
		else if (this.assignments[ent.id()])
			counts[this.assignments[ent.id()]]++;
	}
	const res = this.gameState.getResources();
	const gameState = this.gameState;
	print(`[HARNESS] t=${Math.round(gameState.getTimeElapsed() / 60000)}m ` +
		`pop=${gameState.getPopulation()}/${gameState.getPopulationLimit()} idle=${idle} ` +
		`gatherers food=${counts.food} wood=${counts.wood} stone=${counts.stone} metal=${counts.metal} ` +
		`stock ${Math.floor(res.food)}/${Math.floor(res.wood)}/${Math.floor(res.stone)}/${Math.floor(res.metal)}\n`);
};

// ---------------------------------------------------------------- save/load

BrennusBot.prototype.Serialize = function()
{
	return {
		"assignments": this.assignments,
		"pendingBuild": this.pendingBuild,
		"failedSpots": this.failedSpots,
		"wantsPhaseUp": this.wantsPhaseUp
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
