export function BoomManager(bot)
{
	this.bot = bot;
}

// ---------------------------------------------------------------- phases
BoomManager.prototype.nextPhaseTech = function()
{
	return { 1: "phase_town_generic", 2: "phase_city_generic" }[this.bot.gameState.currentPhase()];
};

/** Town: a short hard bank (pause spending, fill, research). City: a
 * reserve that training/construction only spend above. */
BoomManager.prototype.managePhaseUp = function()
{
	const gameState = this.bot.gameState;
	const tech = this.nextPhaseTech();
	// War fund: while the early-muster buildings (barracks, temple)
	// are still missing, hold 150 wood out of the boom's reach — the house
	// stream spends wood at cost level every block, so the 300-wood barracks
	// gate almost never fires on its own before ~14 min (agg4: barracks at
	// 9.1/9.5m, then starved). 300 strangled the house stream (agg5 s1: pop
	// cap stalled at 120); 150 is one barracks at a time. Must be set before
	// the early returns below so the money accumulates through every hold.
	if (!this.bot.expansionManager.warOn() && this.bot.arbiter.declared("defenseGap"))
		this.bot.arbiter.reserve("phaseBank", { "wood": this.bot.arbiterParams.warChest.fundWood });
	if (!tech || gameState.isResearching(tech) || gameState.isResearched(tech))
		return;
	if (!gameState.canResearch(tech))
		return;

	if (tech === "phase_town_generic")
	{
		const fert = this.bot.houseTrainingTech;
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
		if (t < 300000 && bootstrapFields < 2 && this.bot.economyManager.fruitStock < 1500)
			return;
	}
	const cost = this.bot.phaseUpCost[tech];
	if (tech === "phase_town_generic")
	{
		this.bot.arbiter.hold("banking");
		this.bot.arbiter.reserve("phaseBank", { "food": 500, "wood": 500 });
	}
	else
		this.bot.arbiter.reserve("phaseBank", { ...cost,
			"wood": (cost.wood || 0) + this.bot.arbiter.reserved("wood") });

	// City: the boom used to hold the research start until the grain-rate and
	// house-cap techs were out (fallback 13:20). This bot cannot wait: city
	// unlocks fanatics/arsenal/rams and the 100-army war stage, and the war
	// fund starves those very techs (agg5 s1: plows at 16.4m, city never —
	// the bot died in town phase with 1000 stone and 1800 metal banked).
	if (!this.bot.arbiter.check(this.bot.arbiter.books("phaseUp"), "phaseUp", cost, tech))
		return;

	this.bot.arbiter.hold("phaseReady");
	const cc = this.bot.getCivicCentre();
	if (cc && !cc.trainingQueue()?.length)
	{
		cc.research(tech);
		this.bot.arbiter.hold("construction");
	}
	else if (cc && gameState.getPopulation() >= gameState.getPopulationLimit())

		// Pinned at the pop cap: cancel the full CC queue so it can drain and the research can start.
		for (const item of cc.trainingQueue() || [])
			cc.stopProduction(item.id);
};

