/**
 * Brennus: AI bot for 0 A.D. — a Gaul bot for generic land maps facing a
 * real opponent (Petra, medium difficulty, aggressive behaviour). Survive
 * the early pressure, boom, then convert the economy into an army that
 * eliminates Petra (all enemy civic centers) in under 45 in-game minutes.
 * The `[HARNESS] brennus: loaded` banner is the headless smoke test's canary.
 */

import { BaseAI } from "simulation/ai/common-api/baseAI.js";
import { ResourceArbiter } from "simulation/ai/brennus/arbiter.js";
import { FarmsteadStrategy, MineStorehouseStrategy, WoodStorehouseStrategy } from "simulation/ai/brennus/construction.js";
import "simulation/ai/brennus/army.js";
import "simulation/ai/brennus/boom.js";
import "simulation/ai/brennus/buildup.js";
import "simulation/ai/brennus/config.js";
import "simulation/ai/brennus/defense.js";
import "simulation/ai/brennus/economy.js";
import "simulation/ai/brennus/expansion.js";
import "simulation/ai/brennus/offense.js";
import "simulation/ai/brennus/placement.js";
import "simulation/ai/brennus/status.js";

export function BrennusBot(settings)
{
	BaseAI.call(this, settings);
}

// The side-effect modules above attach their methods to the default
// BrennusBot.prototype while they evaluate, before this body runs — the
// BaseAI link must mutate that object, not replace it with Object.create.
Object.setPrototypeOf(BrennusBot.prototype, BaseAI.prototype);

BrennusBot.prototype.CustomInit = function(gameState)
{
	print(`[HARNESS] brennus: loaded for player ${this.player}\n`);

	this.arbiter = new ResourceArbiter(this);
	this.arbiter.deserialize(this.savedState?.arbiter);

	this.ccAngle = undefined;

	this.assignments = this.savedState?.assignments || {}; // entityID -> resource

	this.builderAssignments = this.savedState?.builderAssignments || {};

	this.pendingBuilds = this.savedState?.pendingBuilds || []; // [{template, x, z, turn}]

	this.rushBuilds = this.savedState?.rushBuilds || []; // [{x, z, turn}] storehouses whose builders come from the choppers

	// One shot only: if the engine rejects the order, manageDropSites'
	// demand trigger is the fallback — retrying re-picks the same best tree.
	this.bootstrapStoreTried = this.savedState?.bootstrapStoreTried || false;

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

	// Relief expansion (pre-pop-300 CC orders when the base is stuck):
	// latched once a trigger fires; placeFailSince tracks per-template
	// continuous placement failure; reliefServedPeak is the high-water mark
	// of dropsite-served supply per resource for the exhaustion check.
	this.reliefOn = this.savedState?.reliefOn || false;

	this.placeFailSince = this.savedState?.placeFailSince || {};

	this.reliefServedPeak = this.savedState?.reliefServedPeak || {};

	// Spot clearing: expansion spots vetoed only by enemy presence
	// (expContested: key -> {x, z, since, seen, proven?, until?}) are cleared
	// by the army via clearOp ({x, z, key, turn, proven?, arrivedTurn?,
	// everArrived?}); clearCool (key -> turn) holds a per-spot relaunch
	// cooldown after an abort or a give-up.
	this.expContested = this.savedState?.expContested || {};

	this.clearOp = this.savedState?.clearOp;

	this.clearCool = this.savedState?.clearCool || {};

	// Defense: standing army roster (entityID -> 1), command throttle, shelter memory.
	this.army = this.savedState?.army || {};
	this.rams = this.savedState?.rams || {};
	this.healers = this.savedState?.healers || {};
	this.demobilized = this.savedState?.demobilized || {};
	this.armyCmdTurn = 0;
	this.shelterDanger = {};
	this.lastSeriousTurn = 0;
	this.swatting = false;
	this.spearNext = true;

	// Proportional recall (ids recalled to a home threat, live only while the
	// threat does) and border foundation denial state — transient like
	// this.offense/this.purge.
	this.recalled = {};
	this.deny = undefined;
	this.denyTried = {};

	// Dropsite placement strategies, in priority order (wood, mine, farmstead)
	// — the first strategy to fire places the block's one dropsite order.
	// Self-contained per-resource policies with their own gates: swap one here
	// to change placement for a map/biome. Instances are recreated fresh on
	// deserialization, like the other transient dropsite state they hold.
	this.woodStrategy = Object.create(WoodStorehouseStrategy);
	this.mineStrategy = Object.create(MineStorehouseStrategy);
	this.farmsteadStrategy = Object.create(FarmsteadStrategy);
	this.dropsiteStrategies = [this.woodStrategy, this.mineStrategy, this.farmsteadStrategy];

};

BrennusBot.prototype.OnUpdate = function()
{
	if (this.gameState.playerData.state !== "active")
		return;

	if (this.turn % 5 === 0)
	{
		this.updateEnemyPositions();

		// Failed build spots expire after 1500 turns (5 min) — storehouses after
		// 300: their failures are mostly silent engine rejections from the
		// territory/passability grid lag at the frontier (storehouses require
		// OWN territory), and the clump's best ring spot must not stay
		// poisoned while the woodline keeps receding. Other failures are
		// mostly war damage, and the spot is fine once the frontier moves
		// (def14: 7-20 dead spots).
		this.failedSpots = this.failedSpots.filter(f =>
			this.turn - (f[2] || 0) < (f[3] && f[3].indexOf("storehouse") !== -1 ? 300 : 1500));

		// A research or defense-building order holds construction for the rest of the block: research + construct in the same block would overdraw the pre-command resource snapshot.
		this.arbiter.resetBlock();
		this.updateResourceScan();
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

// ---------------------------------------------------------------- save/load
BrennusBot.prototype.Serialize = function()
{
	return {
		"assignments": this.assignments,
		"builderAssignments": this.builderAssignments,
		"pendingBuilds": this.pendingBuilds,
		"bootstrapStoreTried": this.bootstrapStoreTried,
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
		"reliefOn": this.reliefOn,
		"placeFailSince": this.placeFailSince,
		"reliefServedPeak": this.reliefServedPeak,
		"expContested": this.expContested,
		"clearOp": this.clearOp,
		"clearCool": this.clearCool,
		"army": this.army,
		"arbiter": this.arbiter.serialize(),
		"rams": this.rams,
		"healers": this.healers
	};
};

BrennusBot.prototype.Deserialize = function(data, sharedScript)
{
	this.savedState = data;
	this.isDeserialized = true;
};
