import { SquareDistance } from "simulation/ai/brennus/helpers.js";

export function BuildupManager(bot)
{
	this.bot = bot;
	// One-time latches and mix counters for army production.
	this.surgeLogged = false;
	this.arsenalBuilt = false;
	this.champTick = undefined;
	this.slingerTick = undefined;
	this.nextDismissTurn = undefined;
	// Wonder funding window start (set the first time the hold engages).
	this.wonderHoldSince = undefined;
	// Barracks alternation: spearmen, then javelineers.
	this.spearNext = true;
}

/** Military buildings: 3 barracks + 5 home towers from the town phase on (the early-muster package — 5 towers because a garrisoned stone tower is 9 arrows, and the wave arrives before the war stage does); after the boom the full set — 4 barracks, temples, forge, arsenal + 4 towers per expansion CC. Stone is plentiful on mainland; towers are our cheapest defense. */
BuildupManager.prototype.manageDefenseBuildings = function()
{
	if (!this.bot.expansionManager.defenseOn() || this.bot.arbiter.held("construction"))
		return;
	const gameState = this.bot.gameState;
	const boom = this.bot.expansionManager.warOn();
	const wants = [
		[gameState.applyCiv("structures/{civ}/barracks"), boom ? 4 : 3, { "wood": 300 }],
		// Arsenal before temples post-city: the raid gate is rams, and agg6
		// s2's arsenal landed ~10 min after city, pushing the first real raid
		// to 33.7m.
		[gameState.applyCiv("structures/{civ}/arsenal"), boom ? 2 : 0, { "wood": 300 }],
		[gameState.applyCiv("structures/{civ}/temple"), boom ? 3 : 1, { "wood": 300 }],
		[gameState.applyCiv("structures/{civ}/forge"), boom ? 1 : 0, { "wood": 200 }],
		// Assembly before the fortress: the hero it trains is pop-free army
		// power, and 400 wood lands long before the fortress's 600 stone.
		[gameState.applyCiv("structures/{civ}/assembly"), boom ? 1 : 0, { "wood": 400 }],
		// The fortress exists for Will to Fight (+25% attack) — that tech is
		// the whole point of paying 600 stone.
		[gameState.applyCiv("structures/{civ}/fortress"), boom ? 1 : 0, { "wood": 300, "stone": 600 }],
		// The stable comes last: sword cavalry is a force multiplier on top of
		// the infantry/ram/hero core, not a substitute for it. War stage only —
		// before the economy is developed a 250-wood building whose output
		// cannot gather (citizen cavalry only herds meat) is a pure drain.
		[gameState.applyCiv("structures/{civ}/stable"), boom ? 1 : 0, { "wood": 250 }]
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
		if (have < want && !this.bot.constructionManager.pendingBuilds.some(pb => pb.template === type))
			missingAny = true;
	}
	this.bot.arbiter.declare("defenseGap", missingAny);
	for (const [type, want, cost] of wants)
	{
		if (haveByType[type] >= want || this.bot.constructionManager.pendingBuilds.some(pb => pb.template === type))
			continue;
		const books = this.bot.arbiter.books("defenseBuildings");
		if (books.wood < (boom ? 350 : 300))
		{
			// Pre-boom the boom spends wood below the floor every block, so a
			// muster building can wait minutes for stock that never
			// accumulates (s21: three barracks landed 7 min after town
			// phase). Hold construction while unaffordable: the trickle
			// accumulates and the building fires at cost the moment it can.
			// The hold binds houses/fields only — dropsites are the wood
			// producers and must keep firing (s90's woodline collapsed under
			// a full construction hold) — and it releases when the boom is
			// pop-choked: a house outranks a barracks when nothing can train
			// anyway (s90 sat at 40/40 for 5 min under the hold).
			if (!boom)
			{
				let queuedPop = 0;
				for (const ent of gameState.getOwnStructures().values())
					for (const item of ent.trainingQueue() || [])
						if (item.unitTemplate)
							queuedPop += item.count;
				if (gameState.getPopulationLimit() - gameState.getPopulation() - queuedPop > this.bot.defenseHoldMinPopMargin)
					this.bot.arbiter.hold("constructionDefense");
			}
			return;
		}
		// The full price must be in the books or the engine silently rejects
		// the order (the fortress's 600 stone is the one the wood gate cannot
		// see). Skip to the next want — a stone-poor war must not stall the
		// buildings behind it.
		if (!books.canAfford({ "wood": cost.wood || 0, "stone": cost.stone || 0, "food": 0, "metal": 0 }))
			continue;
		if (this.bot.placementManager.tryConstruct(type, "military"))
		{
			this.bot.arbiter.spend(books, "defenseBuildings", { "wood": cost.wood || 0, "stone": cost.stone || 0 }, type.split("/").pop());
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m defense building ${type.split("/").pop()}\n`);
			this.bot.arbiter.hold("construction");
			return;
		}
		// Placement failed (crowded rings): skip to the next want rather than
		// starving temples/forge behind an unplaceable arsenal (3af2b27 sweep).
	}

	// Towers: 5 around the home CC from the town phase on (they double as
	// garrisoned arrow platforms when the big wave lands), 4 per expansion
	// CC once the army can reach them.
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const home = this.bot.getCivicCentre();
	if (!home)
		return;
	for (const cc of gameState.getOwnStructures().values())
	{
		if (cc.templateName() !== ccType || !cc.position() ||
			cc.foundationProgress() !== undefined)
			continue;
		const isHome = cc.id() === home.id();
		if (!isHome && (this.bot.armyManager.armyCount() < 30 || !this.bot.expansionManager.warOn()))
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
BuildupManager.prototype.placeTower = function(center, want)
{
	const gameState = this.bot.gameState;
	const towerType = gameState.applyCiv("structures/{civ}/defense_tower");
	const towers = [];
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === towerType && ent.position())
			towers.push(ent.position());
	for (const f of gameState.getOwnFoundations().values())
		if (f.position() && gameState.getBuiltTemplate(f.templateName()).templateName() === towerType)
			towers.push(f.position());
	for (const pb of this.bot.constructionManager.pendingBuilds)
		if (pb.template === towerType)
			towers.push([pb.x, pb.z]);
	let near = 0;
	for (const p of towers)
		if (SquareDistance(p, center) < 60 * 60)
			near++;
	if (near >= want)
		return false;
	const res = this.bot.arbiter.books("towers");
	// Cost-level floors: a tower costs 100/100, and the wave does not wait
	// for 300/300 to accumulate (s57 stood up zero towers all game).
	if (res.wood < 100 || res.stone < 100)
		return false;
	const clearOfTowers = (x, z) => !towers.some(p => SquareDistance(p, [x, z]) < 65 * 65);
	const spot = this.bot.placementManager.findBuildingPosition(towerType, center, 12, 80, true,
		this.bot.accessibility.getAccessValue(center), clearOfTowers);
	if (!spot || !this.bot.placementManager.placeOrder(towerType, spot))
		return false;
	this.bot.arbiter.spend(res, "towers", { "wood": 100, "stone": 100 }, "tower");
	print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m tower at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} for CC ${center[0].toFixed(0)},${center[1].toFixed(0)}\n`);
	return true;
};

/** War-stage research in priority order: the full forge line through tier 3
 * (tier 3 supersedes tier 2, so the chain runs in order), then Will to
 * Fight (+25% attack to soldiers and siege — needs the fortress), the
 * barracks production techs, the tower line and the druid line. Costs are
 * list prices; gaul's team bonus makes the forge ones 15% cheaper, so the
 * gates stay conservative. */
BuildupManager.prototype.militaryTechs = [
	["soldier_attack_melee_01", { "food": 200, "metal": 100 }],
	["soldier_attack_ranged_01", { "wood": 200, "metal": 100 }],
	["soldier_resistance_hack_01", { "food": 200, "metal": 100 }],
	["soldier_resistance_pierce_01", { "wood": 200, "metal": 100 }],
	["soldier_attack_melee_02", { "food": 350, "metal": 250 }],
	["soldier_attack_ranged_02", { "wood": 350, "metal": 250 }],
	["soldier_resistance_hack_02", { "food": 350, "metal": 250 }],
	["soldier_resistance_pierce_02", { "wood": 350, "metal": 250 }],
	["soldier_attack_melee_03", { "food": 500, "metal": 400 }],
	["soldier_attack_ranged_03", { "wood": 500, "metal": 400 }],
	["soldier_resistance_hack_03", { "food": 500, "metal": 400 }],
	["soldier_resistance_pierce_03", { "wood": 500, "metal": 400 }],
	["attack_soldiers_will", { "food": 1500, "wood": 1500, "stone": 1500, "metal": 1500 }],
	["unlock_champion_infantry", { "food": 600 }],
	["barracks_batch_training", { "food": 500 }],
	// Stable line: Horse Racing before Horse Breeding — the flank/ram-snipe
	// tactics lean on the speed more than on the HP.
	["cavalry_movement_speed", { "food": 100, "metal": 50 }],
	["cavalry_health", { "food": 200, "metal": 75 }],
	["tower_watch", { "food": 500 }],
	["tower_range", { "wood": 500, "metal": 250 }],
	["tower_murderholes", { "wood": 250, "stone": 150 }],
	["tower_crenellations", { "stone": 500, "metal": 250 }],
	["tower_health", { "stone": 500, "metal": 100 }],
	["heal_range", { "food": 200, "metal": 100 }],
	["heal_rate", { "food": 200, "metal": 100 }],
	["heal_range_2", { "food": 300, "metal": 150 }],
	["heal_rate_2", { "food": 300, "metal": 150 }],
	["cost_healer", { "food": 250, "stone": 100 }]
];

BuildupManager.prototype.manageMilitaryTechs = function()
{
	if (!this.bot.expansionManager.warOn() || this.bot.arbiter.held("construction"))
		return;
	const gameState = this.bot.gameState;
	const res = this.bot.arbiter.books("milTechs");
	// The forge line outranks the war machine's big one-time spends and is
	// exempt from their metal hold; the techs listed behind Will to Fight
	// must leave 1700 metal standing while Will or the wonder is unfunded —
	// probe s209 watched hack_02, pierce_02 and melee_03 snipe the
	// barter-bought metal at the 550-800 level for 6 minutes while the 1650
	// Will to Fight gate never filled (that was under the old Will-first
	// order; the forge line now goes first on purpose).
	const metalHold = this.warMachineMetalHold(gameState);
	for (const [tech, cost] of this.militaryTechs)
	{
		if (gameState.isResearched(tech) || gameState.isResearching(tech))
			continue;
		const facility = gameState.findResearchers(tech)?.toEntityArray()
			.filter(ent => ent.foundationProgress() === undefined &&
				(ent.trainingQueue()?.length || 0) <= 1)[0];
		// Skip — never block the list: a missing fortress or an unaffordable
		// Will to Fight must not freeze every cheaper tech behind it.
		if (!facility || !gameState.canResearch(tech))
			continue;
		if (!res.canAfford(cost) || res.metal < (cost.metal || 0) + this.bot.arbiterParams.warChest.techMetal +
				(tech.startsWith("soldier_") ? 0 : metalHold))
			continue;
		facility.research(tech);
		this.bot.arbiter.spend(res, "milTechs", cost, tech);
		print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m research ${tech}\n`);
		this.bot.arbiter.hold("construction");
		return;
	}
};

/**
 * Will to Fight is pending only while a completed fortress can research it
 * — without the fortress the tech is unreachable, and the wonder must not
 * queue behind it forever.
 */
BuildupManager.prototype.willToFightPending = function(gameState)
{
	if (gameState.isResearched("attack_soldiers_will") || gameState.isResearching("attack_soldiers_will"))
		return false;
	const fortressType = gameState.applyCiv("structures/{civ}/fortress");
	return gameState.getOwnStructures().toEntityArray()
		.some(ent => ent.templateName() === fortressType && ent.foundationProgress() === undefined);
};

/**
 * The wonder's funding window: from the moment Will to Fight is funded
 * (the spend order is forge line, Will, wonder) until the wonder stands,
 * capped at 15 min so an unplaceable wonder releases the tech tree, the
 * champion stream and the expansion CC stream (5 min was not enough in
 * s213 — ram churn ate the bought metal faster than it landed).
 */
BuildupManager.prototype.wonderHoldActive = function(gameState)
{
	if (!this.bot.expansionManager.expansionOn() || this.bot.expansionManager.expPlan?.wonderDone || this.willToFightPending(gameState))
		return false;
	this.wonderHoldSince = this.wonderHoldSince || this.bot.turn;
	return this.bot.turn - this.wonderHoldSince < 4500;
};

/**
 * One-time metal spends get funded before the continuous drains: while
 * Will to Fight or the wonder is still unfunded, the continuous spenders
 * (champion batches, the techs listed behind them) must leave 1700 metal
 * untouched — 1500 for Will to Fight plus the techMetal pad, 1100+ for the
 * wonder.
 */
BuildupManager.prototype.warMachineMetalHold = function(gameState)
{
	if (this.wonderHoldActive(gameState))
		return 1700;
	if (this.willToFightPending(gameState))
		return 1700;
	return 0;
};

BuildupManager.prototype.heroChain = [
	"units/{civ}/hero_vercingetorix",
	"units/{civ}/hero_viridomarus",
	"units/{civ}/hero_brennus"
];

/** Army production: barracks spearmen/javelineers (alternating, slingers every third batch pre-war) from the town phase on, temple fanatics after the boom; dismiss women for pop room only once the boom is done. */
BuildupManager.prototype.manageDefenseTraining = function()
{
	if (!this.bot.expansionManager.defenseOn())
		return;
	const gameState = this.bot.gameState;
	const res = this.bot.arbiter.books("defenseTraining");
	const barracksType = gameState.applyCiv("structures/{civ}/barracks");
	const templeType = gameState.applyCiv("structures/{civ}/temple");
	const stableType = gameState.applyCiv("structures/{civ}/stable");
	let queued = 0;
	const trainers = [];
	const stables = [];
	let cavQueued = 0;
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.foundationProgress() !== undefined)
			continue;
		if (ent.templateName() !== barracksType && ent.templateName() !== templeType &&
			ent.templateName() !== stableType)
			continue;
		for (const item of ent.trainingQueue() || [])
			queued += item.count;
		if (ent.templateName() === stableType)
		{
			for (const item of ent.trainingQueue() || [])
				if (item.unitTemplate && item.unitTemplate.indexOf("cavalry") !== -1)
					cavQueued += item.count;
			if ((ent.trainingQueue()?.length || 0) <= 1)
				stables.push(ent);
			continue;
		}
		if ((ent.trainingQueue()?.length || 0) <= 1)
			trainers.push(ent);
	}
	// Early muster: musterTarget (60) soldiers until the war stage (city) —
	// Petra aggressive arrives at ~16 min with ~100 units, so 40 was still
	// half a wave (agg3); 75 slowed the boom without flipping the wave fight
	// (rebal75: 0/5 conquest wins). Except when the enemy plainly fields more:
	// then muster toward their number (capped — pre-city pop room cannot feed
	// a full army AND the boom). Mustering back to 60 after a 100+ wave
	// re-fields half a wave every time (loss review: s55 met 120 with 60;
	// s70/s81 sat at army~20 for 15 min after the first wave).
	const baseTarget = this.bot.expansionManager.warOn() ? this.bot.arbiterParams.popPartition.armyTarget : this.bot.arbiterParams.foodSplit.musterTarget;
	const surging = !this.bot.expansionManager.warOn() && (this.bot.armyManager.enemyArmy || 0) > baseTarget;
	const target = surging ? Math.min(this.bot.armyManager.enemyArmy, this.bot.arbiterParams.surge.cap) : baseTarget;
	if (surging && !this.surgeLogged)
	{
		this.surgeLogged = true;
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m retraining surge on: muster toward ${target} (enemy army=${this.bot.armyManager.enemyArmy})\n`);
	}
	const missing = target - this.bot.armyManager.armyCount() - queued;
	// While the early muster is still drawing, the women stream leaves
	// musterShare × the estimated food flow unspent (trainWorkers). Declared
	// — and cleared — every block, so the claim dies with the early window.
	this.bot.arbiter.declare("musterActive", !this.bot.expansionManager.warOn() && missing > 0 ? true : null);
	// Siege plan, first-class: rams are the kill clock — basic infantry cannot
	// raze a garrisoned CC before Petra reinforces. While a ram is
	// missing, one ram's cost is reserved from the later pipeline stages and
	// rams train BEFORE the infantry/fanatic batches, so the war muster's
	// wood never crowds out the raid's siege. Rams are slow: muster them
	// before the army hits raid size or every raid goes in without them (4
	// made for 3-7-minute kills in agg6 — first razed CC at 40.2m, too slow).
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
	for (const id in this.bot.armyManager.rams)
		rams++;
	const ramPending = this.bot.armyManager.armyCount() >= 40 && rams < this.bot.arbiterParams.popPartition.rams && arsenals.length;
	if (ramPending)
		this.bot.arbiter.reserve("siege", { "wood": 300, "metal": 150 });
	if (ramPending &&
		res.wood >= this.bot.arbiterParams.warChest.ramWood && res.metal >= this.bot.arbiterParams.warChest.ramMetal)
		for (const arsenal of arsenals)
		{
			if (rams >= this.bot.arbiterParams.popPartition.rams || res.wood < this.bot.arbiterParams.warChest.ramWood || res.metal < this.bot.arbiterParams.warChest.ramMetal)
				break;
			arsenal.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/siege_ram"), 1, {});
			this.bot.arbiter.spend(res, "defenseTraining", { "wood": 300, "metal": 150 }, "ram");
			rams++;
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m training a ram (${rams}/${this.bot.arbiterParams.popPartition.rams})\n`);
		}
	// Healers first: 10 of them halve the effective churn of the standing army.
	let healerCount = 0;
	for (const id in this.bot.armyManager.healers)
		healerCount++;
	// No stockpile floors before the war stage: the boom spends the flow to
	// near zero every block, so any floor above cost level can never fire
	// (agg1/agg2: zero infantry trained). The early muster draws from the
	// flow instead: batches of 1 at cost-level floors, which splits the
	// income fairly with the woman stream (same 50/50 unit cost, same
	// per-block cadence). After city, batches of 5 with a wood reserve while
	// temples/forge/arsenal are outstanding (def11-13: starving the
	// construction budget froze the muster).
	const boom = this.bot.expansionManager.warOn();
	const milBatch = boom ? this.bot.arbiterParams.warChest.musterBatch :
		surging ? this.bot.arbiterParams.surge.batch : this.bot.arbiterParams.foodSplit.musterBatch;
	const floorF = boom ? this.bot.arbiterParams.warChest.musterFood : this.bot.arbiterParams.foodSplit.musterFloor.food;
	const floorW = boom ? (this.bot.arbiter.declared("defenseGap") ? this.bot.arbiterParams.warChest.musterWoodGap : this.bot.arbiterParams.warChest.musterWood) : this.bot.arbiterParams.foodSplit.musterFloor.wood;
	// Sword cavalry, first-class like the rams: the contingent trains BEFORE
	// the infantry loop and holds its own reserve — smoke s42 showed the
	// alternative: gated behind the infantry floors and the Will-to-Fight
	// metal hold, a stable stood 4 minutes and trained nothing. War stage
	// only (citizen cavalry cannot gather or build — meat herding aside —
	// so before the boom it is a pure drain). The metal floor is only the
	// tech stream's: the whole contingent costs 240 metal, one-seventh of a
	// Will to Fight; holding 1700 for it would re-create the s42 stall.
	if (boom && stables.length)
	{
		const cavCap = this.bot.arbiterParams.popPartition.cavalry;
		let cavCount = cavQueued;
		for (const id in this.bot.armyManager.army)
		{
			const ent = gameState.getEntityById(+id);
			if (ent?.hasClass("Cavalry"))
				cavCount++;
		}
		if (cavCount < cavCap)
		{
			this.bot.arbiter.reserve("cavalry", { "food": 100 * milBatch, "wood": 40 * milBatch, "metal": 10 * milBatch });
			for (const stable of stables)
			{
				if (cavCount >= cavCap ||
					res.food < 100 * milBatch || res.wood < 40 * milBatch ||
					res.metal < 10 * milBatch + this.bot.arbiterParams.warChest.techMetal)
					break;
				stable.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/cavalry_swordsman_b"), milBatch, {});
				this.bot.arbiter.spend(res, "defenseTraining", { "food": 100 * milBatch, "wood": 40 * milBatch, "metal": 10 * milBatch }, `cavalry x${milBatch}`);
				cavCount += milBatch;
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m training cavalry x${milBatch} (${cavCount}/${cavCap})\n`);
			}
		}
	}
	// The shared balance is the allocator: re-check the floors before every
	// trainer instead of issuing the whole round on one entry check — orders
	// the balance cannot cover are denied here, not failed at the engine.
	if (missing > 0)
		for (const ent of trainers)
		{
			if (res.food < floorF || res.wood < floorW)
				break;
			if (ent.templateName() === barracksType)
			{
				// Every third barracks batch goes to champion swordsmen once
				// unlocked: 200 HP and 16 hack against the basic infantry's
				// paper armor, at metal the war chest can spare (the batch is
				// priced in full here — the loop's floors only cover the 50/50
				// basic batch). Champions hold while the war machine's big
				// one-time metal spends are unfunded — probe s205/s207 bought
				// ~3000 metal by barter and the champion batches ate it as it
				// landed, so neither the wonder nor Will to Fight ever fired.
				if (boom && gameState.isResearched("unlock_champion_infantry") &&
					(this.champTick = ((this.champTick || 0) + 1) % 3) === 0 &&
					res.food >= 80 * milBatch && res.wood >= 60 * milBatch &&
					res.metal >= 80 * milBatch + 50 + this.warMachineMetalHold(gameState))
				{
					ent.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/champion_infantry_swordsman"), milBatch, {});
					this.bot.arbiter.spend(res, "defenseTraining", { "food": 80 * milBatch, "wood": 60 * milBatch, "metal": 80 * milBatch }, `champions x${milBatch}`);
					print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m training champions x${milBatch}\n`);
					continue;
				}
				// Pre-war, every slingers.every-th barracks batch is slingers:
				// 45 m range pelts raiders over the melee line in dense urban
				// chokes where a 30 m javelin cannot shoot past its own
				// spearmen. Gated on the 850-stone city bank staying funded —
				// a slinger never eats the phase research money; the mining
				// target's revolving fund refills what the stream spends.
				if (!boom)
				{
					this.slingerTick = ((this.slingerTick || 0) + 1) % this.bot.arbiterParams.slingers.every;
					if (this.slingerTick === 0 && res.stone >= 850 + 30 * milBatch)
					{
						ent.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/infantry_slinger_b"), milBatch, {});
						this.bot.arbiter.spend(res, "defenseTraining", { "food": 50 * milBatch, "wood": 20 * milBatch, "stone": 30 * milBatch }, `slingers x${milBatch}`);
						print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m training slingers x${milBatch}\n`);
						continue;
					}
				}
				const type = gameState.applyCiv(this.spearNext ?
					"units/{civ}/infantry_spearman_b" : "units/{civ}/infantry_javelineer_b");
				this.spearNext = !this.spearNext;
				ent.train(gameState.getPlayerCiv(), type, milBatch, {});
				this.bot.arbiter.spend(res, "defenseTraining", { "food": 50 * milBatch, "wood": 50 * milBatch }, `infantry x${milBatch}`);
				continue;
			}
			if (healerCount < (boom ? this.bot.arbiterParams.popPartition.healersWar : this.bot.arbiterParams.popPartition.healersEarly))
			{
				ent.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/support_healer_b"), boom ? 2 : 1, {});
				this.bot.arbiter.spend(res, "defenseTraining", boom ? { "food": 200, "metal": 60 } : { "food": 100, "metal": 30 }, `healer x${boom ? 2 : 1}`);
				healerCount += boom ? 2 : 1;
				continue;
			}
			ent.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/champion_fanatic"), 5, {});
			this.bot.arbiter.spend(res, "defenseTraining", { "food": 600, "wood": 500 }, "fanatics x5");
		}
	// The Assembly of Princes: Vercingetorix rides with the raid — his aura is
	// +20% damage and +1 capture for soldiers AND siege, i.e. a straight kill
	//-clock multiplier — and heroes cost no population. Carnyxes debuff enemy
	// soldiers in the brawl (−10% damage within 20 m). Metal floors keep rams
	// and the tech tree ahead of both.
	if (boom)
	{
		const assemblyType = gameState.applyCiv("structures/{civ}/assembly");
		const carnyxType = gameState.applyCiv("units/{civ}/champion_infantry_trumpeter");
		let heroUp = false, heroQueued = false, carnyx = 0;
		for (const ent of gameState.getOwnUnits().values())
		{
			if (ent.hasClass("Hero"))
				heroUp = true;
			else if (ent.templateName() === carnyxType)
				carnyx++;
		}
		const assemblies = [];
		for (const ent of gameState.getOwnStructures().values())
		{
			if (ent.templateName() !== assemblyType || ent.foundationProgress() !== undefined)
				continue;
			for (const item of ent.trainingQueue() || [])
			{
				if (!item.unitTemplate)
					continue;
				if (item.unitTemplate.indexOf("/hero_") !== -1)
					heroQueued = true;
				else if (item.unitTemplate.indexOf("trumpeter") !== -1)
					carnyx += item.count;
			}
			if ((ent.trainingQueue()?.length || 0) <= 1)
				assemblies.push(ent);
		}
		const assembly = assemblies[0];
		// Engine fact: MatchLimit counts how many times a template was trained
		// over the whole match and never decrements on death (EntityLimits.js
		// matchTemplateCount) — a dead hero can never retrain (validation s2
		// spammed 173 futile retrain orders). Each hero template has its own
		// cap, so fall down the chain: Vercingetorix for the raid aura,
		// Viridomarus for the global gather bonus, Brennus for the loot.
		const matchCounts = gameState.getEntityMatchCounts() || {};
		const heroType = this.heroChain.map(t => gameState.applyCiv(t))
			.find(t => (matchCounts[t] || 0) < 1);
		if (assembly && !heroUp && !heroQueued && heroType &&
			res.food >= 350 && res.wood >= 250 && res.metal >= 300)
		{
			assembly.train(gameState.getPlayerCiv(), heroType, 1, {});
			this.bot.arbiter.spend(res, "defenseTraining", { "food": 300, "wood": 200, "metal": 250 }, `hero ${heroType.split("/").pop()}`);
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m training hero ${heroType.split("/").pop()}\n`);
		}
		else if (assembly && heroUp && carnyx < 2 && res.food >= 400 && res.metal >= 400)
		{
			assembly.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/champion_infantry_trumpeter"), 1, {});
			this.bot.arbiter.spend(res, "defenseTraining", { "food": 180, "metal": 120 }, "carnyx");
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m training a carnyx\n`);
		}
	}
	// Pop room for a batch of 5: dismiss workers (idle first) until 5 slots are
	// free, throttled and never below a floor that keeps the economy alive.
	// Post-boom only: before city+300 the women are still racing to pop 300 and
	// dismissing them would deadlock the boom (army pop counts toward 300).
	if (boom && missing > 0 &&
		gameState.getPopulation() > gameState.getPopulationLimit() - 6 &&
		this.bot.turn >= (this.nextDismissTurn || 0))
	{
		let victim, fallback, workers = 0;
		for (const ent of gameState.getOwnUnits().values())
		{
			if (!ent.position() || !ent.isGatherer() || this.bot.armyManager.army[ent.id()] ||
				ent.id() === this.bot.economyManager.herderId || ent.hasClass("Soldier") || ent.hasClass("Trader"))
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
		if (victim && workers > this.bot.arbiterParams.popPartition.dismissFloor)
		{
			this.nextDismissTurn = this.bot.turn + 3;
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m dismissing a civilian for army pop room (workers=${workers})\n`);
			delete this.bot.economyManager.assignments[victim.id()];
			victim.destroy();
		}
	}
};
