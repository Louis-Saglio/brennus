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

			// Stone mining starts at t=5:00, not t=8:00: five towers (500
			// stone) must stand before the diff-5 wave lands at ~10-12 min.
			const early = this.gameState.getTimeElapsed() < 300000;
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
					Math.min(0.25, needed / (0.35 * timeLeft) / total) : 0;
				mining += shares[res2];
			}
			const scale = Math.max(0, 1 - mining) / (base.food + base.wood);
			shares.food = base.food * scale;
			shares.wood = base.wood * scale;
		}
		return shares;
	}
	// War-stage phase 3 (city researched): keep real mining shares. Phase-3
	// base shares are 1% stone/metal — goal 10 (agg8 s2) banked 40 metal for
	// 11 minutes after city and the first ram trained 11 min after the
	// arsenals were ordered. Rams, forge techs and towers all eat metal/stone
	// continuously; mine until a war chest is banked.
	if (phase === 3 && this.warOn())
	{
		const res = this.gameState.getResources();
		const shares = { ...base };
		let mining = 0;
		if (res.stone < 400)
		{
			shares.stone = 0.06;
			mining += 0.06;
		}
		if (res.metal < 800)
		{
			shares.metal = 0.12;
			mining += 0.12;
		}
		const scale = Math.max(0, 1 - mining) / (base.food + base.wood);
		shares.food = base.food * scale;
		shares.wood = base.wood * scale;
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

	// Defense: standing army roster (entityID -> 1), command throttle, shelter memory.
	this.army = this.savedState?.army || {};
	this.rams = this.savedState?.rams || {};
	this.healers = this.savedState?.healers || {};
	this.cavForce = this.savedState?.cavForce || {};
	this.armyCmdTurn = 0;
	this.shelterDanger = {};
	this.spearNext = true;
};

BrennusBot.prototype.OnUpdate = function()
{
	if (this.gameState.playerData.state !== "active")
		return;

	if (this.turn % 5 === 0)
	{
		this.updateEnemyPositions();

		// Failed build spots expire after 1500 turns (5 min): most failures are
		// war damage (a raided storehouse, a razed foundation) and the spot is
		// fine once the frontier moves.
		this.failedSpots = this.failedSpots.filter(f => this.turn - (f[2] || 0) < 1500);

		// A research + construct order in the same block overdraws the resource
		// snapshot (the construct is rejected and blacklisted): hold construction.
		this.constructionHold = false;
		this.updateWoodline();
		this.assignGatherers();
		this.manageHerding();
		this.sampleGatherRates();
		// Defense runs BEFORE the economy spenders (research, women stream,
		// construction): the early muster must draw from the resource flow, not
		// from stockpiles the boom never leaves behind (goal 10, agg1: floors
		// above cost level never fired pre-boom and the army stayed empty while
		// Petra's wave arrived).
		this.manageDefense();
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

	// City is the whole game at diff 5 (fanatics, rams, forge techs): do NOT
	// hold the research for the grain-rate techs — at war their metal cost
	// is refilled by mining and barter, but every minute of delay is a
	// minute off the kill clock (mil6: city at 26.5-30.1m, never time to
	// raid).
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

	// Leave pop room for the mustering army and its refills: stop the civilian
	// stream at the cap once the war stage is on. Gating this on army <
	// target yo-yoed (army full → train to the cap → dismiss for the next
	// batch → retrain…).
	if (this.warOn() &&
		gameState.getPopulation() >= gameState.getPopulationLimit() - 5)
		return;

	// War-stage pop discipline: hold workers at 150 and leave the rest of the
	// 300 cap free for the army (120) + healers (10) + rams (6 × 3 pop) =
	// 298 total. 175 workers pop-blocked the army at ~60 until dismissal
	// kicked in 15 min after city (goal 10, agg11 s3), and the war economy
	// runs a 10k+ food surplus anyway. Refilling army losses with women only
	// to dismiss them on the next soldier batch is a pure food leak.
	if (this.warOn())
	{
		let workers = 0;
		for (const u of gameState.getOwnUnits().values())
			if (u.isGatherer() && !u.hasClass("Soldier") && !u.hasClass("Trader") &&
				u.id() !== this.herderId)
				workers++;
		if (workers >= 150)
			return;
	}

	// Pre-war (town phase): cap the woman stream at 150 — the early muster
	// needs the food more than the boom needs a 150th worker (goal 10, agg4
	// s1: the house stream drained food at cost level every block and the
	// barracks starved). But not lower: a cap of 100 starved the boom techs
	// and stalled city phase, and 130 still meant city at 18.5-20.2m — city
	// gates fanatics/rams/raids, so every minute here is off the kill clock.
	if (this.defenseOn() && !this.warOn())
	{
		let workers = 0;
		for (const u of gameState.getOwnUnits().values())
			if (u.isGatherer() && !u.hasClass("Soldier") && !u.hasClass("Trader") &&
				u.id() !== this.herderId)
				workers++;
		if (workers >= 150)
			return;
	}

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
	// The ram fund outranks boom techs (see manageDefenseTraining).
	if (this.ramHold)
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
		// Market first: barter converts the food/wood surplus into the
		// stone/metal the city bank wants.
		this._trioTypes = ["market", "forge", third]
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
		if (this.turn - pb.turn > (pb.timeout || 50))
		{
			print(`[HARNESS] construct FAILED: ${pb.template} at ${pb.x.toFixed(0)},${pb.z.toFixed(0)}\n`);
			this.failedSpots.push([pb.x, pb.z, this.turn]);
			return false;
		}
		return true;
	});

	if (this.constructionHold)
		return;

	if (this.banking)
		return;

	// A missing pre-war military building freezes the economy's wood
	// spending until its 320 gate is banked (see manageDefenseBuildings);
	// ramHold does the same for the ram fund (see manageDefenseTraining).
	if (this.milBuildingHold || this.ramHold)
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
			// Metal over-banks while stone is the binding constraint for the
			// city bank (mil5 s2: 1400 metal vs 320 stone at t=20m, city
			// never researched): sell the surplus metal for stone directly.
			if (res.metal >= 900 && res.stone < 700)
			{
				market.barter("stone", "metal", 500);
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 metal -> stone\n`);
				return;
			}
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
			if (this.nearEnemyForBuild([x, z]))
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
	// The commit timeout must cover the walk: a flat 50 turns (10 s) declares
	// the order failed while the builder is still on its way, and the same
	// spot is re-picked forever (mil3 s2: five towers at 70-90 m looped the
	// whole game and never stood). Budget 1 m/turn for the walk plus 60.
	const bp = builder.position();
	const walk = bp ? Math.hypot(bp[0] - pos[0], bp[1] - pos[1]) : 0;
	this.pendingBuilds.push({ "template": templateType, "x": pos[0], "z": pos[1], "turn": this.turn,
		"timeout": 60 + Math.ceil(walk) });
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
			// The mid-game food base must live under CC and tower arrows: the
			// 58-96 m ring was razed wave after wave (mil7/8). Spillover goes
			// outward through the generic fallback anyway.
			if (dist2 < 42 * 42 || dist2 > 66 * 66)
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
		if (this.nearEnemyForBuild([x, z]))
			continue;
		if (this.accessibility.getAccessValue([x, z]) !== region)
			continue;
		if (this.placementOK(x, z, halfW, halfD, angle, pass, mask, this.territoryMap))
			return [x, z];
	}
	return undefined;
};

BrennusBot.prototype.findBuildingPosition = function(templateType, center, minRadius, maxRadius, fine, region, extraCheck)
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
			if (this.nearEnemyForBuild([x, z]))
				continue;
			if (region !== undefined && this.accessibility.getAccessValue([x, z]) !== region)
				continue;
			if (extraCheck && !extraCheck(x, z))
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

/**
 * Building-placement variant: enemy mobiles loitering near home must not
 * freeze construction — a spot inside the home guard ring (60 m of the CC)
 * is covered by its arrows even while Petra camps the base (mil3 s2: the
 * town trio was unplaceable for 25 min and city landed at 39.8m). Enemy
 * STRUCTURES within 100 m still reject (don't build next to their base).
 */
BrennusBot.prototype.nearEnemyForBuild = function(pos)
{
	for (const epos of this.enemyStructuresPos || [])
		if (SquareDistance(epos, pos) < 100 * 100)
			return true;
	const home = this.getCivicCentre()?.position();
	if (home && SquareDistance(pos, home) < 60 * 60)
		return false;
	for (const epos of this.enemyMobilesPos || [])
		if (SquareDistance(epos, pos) < 60 * 60)
			return true;
	return false;
};

/**
 * The defense stage starts at the town phase (~5 min), not at the end of
 * the boom — very hard aggressive Petra must be met by a standing army and
 * towers from her first raids on (~10-12 min at difficulty 5, ~4 min
 * earlier than medium), not by a muster that starts when her army is
 * already camping the base.
 */
BrennusBot.prototype.defenseOn = function()
{
	if (this.defOn)
		return true;
	if (this.gameState.isResearched("phase_town_generic"))
	{
		this.defOn = true;
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m defense stage on (town researched)\n`);
	}
	return this.defOn;
};

