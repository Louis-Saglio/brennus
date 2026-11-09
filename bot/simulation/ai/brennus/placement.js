import { SquareDistance } from "simulation/ai/brennus/helpers.js";

/** World → town-plan frame (p along the buildings' width axis, q along their depth axis). */
function toLocal(f, x, z)
{
	const dx = x - f.ox, dz = z - f.oz;
	return [dx * f.c - dz * f.s, dx * f.s + dz * f.c];
}

/** Town-plan frame → world. */
function toWorld(f, p, q)
{
	return [f.ox + p * f.c + q * f.s, f.oz - p * f.s + q * f.c];
}

/** Strict positive-area overlap of a building rect with [p0,p1]×[q0,q1]. */
function intersects(b, p0, p1, q0, q1)
{
	return b.p0 < p1 - 0.05 && b.p1 > p0 + 0.05 && b.q0 < q1 - 0.05 && b.q1 > q0 + 0.05;
}

/** True when one side of X has a clear strip to the lot edge (no blocking building of `others` in between). */
function hasFreeSide(X, lot, others)
{
	for (let side = 0; side < 4; ++side)
	{
		let r;
		if (side === 0)
		{
			if (X.p0 <= lot.p0 + 0.05)
				return true;
			r = [lot.p0, X.p0, X.q0, X.q1];
		}
		else if (side === 1)
		{
			if (X.p1 >= lot.p1 - 0.05)
				return true;
			r = [X.p1, lot.p1, X.q0, X.q1];
		}
		else if (side === 2)
		{
			if (X.q0 <= lot.q0 + 0.05)
				return true;
			r = [X.p0, X.p1, lot.q0, X.q0];
		}
		else
		{
			if (X.q1 >= lot.q1 - 0.05)
				return true;
			r = [X.p0, X.p1, X.q1, lot.q1];
		}
		if (!others.some(o => o !== X && o.blocks && intersects(o, r[0], r[1], r[2], r[3])))
			return true;
	}
	return false;
}

export function PlacementManager(bot)
{
	this.bot = bot;
	// All buildings share the home CC's orientation, latched on first use.
	this.ccAngle = undefined;
	// Town-plan lattice origin (the home CC's position), latched on first use.
	this.planOrigin = undefined;
	// Engine-rejected build spots [x, z, turn, template] (the entry's OnUpdate
	// expires them) and the per-template continuous-failure latch the
	// relief-expansion check reads.
	this.failedSpots = [];
	this.placeFailSince = {};
	// House space-pressure latch: streak of consecutive house orders that had
	// to leave the inner districts (level >= 1), when the streak started,
	// and the last house order turn. Read by checkReliefExpansion.
	this.houseSpill = { "streak": 0, "since": undefined, "lastOrder": undefined };
	// Transient scan caches and log throttles, lazily init'd (reset on load).
	this.placeRetryAfter = undefined;
	this.placeFailLog = undefined;
	this._halfCache = {};
	this._frame = undefined;
}

PlacementManager.prototype.serialize = function()
{
	return {
		"failedSpots": this.failedSpots,
		"placeFailSince": this.placeFailSince,
		"houseSpill": this.houseSpill,
		"planOrigin": this.planOrigin
	};
};

PlacementManager.prototype.deserialize = function(data)
{
	this.failedSpots = data?.failedSpots || [];
	this.placeFailSince = data?.placeFailSince || {};
	this.houseSpill = data?.houseSpill || { "streak": 0, "since": undefined, "lastOrder": undefined };
	this.planOrigin = data?.planOrigin;
};

// ---------------------------------------------------------------- town plan
/**
 * Town plan. Every building sits on ONE lattice of lots anchored at the
 * home civic centre and aligned with its orientation, lots separated by
 * streetWidth m streets: the base is a grid of solid blocks with straight,
 * always-clear streets — the army crosses it without circling, rams (siege
 * pathfinding clearance 3 m, pathfinder.xml "large") fit through every
 * street, and nothing is ever boxed in. Rules:
 *  - the centre lot is the home farm: the civic centre ringed by two rings
 *    of field slots (24 fields) lotGap apart, the first 1.5 m from its
 *    walls. Fields are walkable (BlockMovement false), so the CC stands in
 *    a 119 m walkable square where the army musters, shelters and flees,
 *    the fields pack with no street between them, and farmers walk 1.5-38 m
 *    to the dropsite;
 *  - every other lot is lotDepth × lotLength (26 × 49 m): two houses deep and
 *    four long, eight houses each on a street, or a big building plus
 *    houses (the lots in line with the farm span its 119 m on that axis);
 *  - a building lies inside one lot. The arsenal (29 m) overhangs a street
 *    by 3 m on the 26 m axis, leaving a 5 m infantry alley there;
 *  - buildings sharing a lot snap together lotGap apart — too narrow for any
 *    unit, so a block is solid (no maze of 2-4 m alleys that infantry try
 *    and rams cannot pass) — and each keeps one side open onto the street:
 *    its strip to the lot edge is clear (units spawn all around the
 *    footprint, CCmpFootprint::PickSpawnPoint);
 *  - dropsites may also stand off the lattice next to their resource, on
 *    open ground only (freeSpotOK);
 *  - expansion civic centres sit on lot centres (expansionSpotNear) with
 *    their four side lots kept for fields; one lattice serves every
 *    district. The wonder (40 m) takes two lots across their street.
 * tools/layout.py measures the result from the [HARNESS] layout snapshots.
 */