// ---------------------------------------------------------------- training
BoomManager.prototype.trainWorkers = function()
{
	const gameState = this.bot.gameState;
	const resources = this.bot.arbiter.books("workers");

	// Leave pop room for the mustering army and its refills: stop the civilian
	// stream at the cap once the war stage is on. Gating this on army <
	// target yo-yoed (army full → train to the cap → dismiss for the next
	// batch → retrain…).
	if (this.bot.expansionManager.warOn() &&
		gameState.getPopulation() >= gameState.getPopulationLimit() - this.bot.arbiterParams.popPartition.warPopHeadroom)
		return;

	// War-stage pop discipline: hold workers at the pop-partition cap and
	// leave the rest of the 300 cap free for the army (120, up to
	// popPartition.cavalry of them mounted) + healers (10) + rams
	// (6 × 3 pop) = 298 total. 175 workers pop-blocked the army at ~60
	// until dismissal kicked in 15 min after city (agg11 s3), and the war
	// economy runs a 10k+ food surplus anyway.
	// Refilling army losses with women only to dismiss them on the next
	// soldier batch is a pure food leak — def10-12 logged 400-900 dismissals
	// per game (≈ 20-45k food).
	if (this.bot.expansionManager.warOn())
	{
		let workers = 0;
		for (const u of gameState.getOwnUnits().values())
			if (u.isGatherer() && !u.hasClass("Soldier") && !u.hasClass("Trader") &&
				u.id() !== this.bot.economyManager.herderId)
				workers++;
		if (workers >= this.bot.arbiterParams.popPartition.workerCap)
			return;
	}

	// Pre-war (town phase): cap the woman stream at the same cap — the early
	// muster needs the food more than the boom needs a 150th worker (agg4 s1:
	// the house stream drained food at cost level every block and the barracks
	// starved; 8 infantry trained all game). But not lower: agg5's cap of
	// 100 starved the boom techs and stalled city phase, and agg6's 130
	// still meant city at 18.5-20.2m — city gates fanatics/rams/raids, so
	// every minute here is a minute off the kill clock.
	if (this.bot.expansionManager.defenseOn() && !this.bot.expansionManager.warOn())
	{
		let workers = 0;
		for (const u of gameState.getOwnUnits().values())
			if (u.isGatherer() && !u.hasClass("Soldier") && !u.hasClass("Trader") &&
				u.id() !== this.bot.economyManager.herderId)
				workers++;
		if (workers >= this.bot.arbiterParams.popPartition.workerCap)
			return;
	}

	const reserveFood = this.bot.arbiter.reserved("food");

	const fertFloor = this.bot.arbiter.declaredAmount("fert", "food");
	// The early muster has first claim on musterShare × the estimated food
	// flow: the women stream spends only the surplus above it (the old
	// emergent race — muster first at cost-level floors, women the
	// remainder — made an explicit parameter).
	const flowFloor = this.bot.arbiter.declared("musterActive") ?
		Math.round(this.bot.arbiterParams.foodSplit.musterShare * this.bot.arbiter.income.food) : 0;
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const houseTraining = gameState.isResearched(this.bot.houseTrainingTech);

	for (const ent of gameState.getOwnStructures().values())
	{
		let type, batch;
		if (ent.templateName() === ccType)
		{

			if (this.bot.arbiter.held("phaseReady"))
				continue;
			type = gameState.applyCiv("units/{civ}/support_civilian");
			batch = this.bot.arbiterParams.foodSplit.womanCcBatch;
		}
		else if (houseTraining && ent.hasClass("House") && ent.foundationProgress() === undefined)
		{
			type = gameState.applyCiv("units/{civ}/support_civilian_house");
			batch = this.bot.arbiterParams.foodSplit.womanHouseBatch;
		}
		else
			continue;

		const queue = ent.trainingQueue();
		if (queue && !queue.length && resources.food >= reserveFood + fertFloor + flowFloor + 50 * batch)
		{
			ent.train(gameState.getPlayerCiv(), type, batch, {});
			this.bot.arbiter.spend(resources, "workers", { "food": 50 * batch }, `women x${batch}`);
		}
	}
};

// ---------------------------------------------------------------- research
/** Boom techs, one per block, from genuine surplus only (reserve and
 * pending wood kept intact); Fertility Festival first. */
BoomManager.prototype.manageResearch = function()
{
	const gameState = this.bot.gameState;
	const resources = this.bot.arbiter.books("research");
	const reserve = this.bot.arbiter.reservedAll();
	if (this.bot.arbiter.held("banking"))
		return;

	const fert = this.bot.houseTrainingTech;
	this.bot.arbiter.declare("fert", null);
	if (!gameState.isResearched(fert) && !gameState.isResearching(fert) &&
		gameState.getTimeElapsed() >= 240000)
	{
		const affordable = resources.canAfford({ "food": 260, "wood": 110, "metal": 110 });
		const facility = gameState.findResearchers(fert)?.toEntityArray()
			.filter(ent => ent.foundationProgress() === undefined && (ent.trainingQueue()?.length || 0) <= 1)[0];
		this.bot.arbiter.declare("fert", !!facility && gameState.canResearch(fert) && !affordable ? { "food": 300 } : null);
		if (affordable && facility)
		{
			facility.research(fert);
			this.bot.arbiter.spend(resources, "research", { "food": 250, "wood": 100, "metal": 100 }, fert);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m research ${fert}\n`);
			this.bot.arbiter.hold("construction");
		}
		return;
	}

	if (this.bot.expansionManager.manageExpansionTechs())
		return;

	for (const tech of this.bot.boomTechs)
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
			this.bot.arbiter.spend(resources, "research", cost, tech);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m research ${tech}\n`);
			this.bot.arbiter.hold("construction");
		}
		return;
	}

	this.bot.expansionManager.manageExpansionTechs();
};