/**
 * The war stage starts at the city phase, WITHOUT a pop requirement —
 * against aggressive Petra the waves arrive before 300 pop ever lands
 * (goal 10, agg2/agg3: city at ~14.5m, pop stuck at 240-290 under raid, so
 * the whole post-boom war machine stayed off while the base burned). City
 * unlocks fanatics/arsenal/rams; that is all the war machine needs.
 */
BrennusBot.prototype.warOn = function()
{
	if (this.war)
		return true;
	if (this.gameState.isResearched("phase_city_generic"))
	{
		this.war = true;
		print(`[HARNESS] t=${(this.gameState.getTimeElapsed() / 60000).toFixed(1)}m war stage on (city researched)\n`);
	}
	return this.war;
};

BrennusBot.prototype.defenseArmyTarget = 120;

BrennusBot.prototype.armyCount = function()
{
	let n = 0;
	for (const id in this.army)
		n++;
	return n;
};

/**
 * Defense (ported from the goal-10 winner): the muster starts at the town
 * phase — aggressive Petra's first waves arrive long before the boom
 * completes. A standing army mustered from town phase (barracks
 * spearmen/javelineers, temple fanatics after the boom), workers sheltering
 * in garrisonable structures when enemies are close, and the army blob sent
 * to whichever CC has enemies near it.
 */
