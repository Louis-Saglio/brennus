import { SquareDistance } from "simulation/ai/brennus/helpers.js";

export function ConstructionManager(bot)
{
	this.bot = bot;
	this.builderAssignments = {};
	this.pendingBuilds = []; // [{template, x, z, turn}]
	this.rushBuilds = []; // [{x, z, turn}] storehouses whose builders come from the choppers
	// One shot only: if the engine rejects the order, manageDropSites'
	// demand trigger is the fallback — retrying re-picks the same best tree.
	this.bootstrapStoreTried = false;
	// Civ-resolved civic-trio template names, cached by trioTypes.
	this._trioTypes = undefined;
	// Dropsite placement strategies, in priority order (wood, mine, farmstead)
	// — the first strategy to fire places the block's one dropsite order.
	// Self-contained per-resource policies with their own gates: swap one here
	// to change placement for a map/biome. Instances are recreated fresh on
	// deserialization, like the other transient dropsite state they hold.
	this.woodStrategy = Object.create(WoodStorehouseStrategy);
	this.mineStrategy = Object.create(MineStorehouseStrategy);
	this.farmsteadStrategy = Object.create(FarmsteadStrategy);
	this.dropsiteStrategies = [this.woodStrategy, this.mineStrategy, this.farmsteadStrategy];
}

ConstructionManager.prototype.serialize = function()
{
	return {
		"builderAssignments": this.builderAssignments,
		"pendingBuilds": this.pendingBuilds,
		"bootstrapStoreTried": this.bootstrapStoreTried
	};
};

ConstructionManager.prototype.deserialize = function(data)
{
	this.builderAssignments = data?.builderAssignments || {};
	this.pendingBuilds = data?.pendingBuilds || [];
	// Never written to the blob, and the pre-manager entry never serialized it
	// either: rushBuilds always restarts empty after a load.
	this.rushBuilds = data?.rushBuilds || [];
	this.bootstrapStoreTried = data?.bootstrapStoreTried || false;
};

ConstructionManager.prototype.nextTrioWood = function()
{
	if (this.bot.gameState.currentPhase() < 2)
		return 0;
	const foundations = this.bot.gameState.getOwnFoundations().toEntityArray();
	const next = this.trioTypes()
		.find(t => !this.hasStructureOrFoundation(t, foundations));
	return next ? (this.bot.gameState.getTemplate(next).cost().wood || 0) : 0;
};

ConstructionManager.prototype.trioTypes = function()
{
	if (!this._trioTypes)
	{
		const third = this.bot.gameState.getTemplate(this.bot.gameState.applyCiv("structures/{civ}/tavern")) ?
			"tavern" : "temple";
		this._trioTypes = ["forge", "market", third]
			.map(t => this.bot.gameState.applyCiv(`structures/{civ}/${t}`));
	}
	return this._trioTypes;
};

