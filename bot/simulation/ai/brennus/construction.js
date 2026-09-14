import { BrennusBot } from "simulation/ai/brennus/brennus.js";
import { SquareDistance } from "simulation/ai/brennus/helpers.js";

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

// ---------------------------------------------------------------- construction
BrennusBot.prototype.manageConstruction = function()
{
	const gameState = this.gameState;
	const resources = this.arbiter.books("construction");
	const foundations = gameState.getOwnFoundations().toEntityArray();

	// Sticky, non-overlapping builders per foundation (dropsites 4, houses 2-3, fields 2, CC 10, wonder 16); the herder is excluded.
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
		const isCC = built.hasClass("CivCentre");
		const isWonder = built.hasClass("Wonder");
		const fpos = foundation.position();

		const rush = this.rushBuilds.some(r => Math.abs(r.x - fpos[0]) < 6 && Math.abs(r.z - fpos[1]) < 6);

		const target = (isField ? 2 : isHouse ? (this.gameState.currentPhase() === 1 ? 2 : 3) :
			isCC ? 10 : isWonder ? 16 : rush ? 8 : 4);
		let cur = assigned[foundation.id()];
		if (!cur)
			cur = assigned[foundation.id()] = [];
		const needed = target - cur.length;
		if (needed <= 0)
			continue;
		const builders = gameState.getOwnUnits()
			.filter(ent => ent.isGatherer() && ent.isBuilder() && ent.position() &&
				!(ent.id() === this.herderId && !this.herdingDone) &&
				!this.armyManager.army[ent.id()] &&
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
		// The engine creates the foundation instantly when it processes the
		// construct command, or silently rejects it (BuildRestrictions —
		// storehouses require OWN territory and the frontier grid lags the
		// engine's — entity limits, tech, real stock). A non-CC order with
		// no foundation 10 turns (2 blocks) later was rejected: drop it fast
		// so the demand re-orders on a neighboring ring spot instead of
		// waiting 50 turns and poisoning the clump's best spot for 5 min.
		// CC timeout must cover builder travel: at ~1.8 m per turn a distant
		// frontier spot needs minutes, and a premature timeout poisoned the
		// spot while the party was still walking (def15 s5: the same far spot
		// failed and re-poisoned itself every recompute cycle).
		const home = this.getCivicCentre()?.position() || [384, 384];
		const ccTimeout = 150 + Math.ceil(Math.hypot(pb.x - home[0], pb.z - home[1]) / 1.5);
		if (this.turn - pb.turn > (pb.template.indexOf("civil_centre") !== -1 ? ccTimeout : 10))
		{
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m construct FAILED: ${pb.template} at ${pb.x.toFixed(0)},${pb.z.toFixed(0)} ${this.diagnoseFailedSpot(pb)}\n`);
			this.failedSpots.push([pb.x, pb.z, this.turn, pb.template]);
			// A CC order that died with enemies around means the builder party
			// was slaughtered en route (s47: 5 orders, 5 dead parties): mark
			// the area contested so the clearing op sanitizes it before the
			// plan sends the next party.
			if (pb.template.indexOf("civil_centre") !== -1 &&
				this.armyManager.nearEnemy([pb.x, pb.z], 120, 120))
			{
				// Don't re-prove an area whose op just gave up: the army
				// held it and no CC followed — the killers are not the
				// blocker there (s13 churned 4 ops on one cursed spot).
				let cooled = false;
				for (const ck in this.offenseManager.clearCool)
				{
					if (this.turn - this.offenseManager.clearCool[ck] >= 1800)
						continue;
					const [cx, cz] = ck.split(",");
					if (Math.abs(+cx - pb.x) < 100 && Math.abs(+cz - pb.z) < 100)
					{
						cooled = true;
						break;
					}
				}
				if (!cooled)
				{
					const key = `${pb.x.toFixed(0)},${pb.z.toFixed(0)}`;
					const c = this.expContested[key];
					this.expContested[key] = {
						"x": pb.x, "z": pb.z,
						"since": c ? c.since : this.turn, "seen": this.turn,
						// A dead builder party proves the area lethal — no
						// continuous-presence latch needed; the killers patrol and
						// will be back (s47). Lives 3 min, extended per failure.
						"proven": true, "until": this.turn + 900
					};
				}
			}
			return false;
		}
		return true;
	});

	if (this.arbiter.held("construction"))
		return;

	if (this.arbiter.held("banking"))
		return;

	const houseType = gameState.applyCiv("structures/{civ}/house");
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	const reserve = this.arbiter.reservedAll();

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
			this.arbiter.spend(resources, "construction", { "wood": houseCost }, "house");
		else if (this.turn % 750 === 0)
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m house placement FAILED (margin=${margin})\n`);
		return true;

	};

	// Bootstrap: the opener spends on the two dropsites before anything else
	// so the opening economy never walks — farmstead at the richest fruit
	// cluster, storehouse at the in-territory clump with the most wood within
	// 30m. The demand trigger in manageDropSites covers everything past these.
	{
		const type = gameState.applyCiv("structures/{civ}/farmstead");
		if (!this.hasStructureOrFoundation(type, foundations) &&
			resources.canAfford({
				"food": reserve.food || 0, "wood": (reserve.wood || 0) + 100,
				"stone": reserve.stone || 0, "metal": reserve.metal || 0 }) &&
			this.farmsteadStrategy.placeOpening(this, type))
		{
			this.arbiter.spend(resources, "construction", { "wood": 100 }, "farmstead");
			return;
		}
		const storeType = gameState.applyCiv("structures/{civ}/storehouse");
		// pendingBuilds counts too: a rejected order leaves no foundation and
		// would otherwise be re-placed (and re-spent) every block until its
		// 10-turn timeout — the demand trigger's storePending does the same.
		if (!this.hasStructureOrFoundation(storeType, foundations) &&
			!this.bootstrapStoreTried &&
			!this.pendingBuilds.some(pb => pb.template === storeType) &&
			resources.canAfford({
				"food": reserve.food || 0, "wood": (reserve.wood || 0) + 100,
				"stone": reserve.stone || 0, "metal": reserve.metal || 0 }))
		{
			const pos = this.woodStrategy.placeOpening(this, storeType);
			if (pos)
			{
				this.bootstrapStoreTried = true;
				this.arbiter.spend(resources, "construction", { "wood": 100 }, "storehouse");
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m bootstrap storehouse at ${pos[0].toFixed(0)},${pos[1].toFixed(0)}\n`);
				return;
			}
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
					this.arbiter.spend(resources, "construction", cost, trioType.split("/").pop());
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m building ${trioType.split("/").pop()}\n`);
				}
				return;
			}
		}
	}

	if (this.manageDropSites(foundations, reserve))
		return;

	// The defense accumulation hold (manageDefenseBuildings) pauses the
	// house/field race while a muster building's 300 wood accumulates —
	// dropsites and one-time civic buildings above keep firing.
	if (this.arbiter.held("constructionDefense"))
		return;

	// Field demand is computed fresh every block, BEFORE both house gates
	// read it (until step C the early gate below read the previous block's
	// declaration — an accident of statement order, not a policy).
	let foodGatherers = 0;
	for (const res of Object.values(this.assignments))
		if (res === "food")
			foodGatherers++;
	const fieldCap = this.expansionOn() ? 60 : (gameState.currentPhase() === 1 ? 4 : 30);
	// Fields open at t=1:30 or when served fruit runs low: they must stand before the fruit runs out.
	const desiredFields = this.fruitStock < 4000 || gameState.getTimeElapsed() > 90000 ?
		Math.min(fieldCap, Math.max(2, Math.ceil(foodGatherers / 3) + 1)) : 0;
	let fields = 0;
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === fieldType)
			fields++;
	const fieldFoundations = foundations.filter(f =>
		gameState.getBuiltTemplate(f.templateName()).templateName() === fieldType).length;

	// Bootstrap only: the first 2 fields outrank the house stream while served fruit is nearly out.
	this.arbiter.declare("field", (fields + fieldFoundations) < Math.min(2, desiredFields) &&
		this.fruitStock < 800 ? { "wood": 100 } : null);

	if (margin < 2 && houseFoundations < this.maxHouseFoundations &&
		gameState.getPopulationLimit() < gameState.getPopulationMax() &&
		resources.wood >= houseCost + this.arbiter.declaredAmount("field", "wood"))
		return tryHouse();

	this.arbiter.declare("techWood", null);
	for (const tech of ["gather_farming_plows", "gather_farming_training",
		"gather_farming_harvester", "gather_lumbering_ironaxes"])
	{
		if (gameState.isResearched(tech) || gameState.isResearching(tech) ||
			!gameState.canResearch(tech))
			continue;
		const techWood = gameState.getTemplate(tech).cost().wood || 0;
		if (resources.wood < techWood + 100)
			this.arbiter.declare("techWood", techWood ? { "wood": techWood } : null);
		break;
	}

	const cc = this.getCivicCentre();
	if (!cc)
		return;
	const ccPos = cc.position();

	if (fields < desiredFields && fieldFoundations < 2 &&
		resources.wood >= 100)
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

	if (this.arbiter.declared("fert"))
		return;

	const sprintCap = gameState.getTimeElapsed() > 600000 &&
		gameState.getPopulationLimit() < gameState.getPopulationMax();
	if ((margin < this.houseMargin || sprintCap) && houseFoundations < this.maxHouseFoundations &&
		!this.arbiter.declared("techWood") &&
		gameState.getPopulationLimit() < gameState.getPopulationMax() &&
		resources.wood >= (reserve.wood || 0) + this.nextTrioWood() + this.arbiter.declaredAmount("dropsite", "wood") + this.arbiter.declaredAmount("field", "wood") + houseCost)
		return tryHouse();
};

