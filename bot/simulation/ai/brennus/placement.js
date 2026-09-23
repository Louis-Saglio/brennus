import { SquareDistance } from "simulation/ai/brennus/helpers.js";

function distToSegment(x, z, ax, az, bx, bz)
{
	const dx = bx - ax, dz = bz - az;
	const len2 = dx * dx + dz * dz;
	let t = len2 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

export function PlacementManager(bot)
{
	this.bot = bot;
	// All buildings share the home CC's orientation, latched on first use.
	this.ccAngle = undefined;
	// Engine-rejected build spots [x, z, turn, template] (the entry's OnUpdate
	// expires them) and the per-template continuous-failure latch the
	// relief-expansion check reads.
	this.failedSpots = [];
	this.placeFailSince = {};
	// House space-pressure latch: streak of consecutive house orders that had
	// to leave the home/expansion districts (level >= 1), when the streak
	// started, and the last house order turn. Read by checkReliefExpansion.
	this.houseSpill = { "streak": 0, "since": undefined, "lastOrder": undefined };
	// Transient scan caches and log throttles, lazily init'd (reset on load).
	this.placeRetryAfter = undefined;
	this.placeFailLog = undefined;
}

PlacementManager.prototype.serialize = function()
{
	return {
		"failedSpots": this.failedSpots,
		"placeFailSince": this.placeFailSince,
		"houseSpill": this.houseSpill
	};
};

PlacementManager.prototype.deserialize = function(data)
{
	this.failedSpots = data?.failedSpots || [];
	this.placeFailSince = data?.placeFailSince || {};
	this.houseSpill = data?.houseSpill || { "streak": 0, "since": undefined, "lastOrder": undefined };
};

// ---------------------------------------------------------------- placement
PlacementManager.prototype.findMinimaxSpot = function(templateType, points, region)
{
	const template = this.bot.gameState.getTemplate(templateType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const angle = this.getPlacementAngle();
	const pass = this.bot.gameState.getPassabilityMap();
	const mask = this.bot.gameState.getPassabilityClassMask("building-land");
	const terr = this.bot.territoryMap;
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
			if (this.bot.armyManager.nearEnemy([x, z], 100, 60))
				continue;
			if (this.bot.accessibility.getAccessValue([x, z]) !== region)
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

PlacementManager.prototype.tryConstruct = function(templateType, kind, center, rush)
{
	// A full placement failure means a fine scan of every candidate ring came
	// up empty — expensive, and the obstruction it reports changes on
	// building-completion timescales. Retry at most every 25 turns.
	this.placeRetryAfter = this.placeRetryAfter || {};
	if (this.bot.turn < (this.placeRetryAfter[templateType] || 0))
		return false;
	const cc = this.bot.getCivicCentre();
	if (!cc)
		return false;
	const ccPos = cc.position();

	const region = this.bot.accessibility.getAccessValue(ccPos);
	// Only place in the CC's land region: a spot across a cliff or river sits unbuilt forever.
	let pos, houseSpot;
	if (kind === "house")
	{
		// Houses carry their own search (districts + spill levels); the generic
		// ring fallbacks below would bypass it.
		houseSpot = this.findHouseSpot(templateType);
		pos = houseSpot?.pos;
	}
	else if (kind === "dropsite")

		pos = this.findBuildingPosition(templateType, center || ccPos, 10, 28, true, region);
	else

		// Military production buildings need no central spot (unlike dropsites)
		// and the big ones (stable 25x25, arsenal 29x29, fortress) find no hole
		// in the crowded home rings late — the cav sweep logged 5-7 consecutive
		// stable placement failures on 4 of 10 seeds, and no stable at all on
		// one. Scan out to 200 m for them.
		pos = this.findBuildingPosition(templateType, center || ccPos, 10, kind === "military" ? 200 : 130, true, region);
	if (!pos && kind !== "dropsite" && kind !== "house")

		pos = this.findBuildingPosition(templateType, ccPos, 12, 120, true, region);
	// Big footprints (arsenal 29x29) find no hole in the crowded home ring and
	// otherwise retry silently forever — 43 of 56 timeouts in the 3af2b27
	// sweep never placed an arsenal, so no rams, so no raids. Fall back to the
	// expansion rings: an exposed arsenal beats a nonexistent one.
	if (!pos && kind !== "dropsite" && kind !== "house" && !center)
		for (const exp of this.expansionCivicCentres())
		{
			const ep = exp.position();
			pos = this.findBuildingPosition(templateType, ep, 10, 130, true, this.bot.accessibility.getAccessValue(ep));
			if (pos)
				break;
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
				print(`[WARNING] t=${Math.round(this.bot.gameState.getTimeElapsed() / 60000)}m no placement for ${templateType.split("/").pop()} at any CC — rings crowded or enemy too close\n`);
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

/** Built own CCs other than the home one, nearest to home first — fallback building lots for when the home ring is full. */
PlacementManager.prototype.expansionCivicCentres = function()
{
	const home = this.bot.getCivicCentre();
	if (!home)
		return [];
	const ccType = this.bot.gameState.applyCiv("structures/{civ}/civil_centre");
	const hp = home.position();
	const exps = [];
	for (const ent of this.bot.gameState.getOwnStructures().values())
		if (ent.templateName() === ccType && ent.id() !== home.id() &&
			ent.position() && ent.foundationProgress() === undefined)
			exps.push(ent);
	exps.sort((a, b) => SquareDistance(a.position(), hp) - SquareDistance(b.position(), hp));
	return exps;
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

/** House district inner radius (m): just outside the CC's 30 m obstruction; the passability gate polices the exact edge. */
PlacementManager.prototype.houseInnerR = 24;
/** House district outer radius (m): the safe-core annulus a house's location-independent pop bonus belongs in. */
PlacementManager.prototype.houseOuterR = 56;
/** Middle-ring outer bound (m): houses may spill past the district when it fills, at the price of field/dropsite land. */
PlacementManager.prototype.houseLatticeR = 96;
/** Last-resort outer bound (m): past the middle ring, only to keep pop growth from stalling, with a loud warning. */
PlacementManager.prototype.houseWildR = 150;
/** Farmstead exclusion disc radius (m): keeps houses off the farmstead and its doorstep. */
PlacementManager.prototype.houseFarmDiscR = 30;
/** Half-width (m) of the corridor from a CC to each dropsite: the district never seals base egress. */
PlacementManager.prototype.houseCorridorW = 8;

/**
 * House placement. A house's population bonus is location-independent, so it
 * takes the land no location-valued building can use well: a dense district
 * per CC in the safe core, nearest-first (depth is safety — a lost house eats
 * pop margin — and distance is pure cost: builder walk). Farmstead discs and
 * the CC-to-dropsite corridors are excluded. Spill levels when a district
 * fills: 0 = any CC's district annulus, 1 = the middle ring, 2 = the outer
 * ring (last resort). Level >= 1 means space is getting rare: recorded in
 * houseSpill for the relief-expansion check.
 */
PlacementManager.prototype.findHouseSpot = function(templateType)
{
	const gameState = this.bot.gameState;
	const template = gameState.getTemplate(templateType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const angle = this.getPlacementAngle();
	const pass = gameState.getPassabilityMap();
	const mask = gameState.getPassabilityClassMask("building-land");
	const terr = this.bot.territoryMap;

	const home = this.bot.getCivicCentre();
	if (!home)
		return undefined;
	const farmType = gameState.applyCiv("structures/{civ}/farmstead");
	const storeType = gameState.applyCiv("structures/{civ}/storehouse");
	const farmDiscs = [];
	const dropsites = [];
	for (const ent of gameState.getOwnStructures().values())
		if (ent.position())
		{
			if (ent.templateName() === farmType)
			{
				farmDiscs.push(ent.position());
				dropsites.push(ent.position());
			}
			else if (ent.templateName() === storeType)
				dropsites.push(ent.position());
		}
	for (const f of gameState.getOwnFoundations().values())
		if (f.position())
		{
			const built = gameState.getBuiltTemplate(f.templateName()).templateName();
			if (built === farmType)
			{
				farmDiscs.push(f.position());
				dropsites.push(f.position());
			}
			else if (built === storeType)
				dropsites.push(f.position());
		}

	const anchors = [home, ...this.expansionCivicCentres()];
	const rings = [
		[this.houseInnerR, this.houseOuterR, 0],
		[this.houseOuterR + 2, this.houseLatticeR, 1],
		[this.houseLatticeR + 2, this.houseWildR, 2]];
	for (const [r0, r1, level] of rings)
		for (const anchor of anchors)
		{
			const apos = anchor.position();
			const region = this.bot.accessibility.getAccessValue(apos);
			for (let r = r0; r <= r1; r += 2)
				for (let a = 0; a < 64; ++a)
				{
					const ang = a * 2 * Math.PI / 64;
					const x = apos[0] + r * Math.cos(ang);
					const z = apos[1] + r * Math.sin(ang);
					if (this.failedSpots.some(f => Math.abs(f[0] - x) < 6 && Math.abs(f[1] - z) < 6))
						continue;
					if (this.bot.armyManager.nearEnemy([x, z], 100, 60))
						continue;
					if (this.bot.accessibility.getAccessValue([x, z]) !== region)
						continue;
					if (farmDiscs.some(fp => Math.hypot(x - fp[0], z - fp[1]) < this.houseFarmDiscR))
						continue;
					if (dropsites.some(dp => distToSegment(x, z, apos[0], apos[1], dp[0], dp[1]) < this.houseCorridorW))
						continue;
					if (this.placementOK(x, z, halfW, halfD, angle, pass, mask, terr))
						return { "pos": [x, z], "level": level };
				}
		}
	return undefined;
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
			print(`[HARNESS] t=${(this.bot.gameState.getTimeElapsed() / 60000).toFixed(1)}m house spill level ${level} — districts are full, space is getting rare\n`);
		}
	}
	else
	{
		spill.streak = 0;
		spill.since = undefined;
	}
};

PlacementManager.prototype.findBuildingPosition = function(templateType, center, minRadius, maxRadius, fine, region, extraCheck)
{
	const gameState = this.bot.gameState;
	const template = gameState.getTemplate(templateType);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const angle = this.getPlacementAngle();
	const pass = gameState.getPassabilityMap();
	const mask = gameState.getPassabilityClassMask("building-land");
	const terr = this.bot.territoryMap;
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
			if (this.bot.armyManager.nearEnemy([x, z], 100, 60))
				continue;
			if (region !== undefined && this.bot.accessibility.getAccessValue([x, z]) !== region)
				continue;
			if (extraCheck && !extraCheck(x, z))
				continue;
			if (this.placementOK(x, z, halfW, halfD, angle, pass, mask, terr))
				return [x, z];
		}
	return undefined;
};

/** Placement prefilter: true rotated footprint (inflated 0.75 m) passable, territory box own. */
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
			if ((terr.data[i + j * terr.width] & 0x1F) !== this.bot.player)
				return false;
	return true;
};

/** Rejection forensics for the construct FAILED log (engine rejections are silent): whether the spot still passes our placement check, and who owns its territory cell now. */
PlacementManager.prototype.diagnoseFailedSpot = function(pb)
{
	const template = this.bot.gameState.getTemplate(pb.template);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const ok = this.placementOK(pb.x, pb.z, halfW, halfD, this.getPlacementAngle(),
		this.bot.gameState.getPassabilityMap(), this.bot.gameState.getPassabilityClassMask("building-land"),
		this.bot.territoryMap);
	const terr = this.bot.territoryMap;
	const cell = terr.cellSize;
	const owner = terr.data[Math.floor(pb.x / cell) + Math.floor(pb.z / cell) * terr.width] & 0x1F;
	return `(placementOK=${ok} terrOwner=${owner})`;
};
