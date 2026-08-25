/**
 * Louis bot.
 *
 * Current behavior: at the start of the game, find the food cluster closest
 * to the civic centre — a 20 m-radius circle containing at least 500 food —
 * and build a farmstead at the spot minimizing the sum of walking distances
 * to every food source in that cluster.
 *
 * Architecture: the module-level functions are pure. They take plain data
 * as arguments and return plain data; nothing reads `this`, nothing mutates
 * its inputs, nothing posts commands or prints. OnUpdate is the top of the
 * call stack: it reads the game state, feeds plain data down, and applies
 * the returned decisions (commands, state writes, logs).
 *
 * The `[HARNESS] louis-bot: loaded` banner is the headless smoke test's
 * canary.
 */
import { BaseAI } from "simulation/ai/common-api/baseAI.js";

/**
 * @param {object} settings — engine-provided player settings: { player,
 *   difficulty, behavior } (see the AI engine API docs).
 */
export function LouisBot(settings)
{
	BaseAI.call(this, settings);
}

LouisBot.prototype = Object.create(BaseAI.prototype);

// ------------------------------------------------------------- pure functions

/**
 * The player's civic centre among `structures`, or undefined.
 * @param {Iterable<Entity>} structures — own structures to scan.
 * @param {string} ccType — template name of the civic centre, e.g.
 *   "structures/gaul/civil_centre".
 * @returns {Entity|undefined}
 */
function findCivicCentre(structures, ccType)
{
	for (const ent of structures)
		if (ent.templateName() === ccType)
			return ent;
	return undefined;
}

/**
 * Food cluster: for every supply, take the supplies within 20 m of it;
 * candidate circles total at least 500 food, and the one whose centre is
 * closest to `ccPos` wins.
 * @param {Array<{pos: [number, number], food: number}>} supplies — food
 *   supplies with their positions and current amounts.
 * @param {[number, number]} ccPos — civic centre position.
 * @returns {{anchor: [number, number], food: number, bushes: number,
 *   median: [number, number]}|undefined}
 */
function findFarmCluster(supplies, ccPos)
{
	let best, bestDist = Infinity;
	for (const anchor of supplies)
	{
		const members = supplies.filter(s =>
			Math.hypot(s.pos[0] - anchor.pos[0], s.pos[1] - anchor.pos[1]) <= 20);
		const food = members.reduce((sum, s) => sum + s.food, 0);
		if (food < 500)
			continue;
		const dist = Math.hypot(anchor.pos[0] - ccPos[0], anchor.pos[1] - ccPos[1]);
		if (dist < bestDist)
		{
			bestDist = dist;
			best = {
				"anchor": anchor.pos,
				"food": food,
				"bushes": members.length,
				"median": geometricMedian(members.map(s => s.pos))
			};
		}
	}
	return best;
}

/**
 * Weiszfeld iteration: the point minimizing the sum of distances to
 * `points`. Deterministic; 50 iterations settle the typical handful of
 * bushes.
 * @param {Array<[number, number]>} points — positions to serve.
 * @returns {[number, number]} the geometric median.
 */
function geometricMedian(points)
{
	let x = 0, z = 0;
	for (const p of points)
	{
		x += p[0];
		z += p[1];
	}
	x /= points.length;
	z /= points.length;
	for (let i = 0; i < 50; ++i)
	{
		let sx = 0, sz = 0, sw = 0;
		for (const p of points)
		{
			const d = Math.max(0.01, Math.hypot(p[0] - x, p[1] - z));
			sx += p[0] / d;
			sz += p[1] / d;
			sw += 1 / d;
		}
		x = sx / sw;
		z = sz / sw;
	}
	return [x, z];
}

/**
 * Ids of the `count` candidates closest to `target`, nearest first.
 * @param {Array<{id: number, pos: [number, number]}>} candidates — units to
 *   rank.
 * @param {[number, number]} target — reference position.
 * @param {number} count — how many ids to return.
 * @returns {Array<number>} entity ids.
 */
function nearestIds(candidates, target, count)
{
	return candidates
		.map(c => ({ "id": c.id, "d2": (c.pos[0] - target[0]) * (c.pos[0] - target[0]) +
			(c.pos[1] - target[1]) * (c.pos[1] - target[1]) }))
		.sort((a, b) => a.d2 - b.d2)
		.slice(0, count)
		.map(c => c.id);
}

/**
 * Nearest buildable own-territory spot to `center` within `maxRadius`,
 * skipping `failedSpots`. Deterministic concentric-ring scan.
 * @param {{halfW: number, halfD: number, angle: number, pass: object,
 *   mask: number, terr: object, player: number}} placement — building half
 *   extents, placement angle, passability map, passability class mask,
 *   territory map and player id, all from the game state.
 * @param {[number, number]} center — ideal spot to search around.
 * @param {number} maxRadius — search distance from `center`, in meters.
 * @param {Array<[number, number]>} failedSpots — spots to skip.
 * @returns {[number, number]|undefined}
 */