BrennusBot.prototype.hasStructureOrFoundation = function(type, foundations)
{
	return this.gameState.getOwnStructures().toEntityArray().some(ent => ent.templateName() === type) ||
		foundations.some(f => this.gameState.getBuiltTemplate(f.templateName()).templateName() === type);
};

// ------------------------------------------------- dropsite strategies
/**
 * Dropsite placement is split per resource into swappable strategy objects.
 * Resource spread — and thereby where a dropsite pays its 100 wood back —
 * varies with the map and biome, so each policy (demand reading, gating,
 * center selection, opening placement) is self-contained and replaceable in
 * CustomInit without touching the rest. The bot keeps the shared machinery:
 * the per-block context (buildDropsiteContext), the placement scans
 * (tryConstruct, findExpansionWoodStorehouse, findMinimaxSpot, placeOrder)
 * and the serve-distance metrics.
 *
 * Contract: run(bot, ctx) places at most one build order and returns true,
 * or returns false to let the next strategy try — manageDropSites runs them
 * in priority order (wood, mine, farmstead), one dropsite order per block.
 * Strategy state (gated spots, cooldowns) lives on the strategy instance and
 * is transient, like the bot fields it replaces.
 */
export const WoodStorehouseStrategy = {

	/** A far tree must still hold this much wood to trigger a storehouse: a straggler finishing a nearly-dead tree must not spend 100 wood on a building that outlives its forest. */
	"minTreeWood": 100,

	/** Total wood within gateRadius of a storehouse spot below which the building cannot pay its 100 wood back: lone stragglers and pairs top out at 400 (200/tree on temperate), the home groves that must stay covered start at ~700 — 500 sits between the two measured clusters (s21/s70/s81 bled their economy on straggler storehouses; gating at 1000 delayed the home grove on s2/s45 and cost both games). */
	"minWoodMass": 500,

	/** Radius (m) around a storehouse-demand clump whose wood mass counts toward the gate — wider than woodServeDist because a storehouse planted between sparse patches serves all of them: s53 gated five 133-203-mass clumps sitting within 45 m of each other (925 combined) while their choppers walked 230-285 m each way. Pairs 45 m apart still gate out (400 < 500); three trees spanning the radius pass (600), and 600 wood served pays the 100 wood back. */
	"gateRadius": 45,

	/** The opening storehouse goes where it pays its 100 wood back fastest: centered on the in-territory tree with the most wood within 30m, rush-built by the choppers like a demand storehouse. */
	"placeOpening": function(bot, type)
	{
		const gameState = bot.gameState;
		const cc = bot.getCivicCentre();
		if (!cc)
			return false;
		const region = bot.accessibility.getAccessValue(cc.position());
		const trees = gameState.getResourceSupplies("wood").toEntityArray()
			.filter(s => s.position() && s.resourceSupplyAmount() > 30 &&
				!bot.armyManager.nearEnemy(s.position(), 100, 60) &&
				bot.accessibility.getAccessValue(s.position()) === region);
		const scored = trees.filter(t => bot.inOwnTerritory(t.position()[0], t.position()[1]))
			.map(t => {
				let mass = 0;
				for (const o of trees)
					if (SquareDistance(t.position(), o.position()) < 30 * 30)
						mass += o.resourceSupplyAmount();
				return [mass, t.position()];
			}).sort((a, b) => b[0] - a[0]);
		const tried = [];
		for (const cand of scored)
		{
			if (tried.some(p => SquareDistance(p, cand[1]) < 30 * 30))
				continue;
			tried.push(cand[1]);
			const pos = bot.tryConstruct(type, "dropsite", cand[1], true);
			if (pos)
				return pos;
			if (tried.length >= 5)
				break;
		}
		return false;
	},

	/**
	 * Wood storehouse demand has two signals. Stranded choppers (the pull-back
	 * in assignGatherers found no served tree with a free slot) need coverage
	 * where they work. And before anyone strands: when free slots on served
	 * trees run below woodSlotMargin, the unserved trees choppers drifted onto
	 * this block mark the frontier to cover. Two gates keep a bad spend out:
	 * a nearly-dead tree never justifies a 100-wood building (per-tree wood),
	 * and a clump whose whole neighborhood is stragglers cannot pay the
	 * building back either (mass gate in the placement loop below).
	 * No reserve is held against a wood storehouse: it is the investment that
	 * produces wood — reserving wood against it deadlocks the economy once
	 * income has collapsed (s90 never passed the 250-wood effective floor).
	 */
	"run": function(bot, ctx)
	{
		const gameState = bot.gameState;
		const resources = ctx.resources;

		const underserved = (bot.woodUnderserved || []).filter(u => u.wood >= this.minTreeWood);
		const frontier = (bot.woodFrontier || []).filter(u => u.wood >= this.minTreeWood);
		let demand = underserved;
		if (!demand.length && (bot.woodFreeSlots ?? Infinity) < bot.woodSlotMargin)
			demand = frontier;
		if (demand.length && ctx.storeCount < (bot.expansionOn() ? 40 : 18) &&
			resources.wood >= 100)
		{
			// The richest-looking clump is not always worth serving: gate each
			// candidate on the wood mass within serve reach of its center and walk
			// down the distance ranking until one pays for itself.
			const massNear = center => {
				let mass = 0;
				const r2 = this.gateRadius * this.gateRadius;
				for (const s of gameState.getResourceSupplies("wood").values())
				{
					const sp = s.position();
					if (sp && s.resourceSupplyAmount() && SquareDistance(sp, center) < r2)
						mass += s.resourceSupplyAmount();
				}
				return mass;
			};
			const ranked = demand.map(u => [bot.edgeDistToSites(u.pos, ctx.woodSites), u.pos])
				.sort((a, b) => b[0] - a[0]);
			const tried = [];
			for (const [, pos] of ranked)
			{
				if (tried.some(p => SquareDistance(p, pos) < 25 * 25))
					continue;
				const center = bot.centroid(demand.filter(u => Math.hypot(u.pos[0] - pos[0], u.pos[1] - pos[1]) < 25)
					.map(u => u.pos));
				tried.push(center);
				const mass = massNear(center);
				if (mass < this.minWoodMass)
				{
					if (!(this.gatedWoodSpots || []).some(p => SquareDistance(p, center) < 30 * 30))
					{
						(this.gatedWoodSpots = this.gatedWoodSpots || []).push(center);
						const ccp = ctx.cc.position();
						print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m wood storehouse gated at ${center[0].toFixed(0)},${center[1].toFixed(0)} (mass ${mass}, ccDist ${Math.hypot(center[0] - ccp[0], center[1] - ccp[1]).toFixed(0)}m)\n`);
					}
					continue;
				}
				if (ctx.storePending(center))
					continue;
				bot.arbiter.declare("dropsite", { "wood": 100 });
				const placed = bot.expansionOn() ?
					bot.findExpansionWoodStorehouse(ctx.storeType, center) :
					bot.tryConstruct(ctx.storeType, "dropsite", center, true);
				if (placed)
				{
					bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/wood");
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${placed[0].toFixed(0)},${placed[1].toFixed(0)} for wood ${center[0].toFixed(0)},${center[1].toFixed(0)} (${underserved.length} underserved + ${frontier.length} frontier, mass ${mass})\n`);
					return true;
				}
				break;
			}
		}
		return false;
	}
};