/** Field rings around the home CC: 2 = a 5×5 farm of 24 fields, 119 m across (all the farmland a boom needs, with no street between fields). */
PlacementManager.prototype.farmRings = 2;
/** Lot size (m) on the plan's p axis: 2 houses (2·11 + 1.5), a field (22), any single building up to the 25 m fortress/market/assembly. */
PlacementManager.prototype.lotDepth = 26;
/** Lot size (m) on the q axis: 4 houses (4·11 + 3·1.5) or 2 fields — long blocks need fewer streets per house. */
PlacementManager.prototype.lotLength = 49;
/** Street width (m): a ram needs > 6 m (clearance 3 m on both sides), plus slack for the crowd around it. */
PlacementManager.prototype.streetWidth = 8;
/** Gap (m) between buildings sharing a lot: above the 1.25 m placementOK inflation, below the 1.6 m a unit needs. */
PlacementManager.prototype.lotGap = 1.5;
/** Minimum gap (m) to a building of another lot: an overhanging arsenal leaves at least this much of the street. */
PlacementManager.prototype.alleyMin = 4.9;

/** 1-D lot layout along one axis: lot 0 is the centre band [-C, C]; lot k spans L m from C + S + (|k|-1)(L+S) outwards. */
function lotSpan(f, L, k)
{
	if (k === 0)
		return [-f.C, f.C];
	const a = f.C + f.S + (Math.abs(k) - 1) * (L + f.S);
	return k > 0 ? [a, a + L] : [-a - L, -a];
}

/** Lot index of plan coordinate x along an axis of lot length L (a street belongs half to each side). */
function lotIndex(f, L, x)
{
	const ax = Math.abs(x);
	if (ax <= f.C + f.S / 2)
		return 0;
	const k = 1 + Math.floor((ax - f.C - f.S / 2) / (L + f.S));
	return x < 0 ? -k : k;
}

function lotRect(f, i, j)
{
	const [p0, p1] = lotSpan(f, f.Lp, i);
	const [q0, q1] = lotSpan(f, f.Lq, j);
	return { "p0": p0, "p1": p1, "q0": q0, "q1": q1 };
}

/** The lattice frame, or undefined before the home CC exists. */
PlacementManager.prototype.planFrame = function()
{
	if (this._frame)
		return this._frame;
	if (!this.planOrigin)
	{
		const cc = this.bot.getCivicCentre();
		if (!cc)
			return undefined;
		this.planOrigin = [cc.position()[0], cc.position()[1]];
	}
	const gameState = this.bot.gameState;
	const a = this.getPlacementAngle();
	const cc = this.templateHalf(gameState.applyCiv("structures/{civ}/civil_centre"));
	const field = this.templateHalf(gameState.applyCiv("structures/{civ}/field"));
	const fieldHalf = Math.max(field[0], field[1]);
	// Field slots: the first ring hugs the CC lotGap from its walls, each
	// further ring lotGap outside the previous one (+5 cm against float
	// rounding); the centre lot is exactly the CC plus its farm.
	const slots = [0, Math.max(cc[0], cc[1]) + this.lotGap + fieldHalf + 0.05];
	for (let k = 2; k <= this.farmRings; ++k)
		slots.push(slots[k - 1] + 2 * fieldHalf + this.lotGap + 0.05);
	this._frame = {
		"ox": this.planOrigin[0], "oz": this.planOrigin[1],
		"c": Math.cos(a), "s": Math.sin(a),
		"C": slots[this.farmRings] + fieldHalf, "S": this.streetWidth, "Lp": this.lotDepth, "Lq": this.lotLength,
		"slots": slots
	};
	print(`[HARNESS] t=${(gameState.getTimeElapsed() / 60000).toFixed(2)}m town plan origin ${this.planOrigin[0].toFixed(1)},${this.planOrigin[1].toFixed(1)} centre ${(2 * this._frame.C).toFixed(1)} lots ${this.lotDepth}x${this.lotLength} street ${this.streetWidth}\n`);
	return this._frame;
};

/** Obstruction half-extents [width/2, depth/2] and whether it blocks movement. */
PlacementManager.prototype.templateHalf = function(templateType)
{
	let rec = this._halfCache[templateType];
	if (!rec)
	{
		const t = this.bot.gameState.getTemplate(templateType);
		rec = [+t.get("Obstruction/Static/@width") / 2, +t.get("Obstruction/Static/@depth") / 2,
			t.get("Obstruction/BlockMovement") !== "false"];
		this._halfCache[templateType] = rec;
	}
	return rec;
};

/**
 * Snapshot of the plan: every own building (structures, foundations,
 * pending orders) as a rect in plan coordinates, indexed by the lots it
 * touches (lot rect grown by a street, so an overhang is seen by both
 * neighbours), plus the CC lots and the field-only lots. Cheap — a few
 * hundred rects — and rebuilt per search: the state changes every order.
 */
