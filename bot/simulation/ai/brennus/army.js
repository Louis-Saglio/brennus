import { SquareDistance } from "simulation/ai/brennus/helpers.js";

export function ArmyManager(bot)
{
	this.bot = bot;
	// Unit rosters (entityID -> 1): standing army, siege, healers, and the
	// demobilized subset currently gathering (transient, reset on load).
	this.army = {};
	this.rams = {};
	this.healers = {};
	this.demobilized = {};
	// Enemy intel caches, refreshed each block by updateEnemyPositions.
	this.enemyStructuresPos = [];
	this.enemyMobilesPos = [];
	this.enemyArmy = undefined;
	this.enemySiege = undefined;
	this.enemyNearestHome = undefined;
	// First-contact telemetry threshold already logged.
	this.threatLogged = undefined;
	// Last block with an incoming threat (demobilization hysteresis).
	this.lastIncomingTurn = undefined;
}

ArmyManager.prototype.serialize = function()
{
	return {
		"army": this.army,
		"rams": this.rams,
		"healers": this.healers
	};
};

ArmyManager.prototype.deserialize = function(data)
{
	this.army = data?.army || {};
	this.rams = data?.rams || {};
	this.healers = data?.healers || {};
};

/**
 * Roster: drop the dead; once the defense stage is on, every Soldier joins
 * the army. Runs at the top of the defense dispatch.
 */
ArmyManager.prototype.maintainRoster = function(gameState)
{
	for (const id in this.army)
		if (!gameState.getEntityById(+id))
			delete this.army[id];
	for (const id in this.rams)
		if (!gameState.getEntityById(+id))
			delete this.rams[id];
	for (const id in this.healers)
		if (!gameState.getEntityById(+id))
			delete this.healers[id];
	const recalled = this.bot.defenseManager.recalled;
	for (const id in recalled)
		if (!this.army[id])
			delete recalled[id];
	if (this.bot.expansionManager.defenseOn())
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
				delete this.bot.economyManager.assignments[id];
				continue;
			}
			if (this.army[id] || !ent.hasClass("Soldier") || id === this.bot.economyManager.herderId)
				continue;
			this.army[id] = 1;
			delete this.bot.economyManager.assignments[id];
			if (ent.position())
				ent.setStance("defensive");
		}
};

// ---------------------------------------------------------------- threats
/** Threat lists refreshed each block; owner 0 is gaia — only animals with Attack count (every tree is "enemy"). */
ArmyManager.prototype.updateEnemyPositions = function()
{
	this.enemyStructuresPos = [];
	this.enemyMobilesPos = [];
	let army = 0, siege = 0, nearest = Infinity;
	const ccPos = this.bot.getCivicCentre()?.position();
	for (const ent of this.bot.gameState.getEnemyEntities().values())
	{
		if (ent.owner() === 0 && !(ent.hasClass("Animal") && ent.get("Attack")))
			continue;
		const pos = ent.position();
		if (!pos)
			continue;
		if (ent.hasClass("Structure"))
		{
			this.enemyStructuresPos.push(pos);
			continue;
		}
		this.enemyMobilesPos.push(pos);
		if (ent.owner() === 0)
			continue;
		if (ent.hasClass("Siege"))
			siege++;
		else if (ent.hasClass("Soldier"))
			army++;
		if (ccPos)
			nearest = Math.min(nearest, SquareDistance(pos, ccPos));
	}
	this.enemyArmy = army;
	this.enemySiege = siege;
	this.enemyNearestHome = Math.sqrt(nearest);

	// First-contact telemetry: log once per threshold crossing (tightening).
	for (const th of [400, 250, 150, 80])
		if (this.enemyNearestHome < th && (this.threatLogged === undefined || this.threatLogged > th))
		{
			this.threatLogged = th;
			print(`[THREAT] t=${(this.bot.gameState.getTimeElapsed() / 60000).toFixed(1)}m enemy army=${army} siege=${siege} nearest=${Math.sqrt(nearest).toFixed(0)}m from home CC\n`);
		}
};

ArmyManager.prototype.nearEnemy = function(pos, structureDist, mobileDist)
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

// ---------------------------------------------------------------- defense
// War-stage standing army size: popPartition.armyTarget in arbiterParams
// (the pop math lives with the parameter).

ArmyManager.prototype.armyCount = function()
{
	let n = 0;
	for (const id in this.army)
		n++;
	return n;
};

/**
 * Recovery-muster predicate (see manageDefenseTraining): the war-stage
 * muster floors assume an intact war economy; after a rout the women stream
 * and construction skim every accumulation below 300/400 and the army never
 * re-fields (s279/s316/s356/s373: zero soldiers trained for 12-22 min after
 * the wipe, then the lone CC fell). Hysteresis against boundary flapping:
 * enter below 40 while outnumbered, exit at 50+ or once the enemy is mostly
 * spent.
 */
ArmyManager.prototype.armyBroken = function()
{
	const n = this.armyCount();
	const enemy = this.enemyArmy || 0;
	const was = !!this.broken;
	if (!this.bot.expansionManager.warOn())
		this.broken = false;
	else if (was)
		this.broken = n < 50 && enemy * 2 > n;
	else
		this.broken = n < 40 && enemy > n;
	if (this.broken !== was)
		print(`[DEFENSE] t=${(this.bot.gameState.getTimeElapsed() / 60000).toFixed(1)}m recovery muster ${this.broken ? "on" : "off"} (army=${n} enemy=${enemy})\n`);
	return !!this.broken;
};

