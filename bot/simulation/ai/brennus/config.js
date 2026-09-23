import { BrennusBot } from "simulation/ai/brennus/brennus.js";

BrennusBot.prototype.gathererShares = {
	1: { "food": 0.55, "wood": 0.45, "stone": 0.0, "metal": 0.0 },
	2: { "food": 0.47, "wood": 0.53, "stone": 0.0, "metal": 0.0 },
	3: { "food": 0.62, "wood": 0.36, "stone": 0.01, "metal": 0.01 }
};

BrennusBot.prototype.currentShares = function(total)
{
	const phase = this.gameState.currentPhase();

	if (this.expansionManager.expansionOn() && phase === 3)
		return this.expansionManager.expansionShares(total);
	let base = this.gathererShares[phase] || this.gathererShares[1];
	if (phase === 2)
	{
		const trioDone = this.constructionManager.trioTypes()
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
			// The stone target carries the slinger revolving fund past the
			// 850 city bank: slinger batches spend it back down and the
			// miners refill, so the pre-war stone stream lives through the
			// whole muster window instead of stopping at the bank.
			const target = { "stone": 850 + this.arbiterParams.slingers.fund, "metal": 850 + grainMetal };
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
	if (phase === 3 && this.expansionManager.warOn())
	{
		const res = this.arbiter.books("shares");
		const shares = { ...base };
		let mining = 0;
		if (res.stone < this.arbiterParams.warChest.mineStone)
		{
			shares.stone = 0.06;
			mining += 0.06;
		}
		if (res.metal < this.arbiterParams.warChest.mineMetal)
		{
			shares.metal = 0.12;
			mining += 0.12;
		}
		const scale = Math.max(0, 1 - mining) / (base.food + base.wood);
		const woodFrac = this.bankAwareWoodFrac(res, base.wood / (base.food + base.wood));
		shares.food = (base.food + base.wood) * (1 - woodFrac) * scale;
		shares.wood = (base.food + base.wood) * woodFrac * scale;
		return shares;
	}
	return { ...base };
};

/**
 * Wood's fraction of the food+wood gatherer pool, nudged by the banked
 * imbalance: identical stocks keep the base split; past a 3k gap the split
 * slides toward the poor resource (a 20k food mountain turns a 0.50 base
 * into 0.85 wood). Barter levels the stock that already sits in the bank;
 * this stops the inflow from digging the gap deeper.
 */
BrennusBot.prototype.bankAwareWoodFrac = function(res, baseFrac)
{
	const imb = res.food - res.wood;
	if (Math.abs(imb) <= 3000)
		return baseFrac;
	const shift = Math.sign(imb) * Math.min(0.35, (Math.abs(imb) - 3000) / 40000);
	return Math.max(0.15, Math.min(0.85, baseFrac + shift));
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

/** Furthest animal the herder targets from the CC (m). */
BrennusBot.prototype.herdMax = 200;

/** Skittish animals beyond this distance (m) are killed in place instead of herded. */
BrennusBot.prototype.herdCutoff = 200;

BrennusBot.prototype.herdPrefer = false;

/** Distance (m) from the pinned food dropsite at which a steered animal is killed. */
BrennusBot.prototype.herdKillDist = 25;

/** Tree-to-dropsite distance (m) within which a tree counts as served: farther trees pull their gatherer back to a served tree, or trigger a storehouse when no served tree has a slot. */
BrennusBot.prototype.woodServeDist = 30;

/** Mean lumberjack-to-dropsite distance (m) above which logStatus fires a [WARNING]: wood walk distance is the biggest gatherer-efficiency factor, and a storehouse costs wood — a stalling wood supply must be fixed before anything else. */
BrennusBot.prototype.woodDistWarn = 40;

/** Hysteresis for the warning latch (m). */
BrennusBot.prototype.woodDistWarnClear = 30;

/** Per-mine dropsite edge distance (m) above which logStatus fires a [WARNING]: the wood alarm is a mean and hides a far-mine minority — exhausted-mine autocontinue chains miners to far unserved mines while a storehouse-served mine sits unused (s50/s52, and s99's 21 miners at ~180 m). */
BrennusBot.prototype.mineDistWarn = 40;

/** Mine-to-dropsite edge distance (m) within which a mine counts as served: equals the underserved threshold manageDropSites reacts to, so the drift pull-back below corrects miners long before the mineDistWarn alarm could observe them, and warning / pull-back / storehouse demand all read one metric. */
BrennusBot.prototype.mineGatherServeDist = 18;

/** Max gatherers on a tree before it counts as full ("slot"): past this, diminishing returns make another chopper pay less than the walk to a freer tree. Tune against the `rates wood=` telemetry. */
BrennusBot.prototype.treeMaxGatherers = 4;

/** Free pop slots (limit − population − queued) below which a house outranks a missing muster building: the defense accumulation hold releases so the pop race is never choked (s90 sat at 40/40 for 5 min under an ungated hold). */
BrennusBot.prototype.defenseHoldMinPopMargin = 8;

/**
 * The bot's resource equilibria, surfaced as named arbiter parameters
 * (step 3 of the arbiter refactor — values are exactly the emergent ones
 * the previously scattered logic produced; golden timelines must stay
 * bit-identical).
 *
 * foodSplit — the early-game food equilibrium between the woman stream and
 * the early muster: defense spends first in every block (the pipeline's
 * first stage) and draws the muster in 1-unit batches at cost-level floors;
 * the woman stream draws second, in batches, above the phase-bank reserves.
 * Same 50-food head cost, same per-block cadence — that is what splits the
 * flow roughly evenly instead of one side starving the other.
 *
 * popPartition — the 300-pop partition once the war stage is on:
 * workerCap workers + armyTarget soldiers + healersWar + 6 rams (3 pop
 * each) = 298. dismissFloor keeps a hysteresis gap under workerCap so a
 * dismissed civilian is not immediately retrained; warPopHeadroom stops the
 * women stream just below the cap so army refills never hit it. armyTarget
 * is 120 because 100 was not enough to raid through a camped Petra (agg11
 * s3: three raids at 60-63 bounced off 19-37 defenders + CC arrows).
 *
 * warChest — the war-chest floors: fundWood reserves the muster buildings'
 * wood pre-war; mineStone/mineMetal keep war-phase mining shares alive
 * until the chest is banked; the muster/ram/tech floors stop the war
 * machine from spending the chest below working level.
 */
BrennusBot.prototype.arbiterParams = {
	"foodSplit": {
		"musterTarget": 60,
		"musterBatch": 1,
		"musterFloor": { "food": 50, "wood": 50 },
		// The early muster's first claim on the food flow: while it is still
		// drawing, the women stream leaves musterShare × the arbiter's
		// estimated per-block food income unspent. 0 = no forward reserve:
		// the muster's claim is its pipeline position alone. Higher values
		// taxed the women stream measurably (1.0 stalled the boom).
		"musterShare": 0.0,
		"womanCcBatch": 5,
		"womanHouseBatch": 1
	},
	"popPartition": {
		"workerCap": 150,
		"dismissFloor": 145,
		"armyTarget": 120,
		// Mounted contingent inside armyTarget: sword cavalry counts as
		// Soldiers, so the 120-pop army budget is unchanged — this only
		// caps how much of it the stable fills.
		"cavalry": 24,
		"healersWar": 10,
		"healersEarly": 4,
		"rams": 6,
		"warPopHeadroom": 5
	},
	// surge — the pre-city retraining surge: when the enemy's standing army
	// exceeds musterTarget, muster toward their number (cap) in bigger
	// batches (batch) instead of re-fielding half a wave.
	"surge": {
		"cap": 100,
		"batch": 3
	},
	// slingers — the pre-war stone contingent: every "every"-th pre-war
	// barracks batch trains slingers instead of spear/javelin (45 m range —
	// they pelt raiders over the melee line in dense urban chokes where a
	// 30 m javelin cannot shoot past its own spearmen). A slinger batch only
	// fires above the 850-stone city bank, and "fund" keeps the phase-2
	// stone miners working past the bank so the stream does not die after
	// the first batches.
	"slingers": {
		"every": 3,
		"fund": 450
	},
	"warChest": {
		"fundWood": 150,
		"mineStone": 400,
		"mineMetal": 800,
		"musterBatch": 5,
		"musterFood": 300,
		"musterWood": 300,
		"musterWoodGap": 400,
		"ramWood": 350,
		"ramMetal": 200,
		"techMetal": 150
	}
};