PlacementManager.prototype.planIndex = function()
{
	const f = this.planFrame();
	if (!f)
		return undefined;
	const gameState = this.bot.gameState;
	const blds = [];
	const ccNodes = [];
	const add = (pos, w, d, angle, blocks, isCC) => {
		const [p, q] = toLocal(f, pos[0], pos[1]);
		const dl = angle - this.ccAngle;
		const cd = Math.abs(Math.cos(dl)), sd = Math.abs(Math.sin(dl));
		const hp = w / 2 * cd + d / 2 * sd, hq = w / 2 * sd + d / 2 * cd;
		const b = { "p0": p - hp, "p1": p + hp, "q0": q - hq, "q1": q + hq, "blocks": blocks,
			"i": lotIndex(f, f.Lp, p), "j": lotIndex(f, f.Lq, q) };
		blds.push(b);
		if (isCC)
			ccNodes.push([b.i, b.j]);
	};
	const addEnt = (ent, builtTemplate) => {
		const pos = ent.position();
		const o = ent.get("Obstruction/Static");
		if (!pos || !o)
			return;
		add(pos, +o["@width"], +o["@depth"], ent.angle() ?? this.ccAngle,
			ent.get("Obstruction/BlockMovement") !== "false", builtTemplate.hasClass("CivCentre"));
	};
	for (const ent of gameState.getOwnStructures().values())
		if (ent.foundationProgress() === undefined)
			addEnt(ent, ent);
	for (const fd of gameState.getOwnFoundations().values())
		addEnt(fd, gameState.getBuiltTemplate(fd.templateName()));
	for (const pb of this.bot.constructionManager.pendingBuilds)
	{
		const t = gameState.getTemplate(pb.template);
		const o = t?.get("Obstruction/Static");
		if (o)
			add([pb.x, pb.z], +o["@width"], +o["@depth"], this.ccAngle,
				t.get("Obstruction/BlockMovement") !== "false", t.hasClass("CivCentre"));
	}

	const byLot = new Map();
	const S = f.S;
	for (const b of blds)
		for (let i = lotIndex(f, f.Lp, b.p0 - S); i <= lotIndex(f, f.Lp, b.p1 + S); ++i)
			for (let j = lotIndex(f, f.Lq, b.q0 - S); j <= lotIndex(f, f.Lq, b.q1 + S); ++j)
			{
				const r = lotRect(f, i, j);
				if (!intersects(b, r.p0 - S, r.p1 + S, r.q0 - S, r.q1 + S))
					continue;
				const key = i + "," + j;
				const list = byLot.get(key);
				if (list)
					list.push(b);
				else
					byLot.set(key, [b]);
			}
	const ccLots = new Set();
	const fieldLots = new Set();
	for (const [i, j] of ccNodes)
	{
		if (!i && !j)
			continue;
		ccLots.add(i + "," + j);
		for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
			fieldLots.add((i + di) + "," + (j + dj));
	}
	ccNodes.push([0, 0]);
	return { "f": f, "byLot": byLot, "ccNodes": ccNodes, "ccLots": ccLots, "fieldLots": fieldLots };
};

/** "farm" (the home centre lot: CC + field slots), "cc" (an expansion CC's lot), "field" (field-only) or "build". */
PlacementManager.prototype.lotRole = function(idx, key)
{
	if (key === "0,0")
		return "farm";
	if (idx.ccLots.has(key))
		return "cc";
	if (idx.fieldLots.has(key))
		return "field";
	return "build";
};

/** Chebyshev distance (in lots) from lot i,j to the nearest CC lot: 1 = the first building ring. */
PlacementManager.prototype.lotRing = function(idx, i, j)
{
	let ring = Infinity;
	for (const [ci, cj] of idx.ccNodes)
		ring = Math.min(ring, Math.max(Math.abs(i - ci), Math.abs(j - cj)));
	return ring;
};

/**
 * Plan-valid centres (plan coordinates) for a hp×hq footprint in lot i,j:
 * flush against a lot edge and snapped against the lot's buildings (corner
 * packing), plus — walkable footprints only — the position nearest
 * `target`. Valid = inside the lot (the arsenal's overhang excepted),
 * lotGap from the lot's buildings and alleyMin from the others, and nobody
 * — the newcomer included — left without an open side. The farm lot only
 * offers its eight field slots.
 */
PlacementManager.prototype.lotCandidates = function(idx, i, j, hp, hq, blocks, target)
{
	const f = idx.f;
	const g = this.lotGap;
	const lot = lotRect(f, i, j);
	const near = idx.byLot.get(i + "," + j) || [];
	const raw = [];
	const maxOver = f.S - this.alleyMin;
	const axis = (lo, hi, half, tgt, memberEdges) => {
		if (2 * half > hi - lo + 1e-6)
			return 2 * half - (hi - lo) > maxOver ? null : { "lo": lo + half, "hi": hi - half, "vals": [lo + half, hi - half] };
		const a = lo + half, b = hi - half;
		const vals = [a, b];
		for (const [e0, e1] of memberEdges)
			vals.push(e1 + g + half, e0 - g - half);
		if (tgt !== undefined)
			vals.push(Math.max(a, Math.min(b, tgt)));
		return { "lo": a, "hi": b, "vals": vals.filter(v => v >= a - 1e-6 && v <= b + 1e-6) };
	};
	const inLot = near.filter(b => intersects(b, lot.p0, lot.p1, lot.q0, lot.q1));
	const ax = axis(lot.p0, lot.p1, hp, target?.[0], inLot.map(b => [b.p0, b.p1]));
	const ay = axis(lot.q0, lot.q1, hq, target?.[1], inLot.map(b => [b.q0, b.q1]));
	if (!i && !j)
	{
		// The farm: fields only, on the slot grid around the CC, or packed
		// against the CC, the other fields and the farm's edge wherever
		// mines and woods leave room (starting resources lie in it).
		if (blocks || !ax || !ay)
			return [];
		const n = this.farmRings;
		for (let dp = -n; dp <= n; ++dp)
			for (let dq = -n; dq <= n; ++dq)
				if (dp || dq)
					raw.push([Math.sign(dp) * f.slots[Math.abs(dp)], Math.sign(dq) * f.slots[Math.abs(dq)]]);
		for (const x of ax.vals)
			for (const y of ay.vals)
				raw.push([x, y]);
	}
	else
	{
		if (!ax || !ay)
			return [];
		for (const x of ax.vals)
			raw.push([x, ay.lo], [x, ay.hi]);
		for (const y of ay.vals)
			raw.push([ax.lo, y], [ax.hi, y]);
		// The free position nearest the target only for walkable footprints:
		// a blocking building off every lot edge leaves slivers no house fits.
		if (target && !blocks)
			raw.push([ax.vals[ax.vals.length - 1], ay.vals[ay.vals.length - 1]]);
	}

	const seen = new Set();
	const out = [];
	const blockers = near.filter(b => b.blocks);
	for (const [x, y] of raw)
	{
		const key = Math.round(x * 4) + "," + Math.round(y * 4);
		if (seen.has(key))
			continue;
		seen.add(key);
		const cand = { "p0": x - hp, "p1": x + hp, "q0": y - hq, "q1": y + hq, "blocks": blocks, "i": i, "j": j };
		let ok = true;
		for (const b of near)
		{
			const gap = b.i === i && b.j === j || !blocks || !b.blocks ? g : this.alleyMin;
			if (cand.p0 < b.p1 + gap && b.p0 < cand.p1 + gap && cand.q0 < b.q1 + gap && b.q0 < cand.q1 + gap)
			{
				ok = false;
				break;
			}
		}
		if (!ok)
			continue;
		if (blocks)
		{
			if (!hasFreeSide(cand, lot, blockers))
				continue;
			const withCand = blockers.concat([cand]);
			if (blockers.some(X => intersects(X, lot.p0, lot.p1, lot.q0, lot.q1) &&
				hasFreeSide(X, lot, blockers) && !hasFreeSide(X, lot, withCand)))
				continue;
		}
		out.push([x, y]);
	}
	return out;
};

