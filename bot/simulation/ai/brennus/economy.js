import { BrennusBot } from "simulation/ai/brennus/brennus.js";
import { SquareDistance } from "simulation/ai/brennus/helpers.js";

// ---------------------------------------------------------------- gathering
BrennusBot.prototype.assignGatherers = function()
{
	const counts = { "food": 0, "wood": 0, "stone": 0, "metal": 0 };
	const idle = [];

	// The city bank is spent once the research starts: release all miners once so the shares reassign them.
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
		// The engine's gather autocontinue drifts pickers to far unserved supplies: stop empty-handed fruit/meat gatherers working > 45 m from every food dropsite.
		const sites = this.foodDropsitePositions();
		for (const ent of this.gameState.getOwnUnits().values())
		{
			if (this.assignments[ent.id()] !== "food" || !ent.isGatherer() ||
				ent.isIdle() || !ent.position())
				continue;

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

	{
		// The engine's gather autocontinue drifts choppers past their dropsite's
		// reach: pull empty-handed lumberjacks on an unserved tree back to a
		// served tree with a free slot. Those with nowhere to go are underserved
		// — manageDropSites builds their storehouse. Every drift (pulled back or
		// not) is also recorded in woodFrontier with the block's remaining free
		// slots, so manageDropSites can extend coverage BEFORE the woodline
		// saturates instead of waiting for the first stranded chopper.
		const sites = this.woodDropsitePositions();
		const r2 = this.woodServeDist * this.woodServeDist;
		this.woodUnderserved = [];
		this.woodFrontier = [];
		let served; // scanned once per block, only if some chopper drifted
		const slots = new Map();
		for (const ent of this.gameState.getOwnUnits().values())
		{
			if (this.assignments[ent.id()] !== "wood" || !ent.isGatherer() ||
				ent.isIdle() || !ent.position())
				continue;
			if (ent.unitAIState()?.split(".")[1] !== "GATHER")
				continue;
			if ((ent.resourceCarrying() || []).some(c => c.amount > 0))
				continue;
			const tgt = this.gatherTarget[ent.id()];
			if (tgt?.generic !== "wood")
				continue;
			const tree = this.gameState.getEntityById(tgt.supplyId);
			const anchor = tree?.position();
			if (!anchor || sites.some(d => SquareDistance(anchor, d) < r2))
				continue;
			if (served === undefined)
			{
				served = [];
				for (const s of this.gameState.getResourceSupplies("wood").values())
				{
					const sp = s.position();
					if (!sp || !s.resourceSupplyAmount() || s.isFull())
						continue;
					if (!sites.some(d => SquareDistance(sp, d) < r2))
						continue;
					served.push(s);
					slots.set(s.id(), s.resourceSupplyNumGatherers() || 0);
				}
			}
			const region = this.accessibility.getAccessValue(ent.position());
			let best, bestD = Infinity;
			for (const s of served)
			{
				if ((slots.get(s.id()) || 0) >= this.treeMaxGatherers)
					continue;
				if (this.accessibility.getAccessValue(s.position()) !== region)
					continue;
				if (!this.canGatherSupply(ent, s))
					continue;
				const d = SquareDistance(ent.position(), s.position());
				if (d < bestD)
				{
					bestD = d;
					best = s;
				}
			}
			const demand = { "pos": anchor, "wood": tree.resourceSupplyAmount() || 0 };
			if (best)
			{
				slots.set(best.id(), (slots.get(best.id()) || 0) + 1);
				ent.gather(best);
			}
			else
				this.woodUnderserved.push(demand);
			this.woodFrontier.push(demand);
		}
		// Meaningful only when a drift happened this block: Infinity reads as
		// "no pressure information" and never triggers the frontier storehouse.
		this.woodFreeSlots = Infinity;
		if (served !== undefined)
		{
			this.woodFreeSlots = 0;
			for (const s of served)
				this.woodFreeSlots += Math.max(0, this.treeMaxGatherers - (slots.get(s.id()) || 0));
		}
	}

	{
		// Autocontinue drift hits miners the same way it hits choppers. Tier 1:
		// pull empty-handed miners on a mine no dropsite serves back to the
		// nearest served mine of the same resource. Tier 2: the 18-40 m band —
		// not efficient but alarm-safe, always beats an unserved mine. Tier 3:
		// a mine outside own territory can never get a storehouse
		// (BuildRestrictions "own"), so miners there funnel to the in-territory
		// mine closest to existing coverage — the far trigger in manageDropSites
		// extends coverage to it. Whoever still has nowhere to go is real
		// coverage demand read from the same anchors.
		const sites = this.dropsiteEdgeList();
		let served, band, terrMines; // scanned once per block, only if some miner drifted
		let stuckWhy; // rejection census, filled alongside served
		const pulled = { "stone": 0, "metal": 0 };
		const stuck = { "stone": 0, "metal": 0 };
		for (const ent of this.gameState.getOwnUnits().values())
		{
			const res = this.assignments[ent.id()];
			if ((res !== "stone" && res !== "metal") || !ent.isGatherer() ||
				ent.isIdle() || !ent.position())
				continue;
			if (ent.unitAIState()?.split(".")[1] !== "GATHER")
				continue;
			if ((ent.resourceCarrying() || []).some(c => c.amount > 0))
				continue;
			const tgt = this.gatherTarget[ent.id()];
			if (tgt?.generic !== res)
				continue;
			const anchor = this.gameState.getEntityById(tgt.supplyId)?.position();
			if (!anchor || this.edgeDistToSites(anchor, sites) <= this.mineGatherServeDist)
				continue;
			if (served === undefined)
			{
				served = { "stone": [], "metal": [] };
				band = { "stone": [], "metal": [] };
				terrMines = { "stone": [], "metal": [] };
				stuckWhy = {};
				for (const rr of ["stone", "metal"])
				{
					stuckWhy[rr] = { "full": 0, "region": 0, "enemy": 0, "cant": 0 };
					for (const s of this.gameState.getResourceSupplies(rr).values())
					{
						const sp = s.position();
						if (!sp || !s.resourceSupplyAmount())
							continue;
						const edge = this.edgeDistToSites(sp, sites);
						if (edge > this.mineDistWarn)
						{
							if (!s.isFull() && this.inOwnTerritory(sp[0], sp[1]))
								terrMines[rr].push({ "s": s, "edge": edge });
							continue;
						}
						if (s.isFull())
						{
							if (edge <= this.mineGatherServeDist)
								stuckWhy[rr].full++;
							continue;
						}
						if (edge <= this.mineGatherServeDist)
							served[rr].push(s);
						else
							band[rr].push(s);
					}
				}
			}
			const region = this.accessibility.getAccessValue(ent.position());
			const pick = list =>
			{
				let best, bestD = Infinity;
				for (const s of list)
				{
					if (this.accessibility.getAccessValue(s.position()) !== region)
					{
						stuckWhy[res].region++;
						continue;
					}
					if (this.nearEnemy(s.position(), 100, 60))
					{
						stuckWhy[res].enemy++;
						continue;
					}
					if (!this.canGatherSupply(ent, s))
					{
						stuckWhy[res].cant++;
						continue;
					}
					const d = SquareDistance(ent.position(), s.position());
					if (d < bestD)
					{
						bestD = d;
						best = s;
					}
				}
				return best;
			};
			let best = pick(served[res]) || pick(band[res]);
			if (!best && !this.inOwnTerritory(anchor[0], anchor[1]))
			{
				let bestEdge = Infinity;
				for (const m of terrMines[res])
				{
					if (this.accessibility.getAccessValue(m.s.position()) !== region)
						continue;
					if (this.nearEnemy(m.s.position(), 100, 60))
						continue;
					if (!this.canGatherSupply(ent, m.s))
						continue;
					if (m.edge < bestEdge)
					{
						bestEdge = m.edge;
						best = m.s;
					}
				}
			}
			if (best)
			{
				ent.gather(best);
				pulled[res]++;
			}
			else
				stuck[res]++;
		}
		if (served !== undefined)
		{
			// Drift episodes persist for minutes: accumulate and print at most
			// one line per resource per 150 turns, or the early game (starting
			// mines beyond serve range of the CC) floods the log every block.
			this.minePullLog = this.minePullLog || {};
			for (const rr of ["stone", "metal"])
			{
				if (!pulled[rr] && !stuck[rr])
					continue;
				const log = this.minePullLog[rr] = this.minePullLog[rr] ||
					{ "pulled": 0, "stuck": 0, "lastTurn": -150 };
				log.pulled += pulled[rr];
				log.stuck += stuck[rr];
				if (this.turn - log.lastTurn < 150)
					continue;
				log.lastTurn = this.turn;
				const t = (this.gameState.getTimeElapsed() / 60000).toFixed(1);
				const w = stuckWhy[rr];
				print(`[HARNESS] t=${t}m ${rr} pull-back: pulled ${log.pulled}, stuck ${log.stuck} (served: ${served[rr].length} free, band: ${band[rr].length}, in-terr far: ${terrMines[rr].length}, rejected full=${w.full} region=${w.region} enemy=${w.enemy} cant=${w.cant})\n`);
				log.pulled = 0;
				log.stuck = 0;
			}
		}
	}

	for (const ent of this.gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || !ent.position() || (this.army[ent.id()] && !this.demobilized[ent.id()]))
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
	this.gatherCounts = counts;

	// Pull gatherers off over-supplied resources: shares steer only IDLE
	// units, so a banked resource otherwise keeps its workers forever
	// (b7fc612 s99: 46 miners stayed on stone/metal with 5-7k banked and
	// 300/600 ever used while wood sat at 4-141 in stock). Stop up to 2 of
	// the excess per block — they go idle and the shares below reassign
	// them. GATHER state only: a chopper rush-building a storehouse keeps
	// his assignment.
	{
		const total = idle.length + counts.food + counts.wood + counts.stone + counts.metal;
		if (total >= 10)
		{
			const shares = this.currentShares(total);
			let pulled = 0;
			for (const ent of this.gameState.getOwnUnits().values())
			{
				if (pulled >= 2)
					break;
				const res = this.assignments[ent.id()];
				if (!res || !ent.position() || ent.isIdle() || ent.id() === this.herderId)
					continue;
				if (counts[res] - (shares[res] || 0) * total < 4)
					continue;
				if (ent.unitAIState()?.split(".")[1] !== "GATHER")
					continue;
				delete this.assignments[ent.id()];
				ent.stopMoving();
				counts[res]--;
				pulled++;
			}
		}
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

				const sp = supply.position();
				const drop = this.nearestFoodDropsite(sp);
				const dx = sp[0] - drop[0], dz = sp[1] - drop[1];
				const n = Math.hypot(dx, dz) || 1;
				// Approach a huntable from the far side so it flees toward the base.
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

	// Wood: the tree minimizing the full walk cycle (unit -> tree + tree ->
	// nearest dropsite). Trees at slot capacity are skipped — past
	// treeMaxGatherers the diminishing returns cost more than the walk to a
	// freer tree — unless every candidate is full.
	if (resource === "wood")
	{
		const drops = this.woodDropsitePositions();
		const candidates = this.gameState.getResourceSupplies("wood").filterNearest(pos, 20).toEntityArray();
		for (const respectSlots of [true, false])
		{
			let best, bestD = Infinity;
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
				if (respectSlots && (supply.resourceSupplyNumGatherers() || 0) >= this.treeMaxGatherers)
					continue;
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
	}

	// Food: served fruit and dead in-territory animals are one pool; fields fall through to the generic path below.
	if (resource === "food")
	{
		const dropsites = this.foodDropsitePositions();
		let best, bestD = Infinity;
		for (const s of this.gameState.getResourceSupplies("food").values())
		{
			const supplyPos = s.position();
			if (!supplyPos || this.accessibility.getAccessValue(supplyPos) !== region)
				continue;
			const specific = s.resourceSupplyType()?.specific;
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
			this.edgeDistToSites(minePos, this.dropsiteEdgeList()) <= this.mineGatherServeDist &&
			!this.nearEnemy(minePos, 100, 60) &&
			this.canGatherSupply(unit, mine))
			return mine;
	}

	let candidates = this.gameState.getResourceSupplies(resource).filterNearest(pos, 10).toEntityArray();
	if (resource === "food")

		candidates = candidates.concat(this.gameState.getHuntableSupplies().filterNearest(pos, 10).toEntityArray());
	const foodSites = resource === "food" ? this.foodDropsitePositions() : null;

	// Stone/metal: the bot never orders anyone to a mine past the alarm
	// distance — nearest served candidate first, else the in-territory
	// candidate closest to coverage (the far trigger in manageDropSites
	// extends coverage to it), else nothing while any in-territory mine
	// remains: a miner demobilized 300 m from home must not be sent to the
	// mine next door. Outside expansion there is one deadlock exception:
	// no in-territory mine of the resource left at all.
	const mineRes = resource === "stone" || resource === "metal";
	const edgeSites = mineRes ? this.dropsiteEdgeList() : null;
	let firstAny, bestTerr, bestTerrEdge = Infinity;
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

		if (foodSites &&
			(supply.resourceSupplyType()?.specific === "fruit" ||
				supply.resourceSupplyType()?.specific === "meat") &&
			!foodSites.some(d => SquareDistance(supplyPos, d) < 45 * 45))
			continue;

		if (mineRes && this.expansionOn() &&
			this.servedMineIds && !this.servedMineIds.has(supply.id()))
			continue;

		// Civilians never leave the territory for meat.
		if (resource === "food" && supply.isHuntable() && !unit.hasClass("Cavalry") &&
			!this.inOwnTerritory(supplyPos[0], supplyPos[1]))
			continue;
		if (!mineRes)
			return supply;
		const edge = this.edgeDistToSites(supplyPos, edgeSites);
		if (edge <= this.mineDistWarn)
			return supply;
		if (!firstAny)
			firstAny = supply;
		if (this.inOwnTerritory(supplyPos[0], supplyPos[1]) && edge < bestTerrEdge)
		{
			bestTerrEdge = edge;
			bestTerr = supply;
		}
	}
	if (!mineRes)
		return undefined;
	if (bestTerr)
		return bestTerr;
	if (this.expansionOn() || !firstAny)
		return undefined;
	for (const s of this.gameState.getResourceSupplies(resource).values())
	{
		const sp = s.position();
		if (sp && s.resourceSupplyAmount() && this.inOwnTerritory(sp[0], sp[1]))
			return undefined;
	}
	return firstAny;
};

BrennusBot.prototype.woodDropsitePositions = function()
{
	const gameState = this.gameState;
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	const sites = [];
	for (const ent of gameState.getOwnStructures().values())
		if (ent.position() && (ent.templateName() === storeType || ent.hasClass("CivCentre")))
			sites.push(ent.position());
	// Storehouse foundations count: an in-flight storehouse already serves its
	// trees, and ignoring it orders a duplicate on the next block.
	for (const f of gameState.getOwnFoundations().values())
	{
		if (!f.position())
			continue;
		if (gameState.getBuiltTemplate(f.templateName()).templateName() === storeType)
			sites.push(f.position());
	}
	return sites;
};

BrennusBot.prototype.obstructionHalfDiag = function(ent)
{
	const o = ent.get("Obstruction/Static");
	return o ? Math.hypot(+o["@width"], +o["@depth"]) / 2 : 8;
};

BrennusBot.prototype.centroid = function(points)
{
	let sx = 0, sz = 0;
	for (const p of points)
	{
		sx += p[0];
		sz += p[1];
	}
	return [sx / points.length, sz / points.length];
};

/** Storehouse/CC positions with obstruction half-diagonals (storehouse foundations included): edge distance to this list is the serve metric every mine-coverage consumer shares (pull-back, storehouse demand, warning). */
BrennusBot.prototype.dropsiteEdgeList = function()
{
	const gameState = this.gameState;
	const sites = [];
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	for (const ent of gameState.getOwnStructures().values())
		if (ent.position() && (ent.templateName() === storeType || ent.hasClass("CivCentre")))
			sites.push({ "pos": ent.position(), "half": this.obstructionHalfDiag(ent) });
	for (const f of gameState.getOwnFoundations().values())
		if (f.position() && gameState.getBuiltTemplate(f.templateName()).templateName() === storeType)
			sites.push({ "pos": f.position(), "half": this.obstructionHalfDiag(f) });
	return sites;
};

BrennusBot.prototype.edgeDistToSites = function(pos, sites)
{
	let d = Infinity;
	for (const s of sites)
		d = Math.min(d, Math.hypot(pos[0] - s.pos[0], pos[1] - s.pos[1]) - s.half);
	return d;
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

/**
 * Herding: skittish animals are wound-then-steered — a wounded animal flees
 * away from its attacker until it reaches the flee distance fixed at wound
 * time; the cavalry shoots once from the far side, follows without attacking,
 * and kills near the pinned food dropsite. Other animals are killed in place.
 */
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
		// Only the javelineer herds: the wound-then-steer routine is built
		// around a ranged poke, and a trained sword cavalryman must never be
		// kidnapped into herding — the army roster skips the herder, so it
		// would silently vanish from the war machine.
		for (const ent of gameState.getOwnUnits().values())
			if (ent.position() && ent.isGatherer() &&
				ent.templateName().indexOf("cavalry_javelineer") !== -1)
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
	// A dead animal becomes a NEW corpse entity: adopt the carcass by position (within 25 m).
	if (!target && this.herdTarget !== undefined && this.herdLastPos)
	{

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

		if (Math.hypot(hp[0] - pos[0], hp[1] - pos[1]) > 5)
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

/**
 * Economy scan, throttled to every 25 turns: served fruit stock (field
 * demand reads it) and the pinned stone/metal mines.
 */
BrennusBot.prototype.updateResourceScan = function()
{
	if (this.turn < (this.resourceScanRefresh || 0))
		return;
	this.resourceScanRefresh = this.turn + 25;

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
};

BrennusBot.prototype.inOwnTerritory = function(x, z)
{
	const terr = this.territoryMap;
	const i = Math.floor(x / terr.cellSize), j = Math.floor(z / terr.cellSize);
	if (i < 0 || j < 0 || i >= terr.width || j >= terr.height)
		return false;
	return (terr.data[i + j * terr.width] & 0x1F) === this.player;
};

// ------------------------------------------------- gather-rate telemetry
/**
 * Telemetry: a delivery (carried load resets) yields effective rate =
 * amount / cycle time; theoretical = template rate x the diminishing-
 * returns multiplier. Aggregated per class; read in logStatus.
 */
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
