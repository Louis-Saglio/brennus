import { BrennusBot } from "simulation/ai/brennus/brennus.js";
import { SquareDistance } from "simulation/ai/brennus/helpers.js";

// ---------------------------------------------------------------- placement
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
	// A full placement failure means a fine scan of every candidate ring came
	// up empty — expensive, and the obstruction it reports changes on
	// building-completion timescales. Retry at most every 25 turns.
	this.placeRetryAfter = this.placeRetryAfter || {};
	if (this.turn < (this.placeRetryAfter[templateType] || 0))
		return false;
	const cc = this.getCivicCentre();
	if (!cc)
		return false;
	const ccPos = cc.position();

	const region = this.accessibility.getAccessValue(ccPos);
	// Only place in the CC's land region: a spot across a cliff or river sits unbuilt forever.
	let pos;
	if (kind === "house")
		pos = this.findGridSpot(templateType, this.housePlots(ccPos), region);
	else if (kind === "field")
		pos = this.findGridSpot(templateType, this.fieldPlots(ccPos), region);
	else if (kind === "dropsite")

		pos = this.findBuildingPosition(templateType, center || ccPos, 10, 28, true, region);
	else

		// Military production buildings need no central spot (unlike dropsites)
		// and the big ones (stable 25x25, arsenal 29x29, fortress) find no hole
		// in the crowded home rings late — the cav sweep logged 5-7 consecutive
		// stable placement failures on 4 of 10 seeds, and no stable at all on
		// one. Scan out to 200 m for them.
		pos = this.findBuildingPosition(templateType, center || ccPos, 10, kind === "military" ? 200 : 130, true, region);
	if (!pos && kind !== "dropsite")

		pos = this.findBuildingPosition(templateType, ccPos, 12, 120, true, region);
	// Big footprints (arsenal 29x29) find no hole in the crowded home ring and
	// otherwise retry silently forever — 43 of 56 timeouts in the 3af2b27
	// sweep never placed an arsenal, so no rams, so no raids. Fall back to the
	// expansion rings: an exposed arsenal beats a nonexistent one.
	if (!pos && kind !== "dropsite" && !center)
		for (const exp of this.expansionCivicCentres())
		{
			const ep = exp.position();
			pos = this.findBuildingPosition(templateType, ep, 10, 130, true, this.accessibility.getAccessValue(ep));
			if (pos)
				break;
		}
	if (!pos)
	{
		if (kind !== "dropsite")
		{
			this.placeRetryAfter[templateType] = this.turn + 25;
			// Relief-expansion signal: a field failing to place is routine
			// (capped at 30 pre-expansion, rings simply full of fields — the
			// relief1 goldens all false-fired on it), and a house failing only
			// matters when the population is pinned at the limit and can never
			// grow. Anything else failing continuously is a stuck base.
			if (kind !== "field" &&
				(kind !== "house" || this.gameState.getPopulation() >= this.gameState.getPopulationLimit()))
				this.placeFailSince[templateType] = this.placeFailSince[templateType] || this.turn;
			else
				delete this.placeFailSince[templateType];
			this.placeFailLog = this.placeFailLog || {};
			if (this.turn - (this.placeFailLog[templateType] ?? -Infinity) >= 600)
			{
				this.placeFailLog[templateType] = this.turn;
				print(`[WARNING] t=${Math.round(this.gameState.getTimeElapsed() / 60000)}m no placement for ${templateType.split("/").pop()} at any CC — rings crowded or enemy too close\n`);
			}
		}
		return false;
	}
	if (this.placeOrder(templateType, pos, rush))
	{
		delete this.placeFailSince[templateType];
		return pos;
	}
	return false;
};

/** Built own CCs other than the home one, nearest to home first — fallback building lots for when the home ring is full. */
BrennusBot.prototype.expansionCivicCentres = function()
{
	const home = this.getCivicCentre();
	if (!home)
		return [];
	const ccType = this.gameState.applyCiv("structures/{civ}/civil_centre");
	const hp = home.position();
	const exps = [];
	for (const ent of this.gameState.getOwnStructures().values())
		if (ent.templateName() === ccType && ent.id() !== home.id() &&
			ent.position() && ent.foundationProgress() === undefined)
			exps.push(ent);
	exps.sort((a, b) => SquareDistance(a.position(), hp) - SquareDistance(b.position(), hp));
	return exps;
};

BrennusBot.prototype.placeOrder = function(templateType, pos, rush)
{
	const builder = this.gameState.getOwnUnits().filter(ent =>
		(!this.army || !this.army[ent.id()]) && (!this.rams || !this.rams[ent.id()]) &&
		(!this.healers || !this.healers[ent.id()])).filterNearest(pos, 1).toEntityArray()[0];
	if (!builder)
		return false;
	builder.construct(templateType, pos[0], pos[1], this.getPlacementAngle(), undefined);
	this.pendingBuilds.push({ "template": templateType, "x": pos[0], "z": pos[1], "turn": this.turn });
	if (rush)
		this.rushBuilds.push({ "x": pos[0], "z": pos[1], "turn": this.turn });
	return true;
};

/** All buildings share the CC's orientation angle (keeps the grids consistent). */
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
			if (this.nearEnemy([x, z], 100, 60))
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

/** Placement prefilter: true rotated footprint (inflated 0.75 m) passable, territory box own. */
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

/** Rejection forensics for the construct FAILED log (engine rejections are silent): whether the spot still passes our placement check, and who owns its territory cell now. */
BrennusBot.prototype.diagnoseFailedSpot = function(pb)
{
	const template = this.gameState.getTemplate(pb.template);
	const halfW = +template.get("Obstruction/Static/@width") / 2 + 0.5;
	const halfD = +template.get("Obstruction/Static/@depth") / 2 + 0.5;
	const ok = this.placementOK(pb.x, pb.z, halfW, halfD, this.getPlacementAngle(),
		this.gameState.getPassabilityMap(), this.gameState.getPassabilityClassMask("building-land"),
		this.territoryMap);
	const terr = this.territoryMap;
	const cell = terr.cellSize;
	const owner = terr.data[Math.floor(pb.x / cell) + Math.floor(pb.z / cell) * terr.width] & 0x1F;
	return `(placementOK=${ok} terrOwner=${owner})`;
};