/**
 * Plan-valid spots for `templateType` in the lots within `maxDist` of any of
 * `centers`, scored by `score(x, z, info)` (lower first), not yet checked
 * against terrain/territory/enemies (spotOK does that). kind "field" may
 * use the farm and field-only lots; every other kind needs a building lot.
 * `target` (world point, or a function of the lot's world centre) adds the
 * position nearest to it in each lot.
 */
PlacementManager.prototype.planCandidates = function(templateType, opts)
{
	const idx = this.planIndex();
	if (!idx)
		return [];
	const f = idx.f;
	const [hp, hq, blocks] = this.templateHalf(templateType);
	const lots = new Map();
	for (const c of opts.centers)
	{
		const [pc, qc] = toLocal(f, c[0], c[1]);
		for (let i = lotIndex(f, f.Lp, pc - opts.maxDist); i <= lotIndex(f, f.Lp, pc + opts.maxDist); ++i)
			for (let j = lotIndex(f, f.Lq, qc - opts.maxDist); j <= lotIndex(f, f.Lq, qc + opts.maxDist); ++j)
			{
				const r = lotRect(f, i, j);
				const dp = Math.max(r.p0 - pc, 0, pc - r.p1), dq = Math.max(r.q0 - qc, 0, qc - r.q1);
				if (dp * dp + dq * dq <= opts.maxDist * opts.maxDist)
					lots.set(i + "," + j, [i, j, r]);
			}
	}
	const out = [];
	for (const [key, [i, j, r]] of opts.freeOnly ? [] : lots)
	{
		const role = this.lotRole(idx, key);
		if (role === "cc" || role !== "build" && opts.kind !== "field")
			continue;
		const lotWorld = toWorld(f, (r.p0 + r.p1) / 2, (r.q0 + r.q1) / 2);
		const target = typeof opts.target === "function" ? opts.target(lotWorld) : opts.target;
		const tl = target ? toLocal(f, target[0], target[1]) : undefined;
		const own = (idx.byLot.get(key) || []).filter(b => b.i === i && b.j === j);
		const members = own.filter(b => b.blocks).length;
		const info = { "i": i, "j": j, "role": role, "members": members, "fields": own.length - members,
			"lotWorld": lotWorld, "ring": this.lotRing(idx, i, j) };
		if (opts.bigFits && !own.length)
			info.bigFits = this.lotBigFits(idx, i, j);
		if (opts.reserve)
		{
			info.reserved = this.reservedLots(idx).has(key);
			info.arsenalLot = !own.length && this.lotBigFits(idx, i, j, "arsenal");
		}
		for (const [p, q] of this.lotCandidates(idx, i, j, hp, hq, blocks, tl))
		{
			const pos = toWorld(f, p, q);
			if (!opts.centers.some(c => SquareDistance(c, pos) <= opts.maxDist * opts.maxDist))
				continue;
			out.push({ "pos": pos, "info": info, "score": opts.score(pos[0], pos[1], info) });
		}
	}
	// Free-standing spots (dropsites only): off the lattice, next to the
	// resource, but only on open ground — see freeSpotOK.
	if (opts.free)
	{
		const info = { "role": "free", "members": 0, "ring": Infinity };
		for (const pos of opts.free)
			if (this.freeSpotOK(idx, pos, hp, hq))
				out.push({ "pos": pos, "info": info, "score": opts.score(pos[0], pos[1], info) + this.freePenalty });
	}
	out.sort((a, b) => a.score - b.score);
	return out;
};

/**
 * Whether an empty lot can still take a big building (`kind`'s footprint,
 * default the 20 m barracks, passes spotOK somewhere in it) — lots that
 * cannot (trees, mines, the territory edge cutting them) are the ones
 * houses should open first. Cached per lot for 50 turns: terrain changes
 * slowly.
 */
PlacementManager.prototype.lotBigFits = function(idx, i, j, kind = "barracks")
{
	this._bigFitCache = this._bigFitCache || {};
	const key = kind + ":" + i + "," + j;
	const c = this._bigFitCache[key];
	if (c && this.bot.turn - c[0] < 50)
		return c[1];
	const type = this.bot.gameState.applyCiv(`structures/{civ}/${kind}`);
	const [hp, hq] = this.templateHalf(type);
	const fits = this.lotCandidates(idx, i, j, hp, hq, true).some(([p, q]) =>
		this.spotOK(type, toWorld(idx.f, p, q)));
	this._bigFitCache[key] = [this.bot.turn, fits];
	return fits;
};

/** The big buildings the build orders will still ask for (buildup.js manageDefenseBuildings at the war stage, the town-phase trio): count per short name. */
PlacementManager.prototype.bigBuildingPlan = {
	"barracks": 4, "arsenal": 2, "temple": 3, "forge": 1, "assembly": 1,
	"fortress": 1, "stable": 1, "market": 1, "tavern": 1
};

/**
 * Land bank for the big buildings: as many empty building lots as big
 * buildings are still to come, the arsenal-sized ones (29 m — the only
 * footprint that needs a whole lot plus an overhang) nearest home first.
 * Houses and fields take these lots only as a last resort: without the
 * bank, houses fill every whole lot by minute 18 and the arsenal waits
 * for a relief CC (seed 43: arsenal at 36 min instead of 17). Cached per
 * turn.
 */