BrennusBot.prototype.manageDefense = function()
{
	const gameState = this.gameState;

	// Roster: drop the dead; once the defense stage is on, every Soldier joins the army.
	for (const id in this.army)
		if (!gameState.getEntityById(+id))
			delete this.army[id];
	for (const id in this.rams)
		if (!gameState.getEntityById(+id))
			delete this.rams[id];
	for (const id in this.healers)
		if (!gameState.getEntityById(+id))
			delete this.healers[id];
	for (const id in this.cavForce)
		if (!gameState.getEntityById(+id))
			delete this.cavForce[id];
	if (this.defenseOn())
		for (const ent of gameState.getOwnUnits().values())
		{
			const id = ent.id();
			if (ent.hasClass("Siege") && !this.rams[id])
			{
				this.rams[id] = 1;
				continue;
			}
			if (ent.hasClass("Healer"))
			{
				this.healers[id] = 1;
				delete this.assignments[id];
				continue;
			}
			// Cavalry is the raid force, not the blob (see manageCavRaids).
			if (id !== this.herderId && ent.hasClass("Cavalry") && !this.cavForce[id])
			{
				delete this.army[id];
				this.cavForce[id] = 1;
				delete this.assignments[id];
				continue;
			}
			if (this.army[id] || !ent.hasClass("Soldier") || id === this.herderId)
				continue;
			this.army[id] = 1;
			delete this.assignments[id];
			if (ent.position())
				ent.setStance("defensive");
		}

	this.manageDefenseBuildings();
	this.manageDefenseTraining();
	this.manageMilitaryTechs();

	// Enemy soldiers/siege in the world, once for the threat scan and the shelter.
	const mil = [];
	const milSiege = [];
	for (const ent of gameState.getEnemyUnits().values())
	{
		if (ent.owner() === 0 || (!ent.hasClass("Soldier") && !ent.hasClass("Siege")))
			continue;
		const pos = ent.position();
		if (!pos)
			continue;
		mil.push(pos);
		if (ent.hasClass("Siege"))
			milSiege.push(pos);
	}

	this.manageCavRaids(gameState, mil);

	// Threat: enemies within 120 m of an own CC; the CC nearest home wins.
	// Serious means a real assault (8+ units, or siege within 160 m) — only a
	// serious threat cancels or blocks a raid; small probing parties are the
	// standing army's everyday job and must not pin it at home forever.
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const homePos = this.getCivicCentre()?.position();
	let threat;
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.templateName() !== ccType || !ent.position())
			continue;
		const cp = ent.position();
		let n = 0, sx = 0, sz = 0;
		for (const p of mil)
		{
			if (SquareDistance(p, cp) > 120 * 120)
				continue;
			n++;
			sx += p[0];
			sz += p[1];
		}
		let siegeN = 0;
		for (const p of milSiege)
			if (SquareDistance(p, cp) < 160 * 160)
				siegeN++;
		if (!n && !siegeN)
			continue;
		const score = homePos ? SquareDistance(cp, homePos) : -(n + siegeN);
		if (!threat || score < threat.score)
			threat = { "x": sx / Math.max(n, 1), "z": sz / Math.max(n, 1), "n": n, "siegeN": siegeN, "score": score, "ccx": cp[0], "ccz": cp[1], "ccId": ent.id() };
	}

	const armyEnts = [];
	for (const id in this.army)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			armyEnts.push(ent);
	}
	// Healers trail the army everywhere it is sent; they heal passively.
	const healerEnts = [];
	for (const id in this.healers)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			healerEnts.push(ent);
	}
	const serious = threat && (threat.n >= 8 || threat.siegeN > 0);
	// A strong raid does NOT come home for a serious threat: at diff 5 a
	// wave lands every ~6 min and cancelling every raid means never raiding
	// (mil9: zero raids in 22 post-city minutes). With 75+ soldiers and
	// rams at their CC the base race beats the recall loop — home holds on
	// towers, garrisoned workers and arrows.
	const raidHolds = serious && this.offense && this.armyCount() >= 75;
	if (serious && !raidHolds)
	{
		// Defense takes precedence over any raid.
		if (this.offense)
		{
			this.offense = undefined;
			for (const ent of armyEnts)
				ent.setStance("defensive");
			if (homePos)
				for (const id in this.rams)
				{
					const ram = gameState.getEntityById(+id);
					if (ram?.position())
						ram.move(homePos[0], homePos[1]);
				}
		}
		if (!this.hadThreat)
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m engaging ${threat.n} enemies (siege=${threat.siegeN}) near CC ${threat.x.toFixed(0)},${threat.z.toFixed(0)} (army=${armyEnts.length})\n`);
		if (this.turn >= this.armyCmdTurn)
		{
			this.armyCmdTurn = this.turn + 10;
			// threat.n counts only enemies already within 120 m of the CC;
			// the rest of the wave is still marching in (goal 10, agg9 s3:
			// threat.n=8 hid a 105-unit wave — the 59-strong army
			// attack-moved into the open and melted in 1.5 min). Compare
			// against everyone within 150 m of the threat centroid instead.
			let nearThreat = 0;
			for (const p of mil)
				if (SquareDistance(p, [threat.x, threat.z]) < 150 * 150)
					nearThreat++;
			nearThreat = Math.max(nearThreat, threat.n);
			// Garrisoned soldiers (not the ungarrisoned remainder) decide
			// superiority — 20 in the CC is +20 arrows, and they eject into
			// the fight once the balance flips.
			// Shelters: the threatened CC, then built defense towers within
			// 120 m of it. A stone tower holds 5 infantry at +1 arrow each
			// (default 4, GarrisonArrowMultiplier 1, GarrisonArrowClasses
			// Infantry) — five full towers shelter 25 soldiers behind ~45
			// extra arrows; the CC alone could not hold the army (goal 10,
			// agg10 s3: the 39-man overflow stood outside and was
			// slaughtered).
			const shelters = [];
			{
				const ccEnt0 = gameState.getEntityById(threat.ccId);
				if (ccEnt0)
					shelters.push(ccEnt0);
				const towerType = gameState.applyCiv("structures/{civ}/defense_tower");
				for (const ent of gameState.getOwnStructures().values())
					if (ent.templateName() === towerType && ent.position() &&
						ent.foundationProgress() === undefined &&
						SquareDistance(ent.position(), [threat.ccx, threat.ccz]) < 120 * 120)
						shelters.push(ent);
			}
			// Pre-city, never trade in the open against a serious threat: at
			// diff 5 Petra replaces losses instantly while the workers die
			// with the soldiers and the refill stream dies with them (mil2:
			// 42 → 15 in one clash). Under tower/CC arrows (threat centroid
			// within 100 m of the CC) 1.3× suffices — the arrows tip the
			// balance; in the open stay at 2× and garrison. Post-city the
			// standing 1× rule applies — the army can fight.
			const underArrows = SquareDistance([threat.x, threat.z], [threat.ccx, threat.ccz]) < 100 * 100;
			const engageAt = this.warOn() ? 1 : underArrows ? 1.3 : 2;
			if (this.armyCount() >= engageAt * nearThreat)
			{
				// Local superiority: eject the garrisons and take the fight to them.
				for (const s of shelters)
					for (const gid of s.garrisoned() || [])
					{
						const g = gameState.getEntityById(gid);
						if (g?.hasClass("Soldier") || g?.hasClass("Healer"))
							s.unload(gid);
					}
				for (const ent of armyEnts)
					ent.attackMove(threat.x, threat.z, "Unit", false);
				for (const ent of healerEnts)
					ent.move(threat.x, threat.z);
			}
			else
			{
				// Outnumbered: garrison the shelters, CC first. Each
				// garrisoned soldier is +1 arrow (civil_centre and tower
				// GarrisonArrowMultiplier), the CC garrison heals at 1 hp/s
				// and the CC cannot be captured while manned — standing
				// outside and trading against a bigger blob is a donation
				// (goal 10, agg3 s3: 34 basics melted into a 106-unit wave
				// at 16m while the CC idled).
				const frees = shelters.map(s => Math.max(0, (+s.garrisonMax() || 0) - s.garrisonedSlots()));
				const garrisonIn = ent =>
				{
					for (let i = 0; i < shelters.length; i++)
						if (frees[i] > 0)
						{
							ent.garrison(shelters[i]);
							frees[i]--;
							return true;
						}
						return false;
				};
				for (const ent of armyEnts)
				{
					ent.setStance("defensive");
					if (!garrisonIn(ent) && SquareDistance(ent.position(), [threat.ccx, threat.ccz]) > 40 * 40)
						ent.move(threat.ccx, threat.ccz);
				}
				for (const ent of healerEnts)
					if (!garrisonIn(ent))
						ent.move(threat.ccx, threat.ccz);
			}
		}
	}
	else if (this.manageOffense(gameState, armyEnts, healerEnts, mil, homePos))
	{
		// raid in progress, commands issued there
	}
	else if (threat)
	{
		// Minor probes while no raid is on: swat them.
		if (this.turn >= this.armyCmdTurn)
		{
			this.armyCmdTurn = this.turn + 10;
			for (const ent of armyEnts)
				ent.attackMove(threat.x, threat.z, "Unit", false);
			for (const ent of healerEnts)
				ent.move(threat.x, threat.z);
		}
	}
	else if (homePos)
	{
		// No threat: if a siege camp loiters near home (Petra piles its
		// army just outside our territory, which both blocks the raid windows and
		// farms our outlying storehouses), sortie against it once we are strong
		// enough — the fight happens under our towers and CC arrows.
		// War-stage only: before city the sortie is a donation — goal 10,
		// agg5 s1 sent the whole 60-strong muster into Petra's 75-106 blob
		// at 16m and the base fell 9 minutes later.
		if (!this.warOn())
		{
			// stand down: fall through to the rally below
		}
		else
		{
		let campN = 0, cx = 0, cz = 0;
		for (const p of mil)
			if (SquareDistance(p, homePos) < 220 * 220)
			{
				campN++;
				cx += p[0];
				cz += p[1];
			}
		// Sortie only with clear superiority: the camp GROWS while the army
		// marches (Petra converges), and goal-10 agg8 s2's 20.7m sortie at
		// 60-vs-32 turned into 60-vs-83 mid-field and donated ~30 soldiers.
		// 1.5x or stay home and let the towers and CC arrows bleed the camp.
		// Post-city the sortie gate drops to army ≥ 40: a standing army that
		// never sallies lets the camp farm the workers between waves forever
		// (the mil7-s2 equilibrium). Still 1.5× — the camp grows while the
		// army marches.
		if (campN >= 10 && this.armyCount() >= 40 && this.armyCount() >= campN * 1.5 && this.turn >= this.armyCmdTurn)
		{
			this.armyCmdTurn = this.turn + 10;
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m sortie against siege camp ${(cx / campN).toFixed(0)},${(cz / campN).toFixed(0)} (camp=${campN}, army=${armyEnts.length})\n`);
			for (const ent of armyEnts)
				ent.attackMove(cx / campN, cz / campN, "Unit", false);
			for (const ent of healerEnts)
				ent.move(cx / campN, cz / campN);
		}
		else if (this.turn >= this.armyCmdTurn)
		{
			// Rally home.
			const rally = homePos;
			let far = false;
			for (const ent of armyEnts)
				if (SquareDistance(ent.position(), rally) > 60 * 60)
				{
					far = true;
					break;
				}
			if (far)
			{
				this.armyCmdTurn = this.turn + 25;
				for (const ent of armyEnts)
					if (SquareDistance(ent.position(), rally) > 60 * 60)
						ent.move(rally[0], rally[1]);
				for (const ent of healerEnts)
					ent.move(rally[0], rally[1]);
			}
		}
		}
	}
	this.hadThreat = !!serious;

	// Shelter: workers garrison the nearest holder with room when enemies are
	// close (75 m — field hands need the head start at diff 5); holders eject
	// once no enemy has been within 100 m for 20 turns.
	const holders = [];
	for (const ent of gameState.getOwnStructures().values())
	{
		if (!ent.position() || ent.foundationProgress() !== undefined || !ent.isGarrisonHolder())
			continue;
		if (ent.healthLevel() < 0.15)
			continue;
		holders.push({ "ent": ent, "pos": ent.position(),
			"free": (+ent.garrisonMax() || 0) - ent.garrisonedSlots() });
	}
	for (const h of holders)
		for (const p of mil)
			if (SquareDistance(p, h.pos) < 100 * 100)
			{
				this.shelterDanger[h.ent.id()] = this.turn;
				break;
			}
	for (const h of holders)
		if (h.ent.garrisonedSlots() > 0 &&
			this.turn - (this.shelterDanger[h.ent.id()] ?? -1000) > 20)
			h.ent.unloadAll();
	if (!mil.length)
		return;
	for (const ent of gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || !ent.position() || this.army[ent.id()] || ent.id() === this.herderId)
			continue;
		const state = ent.unitAIState() || "";
		if (state.indexOf("GARRISON") !== -1 || state.indexOf("REPAIR") !== -1)
			continue;
		const wp = ent.position();
		// Serious threat: only workers in the wave's path come home —
		// recalling EVERYONE on every 8-unit probe stopped the economy
		// outright (mil16); the others keep working or shelter in place.
		if (serious)
		{
			if (SquareDistance(wp, [threat.x, threat.z]) < 110 * 110 &&
				SquareDistance(wp, [threat.ccx, threat.ccz]) > 45 * 45)
			{
				if (this.turn >= (this.recallTurn || 0))
					ent.move(threat.ccx, threat.ccz);
				continue;
			}
		}
		else
		{
			let danger = false;
			for (const p of mil)
				if (SquareDistance(p, wp) < 75 * 75)
				{
					danger = true;
					break;
				}
			if (!danger)
				continue;
		}
		let best, bestD = 90 * 90;
		for (const h of holders)
		{
			if (h.free <= 0)
				continue;
			const d2 = SquareDistance(h.pos, wp);
			if (d2 < bestD)
			{
				bestD = d2;
				best = h;
			}
		}
		if (best)
		{
			best.free--;
			ent.garrison(best.ent);
		}
	}
	if (serious)
		this.recallTurn = this.turn + 25;
};