export const MineStorehouseStrategy = {

	/** Pinned stone and metal mines closer than this (m) share ONE storehouse. */
	"pairDist": 55,

	/** Mine coverage: reactive (miner drift past the serve distance) first, then — expansion stage only — proactively opening the richest in-territory mine past the alarm distance. */
	"run": function(bot, ctx)
	{
		const gameState = bot.gameState;
		const resources = ctx.resources;

		if (ctx.storeCount < (bot.expansionOn() ? 40 : 18))
		{
			let worst, worstDist = bot.mineGatherServeDist;
			const underserved = [];
			for (const ent of gameState.getOwnUnits().values())
			{
				if (!ent.isGatherer() || ent.isIdle() || !ent.position())
					continue;
				const tgt = bot.gatherTarget[ent.id()];
				if (tgt?.generic !== "stone" && tgt?.generic !== "metal")
					continue;
				const anchor = gameState.getEntityById(tgt.supplyId)?.position() || ent.position();
				const d = bot.edgeDistToSites(anchor, ctx.woodSites);
				if (d > bot.mineGatherServeDist)
					underserved.push(anchor);
				if (d > worstDist)
				{
					worstDist = d;
					worst = anchor;
				}
			}
			// A drift cluster past the warning distance cannot wait for the
			// expansion headcount: two miners at 40+ m is already coverage demand.
			// It also skips the mine-storehouse cooldown and the reserve-padded
			// wood floor — every turn at 40+ m costs more than the 100 wood.
			const far = underserved.filter(p => bot.edgeDistToSites(p, ctx.woodSites) > bot.mineDistWarn);
			if ((underserved.length >= (bot.expansionOn() ? 5 : 2) || far.length >= 2) &&
				!(bot.expansionOn() && far.length < 2 && bot.turn - (this.lastMineStoreTurn || -1000) < 40))
			{
				bot.arbiter.declare("dropsite", { "wood": 100 });
				const sMine = bot.mineId.stone !== undefined ?
					gameState.getEntityById(bot.mineId.stone) : undefined;
				const mMine = bot.mineId.metal !== undefined ?
					gameState.getEntityById(bot.mineId.metal) : undefined;
				const sPos = sMine?.position(), mPos = mMine?.position();
				// Pinned stone and metal mines close together share ONE storehouse between them.
				// Not when the trigger is a far drift cluster: the demand sits at
				// worst, wherever the pinned mines are is irrelevant to it.
				const pairNear = sPos && mPos &&
					Math.hypot(sPos[0] - mPos[0], sPos[1] - mPos[1]) < this.pairDist;
				if (pairNear && far.length < 2)
				{
					const mid = [(sPos[0] + mPos[0]) / 2, (sPos[1] + mPos[1]) / 2];
					const planned = ctx.storeFoundations.some(p => Math.hypot(p[0] - mid[0], p[1] - mid[1]) < 30) ||
						ctx.storePending(mid);
					if (!planned && resources.wood >= ctx.woodFloor)
					{
						const spot = bot.findMinimaxSpot(ctx.storeType, [sPos, mPos],
							bot.accessibility.getAccessValue(ctx.cc.position()));
						if (spot && bot.placeOrder(ctx.storeType, spot))
						{
							this.lastMineStoreTurn = bot.turn;
							bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/mine-pair");
							print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} between stone ${sPos[0].toFixed(0)},${sPos[1].toFixed(0)} and metal ${mPos[0].toFixed(0)},${mPos[1].toFixed(0)} (${underserved.length} underserved)\n`);
							return true;
						}
					}
				}
				const clump = underserved.filter(p => Math.hypot(p[0] - worst[0], p[1] - worst[1]) < 25);
				const center = bot.centroid(clump);
				const planned = ctx.storeFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 45) ||
					ctx.storePending(center);
				const pos = resources.wood >= (far.length >= 2 ? 100 : ctx.woodFloor) && !planned &&
					bot.tryConstruct(ctx.storeType, "dropsite", center);
				if (pos)
				{
					this.lastMineStoreTurn = bot.turn;
					bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/mine");
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for mine ${center[0].toFixed(0)},${center[1].toFixed(0)} (${underserved.length} underserved)\n`);
					return true;
				}
			}
		}

		if (bot.expansionOn() && resources.wood >= ctx.woodFloor &&
			ctx.storeCount < 40 && bot.turn - (this.lastMineStoreTurn || -1000) > 40)
		{
			const region = bot.accessibility.getAccessValue(ctx.cc.position());
			let best, bestAmt = 1500;
			for (const res of ["stone", "metal"])
				for (const s of gameState.getResourceSupplies(res).values())
				{
					const pos = s.position();
					if (!pos || s.resourceSupplyAmount() <= bestAmt || bot.armyManager.nearEnemy(pos, 100, 60))
						continue;
					if (bot.accessibility.getAccessValue(pos) !== region ||
						!bot.inOwnTerritory(pos[0], pos[1]))
						continue;
					// Coverage-first: open the richest in-territory mine past the
					// alarm distance before mining shares ever reach it.
					if (bot.edgeDistToSites(pos, ctx.woodSites) <= bot.mineDistWarn)
						continue;
					bestAmt = s.resourceSupplyAmount();
					best = pos;
				}
			if (best)
			{
				bot.arbiter.declare("dropsite", { "wood": 100 });
				const planned = ctx.storeFoundations.some(p => Math.hypot(p[0] - best[0], p[1] - best[1]) < 45) ||
					ctx.storePending(best);
				if (!planned)
				{
					const spot = bot.findMinimaxSpot(ctx.storeType, [best], region);
					if (spot && bot.placeOrder(ctx.storeType, spot))
					{
						this.lastMineStoreTurn = bot.turn;
						bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/unserved-mine");
						print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} for mine ${best[0].toFixed(0)},${best[1].toFixed(0)} (${bestAmt} left)\n`);
						return true;
					}
				}
			}
		}
		return false;
	}
};

export const FarmsteadStrategy = {

	/** The opening farmstead goes at the richest in-territory fruit cluster. */
	"placeOpening": function(bot, type)
	{
		const gameState = bot.gameState;
		const cc = bot.getCivicCentre();
		if (!cc)
			return false;
		const region = bot.accessibility.getAccessValue(cc.position());
		const fruits = gameState.getResourceSupplies("food").toEntityArray()
			.filter(s => s.resourceSupplyType()?.specific === "fruit" && s.position() &&
				s.resourceSupplyAmount() > 30 && !bot.armyManager.nearEnemy(s.position(), 100, 60) &&
				bot.inOwnTerritory(s.position()[0], s.position()[1]) &&
				bot.accessibility.getAccessValue(s.position()) === region);
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
			if (bot.tryConstruct(type, "dropsite", cand[1]))
				return true;
			if (tried.length >= 5)
				break;
		}
		return false;
	},

	/** Farmstead coverage: unserved fields first, then fruit-gatherer drift, then — while fruit stocks run low — the next fruit patch proactively. */
	"run": function(bot, ctx)
	{
		const gameState = bot.gameState;
		const resources = ctx.resources;
		const cc = ctx.cc;

		const farmType = gameState.applyCiv("structures/{civ}/farmstead");
		const fieldType = gameState.applyCiv("structures/{civ}/field");
		const foodSites = [{ "pos": cc.position(), "half": bot.obstructionHalfDiag(cc) }];
		const farmFoundations = [];
		let farmCount = 0;
		for (const f of ctx.foundations)
			if (gameState.getBuiltTemplate(f.templateName()).templateName() === farmType && f.position())
			{
				foodSites.push({ "pos": f.position(), "half": bot.obstructionHalfDiag(f) });
				farmFoundations.push(f.position());
				farmCount++;
			}
		for (const ent of gameState.getOwnStructures().values())
			if (ent.templateName() === farmType && ent.position())
			{
				foodSites.push({ "pos": ent.position(), "half": bot.obstructionHalfDiag(ent) });
				farmCount++;
			}
		let worstField, worstFieldDist = 15;
		const unservedFields = [];
		for (const ent of gameState.getOwnStructures().values())
		{
			if (ent.templateName() !== fieldType || ent.foundationProgress() !== undefined || !ent.position())
				continue;
			const d = bot.edgeDistToSites(ent.position(), foodSites) - 15.5;
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
			const center = bot.centroid(cluster);
			const planned = farmFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 25);
			const pos = !planned && resources.wood >= ctx.woodFloor &&
				bot.tryConstruct(farmType, "dropsite", center);
			if (pos)
			{
				bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "farmstead/fields");
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
			const tgt = bot.gatherTarget[ent.id()];
			if (tgt?.generic !== "food" || tgt?.specific !== "fruit")
				continue;
			const anchor = gameState.getEntityById(tgt.supplyId)?.position() || ent.position();
			const d = bot.edgeDistToSites(anchor, foodSites);
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
			bot.arbiter.declare("dropsite", { "wood": 100 });
			const cluster = unservedFruit.filter(p => Math.hypot(p[0] - worstFruit[0], p[1] - worstFruit[1]) < 25);
			const center = bot.centroid(cluster);
			const planned = farmFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 25);
			const pos = !planned && resources.wood >= ctx.woodFloor &&
				bot.tryConstruct(farmType, "dropsite", center);
			if (pos)
			{
				bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "farmstead/fruit");
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m farmstead at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for fruit ${center[0].toFixed(0)},${center[1].toFixed(0)} (${unservedFruit.length} underserved)\n`);
				return true;
			}
		}

		if (bot.fruitStock < 600 && farmCount < 12 && resources.wood >= ctx.woodFloor)
		{
			const region = bot.accessibility.getAccessValue(cc.position());
			const fruits = gameState.getResourceSupplies("food").toEntityArray()
				.filter(s => s.resourceSupplyType()?.specific === "fruit" && s.position() &&
					s.resourceSupplyAmount() > 30 && !bot.armyManager.nearEnemy(s.position(), 100, 60) &&
					bot.inOwnTerritory(s.position()[0], s.position()[1]) &&
					bot.accessibility.getAccessValue(s.position()) === region &&
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
				bot.arbiter.declare("dropsite", { "wood": 100 });
				const planned = farmFoundations.some(p => Math.hypot(p[0] - best[0], p[1] - best[1]) < 25);
				const pos = !planned && bot.tryConstruct(farmType, "dropsite", best);
				if (pos)
				{
					bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "farmstead/next-fruit");
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m farmstead at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for next fruit patch ${best[0].toFixed(0)},${best[1].toFixed(0)} (stock ${Math.round(bot.fruitStock)})\n`);
					return true;
				}
			}
		}
		return false;
	}
};

/**
 * The per-block state every dropsite strategy reads: the frozen budget book,
 * the reserve-padded wood floor, existing storehouse coverage (home CC +
 * storehouses, foundations included) and the pending-build dedupe.
 */
BrennusBot.prototype.buildDropsiteContext = function(foundations, reserve, resources)
{
	const gameState = this.gameState;
	const cc = this.getCivicCentre();
	if (!cc)
		return null;
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	const woodSites = [{ "pos": cc.position(), "half": this.obstructionHalfDiag(cc) }];
	const storeFoundations = [];
	let storeCount = 0;
	for (const f of foundations)
		if (gameState.getBuiltTemplate(f.templateName()).templateName() === storeType && f.position())
		{
			woodSites.push({ "pos": f.position(), "half": this.obstructionHalfDiag(f) });
			storeFoundations.push(f.position());
			storeCount++;
		}
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === storeType && ent.position())
		{
			woodSites.push({ "pos": ent.position(), "half": this.obstructionHalfDiag(ent) });
			storeCount++;
		}
	return {
		"resources": resources,
		"woodFloor": 100 + (reserve.wood || 0),
		"cc": cc,
		"foundations": foundations,
		"storeType": storeType,
		"woodSites": woodSites,
		"storeFoundations": storeFoundations,
		"storeCount": storeCount,
		"storePending": center => this.pendingBuilds.some(pb =>
			pb.template === storeType && Math.hypot(pb.x - center[0], pb.z - center[1]) < 30)
	};
};

/** One dropsite order per block: the strategies run in priority order (wood, mine, farmstead) and the first to place an order wins. */
BrennusBot.prototype.manageDropSites = function(foundations, reserve)
{
	const resources = this.arbiter.books("dropsites");
	const ctx = this.buildDropsiteContext(foundations, reserve, resources);
	if (!ctx)
		return false;
	this.arbiter.declare("dropsite", null);
	for (const strategy of this.dropsiteStrategies)
		if (strategy.run(this, ctx))
			return true;
	return false;
};

/** Barter: while banking, surplus food/wood buys the missing stone/metal;
 * mining surplus far past the bank is sold back for wood/food. */
BrennusBot.prototype.manageBarter = function()
{
	const gameState = this.gameState;
	if (gameState.currentPhase() < 2)
		return;
	const market = gameState.getOwnStructures().toEntityArray()
		.find(ent => ent.hasClass("Market") && ent.foundationProgress() === undefined);
	if (!market)
		return;
	const res = this.arbiter.books("barter");

	// One deal per block; 500-unit deals drift prices ~8%, so alternate the sold resource.
	if (!gameState.isResearched("phase_city_generic"))
	{

		if ((res.stone < 750 || res.metal < 750))
		{
			const want = res.stone <= res.metal ? "stone" : "metal";
			const sell = res.food >= res.wood ? "food" : "wood";
			if (res[sell] >= 700)
			{
				market.barter(want, sell, 500);
				this.arbiter.spendSell("barter", sell, 500, `barter ${sell}->${want}`);
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 ${sell} -> ${want}\n`);
				return;
			}
			if (res[sell] >= 400)
			{
				market.barter(want, sell, 100);
				this.arbiter.spendSell("barter", sell, 100, `barter ${sell}->${want}`);
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 100 ${sell} -> ${want}\n`);
				return;
			}
		}

		const excess = res.stone - 800 >= res.metal - 800 ? "stone" : "metal";
		if (res[excess] >= 1300 && (res.wood < 250 || res.food < 200))
		{
			const want = res.wood < 250 ? "wood" : "food";
			market.barter(want, excess, 500);
			this.arbiter.spendSell("barter", excess, 500, `barter ${excess}->${want}`);
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 ${excess} -> ${want}\n`);
			return;
		}
	}
	else if (this.expansionOn())
	{

		if (!this.manageExpansionBarter(market))
		{
			// Strategic buying: the war machine's big one-time spends — Will
			// to Fight (1500 metal / 1500 stone) first, then the wonder
			// (1000 metal / 1500 stone) — starve on metal while the food
			// mountain grows (probe s203: metal sat at 70-550 for 15 min
			// with 8-10k food banked, so neither the wonder nor Will to
			// Fight ever fired). Sell food toward the missing amounts before
			// any other food deal.
			if (this.turn % 15 === 0 && res.food >= 4000)
			{
				const willPending = this.buildupManager.willToFightPending(gameState);
				let wonderPending = !willPending && !(this.expPlan?.wonderDone);
				if (wonderPending && res.metal >= 2200 && res.stone >= 1800)
					wonderPending = false;
				let want;
				if (willPending && (res.metal < 1700 || res.stone < 1700))
					want = res.metal <= res.stone ? "metal" : "stone";
				else if (wonderPending)
					// Metal-first ordering starved stone for 10 minutes in
					// probe s217 (the CC stream ate every stone deal) — buy
					// whichever ore is relatively scarcer against the target.
					want = res.metal / 2200 <= res.stone / 1800 ? "metal" : "stone";
				if (want)
				{
					const prices = gameState.getBarterPrices();
					if (prices.sell.food / prices.buy[want] >= 0.5)
					{
						market.barter(want, "food", 500);
						this.arbiter.spendSell("barter", "food", 500, `barter food->${want}`);
						print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 food -> ${want} (war machine)\n`);
						return;
					}
				}
			}
			// Bank leveling: past a 5k food/wood gap, sell the mountain for the
			// poor resource — the gatherer shares correct the inflow, but a
			// 20k food bank needs the market to ever become wood (Louis's
			// review: 20k food against a few hundred wood late game).
			const rich = res.food >= res.wood ? "food" : "wood";
			const poor = rich === "food" ? "wood" : "food";
			if (res[rich] - res[poor] > 5000 && res[rich] > 6000 && this.turn % 15 === 0)
			{
				const prices = gameState.getBarterPrices();
				if (prices.sell[rich] / prices.buy[poor] >= 0.5)
				{
					market.barter(poor, rich, 500);
					this.arbiter.spendSell("barter", rich, 500, `barter ${rich}->${poor}`);
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 ${rich} -> ${poor} (bank leveling)\n`);
					return;
				}
			}
			if (res.stone >= 600 || res.metal >= 600)
			{

				const excess = res.stone >= res.metal ? "stone" : "metal";
				if (res[excess] >= 1000 && (res.wood < 250 || res.food < 200))
				{
					const want = res.wood < 250 ? "wood" : "food";
					market.barter(want, excess, 500);
					this.arbiter.spendSell("barter", excess, 500, `barter ${excess}->${want}`);
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m barter 500 ${excess} -> ${want}\n`);
				}
			}
		}
	}
};