PlacementManager.prototype.reservedLots = function(idx)
{
	if (this._reserved && this._reserved.turn === this.bot.turn)
		return this._reserved.set;
	const gameState = this.bot.gameState;
	const have = {};
	const count = name => { have[name] = (have[name] || 0) + 1; };
	for (const ent of gameState.getOwnStructures().values())
		count(ent.templateName().split("/").pop());
	for (const fd of gameState.getOwnFoundations().values())
		count(gameState.getBuiltTemplate(fd.templateName()).templateName().split("/").pop());
	for (const pb of this.bot.constructionManager.pendingBuilds)
		count(pb.template.split("/").pop());
	let missing = 0;
	for (const name in this.bigBuildingPlan)
		missing += Math.max(0, this.bigBuildingPlan[name] - (have[name] || 0));
	const set = new Set();
	if (missing)
	{
		const f = idx.f;
		const home = this.bot.getCivicCentre()?.position();
		const lots = [];
		const reach = 3;
		for (let i = -reach; i <= reach; ++i)
			for (let j = -reach; j <= reach; ++j)
			{
				const key = i + "," + j;
				if (this.lotRole(idx, key) !== "build" ||
					(idx.byLot.get(key) || []).some(b => b.i === i && b.j === j))
					continue;
				if (!this.lotBigFits(idx, i, j, "arsenal"))
					continue;
				const r = lotRect(f, i, j);
				const w = toWorld(f, (r.p0 + r.p1) / 2, (r.q0 + r.q1) / 2);
				lots.push([home ? Math.hypot(w[0] - home[0], w[1] - home[1]) : 0, key]);
			}
		lots.sort((a, b) => a[0] - b[0]);
		for (const [, key] of lots.slice(0, missing))
			set.add(key);
	}
	this._reserved = { "turn": this.bot.turn, "set": set };
	return set;
};

/** Score handicap (m) of a free-standing dropsite spot: a lattice spot this much farther still wins. */
PlacementManager.prototype.freePenalty = 4;

/**
 * A dropsite serves a resource only from up close (a farmstead 30 m from
 * its berries leaves them unserved and the strategy orders another), and
 * woodlines and mines rarely line up with the lots. So a dropsite may also
 * stand off the lattice — on open ground only: a street's width
 * (streetWidth) clear of every blocking building, and touching no building
 * lot that already holds buildings and no CC/field lot. The farm's outer
 * ring is open to it: the starting woods and mines lie there, and a
 * storehouse is a rock among walkable fields (the first field ring around
 * the CC stays clear). The town later grows
 * around it like around a rock: lots it touches treat it as an obstacle,
 * and the free-side rule keeps everyone's door open.
 */
PlacementManager.prototype.freeSpotOK = function(idx, pos, hp, hq)
{
	const f = idx.f;
	const [p, q] = toLocal(f, pos[0], pos[1]);
	const r = { "p0": p - hp, "p1": p + hp, "q0": q - hq, "q1": q + hq };
	const S = f.S;
	for (let i = lotIndex(f, f.Lp, r.p0 - S); i <= lotIndex(f, f.Lp, r.p1 + S); ++i)
		for (let j = lotIndex(f, f.Lq, r.q0 - S); j <= lotIndex(f, f.Lq, r.q1 + S); ++j)
		{
			const key = i + "," + j;
			const near = idx.byLot.get(key) || [];
			for (const b of near)
			{
				const gap = b.blocks ? S : this.lotGap;
				if (r.p0 < b.p1 + gap && b.p0 < r.p1 + gap && r.q0 < b.q1 + gap && b.q0 < r.q1 + gap)
					return false;
			}
			const lot = lotRect(f, i, j);
			if (!intersects(r, lot.p0, lot.p1, lot.q0, lot.q1))
				continue;
			const role = this.lotRole(idx, key);
			if (role !== "build" && role !== "farm" || near.some(b => b.blocks && b.i === i && b.j === j && role === "build"))
				return false;
			// In the farm, only past the first field ring: the eight fields
			// hugging the CC are the best farmland there is.
			const inner = f.slots[1] + (f.C - f.slots[this.farmRings]) + this.lotGap;
			if (role === "farm" && intersects(r, -inner, inner, -inner, inner))
				return false;
		}
	return true;
};

/** Ring positions around `center` from rMin to rMax, `step` m apart radially (the free-standing candidates). */
PlacementManager.prototype.ringSpots = function(center, rMin, rMax, step = 2)
{
	const out = [];
	for (let r = rMin; r <= rMax; r += step)
		for (let a = 0; a < 32; ++a)
		{
			const ang = a * Math.PI / 16;
			out.push([center[0] + r * Math.cos(ang), center[1] + r * Math.sin(ang)]);
		}
	return out;
};

/** Terrain/territory/enemy/region check of one spot (the plan rules are the candidate generator's): "" when buildable, else the first failing check. */
PlacementManager.prototype.spotCheck = function(templateType, pos, region)
{
	const [x, z] = pos;
	if (this.failedSpots.some(fs => Math.abs(fs[0] - x) < 6 && Math.abs(fs[1] - z) < 6))
		return "failed";
	if (this.bot.armyManager.nearEnemy(pos, 100, 60))
		return "enemy";
	if (region !== undefined && this.bot.accessibility.getAccessValue(pos) !== region)
		return "region";
	const [hw, hd] = this.templateHalf(templateType);
	return this.placementOK(x, z, hw + 0.5, hd + 0.5, this.getPlacementAngle(),
		this.bot.gameState.getPassabilityMap(), this.bot.gameState.getPassabilityClassMask("building-land"),
		this.bot.territoryMap) ? "" : "terrain";
};

PlacementManager.prototype.spotOK = function(templateType, pos, region)
{
	return !this.spotCheck(templateType, pos, region);
};