/**
 * Offense: with no serious threat at home and a strong army, strike Petra.
 * Two raid kinds:
 * - CC raid (army ≥ 75, ≥ 2 rams): raze the least defended enemy CC —
 *   under conquest_civic_centers eliminating Petra is the win condition.
 *   Basic infantry cannot raze a garrisoned CC before reinforcements
 *   arrive, hence the rams; retreat and regroup below 50.
 * - Eco-raid (army ≥ 40, guard thin): attack-move her least guarded CC
 *   area and kill her workers. Turtling against a +56% booming aggressive
 *   opponent is a losing game by equilibrium — the bot must bleed HER
 *   boom in the windows right after her waves die on our arrows
 *   (mil7-mil12: twelve iterations of stable ~30-min turtling defeats).
 *   Eco-raids recall on serious threat (no base race at 40-74 army) and
 *   abort when her guard returns.
 * Returns true while a raid is commanded.
 */
BrennusBot.prototype.manageOffense = function(gameState, armyEnts, healerEnts, mil, homePos)
{
	if (!this.warOn() || !armyEnts.length)
		return false;

	const ramEnts = [];
	for (const id in this.rams)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			ramEnts.push(ent);
	}
	const sendRamsHome = () => {
		if (homePos)
			for (const ram of ramEnts)
				ram.move(homePos[0], homePos[1]);
	};
	const sendHealersHome = () => {
		if (homePos)
			for (const ent of healerEnts)
				ent.move(homePos[0], homePos[1]);
	};

	const enemyCCs = [];
	for (const ent of gameState.getEnemyStructures().values())
		if (ent.hasClass("CivCentre") && ent.position() &&
			ent.foundationProgress() === undefined)
			enemyCCs.push(ent);

	if (this.offense)
	{
		if (this.offense.eco)
		{
			let guard = 0;
			for (const p of mil)
				if (SquareDistance(p, [this.offense.x, this.offense.z]) < 100 * 100)
					guard++;
			if (this.armyCount() < 25 || guard >= this.armyCount() ||
				this.turn - (this.offense.turn || 0) > 900)
			{
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m eco-raid over at ${this.offense.x.toFixed(0)},${this.offense.z.toFixed(0)} (guard=${guard}, army=${armyEnts.length})\n`);
				this.offense = undefined;
				this.armyCmdTurn = 0;
				for (const ent of armyEnts)
					ent.setStance("defensive");
				sendRamsHome();
				sendHealersHome();
				return false;
			}
		}
		else
		{
			const target = gameState.getEntityById(this.offense.id);
			if (!target || !target.position())
			{
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m razed enemy CC at ${this.offense.x.toFixed(0)},${this.offense.z.toFixed(0)}\n`);
				this.offense = undefined;
				this.armyCmdTurn = 0;	// rally home next block
				for (const ent of armyEnts)
					ent.setStance("defensive");
				sendRamsHome();
				sendHealersHome();
			}
			else if (ramEnts.length < 1 || this.turn - (this.offense.turn || 0) > 1800)
			{
				// Abort a stalled raid: no rams left means nobody razes the CC —
				// the infantry just dies under its arrows while Petra reinforces
				// (goal 10, agg7 s1: one raid ground on for 12+ min at full
				// army). The age cap is 6 min, not 2: the walk alone to a far CC
				// takes ~2 min, and a 2-min cap abort/relaunched in a loop —
				// the army walked home and back each time and the second CC
				// never even got attacked.
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raid aborted at ${this.offense.x.toFixed(0)},${this.offense.z.toFixed(0)} (rams=${ramEnts.length}, age=${((this.turn - (this.offense.turn || 0)) / 300).toFixed(1)}m, army=${armyEnts.length})\n`);
				this.offense = undefined;
				this.armyCmdTurn = 0;
				for (const ent of armyEnts)
					ent.setStance("defensive");
				sendRamsHome();
				sendHealersHome();
				return false;
			}
		}
	}
	if (!this.offense)
	{
		if (enemyCCs.length < 1)
			return false;
		let best, bestScore;
		for (const ent of enemyCCs)
		{
			const cp = ent.position();
			let defenders = 0;
			for (const p of mil)
				if (SquareDistance(p, cp) < 100 * 100)
					defenders++;
			const score = defenders * 10000 + (homePos ? SquareDistance(cp, homePos) : 0);
			if (best === undefined || score < bestScore)
			{
				best = ent;
				bestScore = score;
			}
		}
		if (!best)
			return false;
		const bp = best.position();
		const defenders = Math.floor(bestScore / 10000);
		if (this.armyCount() >= 75 && ramEnts.length >= 2)
		{
			this.offense = { "id": best.id(), "x": bp[0], "z": bp[1], "turn": this.turn };
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raiding enemy CC ${bp[0].toFixed(0)},${bp[1].toFixed(0)} (defenders=${defenders}, army=${armyEnts.length}, rams=${ramEnts.length})\n`);
			for (const ent of armyEnts)
				ent.setStance("aggressive");
		}
		else if (this.armyCount() >= 40 && defenders <= this.armyCount() * 0.5)
		{
			// Eco-raid: her guard is thin (her army is dead on our arrows or
			// away) — go bleed her workers. Rams stay home.
			this.offense = { "eco": true, "x": bp[0], "z": bp[1], "turn": this.turn };
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m eco-raiding enemy base ${bp[0].toFixed(0)},${bp[1].toFixed(0)} (guard=${defenders}, army=${armyEnts.length})\n`);
			for (const ent of armyEnts)
				ent.setStance("aggressive");
			sendRamsHome();
		}
		else
			return false;
	}
	if (this.armyCount() < (this.offense.eco ? 25 : 50))
	{
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raid spent, regrouping (army=${armyEnts.length})\n`);
		this.offense = undefined;
		this.armyCmdTurn = 0;
		for (const ent of armyEnts)
			ent.setStance("defensive");
		sendRamsHome();
		sendHealersHome();
		return false;
	}
	if (this.turn < this.armyCmdTurn)
		return true;
	this.armyCmdTurn = this.turn + 10;
	if (this.offense.eco)
	{
		for (const ent of armyEnts)
			ent.attackMove(this.offense.x, this.offense.z, "Unit", false);
		for (const ent of healerEnts)
			ent.move(this.offense.x, this.offense.z);
		return true;
	}
	for (const ent of armyEnts)
	{
		if (SquareDistance(ent.position(), [this.offense.x, this.offense.z]) < 60 * 60)
			ent.attack(this.offense.id, false);
		else
			ent.attackMove(this.offense.x, this.offense.z, "Unit", false);
	}
	for (const ram of ramEnts)
	{
		if (SquareDistance(ram.position(), [this.offense.x, this.offense.z]) < 50 * 50)
			ram.attack(this.offense.id, false);
		else
			ram.attackMove(this.offense.x, this.offense.z, "Structure", false);
	}
	for (const ent of healerEnts)
		ent.move(this.offense.x, this.offense.z);
	return true;
};

