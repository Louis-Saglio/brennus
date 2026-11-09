/**
 * FieldManager — the grain infrastructure: how many fields to build, and
 * where to put them. Written from first principles:
 *
 * A field is a grain-slot factory. Its output is location-independent
 * except for one thing: the walk between the field and the food dropsite
 * the gatherer deposits at. The gather cycle is capacity/rate of gathering
 * (10 food at 0.5/s = 20 s, less with the farming techs) plus 2d/v of
 * walking (d = field-to-dropsite edge distance, v = 9 m/s), so a field at
 * d=5 m runs at ~95% of its paper rate, at d=30 m at 75%, at d=60 m at
 * 60%. Placement therefore has exactly one objective: minimize the edge
 * distance to the nearest food dropsite (CC or farmstead).
 *
 * Packing: fields are 22x22 m obstructions that do NOT block movement
 * (BlockMovement false), so they double as walkable open ground: the
 * town plan (placement.js) packs them around the home CC as its farm and
 * beside expansion CCs, and they take building lots elsewhere.
 *
 * Diminishing returns (dr=0.9, 5 slots) make spreading gatherers across
 * fields better than stacking them: per-gatherer efficiency is 100/95/90/
 * 86/82% at 1..5 gatherers. Three gatherers per field is the knee — the
 * demand model targets it.
 */
export function FieldManager(bot)
{
	this.bot = bot;
	// Full-scan failure throttle and warning latch (transient, like the
	// placement manager's: the rings change on building-completion
	// timescales, so a failed full scan is retried at most every 25 turns).
	this.scanRetryAfter = 0;
	this.scanFailLog = -Infinity;
	// Per-block demand state, recomputed by demandFields every block.
	this._desired = 0;
	this._standing = 0;
	this._inFlight = 0;
}

/**
 * Demand. The field program starts when the finite food (served fruit)
 * can no longer carry the gatherer flow — fruit stock below the
 * consumption horizon (~7 min at 10 gatherers) — or at t=90 s as
 * insurance: on the standard map fruit exhaustion is the norm, and being
 * caught with zero grain infrastructure stalls the whole boom. Two fields
 * always stand once the program runs (one field is a single point of
 * failure for the entire food income).
 *
 * Occupancy target is 3 gatherers per field: the diminishing-returns knee.
 * More fields would idle wood (a house, 75 w for +5 pop, is the cheaper
 * food-income investment while pop is not capped); fewer would stack
 * gatherers into the penalty. The count ramps with the food gatherer pool
 * and is recomputed every block, so fields lead the fruit-to-grain
 * migration instead of chasing it.
 *
 * Declares the bootstrap "field" wood demand (first 2 fields while served
 * fruit is nearly out) that the house gate yields to.
 */
FieldManager.prototype.demandFields = function()
{
	const gameState = this.bot.gameState;
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	let standing = 0;
	for (const ent of gameState.getOwnStructures().values())
		if (ent.templateName() === fieldType)
			standing++;
	let inFlight = 0;
	for (const f of gameState.getOwnFoundations().values())
		if (gameState.getBuiltTemplate(f.templateName()).templateName() === fieldType)
			inFlight++;

	let desired = 0;
	if (this.bot.economyManager.fruitStock < 4000 || gameState.getTimeElapsed() > 90000)
	{
		let foodGatherers = 0;
		for (const res of Object.values(this.bot.economyManager.assignments))
			if (res === "food")
				foodGatherers++;
		desired = Math.max(2, Math.ceil(foodGatherers / 3));
	}
	this._desired = desired;
	this._standing = standing;
	this._inFlight = inFlight;

	this.bot.arbiter.declare("field",
		(standing + inFlight) < Math.min(2, desired) && this.bot.economyManager.fruitStock < 800 ?
		{ "wood": 100 } : null);
};

/**
 * Order at most one field per block, after the house: fields are cheap
 * (100 w) but not free, and the house pipeline (pop for more gatherers)
 * outranks routine field expansion — only the bootstrap fields declare
 * wood priority above. Up to 3 foundations in flight: more would pull a
 * visible chunk of the economy onto build duty when the program ramps.
 */