/** Best plan spot that passes spotOK (+ opts.accept), or undefined. `region`: an access value, or "nearestCC" for the region of the CC nearest the spot. Failure tallies go to this.lastSearch (the no-placement warning prints them). */
PlacementManager.prototype.planSearch = function(templateType, opts)
{
	const ccs = opts.region === "nearestCC" ? this.ownCivicCentres().map(e => e.position()) : undefined;
	let checked = 0;
	const tally = { "cands": 0, "accept": 0, "failed": 0, "enemy": 0, "region": 0, "terrain": 0 };
	this.lastSearch = tally;
	for (const cand of this.planCandidates(templateType, opts))
	{
		++tally.cands;
		if (opts.accept && !opts.accept(cand.pos[0], cand.pos[1]))
		{
			++tally.accept;
			continue;
		}
		let region = opts.region;
		if (ccs)
		{
			let best = Infinity;
			for (const c of ccs)
			{
				const d = SquareDistance(c, cand.pos);
				if (d < best)
				{
					best = d;
					region = this.bot.accessibility.getAccessValue(c);
				}
			}
		}
		const why = this.spotCheck(templateType, cand.pos, region);
		if (!why)
			return cand;
		++tally[why];
		if (++checked >= 600)
			break;
	}
	return undefined;
};

/**
 * Telemetry: the home district's lots as one character each, rows of
 * constant q (top = +q), lots -4..4 on both axes around the home CC.
 * digit: the farm (base-36 count of its fields), c an
 * expansion CC, f/F field-only lot empty/with a field; building lots:
 * . empty and a house fits, + used and a house still fits, # used and
 * full, F holds a field, t empty but outside own territory, x empty and in
 * territory but no house fits (trees, mines, cliffs, enemies).
 */
PlacementManager.prototype.planDump = function()
{
	const idx = this.planIndex();
	if (!idx)
		return;
	const f = idx.f;
	const houseType = this.bot.gameState.applyCiv("structures/{civ}/house");
	const [hp, hq] = this.templateHalf(houseType);
	const rows = [];
	const counts = {};
	for (let j = 4; j >= -4; --j)
	{
		let row = "";
		for (let i = -4; i <= 4; ++i)
		{
			const key = i + "," + j;
			const role = this.lotRole(idx, key);
			const near = (idx.byLot.get(key) || []).filter(b => b.i === i && b.j === j);
			const nFields = near.filter(b => !b.blocks).length;
			const members = near.filter(b => b.blocks).length;
			let ch;
			if (role === "farm")
				ch = nFields.toString(36);
			else if (role === "cc")
				ch = "c";
			else if (role === "field")
				ch = nFields ? "F" : "f";
			else if (nFields)
				ch = "F";
			else
			{
				const fits = this.lotCandidates(idx, i, j, hp, hq, true).some(([p, q]) =>
					this.spotOK(houseType, toWorld(f, p, q)));
				if (members)
					ch = fits ? "+" : "#";
				else if (fits)
					ch = ".";
				else
				{
					const r = lotRect(f, i, j);
					const w = toWorld(f, (r.p0 + r.p1) / 2, (r.q0 + r.q1) / 2);
					ch = this.bot.inOwnTerritory(w[0], w[1]) ? "x" : "t";
				}
			}
			if (role === "build")
				counts[ch] = (counts[ch] || 0) + 1;
			row += ch;
		}
		rows.push(row);
	}
	print(`[HARNESS] t=${(this.bot.gameState.getTimeElapsed() / 60000).toFixed(1)}m plan ${rows.join("/")} build lots ${Object.keys(counts).sort().map(k => k + "=" + counts[k]).join(" ")}\n`);
};

/** Built own CCs, home first. */
PlacementManager.prototype.ownCivicCentres = function()
{
	const home = this.bot.getCivicCentre();
	if (!home)
		return [];
	const ccType = this.bot.gameState.applyCiv("structures/{civ}/civil_centre");
	const out = [home];
	for (const ent of this.bot.gameState.getOwnStructures().values())
		if (ent.templateName() === ccType && ent.id() !== home.id() && ent.position())
			out.push(ent);
	return out;
};

/** Lot centres (the centre lot excepted) within maxDist of `anchor`, nearest first — the expansion CC spots. */
PlacementManager.prototype.latticeNodesNear = function(anchor, maxDist)
{
	const f = this.planFrame();
	if (!f)
		return undefined;
	const [pc, qc] = toLocal(f, anchor[0], anchor[1]);
	const out = [];
	for (let i = lotIndex(f, f.Lp, pc - maxDist); i <= lotIndex(f, f.Lp, pc + maxDist); ++i)
		for (let j = lotIndex(f, f.Lq, qc - maxDist); j <= lotIndex(f, f.Lq, qc + maxDist); ++j)
		{
			if (!i && !j)
				continue;
			const r = lotRect(f, i, j);
			const p = (r.p0 + r.p1) / 2, q = (r.q0 + r.q1) / 2;
			const d = Math.hypot(p - pc, q - qc);
			if (d <= maxDist)
				out.push([d, toWorld(f, p, q)]);
		}
	out.sort((a, b) => a[0] - b[0]);
	return out.map(o => o[1]);
};

/**
 * Spot for a building wider than a lot plus an overhang (the wonder, 40 m):
 * two empty building lots side by side on the p axis, the building centred
 * on the street between them — it leaves 9 m of each lot open. Nearest the
 * anchors first.
 */
