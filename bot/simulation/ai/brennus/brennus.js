/**
 * Brennus: AI bot for 0 A.D. — a Gaul bot for generic land maps facing a
 * real opponent (Petra, medium difficulty, aggressive behaviour). Survive
 * the early pressure, boom, then convert the economy into an army that
 * eliminates Petra (all enemy civic centers) in under 45 in-game minutes.
 * The `[HARNESS] brennus: loaded` banner is the headless smoke test's canary.
 */

import { BaseAI } from "simulation/ai/common-api/baseAI.js";
import { ResourceArbiter } from "simulation/ai/brennus/arbiter.js";
import { ArmyManager } from "simulation/ai/brennus/army.js";
import { BoomManager } from "simulation/ai/brennus/boom.js";
import { BuildupManager } from "simulation/ai/brennus/buildup.js";
import { DefenseManager } from "simulation/ai/brennus/defense.js";
import { EconomyManager } from "simulation/ai/brennus/economy.js";
import { OffenseManager } from "simulation/ai/brennus/offense.js";
import { ConstructionManager } from "simulation/ai/brennus/construction.js";
import "simulation/ai/brennus/config.js";
import { ExpansionManager } from "simulation/ai/brennus/expansion.js";
import { PlacementManager } from "simulation/ai/brennus/placement.js";
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

	// Builder assignment, pending/rush build tracking and dropsite strategies.
	this.constructionManager = new ConstructionManager(this);
	this.constructionManager.deserialize(this.savedState?.construction);
	// Building-spot scans, the shared placement angle and the failed-spot list.
	this.placementManager = new PlacementManager(this);
	this.placementManager.deserialize(this.savedState?.placement);

	// Gathering assignment, herding, mine pinning and gather-rate telemetry.
	this.economyManager = new EconomyManager(this);
	this.economyManager.deserialize(this.savedState?.economy);
	this.boomManager = new BoomManager(this);

	// Expansion program (CC lattice, relief expansion, wonder/trade/barter)
	// and the defense/war/expansion stage latches.
	this.expansionManager = new ExpansionManager(this);
	this.expansionManager.deserialize(this.savedState?.expansion);

	this.offenseManager = new OffenseManager(this);
	this.offenseManager.deserialize(this.savedState?.offense);

	// Army rosters and enemy intel, home-defense dispatch, war production.
	this.armyManager = new ArmyManager(this);
	this.armyManager.deserialize(this.savedState?.army);
	this.defenseManager = new DefenseManager(this);
	this.buildupManager = new BuildupManager(this);
};

BrennusBot.prototype.OnUpdate = function()
{
	if (this.gameState.playerData.state !== "active")
		return;

	if (this.turn % 5 === 0)
	{
		this.armyManager.updateEnemyPositions();

		// Failed build spots expire after 1500 turns (5 min) — storehouses after
		// 300: their failures are mostly silent engine rejections from the
		// territory/passability grid lag at the frontier (storehouses require
		// OWN territory), and the clump's best ring spot must not stay
		// poisoned while the woodline keeps receding. Other failures are
		// mostly war damage, and the spot is fine once the frontier moves
		// (def14: 7-20 dead spots).
		this.placementManager.failedSpots = this.placementManager.failedSpots.filter(f =>
			this.turn - (f[2] || 0) < (f[3] && f[3].indexOf("storehouse") !== -1 ? 300 : 1500));

		// A research or defense-building order holds construction for the rest of the block: research + construct in the same block would overdraw the pre-command resource snapshot.
		this.arbiter.resetBlock();
		this.economyManager.updateResourceScan();
		this.economyManager.assignGatherers();
		this.economyManager.manageHerding();
		this.economyManager.sampleGatherRates();
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
		"expansion": this.expansionManager.serialize(),
		"construction": this.constructionManager.serialize(),
		"placement": this.placementManager.serialize(),
		"economy": this.economyManager.serialize(),
		"offense": this.offenseManager.serialize(),
		"army": this.armyManager.serialize(),
		"arbiter": this.arbiter.serialize(),
	};
};

BrennusBot.prototype.Deserialize = function(data, sharedScript)
{
	this.savedState = data;
	this.isDeserialized = true;
};

// ---------------------------------------------------------------- lookups
BrennusBot.prototype.getCivicCentre = function()
{
	const ccType = this.gameState.applyCiv("structures/{civ}/civil_centre");
	for (const ent of this.gameState.getOwnStructures().values())
		if (ent.templateName() === ccType)
			return ent;
	return undefined;
};

BrennusBot.prototype.inOwnTerritory = function(x, z)
{
	const terr = this.territoryMap;
	const i = Math.floor(x / terr.cellSize), j = Math.floor(z / terr.cellSize);
	if (i < 0 || j < 0 || i >= terr.width || j >= terr.height)
		return false;
	return (terr.data[i + j * terr.width] & 0x1F) === this.player;
};