function findPlacementSpot(placement, center, maxRadius, failedSpots)
{
	for (let r = 0; r <= maxRadius; r += 2)
		for (let a = 0; a < 64; ++a)
		{
			const ang = a * 2 * Math.PI / 64;
			const x = center[0] + r * Math.cos(ang);
			const z = center[1] + r * Math.sin(ang);
			if (failedSpots.some(f => Math.abs(f[0] - x) < 8 && Math.abs(f[1] - z) < 8))
				continue;
			if (placementOK(x, z, placement.halfW, placement.halfD, placement.angle,
				placement.pass, placement.mask, placement.terr, placement.player))
				return [x, z];
		}
	return undefined;
}

/**
 * Placement prefilter: true rotated footprint (inflated 0.75 m) passable,
 * territory box owned by the player.
 * @param {number} x, z — candidate position.
 * @param {number} halfW, halfD — building half width and half depth.
 * @param {number} angle — building rotation in radians.
 * @param {object} pass — passability map: { width, height, cellSize,
 *   data: Uint16Array }.
 * @param {number} mask — passability class bitmask to test (set bit means
 *   impassable).
 * @param {object} terr — territory map: { width, height, cellSize,
 *   data: Uint8Array }.
 * @param {number} player — player id that must own the territory box.
 * @returns {boolean}
 */
function placementOK(x, z, halfW, halfD, angle, pass, mask, terr, player)
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
			if ((terr.data[i + j * terr.width] & 0x1F) !== player)
				return false;
	return true;
}

// ----------------------------------------------------------- bot entry points

/**
 * Engine hook, called once at game start and again after a load. Restores
 * state from a saved game when present, else sets the fresh-game defaults.
 * @param {GameState} gameState — this player's game state.
 */
LouisBot.prototype.CustomInit = function(gameState)
{
	print(`[HARNESS] louis-bot: loaded for player ${this.player}\n`);

	// Restore on load (see Deserialize); fresh game gets the defaults.
	const saved = this.savedState || {};
	this.farmCluster = saved.farmCluster;   // {anchor, food, bushes, median} — false once computed and none found
	this.farmsteadBuilt = saved.farmsteadBuilt || false;
	this.foundationId = saved.foundationId; // farmstead foundation entity id
	this.builders = [];                     // unit ids tasked on the current foundation
	this.constructTurn = saved.constructTurn ?? -1;
	this.lastSpot = saved.lastSpot;
	this.failedSpots = saved.failedSpots || []; // build spots the engine rejected
	this.scanRadius = saved.scanRadius || 30;   // placement search radius around the median
	this.ccAngle = saved.ccAngle;
};

/**
 * Per-turn engine hook and the top of the call stack. Reads the game and
 * bot state, extracts plain data, calls the pure functions with it, and
 * applies the returned decisions: state writes, log prints, construct and
 * repair commands. No parameters.
 */
