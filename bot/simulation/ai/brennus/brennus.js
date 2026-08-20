import { BaseAI } from "simulation/ai/common-api/baseAI.js";

/**
 * Brennus: AI bot for 0 A.D.
 *
 * Current stage — goal 2 (economy foundations): every starting worker is
 * assigned to a resource and kept gathering; idle units are reassigned to
 * the resource with the largest unmet gatherer need. No training or
 * building yet.
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

/** How many gatherers each resource should have, in priority order. */
BrennusBot.prototype.gathererTargets = { "food": 3, "wood": 2, "stone": 2, "metal": 2 };

BrennusBot.prototype.CustomInit = function(gameState)
{
	print(`[HARNESS] brennus: loaded for player ${this.player}\n`);
	// entityID -> resource this unit was ordered to gather.
	this.assignments = this.savedAssignments || {};
};

BrennusBot.prototype.OnUpdate = function()
{
	if (this.gameState.playerData.state !== "active")
		return;

	if (this.turn % 5 === 0)
		this.assignGatherers();
	if (this.turn % 1500 === 0)
		this.logStatus();
	this.turn++;
};

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

	for (const ent of idle)
	{
		// The resource with the largest unmet need that this unit can gather.
		let resource;
		let bestDeficit = -Infinity;
		for (const res of ["food", "wood", "stone", "metal"])
		{
			const deficit = this.gathererTargets[res] - counts[res];
			if (ent.canGather(res) && deficit > bestDeficit)
			{
				resource = res;
				bestDeficit = deficit;
			}
		}
		if (!resource)
			continue;
		const supply = this.findSupply(ent, resource);
		if (!supply)
			continue;
		ent.gather(supply);
		this.assignments[ent.id()] = resource;
		counts[resource]++;
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
	print(`[HARNESS] t=${Math.round(this.gameState.getTimeElapsed() / 60000)}m idle=${idle} ` +
		`gatherers food=${counts.food} wood=${counts.wood} stone=${counts.stone} metal=${counts.metal} ` +
		`stock ${Math.floor(res.food)}/${Math.floor(res.wood)}/${Math.floor(res.stone)}/${Math.floor(res.metal)}\n`);
};

BrennusBot.prototype.Serialize = function()
{
	return { "assignments": this.assignments };
};

BrennusBot.prototype.Deserialize = function(data, sharedScript)
{
	this.savedAssignments = data.assignments;
	this.isDeserialized = true;
};