/**
 * Cavalry raid force: 6-10 javelineer cavalry raid Petra's worker clusters
 * continuously. Her field army is 2-4× ours from t=10m (mil14 telemetry)
 * but it is committed FORWARD, leaving her economy guarded by a dozen
 * soldiers — fast cavalry bleeds her boom where her army is not, and pulls
 * her waves back when they answer. The infantry blob and rams are the
 * hammer; this is the scalpel that keeps her honest meanwhile.
 */
BrennusBot.prototype.manageCavRaids = function(gameState, mil)
{
	const homePos = this.getCivicCentre()?.position();
	const cavEnts = [];
	for (const id in this.cavForce)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			cavEnts.push(ent);
	}
	if (!homePos || !cavEnts.length)
	{
		this.cavRaid = undefined;
		return;
	}
	if (this.turn < (this.cavCmdTurn || 0))
		return;
	this.cavCmdTurn = this.turn + 15;

	// Her mobiles that are not soldiers/siege = workers.
	const workers = [];
	for (const ent of gameState.getEnemyUnits().values())
	{
		if (ent.owner() === 0 || ent.hasClass("Soldier") || ent.hasClass("Siege"))
			continue;
		const pos = ent.position();
		if (pos)
			workers.push(pos);
	}

	if (this.cavRaid)
	{
		let guard = 0;
		for (const p of mil)
			if (SquareDistance(p, [this.cavRaid.x, this.cavRaid.z]) < 60 * 60)
				guard++;
		let work = 0;
		for (const p of workers)
			if (SquareDistance(p, [this.cavRaid.x, this.cavRaid.z]) < 60 * 60)
				work++;
		if (guard >= 4 || cavEnts.length < 4 || work < 2)
		{
			print(`[CAV] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m retreat from ${this.cavRaid.x.toFixed(0)},${this.cavRaid.z.toFixed(0)} (guard=${guard} work=${work} cav=${cavEnts.length})\n`);
			this.cavRaid = undefined;
			for (const ent of cavEnts)
				ent.move(homePos[0], homePos[1]);
			return;
		}
		for (const ent of cavEnts)
			ent.attackMove(this.cavRaid.x, this.cavRaid.z, "Unit", false);
		return;
	}

	if (cavEnts.length < 6 || !workers.length)
		return;
	// Best cluster: a worker position with ≥ 3 peers within 50 m and ≤ 3
	// soldiers within 60 m; nearest home wins ties.
	let best, bestScore;
	for (const p of workers)
	{
		let peers = 0;
		for (const q of workers)
			if (SquareDistance(p, q) < 50 * 50)
				peers++;
		if (peers < 3)
			continue;
		let guard = 0;
		for (const m of mil)
			if (SquareDistance(m, p) < 60 * 60)
				guard++;
		if (guard > 3)
			continue;
		const score = guard * 100000 + (homePos ? SquareDistance(p, homePos) : 0);
		if (best === undefined || score < bestScore)
		{
			bestScore = score;
			best = p;
		}
	}
	if (!best)
		return;
	this.cavRaid = { "x": best[0], "z": best[1] };
	print(`[CAV] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raiding workers at ${best[0].toFixed(0)},${best[1].toFixed(0)} (cav=${cavEnts.length})\n`);
	for (const ent of cavEnts)
		ent.attackMove(best[0], best[1], "Unit", false);
};