LouisBot.prototype.OnUpdate = function()
{
	if (this.gameState.playerData.state !== "active")
		return;

	if (this.farmsteadBuilt)
	{
		this.turn++;
		return;
	}

	const gameState = this.gameState;
	const farmType = gameState.applyCiv("structures/{civ}/farmstead");
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");

	// 1. Compute the food cluster once, lazily. Entities are complete on the
	// first update; CustomInit runs before the first turn.
	if (this.farmCluster === undefined)
	{
		const cc = findCivicCentre(gameState.getOwnStructures().values(), ccType);
		if (cc)
		{
			const supplies = gameState.getResourceSupplies("food").toEntityArray()
				.filter(s => s.position() && s.resourceSupplyAmount() > 0)
				.map(s => ({ "pos": s.position(), "food": s.resourceSupplyAmount() }));
			const cluster = findFarmCluster(supplies, cc.position());
			if (cluster)
			{
				this.farmCluster = cluster;
				print(`[HARNESS] louis-bot: food cluster ${cluster.bushes} bushes / ${Math.round(cluster.food)} food, anchor ${cluster.anchor[0].toFixed(0)},${cluster.anchor[1].toFixed(0)}, median ${cluster.median[0].toFixed(0)},${cluster.median[1].toFixed(0)}\n`);
			}
			else
			{
				this.farmCluster = false;
				print(`[HARNESS] louis-bot: no 20 m food cluster with >= 500 food found\n`);
			}
		}
	}

	if (!this.farmCluster)
	{
		this.turn++;
		return;
	}

	// 2. A farmstead foundation exists: feed it builders until built.
	if (this.foundationId !== undefined)
	{
		const foundation = gameState.getEntityById(this.foundationId);
		if (!foundation)
		{
			// Destroyed mid-construction: restart from the placement scan.
			this.foundationId = undefined;
			this.builders = [];
			this.constructTurn = -1;
		}
		else if (foundation.foundationProgress() === undefined)
		{
			this.farmsteadBuilt = true;
			this.builders = [];
			const pos = foundation.position();
			print(`[HARNESS] louis-bot: farmstead built at ${pos[0].toFixed(0)},${pos[1].toFixed(0)} for cluster of ${this.farmCluster.bushes} bushes (${Math.round(this.farmCluster.food)} food)\n`);
		}
		else
		{
			this.builders = this.builders.filter(id => gameState.getEntityById(id));
			const needed = 4 - this.builders.length;
			if (needed > 0)
			{
				const candidates = gameState.getOwnUnits().toEntityArray()
					.filter(ent => ent.isBuilder() && ent.position() && !this.builders.includes(ent.id()))
					.map(ent => ({ "id": ent.id(), "pos": ent.position() }));
				for (const id of nearestIds(candidates, foundation.position(), needed))
				{
					this.builders.push(id);
					gameState.getEntityById(id).repair(foundation);
				}
			}
		}
		this.turn++;
		return;
	}

	// 3. Find the foundation our construct order spawned (next turn).
	for (const ent of gameState.getOwnFoundations().values())
		if (gameState.getBuiltTemplate(ent.templateName()).templateName() === farmType)
		{
			this.foundationId = ent.id();
			this.turn++;
			return;
		}

	// 4. Order the construct.
	if (this.constructTurn === -1)
	{
		if (this.ccAngle === undefined)
		{
			const cc = findCivicCentre(gameState.getOwnStructures().values(), ccType);
			this.ccAngle = cc ? cc.angle() ?? 0 : 0;
		}
		const template = gameState.getTemplate(farmType);
		const placement = {
			"halfW": +template.get("Obstruction/Static/@width") / 2 + 0.5,
			"halfD": +template.get("Obstruction/Static/@depth") / 2 + 0.5,
			"angle": this.ccAngle,
			"pass": gameState.getPassabilityMap(),
			"mask": gameState.getPassabilityClassMask("building-land"),
			"terr": this.territoryMap,
			"player": this.player
		};
		const spot = findPlacementSpot(placement, this.farmCluster.median, this.scanRadius, this.failedSpots);
		if (spot && gameState.getResources().wood >= 100)
		{
			const candidates = gameState.getOwnUnits().toEntityArray()
				.filter(ent => ent.position())
				.map(ent => ({ "id": ent.id(), "pos": ent.position() }));
			const builderId = nearestIds(candidates, spot, 1)[0];
			const builder = builderId !== undefined && gameState.getEntityById(builderId);
			if (builder)
			{
				builder.construct(farmType, spot[0], spot[1], this.ccAngle, undefined);
				this.constructTurn = this.turn;
				this.lastSpot = spot;
				print(`[HARNESS] louis-bot: farmstead ordered at ${spot[0].toFixed(0)},${spot[1].toFixed(0)} (ideal ${this.farmCluster.median[0].toFixed(0)},${this.farmCluster.median[1].toFixed(0)})\n`);
			}
		}
		else if (!spot)
			this.scanRadius = Math.min(this.scanRadius + 20, 160);
	}
	else if (this.turn - this.constructTurn > 50)
	{
		// No foundation appeared: the command was rejected (territory or
		// passability). Poison the spot and rescan farther out.
		print(`[HARNESS] louis-bot: construct rejected at ${this.lastSpot[0].toFixed(0)},${this.lastSpot[1].toFixed(0)}\n`);
		this.failedSpots.push([this.lastSpot[0], this.lastSpot[1]]);
		if (this.failedSpots.length > 32)
			this.failedSpots.shift();
		this.constructTurn = -1;
		this.scanRadius = Math.min(this.scanRadius + 20, 160);
	}

	this.turn++;
};

/**
 * Engine hook: returns the bot state persisted in saved games. Plain
 * structured-cloneable data only, no live Entity references. No parameters.
 * @returns {object}
 */
LouisBot.prototype.Serialize = function()
{
	return {
		"farmCluster": this.farmCluster,
		"farmsteadBuilt": this.farmsteadBuilt,
		"foundationId": this.foundationId,
		"constructTurn": this.constructTurn,
		"lastSpot": this.lastSpot,
		"failedSpots": this.failedSpots,
		"scanRadius": this.scanRadius,
		"ccAngle": this.ccAngle
	};
};

/**
 * Engine hook on load: stashes the saved state; CustomInit restores it on
 * the first post-load Init.
 * @param {object} data — plain object returned by Serialize.
 * @param {SharedScript} sharedScript — the shared script instance.
 */
LouisBot.prototype.Deserialize = function(data, sharedScript)
{
	this.savedState = data || {};
	this.isDeserialized = true;
};