/**
 * Cavalry target choice: nearest Siege first — rams are the enemy's kill
 * clock, and their 35 pierce / 7 hack armor makes javelins useless while
 * sword cavalry's hack (plus gaul's +10% cavalry damage bonus) cuts
 * through; else nearest Ranged — the enemy back line folds once a melee
 * unit touches it, and cavalry's run speed gets it around the frontline.
 * Returns undefined when no preferred target exists: the caller falls back
 * to the shared order (attackMove / nearest foe) so cavalry still fights
 * as a normal soldier.
 */
ArmyManager.prototype.pickCavalryTarget = function(foes, pos)
{
	let siege, siegeDist, ranged, rangedDist;
	for (const foe of foes)
	{
		const d = SquareDistance(foe.position(), pos);
		if (foe.hasClass("Siege"))
		{
			if (siege === undefined || d < siegeDist)
			{
				siege = foe;
				siegeDist = d;
			}
		}
		else if (foe.hasClass("Ranged") && (ranged === undefined || d < rangedDist))
		{
			ranged = foe;
			rangedDist = d;
		}
	}
	return siege || ranged;
};

/**
 * Eject roster soldiers/healers from every own holder. Garrisoned units
 * have no position and drop out of armyEnts, so any consumer downstream of
 * the garrison order (swat, raid, purge, rally) silently runs at reduced
 * strength until they are unloaded. Only roster ids are unloaded — workers
 * belong to the shelter logic with its own enemy-proximity timer.
 */
ArmyManager.prototype.ejectArmyGarrisons = function(gameState)
{
	let hiding = false;
	for (const id in this.army)
	{
		const e = gameState.getEntityById(+id);
		if (e && !e.position())
		{
			hiding = true;
			break;
		}
	}
	if (!hiding)
		for (const id in this.healers)
		{
			const e = gameState.getEntityById(+id);
			if (e && !e.position())
			{
				hiding = true;
				break;
			}
		}
	if (!hiding)
		return 0;
	let n = 0;
	for (const ent of gameState.getOwnStructures().values())
		for (const gid of ent.garrisoned() || [])
			if (this.army[gid] || this.healers[gid])
			{
				ent.unload(gid);
				n++;
			}
	return n;
};

/**
 * Defense: the muster starts at the town phase — aggressive Petra's
 * first waves arrive around 15-17 min, long before the boom completes, and
 * starting defense only after city+300pop meant meeting a 90-unit army with
 * 4 soldiers (baseline: all 5 seeds defeated at 26-33 min). A standing army
 * mustered from town phase (barracks spearmen/javelineers, temple fanatics
 * after the boom), workers sheltering in garrisonable structures when
 * enemies are close, and the army blob sent to whichever CC has enemies
 * near it.
 */
/**
 * Working army: pre-war, every citizen-soldier gathers while no threat
 * looms — an idle soldier is a worker the economy doesn't have (b7fc612
 * losses: 15-26 soldiers stood idle 10+ min after each repelled raid while
 * the economy couldn't recover; demob gated on a DEAD civilian economy —
 * food<100 AND civFood<6 AND civWorkers<12 — never fired once). No standing
 * guard: a citizen-soldier is worth more working than watching, and the
 * shares assign him near home so the recall walk is seconds. Recall on any
 * enemy in a CC's 120 m ring, a serious assault, or 5+ soldiers/siege
 * within 250 m of home (waves telegraph at 250-400 m, 1-2 min before
 * contact). Demobilize only after 40 quiet turns so a border-flapping probe
 * can't churn orders (v1 lesson: 12-18 s demob/remob cycles flipped s57 to
 * a loss). Demobilized soldiers stay in the army roster (armyCount stays
 * honest for the muster math) but are skipped by armyEnts and treated as
 * workers by assignGatherers and the shelter logic. War stage never
 * demobilizes: the army has real jobs there (raid/purge/deny/sortie/rally).
 */
ArmyManager.prototype.manageDemobilization = function(gameState, incoming)
{
	for (const id in this.demobilized)
		if (!this.army[id] || !gameState.getEntityById(+id))
			delete this.demobilized[id];

	if (incoming)
		this.lastIncomingTurn = this.bot.turn;

	if (incoming || this.bot.expansionManager.warOn() || !this.bot.expansionManager.defenseOn())
	{
		const home = this.bot.getCivicCentre()?.position();
		let n = 0;
		for (const id in this.demobilized)
		{
			const ent = gameState.getEntityById(+id);
			if (ent?.position())
			{
				// Converge on the CC rather than freezing mid-field: a
				// recalled farmer who stops at his field walks into the blob
				// alone (val-s30: recall at 249 m, cavalry-led contact 15 s
				// later, 57 -> 17). When the threat is already in the ring
				// the defense branch overrides this move in the same block.
				if (home)
					ent.move(home[0], home[1]);
				else
					ent.stopMoving();
			}
			delete this.bot.economyManager.assignments[id];
			delete this.demobilized[id];
			n++;
		}
		if (n)
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m remobilizing ${n} soldiers\n`);
		return;
	}
	if (this.bot.turn - (this.lastIncomingTurn ?? -10000) < 40)
		return;
	let added = 0;
	for (const id in this.army)
	{
		if (this.demobilized[id])
			continue;
		const ent = gameState.getEntityById(+id);
		// Cavalry never demobilizes: it only gathers meat, and the war
		// machine trained it to fight, not to herd.
		if (!ent?.position() || !ent.isGatherer() || ent.hasClass("Cavalry"))
			continue;
		this.demobilized[id] = 1;
		delete this.bot.economyManager.assignments[id];
		ent.stopMoving();
		added++;
	}
	if (added)
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m demobilizing ${added} soldiers to gathering\n`);
};