// ---------------------------------------------------------------- construction
ConstructionManager.prototype.manageConstruction = function()
{
	const gameState = this.bot.gameState;
	const resources = this.bot.arbiter.books("construction");
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

		const target = (isField ? 2 : isHouse ? (this.bot.gameState.currentPhase() === 1 ? 2 : 3) :
			isCC ? 10 : isWonder ? 16 : rush ? 8 : 4);
		let cur = assigned[foundation.id()];
		if (!cur)
			cur = assigned[foundation.id()] = [];
		const needed = target - cur.length;
		if (needed <= 0)
			continue;
		const builders = gameState.getOwnUnits()
			.filter(ent => ent.isGatherer() && ent.isBuilder() && ent.position() &&
				!(ent.id() === this.bot.economyManager.herderId && !this.bot.economyManager.herdingDone) &&
				!this.bot.armyManager.army[ent.id()] &&
				!taken.has(ent.id()) &&
				(!rush || this.bot.economyManager.assignments[ent.id()] === "wood"))
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
		return !done && this.bot.turn - r.turn < 200;
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
		const home = this.bot.getCivicCentre()?.position() || [384, 384];
		const ccTimeout = 150 + Math.ceil(Math.hypot(pb.x - home[0], pb.z - home[1]) / 1.5);
		if (this.bot.turn - pb.turn > (pb.template.indexOf("civil_centre") !== -1 ? ccTimeout : 10))
		{
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m construct FAILED: ${pb.template} at ${pb.x.toFixed(0)},${pb.z.toFixed(0)} ${this.bot.placementManager.diagnoseFailedSpot(pb)}\n`);
			this.bot.placementManager.failedSpots.push([pb.x, pb.z, this.bot.turn, pb.template]);
			// A CC order that died with enemies around means the builder party
			// was slaughtered en route (s47: 5 orders, 5 dead parties): mark
			// the area contested so the clearing op sanitizes it before the
			// plan sends the next party.
			if (pb.template.indexOf("civil_centre") !== -1 &&
				this.bot.armyManager.nearEnemy([pb.x, pb.z], 120, 120))
			{
				// Don't re-prove an area whose op just gave up: the army
				// held it and no CC followed — the killers are not the
				// blocker there (s13 churned 4 ops on one cursed spot).
				let cooled = false;
				for (const ck in this.bot.offenseManager.clearCool)
				{
					if (this.bot.turn - this.bot.offenseManager.clearCool[ck] >= 1800)
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
					const c = this.bot.expansionManager.expContested[key];
					this.bot.expansionManager.expContested[key] = {
						"x": pb.x, "z": pb.z,
						"since": c ? c.since : this.bot.turn, "seen": this.bot.turn,
						// A dead builder party proves the area lethal — no
						// continuous-presence latch needed; the killers patrol and
						// will be back (s47). Lives 3 min, extended per failure.
						"proven": true, "until": this.bot.turn + 900
					};
				}
			}
			return false;
		}
		return true;
	});

	if (this.bot.arbiter.held("construction"))
		return;

	if (this.bot.arbiter.held("banking"))
		return;

	const houseType = gameState.applyCiv("structures/{civ}/house");
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	const reserve = this.bot.arbiter.reservedAll();

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
		if (this.bot.placementManager.tryConstruct(houseType, "house"))
			this.bot.arbiter.spend(resources, "construction", { "wood": houseCost }, "house");
		else if (this.bot.turn % 750 === 0)
			print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m house placement FAILED (margin=${margin})\n`);
		return true;

	};

	// Bootstrap: the opener spends on the two dropsites before anything else
	// so the opening economy never walks — farmstead at the richest fruit
	// cluster, storehouse at the home grove's payback maximum. The demand
	// trigger in manageDropSites covers everything past these.
	{
		const type = gameState.applyCiv("structures/{civ}/farmstead");
		if (!this.hasStructureOrFoundation(type, foundations) &&
			resources.canAfford({
				"food": reserve.food || 0, "wood": (reserve.wood || 0) + 100,
				"stone": reserve.stone || 0, "metal": reserve.metal || 0 }) &&
			this.farmsteadStrategy.placeOpening(this.bot, type))
		{
			this.bot.arbiter.spend(resources, "construction", { "wood": 100 }, "farmstead");
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
			const pos = this.woodStrategy.placeOpening(this.bot, storeType);
			if (pos)
			{
				this.bootstrapStoreTried = true;
				this.bot.arbiter.spend(resources, "construction", { "wood": 100 }, "storehouse");
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
				if (this.bot.placementManager.tryConstruct(trioType, "civic"))
				{
					this.bot.arbiter.spend(resources, "construction", cost, trioType.split("/").pop());
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
	if (this.bot.arbiter.held("constructionDefense"))
		return;

	// Field demand is computed fresh every block, BEFORE both house gates
	// read it (until step C the early gate below read the previous block's
	// declaration — an accident of statement order, not a policy).
	let foodGatherers = 0;
	for (const res of Object.values(this.bot.economyManager.assignments))
		if (res === "food")
			foodGatherers++;
	const fieldCap = this.bot.expansionManager.expansionOn() ? 60 : (gameState.currentPhase() === 1 ? 4 : 30);
	// Fields open at t=1:30 or when served fruit runs low: they must stand before the fruit runs out.
	const desiredFields = this.bot.economyManager.fruitStock < 4000 || gameState.getTimeElapsed() > 90000 ?
		Math.min(fieldCap, Math.max(2, Math.ceil(foodGatherers / 3) + 1)) : 0;
	let fields = 0;
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === fieldType)
			fields++;
	const fieldFoundations = foundations.filter(f =>
		gameState.getBuiltTemplate(f.templateName()).templateName() === fieldType).length;

	// Bootstrap only: the first 2 fields outrank the house stream while served fruit is nearly out.
	this.bot.arbiter.declare("field", (fields + fieldFoundations) < Math.min(2, desiredFields) &&
		this.bot.economyManager.fruitStock < 800 ? { "wood": 100 } : null);

	if (margin < 2 && houseFoundations < this.bot.maxHouseFoundations &&
		gameState.getPopulationLimit() < gameState.getPopulationMax() &&
		resources.wood >= houseCost + this.bot.arbiter.declaredAmount("field", "wood"))
		return tryHouse();

	this.bot.arbiter.declare("techWood", null);
	for (const tech of ["gather_farming_plows", "gather_farming_training",
		"gather_farming_harvester", "gather_lumbering_ironaxes"])
	{
		if (gameState.isResearched(tech) || gameState.isResearching(tech) ||
			!gameState.canResearch(tech))
			continue;
		const techWood = gameState.getTemplate(tech).cost().wood || 0;
		if (resources.wood < techWood + 100)
			this.bot.arbiter.declare("techWood", techWood ? { "wood": techWood } : null);
		break;
	}

	const cc = this.bot.getCivicCentre();
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
		const region = this.bot.accessibility.getAccessValue(ccPos);
		for (const farm of farms)
		{
			const spot = this.bot.placementManager.findBuildingPosition(fieldType, farm[1], 16, 36, true, region);
			if (spot && this.bot.placementManager.placeOrder(fieldType, spot))
				return;
		}
		this.bot.placementManager.tryConstruct(fieldType, "field");
		return;
	}

	if (this.bot.arbiter.declared("fert"))
		return;

	const sprintCap = gameState.getTimeElapsed() > 600000 &&
		gameState.getPopulationLimit() < gameState.getPopulationMax();
	if ((margin < this.bot.houseMargin || sprintCap) && houseFoundations < this.bot.maxHouseFoundations &&
		!this.bot.arbiter.declared("techWood") &&
		gameState.getPopulationLimit() < gameState.getPopulationMax() &&
		resources.wood >= (reserve.wood || 0) + this.nextTrioWood() + this.bot.arbiter.declaredAmount("dropsite", "wood") + this.bot.arbiter.declaredAmount("field", "wood") + houseCost)
		return tryHouse();
};

ConstructionManager.prototype.hasStructureOrFoundation = function(type, foundations)
{
	return this.bot.gameState.getOwnStructures().toEntityArray().some(ent => ent.templateName() === type) ||
		foundations.some(f => this.bot.gameState.getBuiltTemplate(f.templateName()).templateName() === type);
};

// ------------------------------------------------- dropsite strategies
/**
 * Dropsite placement is split per resource into swappable strategy objects.
 * Resource spread — and thereby where a dropsite pays its 100 wood back —
 * varies with the map and biome, so each policy (demand reading, gating,
 * center selection, opening placement) is self-contained and replaceable in
 * CustomInit without touching the rest. The bot keeps the shared machinery:
 * the per-block context (buildDropsiteContext), the placement scans
 * (tryConstruct, findMinimaxSpot, placeOrder)
 * and the serve-distance metrics.
 *
 * Contract: run(bot, ctx) places at most one build order and returns true,
 * or returns false to let the next strategy try — manageDropSites runs them
 * in priority order (wood, mine, farmstead), one dropsite order per block.
 * Strategy state (gated spots, cooldowns) lives on the strategy instance and
 * is transient, like the bot fields it replaces.
 */
/**
 * Wood storehouse placement, derived from the gather cycle rather than from
 * heuristics. A wood gatherer's round trip is capacity/rate seconds of
 * gathering plus 2d/v seconds of walking (d = one-way tree-to-dropsite edge
 * distance, v = walk speed), so draining a tree holding W wood costs
 * (W/rate)·(1 + a·d) person-seconds whatever the gatherer count, with
 * a = 2·rate/(v·capacity). A new dropsite at d' therefore saves
 * W·a·(d − d') wood-equivalent per tree, valued at the gatherer's
 * alternative wood income (≈ base rate): the saved person-seconds go back
 * into gathering. The strategy builds when the savings on the wood that is
 * NOT currently served clear the building's full cost (stock + the builders'
 * lost gathering), and places the building at the spot maximizing total
 * savings over the wood mass it will amortize over.
 */
export const WoodStorehouseStrategy = {

	/** Grid hash cell (m) clustering far gatherers into one demand point. */
	"clusterCell": 40,

	/** Radius (m) around a demand point whose tree mass one storehouse amortizes over — beyond it the woodline needs >10 min to arrive and the payback estimate is fiction. */
	"evalRadius": 80,

	/** The unserved mass alone must pay for the building: at least this many trees... */
	"minUnservedTrees": 2,

	/** ...holding at least this much wood (2 temperate trees). One straggler never passes, however long the walk — the old mass-gate lesson, here the floor of a plausible payback clump. */
	"minUnservedMass": 400,

	/** A new storehouse must sit at least this far (m, center-to-center) from every existing dropsite: closer, it cannibalizes coverage instead of extending it. */
	"separation": 20,

	/** Payback multiplier over the computed cost: covers path-vs-straight-line error, supply amounts stale through fog, and raids interrupting the served wood. */
	"safety": 1.5,

	/** Builders a rush storehouse pulls off the woodline, for the cost estimate. */
	"rushBuilders": 4,

	/** Per-instance cache of the derived constants (recomputed after a load, like the rest of the strategy state). */
	"_economics": function(bot)
	{
		if (this._econ)
			return this._econ;
		const gameState = bot.gameState;
		const unit = gameState.getTemplate(gameState.applyCiv("units/{civ}/support_civilian"));
		const store = gameState.getTemplate(gameState.applyCiv("structures/{civ}/storehouse"));
		const rate = +unit?.get("ResourceGatherer/Rates/wood.tree") || 0.7;
		const capacity = +unit?.get("ResourceGatherer/Capacities/wood") || 10;
		const speed = +unit?.get("UnitMotion/WalkSpeed") || 9;
		const cost = store?.cost().wood || 100;
		const buildTime = store?.buildTime() || 40;
		this._econ = {
			"a": 2 * rate / (speed * capacity),
			"minValue": (cost + buildTime * this.rushBuilders * rate) * this.safety
		};
		return this._econ;
	},

	/**
	 * The tree set one storehouse would amortize over: every live tree within
	 * evalRadius of the demand point that is in own territory (a storehouse
	 * cannot be ordered elsewhere, so trees across the border contribute no
	 * payback), in the same land region, and not under the enemy. d0 is the
	 * edge distance to the existing dropsites; a tree is "unserved" past the
	 * bot's serve distance — the same discipline the drift pull-back enforces.
	 */
	"_trees": function(bot, center, region, sites)
	{
		const gameState = bot.gameState;
		const r2 = this.evalRadius * this.evalRadius;
		const trees = [];
		for (const s of gameState.getResourceSupplies("wood").values())
		{
			if (s.resourceSupplyType()?.specific !== "tree")
				continue;
			const pos = s.position();
			const wood = s.resourceSupplyAmount();
			if (!pos || !wood || wood < 30)
				continue;
			if (SquareDistance(pos, center) > r2)
				continue;
			if (!bot.inOwnTerritory(pos[0], pos[1]))
				continue;
			if (bot.accessibility.getAccessValue(pos) !== region)
				continue;
			if (bot.armyManager.nearEnemy(pos, 100, 60))
				continue;
			const d0 = Math.max(0, bot.economyManager.edgeDistToSites(pos, sites));
			trees.push({ "pos": pos, "wood": wood, "d0": d0, "unserved": d0 > bot.woodServeDist });
		}
		return trees;
	},

	/**
	 * Demand: wood gatherers actually working a tree beyond every dropsite's
	 * serve distance (carriers included — a full chopper on a far tree is
	 * coverage demand the pull-back will only correct next trip). Grid-hashed
	 * per tree, densest cells first, capped: one order per block goes to the
	 * best cluster anyway.
	 */
	"_clusters": function(bot, ctx)
	{
		const gameState = bot.gameState;
		const cells = new Map();
		for (const ent of gameState.getOwnUnits().values())
		{
			if (!ent.isGatherer() || ent.isIdle() || !ent.position())
				continue;
			if (bot.economyManager.assignments[ent.id()] !== "wood")
				continue;
			const tgt = bot.economyManager.gatherTarget[ent.id()];
			if (tgt?.generic !== "wood" || tgt?.specific !== "tree")
				continue;
			const tree = gameState.getEntityById(tgt.supplyId);
			const pos = tree?.position();
			if (!pos || !tree.resourceSupplyAmount())
				continue;
			if (Math.max(0, bot.economyManager.edgeDistToSites(pos, ctx.woodSites)) <= bot.woodServeDist)
				continue;
			const key = `${Math.floor(pos[0] / this.clusterCell)},${Math.floor(pos[1] / this.clusterCell)}`;
			const cell = cells.get(key);
			if (cell)
				cell.push(pos);
			else
				cells.set(key, [pos]);
		}
		return [...cells.values()]
			.sort((a, b) => b.length - a.length)
			.slice(0, 4)
			.map(positions => bot.economyManager.centroid(positions));
	},

	/**
	 * Pick the buildable spot maximizing total savings, a·Σ W·max(0, d0 − dNew),
	 * over the tree set. Candidates ring the unserved mass's wood-weighted
	 * centroid; the engine's own placement prefilter (passability, territory,
	 * failed spots, enemy proximity, land region) vets each one, and existing
	 * dropsites keep their separation. Returns the winner with its total and
	 * unserved-only savings in wood-equivalent.
	 */
	"_scan": function(bot, storeType, region, sites, trees)
	{
		const gameState = bot.gameState;
		const econ = this._economics(bot);
		const template = gameState.getTemplate(storeType);
		const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
		const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
		const halfDiag = Math.hypot(+template.get("Obstruction/Static/@width"), +template.get("Obstruction/Static/@depth")) / 2;
		const angle = bot.placementManager.getPlacementAngle();
		const pass = gameState.getPassabilityMap();
		const mask = gameState.getPassabilityClassMask("building-land");
		const terr = bot.territoryMap;
		const placement = bot.placementManager;

		let sw = 0, cx = 0, cz = 0;
		for (const t of trees)
		{
			if (!t.unserved)
				continue;
			sw += t.wood;
			cx += t.pos[0] * t.wood;
			cz += t.pos[1] * t.wood;
		}
		if (sw <= 0)
			return undefined;
		cx /= sw;
		cz /= sw;

		let best, bestTotal = 0, bestUnserved = 0;
		const consider = (x, z) => {
			if (placement.failedSpots.some(f => Math.abs(f[0] - x) < 6 && Math.abs(f[1] - z) < 6))
				return;
			if (bot.armyManager.nearEnemy([x, z], 100, 60))
				return;
			if (bot.accessibility.getAccessValue([x, z]) !== region)
				return;
			if (sites.some(s => Math.hypot(x - s.pos[0], z - s.pos[1]) < this.separation))
				return;
			if (!placement.placementOK(x, z, halfW, halfD, angle, pass, mask, terr))
				return;
			let total = 0, unserved = 0;
			for (const t of trees)
			{
				const gain = t.d0 - Math.max(0, Math.hypot(x - t.pos[0], z - t.pos[1]) - halfDiag);
				if (gain <= 0)
					continue;
				total += t.wood * gain;
				if (t.unserved)
					unserved += t.wood * gain;
			}
			if (total > bestTotal)
			{
				bestTotal = total;
				bestUnserved = unserved;
				best = [x, z];
			}
		};
		consider(cx, cz);
		for (let r = 6; r <= 42; r += 6)
			for (let k = 0; k < 16; ++k)
			{
				const ang = k * Math.PI / 8;
				consider(cx + r * Math.cos(ang), cz + r * Math.sin(ang));
			}
		if (!best)
			return undefined;
		return { "pos": best, "total": bestTotal * econ.a, "unserved": bestUnserved * econ.a };
	},

	/** Gates shared by the opening and the demand path: the unserved mass alone must pay the building back. */
	"_pays": function(bot, trees, scan)
	{
		let mass = 0, count = 0;
		for (const t of trees)
			if (t.unserved)
			{
				mass += t.wood;
				count++;
			}
		return count >= this.minUnservedTrees && mass >= this.minUnservedMass &&
			scan && scan.unserved >= this._economics(bot).minValue;
	},

	/**
	 * The opening storehouse: same evaluator with the civic centre as the
	 * only dropsite. It lands at the payback maximum of the home grove, and
	 * on a wood-poor map the gate simply keeps the 100 wood — choppers walk
	 * to the CC instead of funding a building that never pays back.
	 */
	"placeOpening": function(bot, type)
	{
		if (bot.turn < (this.openingRetryAfter || 0))
			return false;
		const gameState = bot.gameState;
		const cc = bot.getCivicCentre();
		if (!cc)
			return false;
		const region = bot.accessibility.getAccessValue(cc.position());
		const ccSite = [{ "pos": cc.position(), "half": bot.economyManager.obstructionHalfDiag(cc) }];
		const trees = this._trees(bot, cc.position(), region, ccSite);
		const scan = this._scan(bot, type, region, ccSite, trees);
		if (!this._pays(bot, trees, scan))
		{
			this.openingRetryAfter = bot.turn + 150;
			return false;
		}
		if (!bot.placementManager.placeOrder(type, scan.pos, true))
			return false;
		return scan.pos;
	},

	/**
	 * Demand path: for each cluster of far gatherers, evaluate the wood mass
	 * around it and order the block's storehouse at the best-payback spot —
	 * one order per block, the richest cluster first. No reserve is held
	 * against a wood storehouse: it is the investment that produces wood —
	 * reserving wood against it deadlocks the economy once income has
	 * collapsed (s90 never passed the 250-wood effective floor).
	 */
	"run": function(bot, ctx)
	{
		const gameState = bot.gameState;
		const resources = ctx.resources;
		if (ctx.storeCount >= (bot.expansionManager.expansionOn() ? 40 : 18) || resources.wood < 100)
			return false;

		this.gateRetry = this.gateRetry || {};
		let best;
		for (const center of this._clusters(bot, ctx))
		{
			const key = `${Math.round(center[0] / 20)},${Math.round(center[1] / 20)}`;
			if (bot.turn < (this.gateRetry[key] || 0))
				continue;
			const region = bot.accessibility.getAccessValue(center);
			const trees = this._trees(bot, center, region, ctx.woodSites);
			let mass = 0, count = 0;
			for (const t of trees)
				if (t.unserved)
				{
					mass += t.wood;
					count++;
				}
			if (count < this.minUnservedTrees || mass < this.minUnservedMass)
				continue;
			const scan = this._scan(bot, ctx.storeType, region, ctx.woodSites, trees);
			if (!this._pays(bot, trees, scan))
			{
				// The unserved mass only depletes, so a center that failed the
				// payback gate cannot pass later: blacklist it for 5 min.
				this.gateRetry[key] = bot.turn + 300;
				if (!this.gateLog || bot.turn - (this.gateLog[key] || -1000) >= 300)
				{
					this.gateLog = this.gateLog || {};
					this.gateLog[key] = bot.turn;
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m wood storehouse gated at ${center[0].toFixed(0)},${center[1].toFixed(0)} (${count} unserved trees, ${mass} wood, value ${scan ? Math.round(scan.unserved) : 0} < ${Math.round(this._economics(bot).minValue)})\n`);
				}
				continue;
			}
			if (!best || scan.unserved > best.scan.unserved)
				best = { center, scan };
		}
		if (!best)
			return false;
		if (ctx.storePending(best.scan.pos) ||
			ctx.storeFoundations.some(p => Math.hypot(p[0] - best.scan.pos[0], p[1] - best.scan.pos[1]) < 30))
			return false;
		bot.arbiter.declare("dropsite", { "wood": 100 });
		if (!bot.placementManager.placeOrder(ctx.storeType, best.scan.pos, true))
			return false;
		bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/wood");
		print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${best.scan.pos[0].toFixed(0)},${best.scan.pos[1].toFixed(0)} for wood ${best.center[0].toFixed(0)},${best.center[1].toFixed(0)} (value ${Math.round(best.scan.total)}, unserved ${Math.round(best.scan.unserved)} of cost ${Math.round(this._economics(bot).minValue)})\n`);
		return true;
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

		if (ctx.storeCount < (bot.expansionManager.expansionOn() ? 40 : 18))
		{
			let worst, worstDist = bot.mineGatherServeDist;
			const underserved = [];
			for (const ent of gameState.getOwnUnits().values())
			{
				if (!ent.isGatherer() || ent.isIdle() || !ent.position())
					continue;
				const tgt = bot.economyManager.gatherTarget[ent.id()];
				if (tgt?.generic !== "stone" && tgt?.generic !== "metal")
					continue;
				const anchor = gameState.getEntityById(tgt.supplyId)?.position() || ent.position();
				const d = bot.economyManager.edgeDistToSites(anchor, ctx.woodSites);
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
			const far = underserved.filter(p => bot.economyManager.edgeDistToSites(p, ctx.woodSites) > bot.mineDistWarn);
			if ((underserved.length >= (bot.expansionManager.expansionOn() ? 5 : 2) || far.length >= 2) &&
				!(bot.expansionManager.expansionOn() && far.length < 2 && bot.turn - (this.lastMineStoreTurn || -1000) < 40))
			{
				bot.arbiter.declare("dropsite", { "wood": 100 });
				const sMine = bot.economyManager.mineId.stone !== undefined ?
					gameState.getEntityById(bot.economyManager.mineId.stone) : undefined;
				const mMine = bot.economyManager.mineId.metal !== undefined ?
					gameState.getEntityById(bot.economyManager.mineId.metal) : undefined;
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
						const spot = bot.placementManager.findMinimaxSpot(ctx.storeType, [sPos, mPos],
							bot.accessibility.getAccessValue(ctx.cc.position()));
						if (spot && bot.placementManager.placeOrder(ctx.storeType, spot))
						{
							this.lastMineStoreTurn = bot.turn;
							bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/mine-pair");
							print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} between stone ${sPos[0].toFixed(0)},${sPos[1].toFixed(0)} and metal ${mPos[0].toFixed(0)},${mPos[1].toFixed(0)} (${underserved.length} underserved)\n`);
							return true;
						}
					}
				}
				const clump = underserved.filter(p => Math.hypot(p[0] - worst[0], p[1] - worst[1]) < 25);
				const center = bot.economyManager.centroid(clump);
				const planned = ctx.storeFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 45) ||
					ctx.storePending(center);
				const pos = resources.wood >= (far.length >= 2 ? 100 : ctx.woodFloor) && !planned &&
					bot.placementManager.tryConstruct(ctx.storeType, "dropsite", center);
				if (pos)
				{
					this.lastMineStoreTurn = bot.turn;
					bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "storehouse/mine");
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m storehouse at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for mine ${center[0].toFixed(0)},${center[1].toFixed(0)} (${underserved.length} underserved)\n`);
					return true;
				}
			}
		}

		if (bot.expansionManager.expansionOn() && resources.wood >= ctx.woodFloor &&
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
					if (bot.economyManager.edgeDistToSites(pos, ctx.woodSites) <= bot.mineDistWarn)
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
					const spot = bot.placementManager.findMinimaxSpot(ctx.storeType, [best], region);
					if (spot && bot.placementManager.placeOrder(ctx.storeType, spot))
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
			if (bot.placementManager.tryConstruct(type, "dropsite", cand[1]))
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
		const foodSites = [{ "pos": cc.position(), "half": bot.economyManager.obstructionHalfDiag(cc) }];
		const farmFoundations = [];
		let farmCount = 0;
		for (const f of ctx.foundations)
			if (gameState.getBuiltTemplate(f.templateName()).templateName() === farmType && f.position())
			{
				foodSites.push({ "pos": f.position(), "half": bot.economyManager.obstructionHalfDiag(f) });
				farmFoundations.push(f.position());
				farmCount++;
			}
		for (const ent of gameState.getOwnStructures().values())
			if (ent.templateName() === farmType && ent.position())
			{
				foodSites.push({ "pos": ent.position(), "half": bot.economyManager.obstructionHalfDiag(ent) });
				farmCount++;
			}
		let worstField, worstFieldDist = 15;
		const unservedFields = [];
		for (const ent of gameState.getOwnStructures().values())
		{
			if (ent.templateName() !== fieldType || ent.foundationProgress() !== undefined || !ent.position())
				continue;
			const d = bot.economyManager.edgeDistToSites(ent.position(), foodSites) - 15.5;
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
			const center = bot.economyManager.centroid(cluster);
			const planned = farmFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 25);
			const pos = !planned && resources.wood >= ctx.woodFloor &&
				bot.placementManager.tryConstruct(farmType, "dropsite", center);
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
			const tgt = bot.economyManager.gatherTarget[ent.id()];
			if (tgt?.generic !== "food" || tgt?.specific !== "fruit")
				continue;
			const anchor = gameState.getEntityById(tgt.supplyId)?.position() || ent.position();
			const d = bot.economyManager.edgeDistToSites(anchor, foodSites);
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
			const center = bot.economyManager.centroid(cluster);
			const planned = farmFoundations.some(p => Math.hypot(p[0] - center[0], p[1] - center[1]) < 25);
			const pos = !planned && resources.wood >= ctx.woodFloor &&
				bot.placementManager.tryConstruct(farmType, "dropsite", center);
			if (pos)
			{
				bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "farmstead/fruit");
				print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m farmstead at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for fruit ${center[0].toFixed(0)},${center[1].toFixed(0)} (${unservedFruit.length} underserved)\n`);
				return true;
			}
		}

		if (bot.economyManager.fruitStock < 600 && farmCount < 12 && resources.wood >= ctx.woodFloor)
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
				const pos = !planned && bot.placementManager.tryConstruct(farmType, "dropsite", best);
				if (pos)
				{
					bot.arbiter.spend(resources, "dropsites", { "wood": 100 }, "farmstead/next-fruit");
					print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m farmstead at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for next fruit patch ${best[0].toFixed(0)},${best[1].toFixed(0)} (stock ${Math.round(bot.economyManager.fruitStock)})\n`);
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
ConstructionManager.prototype.buildDropsiteContext = function(foundations, reserve, resources)
{
	const gameState = this.bot.gameState;
	const cc = this.bot.getCivicCentre();
	if (!cc)
		return null;
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	const woodSites = [{ "pos": cc.position(), "half": this.bot.economyManager.obstructionHalfDiag(cc) }];
	const storeFoundations = [];
	let storeCount = 0;
	for (const f of foundations)
		if (gameState.getBuiltTemplate(f.templateName()).templateName() === storeType && f.position())
		{
			woodSites.push({ "pos": f.position(), "half": this.bot.economyManager.obstructionHalfDiag(f) });
			storeFoundations.push(f.position());
			storeCount++;
		}
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === storeType && ent.position())
		{
			woodSites.push({ "pos": ent.position(), "half": this.bot.economyManager.obstructionHalfDiag(ent) });
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
ConstructionManager.prototype.manageDropSites = function(foundations, reserve)
{
	const resources = this.bot.arbiter.books("dropsites");
	const ctx = this.buildDropsiteContext(foundations, reserve, resources);
	if (!ctx)
		return false;
	this.bot.arbiter.declare("dropsite", null);
	for (const strategy of this.dropsiteStrategies)
		if (strategy.run(this.bot, ctx))
			return true;
	return false;
};