/** Military buildings: 2 barracks from the village phase (at difficulty 5 the first serious wave lands ~10-12 min — waiting for town to start the muster meant meeting it with ~20 soldiers, mil1), 3 barracks + 5 home towers from town; after the boom the full set — 4 barracks, temples, forge, arsenal. Stone is plentiful on mainland; towers are our cheapest defense. */
BrennusBot.prototype.manageDefenseBuildings = function()
{
	if (this.constructionHold)
		return;
	const gameState = this.gameState;
	const boom = this.warOn();
	const defOn = this.defenseOn();
	const wants = [];
	if (boom)
	{
		// Arsenal FIRST post-city: it is the kill clock (rams). Barracks
		// before it pushed the arsenal to 27.9m on mil10-s2 — 10.7 min
		// after city — and zero rams ever trained.
		wants.push([gameState.applyCiv("structures/{civ}/arsenal"), 2]);
		wants.push([gameState.applyCiv("structures/{civ}/barracks"), 4]);
		wants.push([gameState.applyCiv("structures/{civ}/temple"), 3]);
		wants.push([gameState.applyCiv("structures/{civ}/forge"), 1]);
		wants.push([gameState.applyCiv("structures/{civ}/stable"), 1]);
	}
	else
	{
		// One village barracks from t=3:30 (not two — the wood hold that
		// funds them stalls the boom and pushed town to 9.6m on s1), three
		// from town, four at city.
		wants.push([gameState.applyCiv("structures/{civ}/barracks"),
			defOn ? 3 : (gameState.getTimeElapsed() >= 210000 ? 1 : 0)]);
		wants.push([gameState.applyCiv("structures/{civ}/temple"), defOn ? 1 : 0]);
		// No stable pre-city: food has no slack for a raid force (mil16:
		// the 100f floor never fired and the stable taxed the boom).
	}
	// While any of these is missing, training holds a wood reserve (see
	// manageDefenseTraining) so the buildings actually get funded — otherwise
	// unit batches burn the stock below the wood gate for minutes on end
	// and the temples/forge/arsenal land 10 minutes late (goal 10, def11).
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
		if (have < want && !this.pendingBuilds.some(pb => pb.template === type))
			missingAny = true;
	}
	this.defenseBuildingsMissing = missingAny;
	this.milBuildingHold = false;
	for (const [type, want] of wants)
	{
		if (haveByType[type] >= want || this.pendingBuilds.some(pb => pb.template === type))
			continue;
		if (gameState.getResources().wood < (boom ? 350 : 320))
		{
			// Pre-war, hold the economy's wood spending while a military
			// building is unfunded: the boom spends the flow to near zero
			// every block, so a bare 320 gate never fires (same failure as
			// goal-10 agg1/agg2's unit floors). The arsenal gets the same
			// hold post-city: it IS the kill clock, and without the hold
			// its 350 floor waited 10.7 min (mil10-s2).
			this.milBuildingHold = !boom || type.split("/").pop() === "arsenal";
			return;
		}
		if (this.tryConstruct(type, "military"))
		{
			gameState.getResources().subtract({ "wood": 300 });
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m defense building ${type.split("/").pop()}\n`);
			this.constructionHold = true;
		}
		return;
	}

	// Towers: 5 around the home CC (they double as garrisoned arrow
	// platforms when the big wave lands). Stone towers require the town
	// phase by template — any earlier attempt is engine-rejected and loops
	// the placer (mil4: 19-47 failed tower orders per seed).
	if (!defOn)
		return;
	const home = this.getCivicCentre();
	if (!home)
		return;
	if (this.placeTower(home.position(), 5))
		return;
};

/**
 * Order one defense tower near `center` if fewer than `want` stand (or are
 * planned) within 60 m. Towers must be ≥ 60 m from any other Tower
 * (BuildRestrictions) — the generic placer ignores that, so the candidate
 * filter enforces 65 m against built, foundation and pending towers.
 */
BrennusBot.prototype.placeTower = function(center, want)
{
	const gameState = this.gameState;
	const towerType = gameState.applyCiv("structures/{civ}/defense_tower");
	const towers = [];
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === towerType && ent.position())
			towers.push(ent.position());
	for (const f of gameState.getOwnFoundations().values())
		if (f.position() && gameState.getBuiltTemplate(f.templateName()).templateName() === towerType)
			towers.push(f.position());
	for (const pb of this.pendingBuilds)
		if (pb.template === towerType)
			towers.push([pb.x, pb.z]);
	let near = 0;
	for (const p of towers)
		if (SquareDistance(p, center) < 60 * 60)
			near++;
	if (near >= want)
		return false;
	const res = gameState.getResources();
	if (res.wood < 200 || res.stone < 200)
		return false;
	const clearOfTowers = (x, z) => !towers.some(p => SquareDistance(p, [x, z]) < 65 * 65);
	const spot = this.findBuildingPosition(towerType, center, 12, 80, true,
		this.accessibility.getAccessValue(center), clearOfTowers);
	if (!spot || !this.placeOrder(towerType, spot))
		return false;
	res.subtract({ "wood": 100, "stone": 100 });
	print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m tower at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} for CC ${center[0].toFixed(0)},${center[1].toFixed(0)}\n`);
	return true;
};