FieldManager.prototype.orderField = function()
{
	if (this._standing + this._inFlight >= this._desired || this._inFlight >= 3)
		return;
	const gameState = this.bot.gameState;
	const resources = this.bot.arbiter.books("construction");
	if (resources.wood < 100 + this.bot.arbiter.declaredAmount("house", "wood"))
		return;
	if (this.bot.turn < this.scanRetryAfter)
		return;
	const fieldType = gameState.applyCiv("structures/{civ}/field");
	const spot = this.findFieldSpot(fieldType);
	if (!spot)
	{
		this.scanRetryAfter = this.bot.turn + 25;
		if (this.bot.turn - this.scanFailLog >= 600)
		{
			this.scanFailLog = this.bot.turn;
			print(`[WARNING] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m no field placement near any dropsite — rings crowded or enemy too close\n`);
		}
		return;
	}
	if (!this.bot.placementManager.placeOrder(fieldType, spot))
		return;
	this.bot.arbiter.spend(resources, "construction", { "wood": 100 }, "field");
	print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m field at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} edge ${spot[2].toFixed(0)}m (${this._standing + this._inFlight + 1}/${this._desired})\n`);
};

/**
 * Placement: the town-plan spot minimizing the edge distance to the nearest
 * food dropsite: the home farm's 24 slots around the CC first (no street
 * between fields — the densest farmland there is; farmsteads come to its
 * outer ring), the field-only lots beside an expansion CC next, building
 * lots last, since those hold the town: pairing up in a lot that already
 * has a field (two per lot), then lots too cut up for a big building,
 * the big buildings' land bank (placement.js reservedLots) last.
 * Reach:
 * CCs out to a 110 m edge (their 140 m territory bubble covers it),
 * farmsteads to 60 m (beyond that a field cluster attracts a farmstead
 * through the dropsite demand path instead). Candidates are validated
 * best-first (failed spots, enemy proximity, land region, passability +
 * territory).
 */
FieldManager.prototype.findFieldSpot = function(fieldType)
{
	const bot = this.bot;
	const dropsites = this.foodDropsites();
	if (!dropsites.length)
		return undefined;
	const nearest = (x, z) => {
		let best, edge = Infinity;
		for (const o of dropsites)
		{
			const e = Math.hypot(x - o.pos[0], z - o.pos[1]) - o.halfDiag;
			if (e < edge)
			{
				edge = e;
				best = o;
			}
		}
		return [best, edge];
	};
	const cands = bot.placementManager.planCandidates(fieldType, {
		"kind": "field",
		"centers": dropsites.map(d => d.pos),
		"maxDist": Math.max(...dropsites.map(d => d.halfDiag + (d.isCC ? 110 : 60))),
		"target": lotWorld => nearest(lotWorld[0], lotWorld[1])[0].pos,
		"bigFits": true, "reserve": true,
		"score": (x, z, info) => nearest(x, z)[1] + (info.role === "farm" ? 0 : info.role === "field" ? 10 :
			60 - (info.fields ? 30 : info.bigFits === false ? 20 : 0) + (info.reserved ? 200 : 0))
	});
	for (const c of cands)
	{
		const [site, edge] = nearest(c.pos[0], c.pos[1]);
		if (edge > (site.isCC ? 110 : 60))
			continue;
		if (bot.placementManager.spotOK(fieldType, c.pos, bot.accessibility.getAccessValue(site.pos)))
			return [c.pos[0], c.pos[1], Math.max(0, edge)];
	}
	return undefined;
};

/** Food dropsites (built + under construction) with obstruction half-extents, nearest to the home CC first so ties concentrate fields in the safe core. */
FieldManager.prototype.foodDropsites = function()
{
	const gameState = this.bot.gameState;
	const sites = [];
	const add = (ent, isCC) =>
	{
		const pos = ent.position();
		if (!pos)
			return;
		const hw = +ent.get("Obstruction/Static/@width") / 2 + 0.5;
		const hd = +ent.get("Obstruction/Static/@depth") / 2 + 0.5;
		sites.push({ "pos": pos, "hw": hw, "hd": hd, "halfDiag": Math.hypot(hw, hd), "isCC": isCC });
	};
	for (const ent of gameState.getOwnStructures().values())
		if (ent.hasClass("CivCentre"))
			add(ent, true);
		else if (ent.hasClass("Farmstead"))
			add(ent, false);
	for (const f of gameState.getOwnFoundations().values())
	{
		const built = gameState.getBuiltTemplate(f.templateName());
		if (built.hasClass("CivCentre"))
			add(f, true);
		else if (built.hasClass("Farmstead"))
			add(f, false);
	}
	const home = this.bot.getCivicCentre()?.position();
	if (home)
		sites.sort((a, b) => Math.hypot(a.pos[0] - home[0], a.pos[1] - home[1]) -
			Math.hypot(b.pos[0] - home[0], b.pos[1] - home[1]));
	return sites;
};
