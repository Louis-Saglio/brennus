import { BaseAI } from "simulation/ai/common-api/baseAI.js";
// super_brennus (goal 12): gaul boom bot — defeats very hard aggressive Petra
// (rome) under conquest_civic_centers in under 45 in-game minutes.

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
	return { ...base };
};

BrennusBot.prototype.houseTrainingTech = "unlock_civilians_house_generic";

BrennusBot.prototype.boomTechs = [

	"gather_wicker_baskets",

	"gather_farming_plows",

	// town — grain-rate techs first: they cost the metal the city bank wants,
	// so they must land before the 750 reserve activates
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

BrennusBot.prototype.herdMax = 200;

BrennusBot.prototype.herdCutoff = 200;

BrennusBot.prototype.herdPrefer = false;

BrennusBot.prototype.herdKillDist = 25;

// A new wood storehouse may only go up once no existing dropsite's ring still
// serves >= this much wood; 250 ≈ one temperate tree or 2.5 steppe bushes.
BrennusBot.prototype.ringGateWood = 250;

BrennusBot.prototype.ringServeDist = 40;

BrennusBot.prototype.minePairDist = 55;

BrennusBot.prototype.CustomInit = function(gameState)
{
	print(`[HARNESS] brennus: loaded for player ${this.player}\n`);

	this.ccAngle = undefined;

	this.assignments = this.savedState?.assignments || {};

	this.builderAssignments = this.savedState?.builderAssignments || {};

	this.pendingBuilds = this.savedState?.pendingBuilds || [];

	// Storehouse spots whose commit is blocked by chopper traffic on the
	// foundation: the choppers become the builders.
	this.rushBuilds = this.savedState?.rushBuilds || [];

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

	this.herdDrop = this.savedState?.herdDrop;
	this.herdWoundDist = this.savedState?.herdWoundDist || Infinity;

	this.fruitStock = 0;

	this.mineId = this.savedState?.mineId || {};
};

BrennusBot.prototype.OnUpdate = function()
{
	if (this.gameState.playerData.state !== "active")
		return;

	if (this.turn % 5 === 0)
	{
		this.updateEnemyPositions();

		// A research + construct order in the same block overdraws the resource
		// snapshot (the construct is rejected and blacklisted): hold construction.
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

	if (!this.pop300Logged && this.gameState.getPopulation() >= 300)
	{
		this.pop300Logged = true;
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m population=300\n`);
	}
	if (this.turn % 750 === 0)
		this.logStatus();
	this.turn++;
};

BrennusBot.prototype.assignGatherers = function()
{
	const counts = { "food": 0, "wood": 0, "stone": 0, "metal": 0 };
	const idle = [];

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
		// The engine's gather autocontinue drifts pickers to ever-farther unserved
		// supplies: stop food gatherers > 45 m from every dropsite; returners exempt.
		const sites = this.foodDropsitePositions();
		for (const ent of this.gameState.getOwnUnits().values())
		{
			if (this.assignments[ent.id()] !== "food" || !ent.isGatherer() ||
				ent.isIdle() || !ent.position())
				continue;
			// The herder carries a stale turn-0 "food" assignment and works carcasses
			// beyond 45 m of every dropsite: exempt it.

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

				// An attacked animal flees the attacker: approach from the far side
				// so it runs toward the base.
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

BrennusBot.prototype.findSupply = function(unit, resource)
{
	const pos = unit.position();
	const region = this.accessibility.getAccessValue(pos);

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
			// Minimize the full walk cycle: walk to the tree plus the tree's
			// distance to its nearest dropsite.
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

	if (resource === "food")
	{
		// Served fruit and dead in-territory animals are ONE food pool (same
		// gather rate, carcasses never rot): nearest served supply wins.
		const dropsites = this.foodDropsitePositions();
		let best, bestD = Infinity;
		for (const s of this.gameState.getResourceSupplies("food").values())
		{
			const supplyPos = s.position();
			if (!supplyPos || this.accessibility.getAccessValue(supplyPos) !== region)
				continue;
			const specific = s.resourceSupplyType()?.specific;
			// The carcass the herder is collecting stays its own — a civilian
			// would only duplicate the collection.
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

		// Never trek for unserved food: served-only for fruit AND meat, or the
		// drift stop loops the unit (stop → reassign → drift).
		if (foodSites &&
			(supply.resourceSupplyType()?.specific === "fruit" ||
				supply.resourceSupplyType()?.specific === "meat") &&
			!foodSites.some(d => SquareDistance(supplyPos, d) < 45 * 45))
			continue;

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

// One herder, exempt from the gatherer shares, hunts in two modes:
// - herd: a skittish animal within herdCutoff m is wounded ONCE from the far
//   side, then shadowed without attacking — a wounded animal keeps fleeing
//   away from its attacker while it stays within the flee distance (fixed at
//   wound time), so the flight carries it to the pinned dropsite where the
//   kill lands. In-territory kills go to the civilians.
// - collect: killed in place and collected by the cavalry before the next animal.
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
	if (!target && this.herdTarget !== undefined && this.herdLastPos)
	{
		// The kill replaced the live animal with a NEW corpse entity: adopt it by position.

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

		const keep = this.woodline.kind === "store" ? this.ringGateWood : 800;
		if (remaining > keep)
		{
			this.woodline.total = remaining;
			return;
		}
	}
	// Wood supplies binned into 30 m cells; hotspot = most wood in its 90 m
	// neighbourhood; zone = trees within 45 m, kept until under 800 wood.
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

	// Rule 1: cut the wood an existing dropsite already serves first — pick the
	// dropsite whose ring still holds the most wood; fall back to the hotspot.
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

	// Wood-poor biome (no supply holds 200): gates fields and wood storehouses
	// behind the town trio's wood.
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

// Effective vs theoretical gather rate: a delivery is a carried load dropping
// to 0, and amount / time since the previous delivery is the worker's rate
// over a full cycle. Theoretical = template rate × diminishing returns.
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

BrennusBot.prototype.nextPhaseTech = function()
{
	return { 1: "phase_town_generic", 2: "phase_city_generic" }[this.gameState.currentPhase()];
};

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

	if (tech === "phase_town_generic")
	{
		// Delay the town bank until fertility is researching (its house trainers
		// ARE the boom) and the 2 bootstrap fields stand; fallbacks at t=4 / t=5.
		const fert = this.houseTrainingTech;
		const t = gameState.getTimeElapsed();
		if (!gameState.isResearched(fert) && !gameState.isResearching(fert) &&
			gameState.canResearch(fert) && t >= 240000 && t < 540000)
			return;

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

	// Hold the city research for the grain-rate and house-cap techs; fallback at 13:20.
	if (tech === "phase_city_generic" && gameState.getTimeElapsed() < 800000 &&
		["gather_farming_plows", "gather_farming_training", "gather_farming_harvester",
			"pop_house_01"].some(t2 =>
			gameState.canResearch(t2) && !gameState.isResearched(t2) && !gameState.isResearching(t2)))
		return;
	if (!gameState.getResources().canAfford(cost))
		return;

	this.phaseReady = true;
	const cc = this.getCivicCentre();
	if (cc && !cc.trainingQueue()?.length)
	{
		cc.research(tech);
		this.constructionHold = true;
	}
		// Pinned at the pop cap the queue never drains: cancel it (refunded) so
		// the research can start.
	else if (cc && gameState.getPopulation() >= gameState.getPopulationLimit())

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

BrennusBot.prototype.trainWorkers = function()
{
	const gameState = this.gameState;
	const resources = gameState.getResources();

	const reserveFood = this.banking ? 500 : (this.phaseReserve?.food || 0);

	const fertFloor = this.fertPending ? 300 : 0;
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const houseTraining = gameState.isResearched(this.houseTrainingTech);

	for (const ent of gameState.getOwnStructures().values())
	{
		let type, batch;
		if (ent.templateName() === ccType)
		{

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

BrennusBot.prototype.manageResearch = function()
{
	const gameState = this.gameState;
	const resources = gameState.getResources();
	const reserve = this.phaseReserve || {};
	if (this.banking)
		return;

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

		// Stone/metal keep a floor even before the city reserve; the bank
		// techs may spend into it.
		const bankFloor = gameState.currentPhase() === 2 ? 300 : 0;

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

BrennusBot.prototype.manageConstruction = function()
{
	const gameState = this.gameState;
	const resources = gameState.getResources();
	const foundations = gameState.getOwnFoundations().toEntityArray();

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
		const fpos = foundation.position();

		// Units on a foundation block its commit: the choppers become its builders.
		const rush = this.rushBuilds.some(r => Math.abs(r.x - fpos[0]) < 6 && Math.abs(r.z - fpos[1]) < 6);
		const target = (isField ? 2 : isHouse ? (this.gameState.currentPhase() === 1 ? 2 : 3) : rush ? 8 : 4);
		let cur = assigned[foundation.id()];
		if (!cur)
			cur = assigned[foundation.id()] = [];
		const needed = target - cur.length;
		if (needed <= 0)
			continue;
		const builders = gameState.getOwnUnits()
			.filter(ent => ent.isGatherer() && ent.isBuilder() && ent.position() &&
				!(ent.id() === this.herderId && !this.herdingDone) &&
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

	if (this.banking)
		return;

	const houseType = gameState.applyCiv("structures/{civ}/house");
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	const reserve = this.phaseReserve || {};

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
			resources.subtract({ "wood": 100 });
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
					resources.subtract(cost);
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
		resources.wood >= houseCost + (this.fieldDemand ? 100 : 0))
		return tryHouse();

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

	const cc = this.getCivicCentre();
	if (!cc)
		return;
	const ccPos = cc.position();
	let foodGatherers = 0;
	for (const res of Object.values(this.assignments))
		if (res === "food")
			foodGatherers++;
	// Fields must stand before the served fruit runs out: open at t=1:30 or when
	// served stock drops under ~4 min of runway; village cap 4.
	const fieldCap = gameState.currentPhase() === 1 ? 4 : 30;
	const desiredFields = this.fruitStock < 4000 || gameState.getTimeElapsed() > 90000 ?
		Math.min(fieldCap, Math.max(2, Math.ceil(foodGatherers / 3) + 1)) : 0;
	let fields = 0;
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === fieldType)
			fields++;
	const fieldFoundations = foundations.filter(f =>
		gameState.getBuiltTemplate(f.templateName()).templateName() === fieldType).length;

	this.fieldDemand = (fields + fieldFoundations) < Math.min(2, desiredFields) &&
		this.fruitStock < 800;

	this.fieldStallTurns = fields === this.lastFields ? (this.fieldStallTurns || 0) + 1 : 0;
	this.lastFields = fields;
	if (this.woodPoor && fields + fieldFoundations < desiredFields / 2 &&
		this.fieldStallTurns > 100)
		this.fieldDemand = true;

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

	if (this.fertPending)
		return;

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

BrennusBot.prototype.manageDropSites = function(foundations, reserve)
{
	const gameState = this.gameState;
	const resources = gameState.getResources();
	const cc = this.getCivicCentre();
	if (!cc)
		return false;

	// Gated on raw wood + phase reserve only, never the trio reserve: dropsites
	// ARE the income.
	const woodFloor = 100 + (reserve.wood || 0);

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
	// Destroy storehouses farther than 60 m from their nearest supply; the
	// rebuild logic replaces them at the right spot instead of oscillating.

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

	// Rule 1: a new wood storehouse only once no existing ring still serves
	// >= ringGateWood.
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
	if (storeCount < 18 && servedWood < this.ringGateWood && this.woodline?.kind !== "store")
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

			// The spot minimizes walking: the amount-weighted median of the zone,
			// not the cutting front's centroid.
			const center = this.woodlineDropSpot() || centroid(clump);

			const trioWood = this.gameState.currentPhase() === 2 && this.woodPoor ?
				this.nextTrioWood() : 0;
			const planned = storeFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 30) ||
				storePending(center);
			const pos = resources.wood >= woodFloor + trioWood && !planned &&
				this.tryConstruct(storeType, "dropsite", center, true);
			if (pos)
			{
				resources.subtract({ "wood": 100 });
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for woodline ${center[0].toFixed(0)},${center[1].toFixed(0)} (${underserved.length} underserved)\n`);
				return true;
			}
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
			const sMine = this.mineId.stone !== undefined ?
				gameState.getEntityById(this.mineId.stone) : undefined;
			const mMine = this.mineId.metal !== undefined ?
				gameState.getEntityById(this.mineId.metal) : undefined;
			const sPos = sMine?.position(), mPos = mMine?.position();
			const pairNear = sPos && mPos &&
				Math.hypot(sPos[0] - mPos[0], sPos[1] - mPos[1]) < this.minePairDist;
			// Rule 2: close stone and metal share ONE storehouse (minimax over
			// both mines).
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
						resources.subtract({ "wood": 100 });
						print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} between stone ${sPos[0].toFixed(0)},${sPos[1].toFixed(0)} and metal ${mPos[0].toFixed(0)},${mPos[1].toFixed(0)} (${underserved.length} underserved)\n`);
						return true;
					}
				}
			}
			const clump = underserved.filter(p => Math.hypot(p[0] - worst[0], p[1] - worst[1]) < 25);
			const center = centroid(clump);
			const planned = storeFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 30) ||
				storePending(center);
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

	// Build a farmstead by the next berry patch BEFORE the pickers trek over.
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

	// 500-unit deals drift prices ~8% each: alternate what is sold.
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

// Amount-weighted geometric median via 30 Weiszfeld iterations; a point under
// the median is skipped for that iteration (the 1/d singularity).
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
	let pos;
	if (kind === "house")
		pos = this.findGridSpot(templateType, this.housePlots(ccPos), region);
	else if (kind === "field")
		pos = this.findGridSpot(templateType, this.fieldPlots(ccPos), region);
	else if (kind === "dropsite")

		// A dropsite's value is its location: search tightly, never fall back
		// to the base.
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
	const builder = this.gameState.getOwnUnits().filterNearest(pos, 1).toEntityArray()[0];
	if (!builder)
		return false;
	builder.construct(templateType, pos[0], pos[1], this.getPlacementAngle(), undefined);
	this.pendingBuilds.push({ "template": templateType, "x": pos[0], "z": pos[1], "turn": this.turn });
	if (rush)
		this.rushBuilds.push({ "x": pos[0], "z": pos[1], "turn": this.turn });
	return true;
};

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

// Placement prefilter on the TRUE rotated footprint, inflated by half a
// navcell diagonal (0.75 m); territory keeps the conservative axis box.
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

BrennusBot.prototype.updateEnemyPositions = function()
{
	this.enemyStructuresPos = [];
	this.enemyMobilesPos = [];
	for (const ent of this.gameState.getEnemyEntities().values())
	{
		// Gaia is diplomatically "enemy": keep only animals that can attack.
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