/** Forge upgrades for the standing army, cheapest first. */
BrennusBot.prototype.militaryTechs = [
	["soldier_attack_melee_01", { "food": 200, "metal": 100 }],
	["soldier_attack_ranged_01", { "wood": 200, "metal": 100 }],
	["soldier_resistance_hack_01", { "food": 200, "metal": 100 }],
	["soldier_resistance_pierce_01", { "wood": 200, "metal": 100 }],
	["soldier_attack_melee_02", { "food": 350, "metal": 250 }],
	["soldier_attack_ranged_02", { "wood": 350, "metal": 250 }],
	["soldier_resistance_hack_02", { "food": 350, "metal": 250 }],
	["soldier_resistance_pierce_02", { "wood": 350, "metal": 250 }]
];

BrennusBot.prototype.manageMilitaryTechs = function()
{
	if (!this.warOn() || this.constructionHold)
		return;
	const gameState = this.gameState;
	const res = gameState.getResources();
	// Rams before forge techs: metal flow gates the kill clock (goal 10,
	// conclusion #2). mil9-s2 spent its whole post-city metal income on
	// techs and never banked the 6×150 for the ram fund.
	let rams = 0;
	for (const id in this.rams)
		rams++;
	if (rams < 6 && res.metal < 500)
		return;
	for (const [tech, cost] of this.militaryTechs)
	{
		if (gameState.isResearched(tech) || gameState.isResearching(tech))
			continue;
		const facility = gameState.findResearchers(tech)?.toEntityArray()
			.filter(ent => ent.foundationProgress() === undefined &&
				(ent.trainingQueue()?.length || 0) <= 1)[0];
		if (!facility || !gameState.canResearch(tech))
			return;
		if (!res.canAfford(cost) || res.metal < (cost.metal || 0) + 150)
			return;
		facility.research(tech);
		res.subtract(cost);
		print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m research ${tech}\n`);
		this.constructionHold = true;
		return;
	}
};

/** Army production: barracks spearmen/javelineers (alternating) from the town phase on, temple fanatics after the boom; dismiss women for pop room only once the boom is done. */
BrennusBot.prototype.manageDefenseTraining = function()
{
	const gameState = this.gameState;
	const res = gameState.getResources();
	const barracksType = gameState.applyCiv("structures/{civ}/barracks");
	const templeType = gameState.applyCiv("structures/{civ}/temple");
	const stableType = gameState.applyCiv("structures/{civ}/stable");
	let queued = 0, barracksUp = 0, queuedCav = 0;
	const trainers = [], stables = [];
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.foundationProgress() !== undefined)
			continue;
		if (ent.templateName() === stableType)
		{
			for (const item of ent.trainingQueue() || [])
				queuedCav += item.count;
			if ((ent.trainingQueue()?.length || 0) <= 1)
				stables.push(ent);
			continue;
		}
		if (ent.templateName() !== barracksType && ent.templateName() !== templeType)
			continue;
		if (ent.templateName() === barracksType)
			barracksUp++;
		for (const item of ent.trainingQueue() || [])
			queued += item.count;
		if ((ent.trainingQueue()?.length || 0) <= 1)
			trainers.push(ent);
	}
	const defOn = this.defenseOn();
	if (!defOn && !barracksUp)
		return;
	// Early muster: 35 from the first village barracks until city (lean —
	// every soldier is a worker and a city-bank share not gathered; 35 +
	// garrison arrows held the first waves in mil3), 120 at city. Trained
	// citizen-soldiers keep gathering until the defense stage forms the
	// roster — they are workers who fight, not idlers (and the roster count
	// must include them or training overshoots the target).
	const target = this.warOn() ? this.defenseArmyTarget : 35;
	let soldiers = 0;
	for (const ent of gameState.getOwnUnits().values())
		if (ent.hasClass("Soldier") && !ent.hasClass("Healer") && ent.id() !== this.herderId)
			soldiers++;
	const missing = target - soldiers - queued;
	// Healers first: 10 of them halve the effective churn of the standing army.
	let healerCount = 0;
	for (const id in this.healers)
		healerCount++;
	// Cavalry raid force FIRST: 10 javelineers from the stable at
	// cost-level floors. Every cavalry body is two spearmen of food, but the
	// raids slow her army growth from ~9-10 min — worth more than the
	// marginal spearman (mil15: behind the muster, zero cavalry ever
	// trained — the 100f floor never fired).
	let cavTotal = queuedCav;
	for (const id in this.cavForce)
		cavTotal++;
	if (this.warOn() && cavTotal < 10 && res.food >= 100 && res.wood >= 50)
		for (const ent of stables)
		{
			if (cavTotal >= 10 || res.food < 100 || res.wood < 50)
				break;
			ent.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/cavalry_javelineer_b"), 1, {});
			res.subtract({ "food": 100, "wood": 50 });
			cavTotal++;
		}
	// War-stage floors must meet the wartime economy where it is: on mil7-s2
	// stock food sat at 7-72 for 15 minutes, the 300/300 floors trained
	// NOTHING, and the army froze at ~35 — no raid ever fired. Rich: batches
	// of 5 at 300 floors (protects the construction budget). Poor: batches
	// of 1 at cost-level floors, drawing from the flow like the pre-city
	// muster. Every train order is checked against the live snapshot first.
	const boom = this.warOn();
	const rich = res.food >= 300 && res.wood >= (this.defenseBuildingsMissing ? 400 : 300);
	// Poor war-stage: soldiers train from the flow ONLY once the worker base
	// stands at 100+ — below that the food flow goes to the women stream
	// (refilling the economy outranks refilling the army; mil8 starved
	// itself training soldiers at 60-90 workers).
	if (boom && !rich)
	{
		let workers = 0;
		for (const u of gameState.getOwnUnits().values())
			if (u.isGatherer() && !u.hasClass("Soldier") && !u.hasClass("Trader") &&
				u.id() !== this.herderId)
				workers++;
		if (workers < 100)
			return;
	}
	const milBatch = boom && rich ? 5 : 1;
	const floorF = boom && rich ? 300 : 50;
	const floorW = boom && rich ? (this.defenseBuildingsMissing ? 400 : 300) : 50;
	if (missing > 0 && res.food >= floorF && res.wood >= floorW)
		for (const ent of trainers)
		{
			if (ent.templateName() === barracksType)
			{
				if (res.food < 50 * milBatch || res.wood < 50 * milBatch)
					continue;
				const type = gameState.applyCiv(this.spearNext ?
					"units/{civ}/infantry_spearman_b" : "units/{civ}/infantry_javelineer_b");
				this.spearNext = !this.spearNext;
				ent.train(gameState.getPlayerCiv(), type, milBatch, {});
				res.subtract({ "food": 50 * milBatch, "wood": 50 * milBatch });
				continue;
			}
			if (healerCount < (boom ? 10 : 2))
			{
				const hb = boom ? 2 : 1;
				if (res.food < 100 * hb || res.metal < 30 * hb)
					continue;
				ent.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/support_healer_b"), hb, {});
				res.subtract({ "food": 100 * hb, "metal": 30 * hb });
				healerCount += hb;
				continue;
			}
			const fb = boom && rich ? 5 : 1;
			if (res.food < 120 * fb || res.wood < 100 * fb)
				continue;
			ent.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/champion_fanatic"), fb, {});
			res.subtract({ "food": 120 * fb, "wood": 100 * fb });
		}
	// Rams for the raid: keep 6, started as soon as the army can escort
	// them (30) — they are slow and must be mustered before the army hits
	// raid size or every raid goes in without them. While a ram is needed
	// and unaffordable, ramHold pauses the economy's wood spending: the
	// 350-wood floor never fired in the wartime economy (mil11-s2: wood sat
	// at 40-190 for 10 min post-city, zero rams with two arsenals standing)
	// — the floors lesson again, ram edition.
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
	for (const id in this.rams)
		rams++;
	this.ramHold = this.armyCount() >= 25 && rams < 6 && arsenals.length > 0 &&
		(res.wood < 300 || res.metal < 150);
	if (this.armyCount() >= 25 && rams < 6 && arsenals.length &&
		res.wood >= 300 && res.metal >= 150)
		for (const arsenal of arsenals)
		{
			if (rams >= 6 || res.wood < 300 || res.metal < 150)
				break;
			arsenal.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/siege_ram"), 1, {});
			res.subtract({ "wood": 300, "metal": 150 });
			rams++;
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m training a ram (${rams}/6)\n`);
		}
	// Pop room for a batch of 5: dismiss workers (idle first) until 5 slots are
	// free, throttled and never below a floor that keeps the economy alive.
	// Post-boom only: before city the women are still racing to pop 300 and
	// dismissing them would deadlock the boom (army pop counts toward 300).
	if (boom && missing >= 5 &&
		gameState.getPopulation() > gameState.getPopulationLimit() - 6 &&
		this.turn >= (this.nextDismissTurn || 0))
	{
		let victim, fallback, workers = 0;
		for (const ent of gameState.getOwnUnits().values())
		{
			if (!ent.position() || !ent.isGatherer() || this.army[ent.id()] ||
				ent.id() === this.herderId || ent.hasClass("Soldier") || ent.hasClass("Trader"))
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
		if (victim && workers > 145)
		{
			this.nextDismissTurn = this.turn + 15;
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m dismissing a civilian for army pop room (workers=${workers})\n`);
			delete this.assignments[victim.id()];
			victim.destroy();
		}
	}
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

	// Enemy army telemetry: the real wave curve, not the 120 m threat sample.
	let emil = 0, esiege = 0, eciv = 0;
	for (const ent of gameState.getEnemyUnits().values())
	{
		if (ent.owner() === 0 || !ent.position())
			continue;
		if (ent.hasClass("Siege"))
			esiege++;
		else if (ent.hasClass("Soldier"))
			emil++;
		else if (ent.hasClass("Civilian") || ent.hasClass("Support"))
			eciv++;
	}

	const dropsiteDist = this.meanDropsiteDistances();
	print(`[HARNESS] t=${Math.round(gameState.getTimeElapsed() / 60000)}m ` +
		`pop=${gameState.getPopulation()}/${gameState.getPopulationLimit()} army=${this.armyCount()} emil=${emil} esiege=${esiege} eciv=${eciv} idle=${idle} starved=${this.starvedUnits || 0} ` +
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
		"mineId": this.mineId,
		"army": this.army,
		"rams": this.rams,
		"healers": this.healers,
		"cavForce": this.cavForce
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