PlacementManager.prototype.findBlockSpot = function(templateType, anchors)
{
	const idx = this.planIndex();
	if (!idx)
		return undefined;
	const f = idx.f;
	const cands = [];
	for (const [anchor, maxDist] of anchors)
	{
		const [pc, qc] = toLocal(f, anchor[0], anchor[1]);
		for (let i = lotIndex(f, f.Lp, pc - maxDist); i < lotIndex(f, f.Lp, pc + maxDist); ++i)
			for (let j = lotIndex(f, f.Lq, qc - maxDist); j <= lotIndex(f, f.Lq, qc + maxDist); ++j)
			{
				if (!i || i === -1)
					continue;
				const a = lotRect(f, i, j), b = lotRect(f, i + 1, j);
				const p = (a.p1 + b.p0) / 2, q = (a.q0 + a.q1) / 2;
				const d = Math.hypot(p - pc, q - qc);
				if (d > maxDist)
					continue;
				const free = [i, i + 1].every(k => this.lotRole(idx, k + "," + j) === "build" &&
					!(idx.byLot.get(k + "," + j) || []).length);
				if (free)
					cands.push([d, toWorld(f, p, q)]);
			}
	}
	cands.sort((a, b) => a[0] - b[0]);
	const region = this.bot.accessibility.getAccessValue(anchors[0][0]);
	for (const [, pos] of cands)
		if (this.spotOK(templateType, pos, region))
			return pos;
	return undefined;
};

// ---------------------------------------------------------------- placement
/** Dropsite spot minimizing the farthest of `points` (a storehouse between two mines). */
PlacementManager.prototype.findMinimaxSpot = function(templateType, points, region)
{
	let sx = 0, sz = 0;
	for (const p of points)
	{
		sx += p[0];
		sz += p[1];
	}
	const centroid = [sx / points.length, sz / points.length];
	const res = this.planSearch(templateType, {
		"kind": "dropsite", "centers": [centroid], "maxDist": 40, "target": centroid, "region": region,
		"free": this.ringSpots(centroid, 4, 40),
		"score": (x, z) => {
			let s = 0;
			for (const p of points)
				s = Math.max(s, Math.hypot(x - p[0], z - p[1]));
			return s;
		}
	});
	return res?.pos;
};

PlacementManager.prototype.tryConstruct = function(templateType, kind, center, rush)
{
	// A full placement failure means every candidate lot came up empty —
	// expensive, and the obstruction it reports changes on
	// building-completion timescales. Retry at most every 25 turns.
	this.placeRetryAfter = this.placeRetryAfter || {};
	if (this.bot.turn < (this.placeRetryAfter[templateType] || 0))
		return false;
	const cc = this.bot.getCivicCentre();
	if (!cc)
		return false;
	const ccPos = cc.position();

	let pos, houseSpot;
	if (kind === "house")
	{
		houseSpot = this.findHouseSpot(templateType);
		pos = houseSpot?.pos;
	}
	else if (kind === "dropsite")
	{
		// Only in the CC's land region: a spot across a cliff or river sits unbuilt forever.
		const target = center || ccPos;
		pos = this.planSearch(templateType, {
			"kind": "dropsite", "centers": [target], "maxDist": 28, "target": target,
			"free": this.ringSpots(target, 10, 28),
			"region": this.bot.accessibility.getAccessValue(ccPos),
			"score": (x, z) => Math.hypot(x - target[0], z - target[1])
		})?.pos;
	}
	else
	{
		// Military/civic buildings: the lot nearest the anchor (home CC
		// unless given) among every lot of every district — big footprints
		// (stable, arsenal, fortress) find no room in the crowded home
		// rings late, and an exposed arsenal beats a nonexistent one (43 of
		// 56 timeouts in the 3af2b27 sweep never placed one).
		const anchor = center || ccPos;
		const ccs = this.ownCivicCentres().map(e => e.position());
		// Anything but an arsenal keeps off the arsenal-sized lots of the
		// land bank while another lot nearby has room.
		const isArsenal = templateType.split("/").pop() === "arsenal";
		const opts = {
			"kind": kind, "centers": center ? [center, ...ccs] : ccs, "maxDist": 160,
			"region": "nearestCC", "reserve": !isArsenal,
			"score": (x, z, info) => Math.hypot(x - anchor[0], z - anchor[1]) +
				(!isArsenal && info.reserved && info.arsenalLot ? 40 : 0)
		};
		pos = this.planSearch(templateType, opts)?.pos;
		// Last resort when no lot has room (small territory, lots cut by
		// woods and the border): stand alone on open ground like a
		// dropsite, a street clear of everything (freeSpotOK).
		if (!pos)
		{
			opts.free = [];
			for (const c of ccs)
				opts.free.push(...this.ringSpots(c, 40, 150, 4));
			opts.freeOnly = true;
			pos = this.planSearch(templateType, opts)?.pos;
			if (pos)
				print(`[HARNESS] t=${(this.bot.gameState.getTimeElapsed() / 60000).toFixed(1)}m ${templateType.split("/").pop()} stands alone at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} — no lot has room\n`);
		}
	}
	if (!pos)
	{
		if (kind !== "dropsite")
		{
			this.placeRetryAfter[templateType] = this.bot.turn + 25;
			// Relief-expansion signal: anything failing to place continuously
			// is a stuck base.
			this.placeFailSince[templateType] = this.placeFailSince[templateType] || this.bot.turn;
			this.placeFailLog = this.placeFailLog || {};
			if (this.bot.turn - (this.placeFailLog[templateType] ?? -Infinity) >= 600)
			{
				this.placeFailLog[templateType] = this.bot.turn;
				const s = this.lastSearch;
				print(`[WARNING] t=${Math.round(this.bot.gameState.getTimeElapsed() / 60000)}m no placement for ${templateType.split("/").pop()} at any CC — lots full or enemy too close` +
					(s ? ` (${s.cands} spots: terrain ${s.terrain}, enemy ${s.enemy}, region ${s.region}, failed ${s.failed})` : "") + "\n");
				this.planDump();
			}
		}
		return false;
	}
	if (this.placeOrder(templateType, pos, rush))
	{
		delete this.placeFailSince[templateType];
		if (kind === "house")
			this.recordHouseSpill(houseSpot.level);
		return pos;
	}
	return false;
};

PlacementManager.prototype.placeOrder = function(templateType, pos, rush)
{
	const builder = this.bot.gameState.getOwnUnits().filter(ent =>
		(!this.bot.armyManager.army || !this.bot.armyManager.army[ent.id()]) && (!this.bot.armyManager.rams || !this.bot.armyManager.rams[ent.id()]) &&
		(!this.bot.armyManager.healers || !this.bot.armyManager.healers[ent.id()])).filterNearest(pos, 1).toEntityArray()[0];
	if (!builder)
		return false;
	builder.construct(templateType, pos[0], pos[1], this.getPlacementAngle(), undefined);
	this.bot.constructionManager.pendingBuilds.push({ "template": templateType, "x": pos[0], "z": pos[1], "turn": this.bot.turn });
	if (rush)
		this.bot.constructionManager.rushBuilds.push({ "x": pos[0], "z": pos[1], "turn": this.bot.turn });
	return true;
};

/** All buildings share the CC's orientation angle (keeps the grids consistent). */
PlacementManager.prototype.getPlacementAngle = function()
{
	if (this.ccAngle === undefined)
	{
		const cc = this.bot.getCivicCentre();
		if (!cc)
			return 0;
		this.ccAngle = cc.angle() ?? 0;
		print(`[HARNESS] t=${(this.bot.gameState.getTimeElapsed() / 60000).toFixed(2)}m placement angle=${(this.ccAngle * 180 / Math.PI).toFixed(1)}°\n`);
	}
	return this.ccAngle;
};

/**
 * House placement. A house's population bonus is location-independent, so
 * it takes the building lots nearest any CC — depth is safety (a lost house
 * eats pop margin) and distance is pure cost (builder walk) — completing a
 * started block before opening a new lot, and opening lots too cut up for
 * a big building before whole ones, so houses stay in solid blocks and
 * whole lots remain for the big buildings. Spill level by lot ring
 * around the nearest CC: 0 = the first ring around the farm (68-117 m out),
 * 1 = the second, 2 = farther. Level >= 1 means space is getting rare:
 * recorded in houseSpill for the relief-expansion check.
 */
PlacementManager.prototype.findHouseSpot = function(templateType)
{
	const ccs = this.ownCivicCentres().map(e => e.position());
	if (!ccs.length)
		return undefined;
	const nearestCC = (x, z) => {
		let d = Infinity;
		for (const c of ccs)
			d = Math.min(d, Math.hypot(x - c[0], z - c[1]));
		return d;
	};
	// Lot order: blocks already started, then empty lots no big building
	// fits in (cut by trees, mines or the territory edge), then the whole
	// empty lots the barracks, temples and arsenals need — nearest first in
	// each class.
	// The land bank (reservedLots) comes last of all.
	const res = this.planSearch(templateType, {
		"kind": "house", "centers": ccs, "maxDist": 160, "region": "nearestCC", "bigFits": true, "reserve": true,
		"score": (x, z, info) => nearestCC(info.lotWorld[0], info.lotWorld[1]) -
			(info.members || !info.bigFits ? 30 : 0) - (info.members ? 30 : 0) + 0.05 * nearestCC(x, z) +
			(info.reserved ? 200 : 0)
	});
	if (!res)
		return undefined;
	return { "pos": res.pos, "level": res.info.ring <= 1 ? 0 : res.info.ring === 2 ? 1 : 2 };
};

/** Record where the latest house order landed: level >= 1 starts/extends the space-pressure streak, level 0 breaks it. */
PlacementManager.prototype.recordHouseSpill = function(level)
{
	const spill = this.houseSpill;
	spill.lastOrder = this.bot.turn;
	if (level >= 1)
	{
		spill.streak++;
		if (spill.since === undefined)
			spill.since = this.bot.turn;
		if (!this.houseSpillLog || this.bot.turn - this.houseSpillLog >= 300)
		{
			this.houseSpillLog = this.bot.turn;
			print(`[HARNESS] t=${(this.bot.gameState.getTimeElapsed() / 60000).toFixed(1)}m house spill level ${level} — inner lots are full, space is getting rare\n`);
		}
	}
	else
	{
		spill.streak = 0;
		spill.since = undefined;
	}
};

/** Plan spot nearest `center` between minRadius and maxRadius (towers, expansion markets). */
PlacementManager.prototype.findBuildingPosition = function(templateType, center, minRadius, maxRadius, fine, region, extraCheck)
{
	return this.planSearch(templateType, {
		"kind": "build", "centers": [center], "maxDist": maxRadius, "region": region,
		"accept": (x, z) => Math.hypot(x - center[0], z - center[1]) >= minRadius && (!extraCheck || extraCheck(x, z)),
		"score": (x, z) => Math.hypot(x - center[0], z - center[1])
	})?.pos;
};

/** Placement prefilter: true rotated footprint (inflated 0.75 m) passable, territory box own. Engine rotation convention: width along (cos a, −sin a), depth along (sin a, cos a) (CCmpObstructionManager::AddStaticShape). */
PlacementManager.prototype.placementOK = function(x, z, halfW, halfD, angle, pass, mask, terr)
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
			const u = dx * cosa - dz * sina;
			const v = dx * sina + dz * cosa;
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
			if ((terr.data[i + j * terr.width] & 0x1F) !== this.bot.player)
				return false;
	return true;
};

/** Rejection forensics for the construct FAILED log (engine rejections are silent): whether the spot still passes our placement check, and who owns its territory cell now. */
PlacementManager.prototype.diagnoseFailedSpot = function(pb)
{
	const [hw, hd] = this.templateHalf(pb.template);
	const ok = this.placementOK(pb.x, pb.z, hw + 0.5, hd + 0.5, this.getPlacementAngle(),
		this.bot.gameState.getPassabilityMap(), this.bot.gameState.getPassabilityClassMask("building-land"),
		this.bot.territoryMap);
	const terr = this.bot.territoryMap;
	const cell = terr.cellSize;
	const owner = terr.data[Math.floor(pb.x / cell) + Math.floor(pb.z / cell) * terr.width] & 0x1F;
	return `(placementOK=${ok} terrOwner=${owner})`;
};
