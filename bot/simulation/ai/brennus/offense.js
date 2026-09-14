import { SquareDistance } from "simulation/ai/brennus/helpers.js";

export function OffenseManager(bot)
{
	this.bot = bot;
	// Active raid on an enemy CC: {id, x, z, turn, ramless?, focusId?, contestN?, ...}.
	this.target = undefined;
	// Active purge of a border military structure: {id, x, z, turn, name}.
	this.purgeTarget = undefined;
	// Active clearing op on a contested expansion spot: {x, z, key, turn, proven?, arrivedTurn?, everArrived?}.
	this.clearOp = undefined;
	// Per-spot clearing relaunch cooldown after an abort or give-up (key -> turn).
	this.clearCool = {};
	// Structures our ops just flipped to us (id -> turn captured);
	// manageCaptures decides hold or delete before they drift back.
	this.captures = {};
	// Stuck-ram watchdog for the current march (id -> {x, z, still, nudges}); reset at each raid launch.
	this.ramMarch = undefined;
	// Print latches: one stuck / give-up line per 30 m corridor spot.
	this.ramStuckSpots = undefined;
	this.ramGaveUpSpots = undefined;
	// Throttle turn for the blocked-launch forensics line.
	this.clearBlockedLog = undefined;
}

OffenseManager.prototype.serialize = function()
{
	return {
		"clearOp": this.clearOp,
		"clearCool": this.clearCool,
		"captures": this.captures
	};
};

OffenseManager.prototype.deserialize = function(data)
{
	this.clearOp = data?.clearOp;
	this.clearCool = data?.clearCool || {};
	this.captures = data?.captures || {};
};

/**
 * Register a just-flipped op target for the hold-or-delete sweep. The ops
 * call this on their flip paths; the defense full-recall cancel drops op
 * targets without looking at them and is the one path that would otherwise
 * lose a capture silently (s12: CC flipped under the raid, the recall
 * dropped the target, and the capture never reached the sweep).
 */
OffenseManager.prototype.registerIfCaptured = function(gameState, id)
{
	if (id === undefined)
		return;
	const ent = gameState.getEntityById(id);
	if (ent?.owner() === this.bot.player)
		this.captures[id] = this.bot.turn;
};

/**
 * Capture-or-raze verdict for one structure: Petra's cost-benefit rule
 * (petra/entityExtend.js allowCapture) lifted from one unit to the whole
 * army. Capture when our aggregate capture strength — amplified as the
 * target's hp drops (up to x10 near death, helpers/Attack.js) — beats its
 * regen (base + each garrisoned unit's capture strength x
 * GarrisonRegenRate, minus territory decay when the target is drifting)
 * plus a margin over the capture-point total. The margin is stricter under
 * defensive fire with a garrison (capturing into arrows costs bodies).
 * Capture ignores structure armor — no template has Capture resistance —
 * which is why infantry takes towers it cannot dent. No perimeter modeling:
 * the ops re-decide every command block and own their abort clocks.
 */
OffenseManager.prototype.shouldCapture = function(target, armyEnts)
{
	if (!target.isCapturable())
		return false;
	// The Capture attack's RestrictedClasses: units can never capture these,
	// no matter the verdict (they still decay territorially).
	if (target.hasClass("Field") || target.hasClass("Palisade") || target.hasClass("Wall"))
		return false;
	let strength = 0;
	for (const ent of armyEnts)
		strength += ent.captureStrength() || 0;
	if (!strength)
		return false;
	strength /= 0.1 + 0.9 * target.healthLevel();
	let antiCapture = target.defaultRegenRate();
	let garrisonN = 0;
	if (target.isGarrisonHolder())
	{
		const garrisonRegenRate = target.garrisonRegenRate();
		for (const gid of target.garrisoned() || [])
		{
			garrisonN++;
			antiCapture += garrisonRegenRate * (this.bot.gameState.getEntityById(gid)?.captureStrength() || 0);
		}
	}
	if (target.decaying())
		antiCapture -= target.territoryDecayRate();
	let cpTotal = 0;
	for (const cp of target.capturePoints() || [])
		cpTotal += cp;
	const margin = target.hasDefensiveFire() && garrisonN ? 50 : 80;
	return strength > antiCapture + cpTotal / margin;
};

/**
 * Freshly captured structures: hold or delete before they drift back.
 * Outside our connected territory, decay drains our capture pool at 20 cp/s
 * (40 for fortresses) toward the connected owner; only the CC (30/s regen)
 * and the fortress (45/s) out-regen it, and rome army camps and military
 * docks never decay at all (TerritoryDecay disabled). Anything else left
 * alone flips back inside a minute — a tower holds 25 s — so delete it
 * while our pool is above the engine's 50% deletion threshold: the purge's
 * point was denying the structure, not gifting it back. Runs in the
 * defense dispatch so it also fires between ops.
 */
OffenseManager.prototype.manageCaptures = function(gameState)
{
	for (const id in this.captures)
	{
		const ent = gameState.getEntityById(+id);
		if (!ent || ent.owner() !== this.bot.player)
		{
			if (ent)
				print(`[CAPTURE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m lost the captured structure at ${ent.position()[0].toFixed(0)},${ent.position()[1].toFixed(0)} back to the enemy\n`);
			delete this.captures[id];
			continue;
		}
		if (!ent.decaying() || ent.defaultRegenRate() >= ent.territoryDecayRate())
		{
			print(`[CAPTURE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m holding captured ${ent.templateName().split("/").pop()} at ${ent.position()[0].toFixed(0)},${ent.position()[1].toFixed(0)}\n`);
			delete this.captures[id];
			continue;
		}
		const cp = ent.capturePoints() || [];
		let total = 0;
		for (const c of cp)
			total += c;
		if ((cp[this.bot.player] || 0) * 2 >= total)
		{
			print(`[CAPTURE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m deleting captured ${ent.templateName().split("/").pop()} at ${ent.position()[0].toFixed(0)},${ent.position()[1].toFixed(0)} — decays back to the enemy, denying it\n`);
			ent.destroy();
		}
		delete this.captures[id];
	}
};

/**
 * Offense: with no serious threat at home and a strong army, take the
 * least defended enemy CC — captured when the army's capture strength beats
 * its regen (shouldCapture), razed by the rams otherwise. Enemy CCs claim
 * the spots our expansion plan needs (200 m rule) and their territory caps
 * our map control. Raid at 75+ soldiers with at least 2 rams ready even
 * though infantry capture alone could flip the CC: the blob standing at
 * the walls needs the rams' hp grind (it multiplies capture up to x10) and
 * their armor tanking the arrows (60-strong raids bounced off 19-37
 * defenders + CC arrows in agg11 s3); retreat and regroup below 50.
 * The last enemy CC is taken too — under conquest_civic_centers
 * eliminating Petra is the win condition. Returns true while a raid is
 * commanded.
 */
OffenseManager.prototype.raid = function(gameState, armyEnts, healerEnts, mil, homePos)
{
	if (!this.bot.expansionManager.warOn() || !armyEnts.length)
		return false;

	const ramEnts = [];
	for (const id in this.bot.armyManager.rams)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			ramEnts.push(ent);
	}
	// A ram costs 3 pop; popUsed already counts training reservations. At the
	// cap the siege the raid gate waits for can never train, so the gate would
	// never open — raid regardless instead of deadlocking at full pop.
	const ramBlocked = gameState.getPopulationLimit() - gameState.getPopulation() < 3;
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

	// Raze every enemy CC, including the last — under
	// conquest_civic_centers eliminating Petra wins the match.
	const enemyCCs = [];
	for (const ent of gameState.getEnemyStructures().values())
		if (ent.hasClass("CivCentre") && ent.position() &&
			ent.foundationProgress() === undefined)
			enemyCCs.push(ent);

	if (this.target)
	{
		const target = gameState.getEntityById(this.target.id);
		// owner() === us: the infantry captured the CC under the rams' grind —
		// same win as a raze, and the building is ours to boot.
		if (!target || !target.position() || target.owner() === this.bot.player)
		{
			if (target?.owner() === this.bot.player)
			{
				this.captures[this.target.id] = this.bot.turn;
				print(`[CAPTURE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m captured enemy CC at ${this.target.x.toFixed(0)},${this.target.z.toFixed(0)}\n`);
			}
			else
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m razed enemy CC at ${this.target.x.toFixed(0)},${this.target.z.toFixed(0)}\n`);
			this.target = undefined;
			this.bot.defenseManager.armyCmdTurn = 0;	// rally home next block
			for (const ent of armyEnts)
				ent.setStance("defensive");
			sendRamsHome();
			sendHealersHome();
		}
		else if ((ramEnts.length < 1 && !ramBlocked && !this.target.ramless && !this.shouldCapture(target, armyEnts)) || this.bot.turn - (this.target.turn || 0) > 1800)
		{
			// Abort a stalled raid: no rams left means nobody razes the CC —
			// the infantry just dies under its arrows while Petra reinforces
			// (agg7 s1: one raid ground on for 12+ min at full army) — unless
			// the army's capture strength can still flip it (shouldCapture),
			// or the raid was launched pop-blocked — then it is the deadlock
			// break and its losses reopen ram pop. The age cap is 6 min, not
			// 2: the walk alone to a far CC takes ~2 min, and
			// agg8 s1 abort/relaunched twice at the 2-min mark — the army walked
			// home and back each time and the second CC never even got attacked.
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raid aborted at ${this.target.x.toFixed(0)},${this.target.z.toFixed(0)} (rams=${ramEnts.length}, age=${((this.bot.turn - (this.target.turn || 0)) / 300).toFixed(1)}m, army=${armyEnts.length})\n`);
			this.target = undefined;
			this.bot.defenseManager.armyCmdTurn = 0;
			for (const ent of armyEnts)
				ent.setStance("defensive");
			sendRamsHome();
			sendHealersHome();
			return false;
		}
		else if (ramEnts.length < 1 && !this.target.ramless && !this.target.capWaive &&
			this.shouldCapture(target, armyEnts))
		{
			// The rams died but the capture race is still won — say once why
			// this ramless raid keeps going.
			this.target.capWaive = true;
			print(`[CAPTURE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m rams lost at ${this.target.x.toFixed(0)},${this.target.z.toFixed(0)} — finishing the CC by capture (army=${armyEnts.length})\n`);
		}
	}
	if (!this.target)
	{
		if (this.bot.armyManager.armyCount() < 75)
			return false;
		// No rams, no raze: basic infantry cannot burn a garrisoned CC before
		// reinforcements arrive — agg6 s2 raided with 0 rams at 20-21m and
		// spent the army twice for nothing (the "arsenal not built yet"
		// exception let those raids fire). Except when pop-blocked: the siege
		// can never train then, so waiting deadlocks the war stage at full
		// pop — the raid goes in ramless and its losses reopen ram pop.
		if (ramEnts.length < 2 && !ramBlocked)
			return false;
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
		this.target = { "id": best.id(), "x": bp[0], "z": bp[1], "turn": this.bot.turn,
			// Latch the pop-block waiver: pop flickers across the 3-pop
			// line as the raid trades losses, and re-checking ramBlocked
			// per block abort/relaunches the raid every few seconds.
			"ramless": ramBlocked && ramEnts.length < 2 ? true : undefined };
		this.ramMarch = {};	// fresh stuck-ram tracking for the new march
		this.purgeTarget = undefined;	// the raid takes precedence over any purge
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raiding enemy CC ${bp[0].toFixed(0)},${bp[1].toFixed(0)} (defenders=${Math.floor(bestScore / 10000)}, army=${armyEnts.length}, rams=${ramEnts.length}${this.target.ramless ? ", no pop room for rams" : ""})\n`);
		for (const ent of armyEnts)
			ent.setStance("aggressive");
	}
	if (this.bot.armyManager.armyCount() < 50)
	{
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raid spent, regrouping (army=${armyEnts.length})\n`);
		this.target = undefined;
		this.bot.defenseManager.armyCmdTurn = 0;
		for (const ent of armyEnts)
			ent.setStance("defensive");
		sendRamsHome();
		sendHealersHome();
		return false;
	}
	if (this.bot.turn < this.bot.defenseManager.armyCmdTurn)
		return true;
	this.bot.defenseManager.armyCmdTurn = this.bot.turn + 10;
	// Contest: enemy units within 100 m of the target. While any stand there,
	// soldiers clear them instead of grinding the structure — raids that
	// ignore defenders melt under their fire (replay review s50/51/52). Rams
	// keep battering regardless: they are the razors, and their armor shrugs
	// the arrows the infantry was eating. Gaia predators are not a contest.
	const foes = [];
	for (const ent of gameState.getEnemyUnits().values())
	{
		if (ent.owner() === 0)
			continue;
		const pos = ent.position();
		if (pos && SquareDistance(pos, [this.target.x, this.target.z]) < 100 * 100)
			foes.push(ent);
	}
	// Contested-building alarm: fire whenever soldiers are ordered onto the
	// structure while enemy units stand nearby (once per episode, then once
	// per reinforcement wave, +15 since the last warning). The contest
	// transitions themselves are telemetry (throttled: a scout dancing at
	// the 100 m edge must not spam a line per block).
	if (foes.length !== (this.target.contestN || 0) &&
		this.bot.turn - (this.target.contestLogTurn || -30) >= 30)
	{
		this.target.contestLogTurn = this.bot.turn;
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m raid ${foes.length ? `contested: engaging ${foes.length} enemy unit(s) around the CC, rams keep battering` : "contest cleared: grinding the CC"} (army=${armyEnts.length}, rams=${ramEnts.length})\n`);
	}
	this.target.contestN = foes.length;
	// Capture or raze: one verdict per command block — the whole army's
	// capture strength against the CC's regen and garrison (shouldCapture).
	const capEnt = gameState.getEntityById(this.target.id);
	const cap = capEnt ? this.shouldCapture(capEnt, armyEnts) : false;
	let attackers = 0;
	for (const ent of armyEnts)
	{
		if (SquareDistance(ent.position(), [this.target.x, this.target.z]) >= 60 * 60)
		{
			ent.attackMove(this.target.x, this.target.z, "Unit", false);
			continue;
		}
		if (foes.length)
		{
			// Cavalry flanks: siege first, then the ranged back line — its run
			// speed carries it around the melee frontline that pins the
			// infantry. Nearest-foe remains the fallback.
			if (ent.hasClass("Cavalry"))
			{
				const cavTarget = this.bot.armyManager.pickCavalryTarget(foes, ent.position());
				if (cavTarget)
				{
					ent.attack(cavTarget.id(), false);
					continue;
				}
			}
			let best, bestDist;
			for (const foe of foes)
			{
				const d = SquareDistance(foe.position(), ent.position());
				if (best === undefined || d < bestDist)
				{
					best = foe;
					bestDist = d;
				}
			}
			ent.attack(best.id(), false);
			continue;
		}
		ent.attack(this.target.id, cap);
		attackers++;
	}
	if (attackers >= 1 && foes.length >= 1 &&
		(this.target.warned === undefined || foes.length >= this.target.warned + 15))
	{
		this.target.warned = foes.length;
		print(`[WARNING] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m attacking enemy CC at ${this.target.x.toFixed(0)},${this.target.z.toFixed(0)} with ${foes.length} enemy unit(s) nearby (army=${armyEnts.length}, rams=${ramEnts.length})\n`);
	}
	// Rams raze by priority — fortress, then the CC, then towers — one shared
	// focus so the siege train converges, picked only inside the army's 60 m
	// bubble so the rams never wander out from under the escort.
	if (this.target.focusId !== undefined)
	{
		const focus = gameState.getEntityById(this.target.focusId);
		if (!focus || !focus.position() || focus.owner() === this.bot.player)
			this.target.focusId = undefined;
	}
	if (this.target.focusId === undefined)
	{
		const focus = this.pickRamFocus(gameState);
		this.target.focusId = focus ? focus.id() : this.target.id;
		if (focus && focus.id() !== this.target.id)
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m rams focusing ${focus.templateName().split("/").pop()} at ${focus.position()[0].toFixed(0)},${focus.position()[1].toFixed(0)}\n`);
	}
	for (const ram of ramEnts)
	{
		if (SquareDistance(ram.position(), [this.target.x, this.target.z]) < 50 * 50)
			ram.attack(this.target.focusId, false);
		else
			ram.attackMove(this.target.x, this.target.z, this.ramMarchFilter, false);
		this.trackRamMarch(ram, gameState);
	}
	for (const ent of healerEnts)
		ent.move(this.target.x, this.target.z);
	return true;
};

/**
 * The raid's shared ram target: the highest-priority enemy structure inside
 * the army's bubble around the raid target — built fortress first, then the
 * CC, then towers/army camps, foundations of those last; ties break nearest
 * the raid target. Returns undefined when nothing but the raid CC is there.
 */
OffenseManager.prototype.pickRamFocus = function(gameState)
{
	const center = [this.target.x, this.target.z];
	const tierOf = ent => {
		if (ent.hasClass("Fortress"))
			return 0;
		if (ent.hasClass("CivCentre"))
			return 1;
		if (ent.hasClass("Tower") || ent.hasClass("ArmyCamp"))
			return 2;
		return -1;
	};
	let best, bestScore;
	for (const ent of gameState.getEnemyStructures().values())
	{
		const pos = ent.position();
		if (!pos || SquareDistance(pos, center) > 60 * 60)
			continue;
		let tier = tierOf(ent);
		if (tier < 0)
			continue;
		if (ent.foundationProgress() !== undefined)
			tier += 3;
		const score = tier * 100000 + SquareDistance(pos, center);
		if (best === undefined || score < bestScore)
		{
			best = ent;
			bestScore = score;
		}
	}
	return best;
};

/**
 * En-route target filter for ram marches: military structures, walls and
 * gates only — Louis's review had rams grinding houses they passed instead
 * of the fortress/CC/towers. Walls and gates stay attackable or a walled
 * base becomes unreachable. Engine fact: attackMove's targetClasses must be
 * an { "attack": ... } object — the plain "Structure" string used before
 * has no .attack key and filtered NOTHING (UnitAI.js attackfilter).
 */
OffenseManager.prototype.ramMarchFilter = { "attack": "Fortress CivCentre Tower WallTower ArmyCamp Wall Gate" };

/**
 * Stuck-ram watchdog for the raid march, run per command block. A ram
 * walking at 7.2 m/s covers ~14 m per block; one that moves < 6 m over 3
 * blocks while still far from the target is wedged on an obstruction (its
 * 8x12 footprint does not fit forest gaps — s50's four raids ground down
 * with rams that never arrived). Fighting rams (COMBAT state, e.g. battering
 * a structure the attackMove met en route) reset the counter. A wedged ram
 * gets a direct attack order (re-paths to the target's edge), then a 40 m
 * hop toward the target, then is left alone — the raid age cap owns the rest.
 */
OffenseManager.prototype.trackRamMarch = function(ram, gameState)
{
	const rp = ram.position();
	const distT = Math.hypot(rp[0] - this.target.x, rp[1] - this.target.z);
	const id = ram.id();
	if (!this.ramMarch[id])
	{
		this.ramMarch[id] = { "x": rp[0], "z": rp[1], "still": 0, "nudges": 0 };
		return;
	}
	const tr = this.ramMarch[id];
	const moved = Math.hypot(rp[0] - tr.x, rp[1] - tr.z);
	tr.x = rp[0];
	tr.z = rp[1];
	if (distT <= 60 || moved >= 6)
	{
		tr.still = 0;
		// 99 (given up) survives movement defensively: a wedged ram never
		// moves >= 6 m between blocks anyway (the hop re-wedges it within
		// meters — val-1 and warn-3 ran bit-identical), so this latch only
		// matters if a corridor later opens up mid-raid.
		if (distT <= 60 || tr.nudges !== 99)
			tr.nudges = 0;
		return;
	}
	const state = ram.unitAIState()?.split(".")[1];
	if (state === "WALKING" || state === "WALKINGANDFIGHTING" || state === "IDLE")
		tr.still++;
	else
		tr.still = 0;
	if (tr.still < 3 || tr.nudges === 99)
		return;
	// Print latch per corridor, not per ram: wedged rams pile up at the same
	// forest gap (s5: 6+ rams along one corridor, 46 log lines) and each new
	// raid re-detects them — one stuck line and one give-up line per 30 m
	// spot tells the whole story.
	if (tr.nudges === 0 && !(this.ramStuckSpots || []).some(p => SquareDistance(p, rp) < 30 * 30))
	{
		(this.ramStuckSpots = this.ramStuckSpots || []).push([rp[0], rp[1]]);
		print(`[WARNING] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m ram stuck at ${rp[0].toFixed(0)},${rp[1].toFixed(0)} — ${distT.toFixed(0)}m from the raid target at ${this.target.x.toFixed(0)},${this.target.z.toFixed(0)} (wedged on an obstruction, nudging)\n`);
	}
	if (tr.nudges < 2)
		ram.attack(this.target.id, false);
	else if (tr.nudges === 2)
	{
		const dx = this.target.x - rp[0], dz = this.target.z - rp[1];
		const n = Math.hypot(dx, dz) || 1;
		ram.move(rp[0] + dx / n * 40, rp[1] + dz / n * 40);
	}
	else
	{
		if (!(this.ramGaveUpSpots || []).some(p => SquareDistance(p, rp) < 30 * 30))
		{
			(this.ramGaveUpSpots = this.ramGaveUpSpots || []).push([rp[0], rp[1]]);
			print(`[WARNING] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m ram irrecoverably stuck at ${rp[0].toFixed(0)},${rp[1].toFixed(0)} — raid continues without it\n`);
		}
		tr.nudges = 99;
		return;
	}
	tr.still = 0;
	tr.nudges++;
};

/**
 * Purge: with no raid on, raze the enemy military structures sitting at our
 * border — forward towers, fortresses, army camps (Rome builds those in OUR
 * territory; they train units and rams at our doorstep). They shrink our
 * territory, stale the expansion spots (the planner only avoids them) and
 * farm the nearby economy, and outside a CC raid the army otherwise never
 * touches a structure (s109: lone forward towers stood all game). "Border"
 * means within 150 m of an own structure or 130 m of a planned expansion
 * spot. Foundations are the denial's job, not the purge's. A built fortress
 * is a purge target only with rams on the field — without siege, infantry
 * capture cannot beat its 8x capture points at 45 cp/s regen and the army
 * just bleeds against it (0cae013 s57); towers and army camps fall to
 * infantry capture (its damage bounces off structure armor — towers: hack
 * 29). War-stage only, like the sortie: pre-war the muster IS the defense.
 * Gates sit below the raid's (60 not 75) but the donation rule stands: 1.5x
 * local superiority or stay home. Returns true while a purge is commanded.
 */
OffenseManager.prototype.purge = function(gameState, armyEnts, healerEnts, mil, homePos)
{
	if (!this.bot.expansionManager.warOn() || !armyEnts.length || !homePos)
		return false;

	const ramEnts = [];
	for (const id in this.bot.armyManager.rams)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			ramEnts.push(ent);
	}
	const standDown = () => {
		this.purgeTarget = undefined;
		this.bot.defenseManager.armyCmdTurn = 0;	// rally home next block
		for (const ent of armyEnts)
			ent.setStance("defensive");
		for (const ram of ramEnts)
			ram.move(homePos[0], homePos[1]);
		for (const ent of healerEnts)
			ent.move(homePos[0], homePos[1]);
	};

	if (this.purgeTarget)
	{
		const target = gameState.getEntityById(this.purgeTarget.id);
		// owner() === us: a captured structure flips mid-purge — that is a win,
		// not a reason to keep attacking it. manageCaptures owns it from here.
		if (!target || !target.position() || target.owner() === this.bot.player)
		{
			if (target?.owner() === this.bot.player)
			{
				this.captures[this.purgeTarget.id] = this.bot.turn;
				print(`[CAPTURE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m captured enemy ${this.purgeTarget.name} at ${this.purgeTarget.x.toFixed(0)},${this.purgeTarget.z.toFixed(0)}\n`);
			}
			else
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m purged enemy structure at ${this.purgeTarget.x.toFixed(0)},${this.purgeTarget.z.toFixed(0)}\n`);
			standDown();
			return false;
		}
		if (this.bot.armyManager.armyCount() < 40 || this.bot.turn - this.purgeTarget.turn > 900 ||
			(target.hasClass("Fortress") && ramEnts.length < 1))
		{
			// Purge targets sit near home by construction, so 3 min (not the
			// raid's 6) caps a stalled one. A fortress whose rams died
			// mid-purge is abandoned too — without siege the army just bleeds
			// against it.
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m purge aborted at ${this.purgeTarget.x.toFixed(0)},${this.purgeTarget.z.toFixed(0)} (age=${((this.bot.turn - this.purgeTarget.turn) / 300).toFixed(1)}m, army=${armyEnts.length}, rams=${ramEnts.length})\n`);
			standDown();
			return false;
		}
	}
	if (!this.purgeTarget)
	{
		if (this.bot.armyManager.armyCount() < 60)
			return false;
		// Their main force loitering near home pins the army: the camp sortie
		// and the rally own it then, not a march to the border.
		let campN = 0;
		for (const p of mil)
			if (SquareDistance(p, homePos) < 220 * 220)
				campN++;
		if (campN >= 15)
			return false;
		const spots = this.bot.expansionManager.expPlan?.spots || [];
		let best, bestScore, bestDef;
		for (const ent of gameState.getEnemyStructures().values())
		{
			const pos = ent.position();
			if (!pos)
				continue;
			if (ent.foundationProgress() !== undefined)
				continue;	// foundations are the denial's job
			if (!ent.hasClass("Tower") && !ent.hasClass("Fortress") && !ent.hasClass("ArmyCamp"))
				continue;
			// A built fortress without rams is not a target: 5200 hp and 8x
			// capture points at 45 cp/s regen make the infantry grind a
			// donation (0cae013 s57).
			if (ent.hasClass("Fortress") && ramEnts.length < 1)
				continue;
			let near = false;
			for (const own of gameState.getOwnStructures().values())
				if (own.position() && SquareDistance(own.position(), pos) < 150 * 150)
				{
					near = true;
					break;
				}
			if (!near)
				for (const spot of spots)
					if (SquareDistance(spot, pos) < 130 * 130)
					{
						near = true;
						break;
					}
			if (!near)
				continue;
			let defenders = 0;
			for (const p of mil)
				if (SquareDistance(p, pos) < 100 * 100)
					defenders++;
			const score = defenders * 10000 + SquareDistance(pos, homePos);
			if (best === undefined || score < bestScore)
			{
				best = ent;
				bestScore = score;
				bestDef = defenders;
			}
		}
		if (!best || this.bot.armyManager.armyCount() < bestDef * 1.5)
			return false;
		const bp = best.position();
		this.purgeTarget = { "id": best.id(), "x": bp[0], "z": bp[1], "turn": this.bot.turn, "name": best.templateName() };
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m purging enemy ${best.templateName()} ${bp[0].toFixed(0)},${bp[1].toFixed(0)} (defenders=${bestDef}, army=${armyEnts.length}, rams=${ramEnts.length})\n`);
		for (const ent of armyEnts)
			ent.setStance("aggressive");
	}
	if (this.bot.turn < this.bot.defenseManager.armyCmdTurn)
		return true;
	this.bot.defenseManager.armyCmdTurn = this.bot.turn + 10;
	// Same contest rule as the raid: while enemy units stand within 100 m of
	// the target, soldiers clear them instead of grinding the structure —
	// 1.5x superiority was measured at launch, reinforcements are the
	// surprise. Rams keep battering regardless.
	const purgeFoes = [];
	for (const ent of gameState.getEnemyUnits().values())
	{
		if (ent.owner() === 0)
			continue;
		const pos = ent.position();
		if (pos && SquareDistance(pos, [this.purgeTarget.x, this.purgeTarget.z]) < 100 * 100)
			purgeFoes.push(ent);
	}
	// Contested-building alarm: fire whenever soldiers are ordered onto the
	// structure while enemy units stand nearby. Contest transitions are
	// telemetry, throttled like the raid's.
	if (purgeFoes.length !== (this.purgeTarget.contestN || 0) &&
		this.bot.turn - (this.purgeTarget.contestLogTurn || -30) >= 30)
	{
		this.purgeTarget.contestLogTurn = this.bot.turn;
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m purge ${purgeFoes.length ? `contested: engaging ${purgeFoes.length} enemy unit(s) around the ${this.purgeTarget.name}, rams keep battering` : `contest cleared: capturing the ${this.purgeTarget.name}`} (army=${armyEnts.length}, rams=${ramEnts.length})\n`);
	}
	this.purgeTarget.contestN = purgeFoes.length;
	const purgeCapEnt = gameState.getEntityById(this.purgeTarget.id);
	const purgeCap = purgeCapEnt ? this.shouldCapture(purgeCapEnt, armyEnts) : false;
	let purgeAtk = 0;
	for (const ent of armyEnts)
	{
		if (SquareDistance(ent.position(), [this.purgeTarget.x, this.purgeTarget.z]) >= 60 * 60)
		{
			ent.attackMove(this.purgeTarget.x, this.purgeTarget.z, "Unit", false);
			continue;
		}
		if (purgeFoes.length)
		{
			let best, bestDist;
			for (const foe of purgeFoes)
			{
				const d = SquareDistance(foe.position(), ent.position());
				if (best === undefined || d < bestDist)
				{
					best = foe;
					bestDist = d;
				}
			}
			ent.attack(best.id(), false);
			continue;
		}
		ent.attack(this.purgeTarget.id, purgeCap);
		purgeAtk++;
	}
	if (purgeAtk >= 1 && purgeFoes.length >= 1 &&
		(this.purgeTarget.warned === undefined || purgeFoes.length >= this.purgeTarget.warned + 15))
	{
		this.purgeTarget.warned = purgeFoes.length;
		print(`[WARNING] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m attacking enemy ${this.purgeTarget.name} at ${this.purgeTarget.x.toFixed(0)},${this.purgeTarget.z.toFixed(0)} with ${purgeFoes.length} enemy unit(s) nearby (army=${armyEnts.length}, rams=${ramEnts.length})\n`);
	}
	for (const ram of ramEnts)
	{
		if (SquareDistance(ram.position(), [this.purgeTarget.x, this.purgeTarget.z]) < 50 * 50)
			ram.attack(this.purgeTarget.id, false);
		else
			ram.attackMove(this.purgeTarget.x, this.purgeTarget.z, this.ramMarchFilter, false);
	}
	for (const ent of healerEnts)
		ent.move(this.purgeTarget.x, this.purgeTarget.z);
	return true;
};

/**
 * Clearance: an expansion spot vetoed by enemy presence alone (no enemy CC —
 * razing one is the raid's job) for 1.5 min straight gets the army sent to
 * clear it, so the CC order can finally go through (s47: both plan spots
 * blocked, the nearEnemy one re-vetoed 22 times while the army stood home).
 * Sits below the purge in the chain and shares its donation rules: war-stage,
 * 60+ to launch, 1.5x local superiority, no march while an enemy camp pins
 * home, abort under 40 or after 3 min. Rams march only when a structure must
 * fall — they are too slow for a mobile sweep.
 */
OffenseManager.prototype.clearance = function(gameState, armyEnts, healerEnts, mil, homePos)
{
	if (!this.bot.expansionManager.warOn() || !armyEnts.length || !homePos)
		return false;

	const ramEnts = [];
	for (const id in this.bot.armyManager.rams)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			ramEnts.push(ent);
	}
	const standDown = () => {
		// A structure the op flipped on its way out is ours now — register it
		// for the hold-or-delete sweep (manageCaptures).
		if (this.clearOp?.structId !== undefined)
		{
			const s = gameState.getEntityById(this.clearOp.structId);
			if (s?.owner() === this.bot.player)
				this.captures[s.id()] = this.bot.turn;
		}
		this.clearOp = undefined;
		this.bot.defenseManager.armyCmdTurn = 0;	// rally home next block
		for (const ent of armyEnts)
			ent.setStance("defensive");
		for (const ram of ramEnts)
			ram.move(homePos[0], homePos[1]);
		for (const ent of healerEnts)
			ent.move(homePos[0], homePos[1]);
	};

	if (this.clearOp)
	{
		const op = this.clearOp;
		// Cached enemy positions: same veto predicate as the expansion scan.
		const cleared = !this.bot.armyManager.nearEnemy([op.x, op.z], 100, 60);
		const bubbleDown = () => {
			// One op sanitizes the whole bubble: drop every contested entry
			// within 100 m so the re-order to a neighbor spot is not blocked
			// by a sibling failure's hot-area guard.
			for (const key in this.bot.expansionManager.expContested)
			{
				const c = this.bot.expansionManager.expContested[key];
				if (Math.abs(c.x - op.x) < 100 && Math.abs(c.z - op.z) < 100)
					delete this.bot.expansionManager.expContested[key];
			}
		};
		if (cleared && !op.proven)
		{
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m cleared expansion spot ${op.x.toFixed(0)},${op.z.toFixed(0)} (army=${armyEnts.length})\n`);
			bubbleDown();
			standDown();
			return false;
		}
		if (op.proven)
		{
			// The killers patrol: a clean reading is not safety. Hold the
			// ground until the escorted replacement CC stands — else the army
			// leaves and the next builder party dies the same way (s47).
			const nearOp = pos => pos && Math.abs(pos[0] - op.x) < 60 && Math.abs(pos[1] - op.z) < 60;
			let ccDone = false, ccStarted = false;
			for (const ent of gameState.getOwnStructures().values())
				if (ent.position() && ent.hasClass("CivCentre") && nearOp(ent.position()))
				{
					if (ent.foundationProgress() === undefined)
						ccDone = true;
					else
						ccStarted = true;
				}
			for (const f of gameState.getOwnFoundations().values())
				if (f.position() && nearOp(f.position()) &&
					gameState.getBuiltTemplate(f.templateName()).hasClass("CivCentre"))
					ccStarted = true;
			if (ccDone)
			{
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m held expansion spot ${op.x.toFixed(0)},${op.z.toFixed(0)} until the CC stood (army=${armyEnts.length})\n`);
				bubbleDown();
				standDown();
				return false;
			}
			// Escort-window clocks: the op exists to cover a replacement CC
			// order. The arrival clock runs only while the area is verifiably
			// ours — a returning patrol resets it, a live threat is exactly
			// what the hold is for (s47). If the army never even arrives, the
			// launch clock caps the wait instead (s13: the hold degenerated
			// into a 3 min park on a statically unbuildable spot).
			let atSpot = 0;
			for (const ent of armyEnts)
				if (ent.position() && SquareDistance(ent.position(), [op.x, op.z]) < 80 * 80)
					atSpot++;
			if (atSpot >= 5)
			{
				op.everArrived = true;
				if (op.arrivedTurn === undefined)
					op.arrivedTurn = this.bot.turn;
			}
			if (!cleared)
				op.arrivedTurn = undefined;
			if (!ccStarted &&
				(op.arrivedTurn !== undefined && this.bot.turn - op.arrivedTurn > 300 ||
				!op.everArrived && this.bot.turn - op.turn > 450))
			{
				// No CC order came (escort gate, affordability, static
				// obstruction, no in-bubble spot): parking the army buys
				// nothing more. Long cooldown — don't churn ops on it.
				const why = op.arrivedTurn !== undefined ? "held clean" : "never arrived";
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m cleared expansion spot ${op.x.toFixed(0)},${op.z.toFixed(0)}, no CC order followed (${why}, atSpot=${atSpot}, army=${armyEnts.length}) — standing down\n`);
				this.clearCool[op.key] = this.bot.turn;
				standDown();
				return false;
			}
		}
		if (this.bot.armyManager.armyCount() < 40 || this.bot.turn - op.turn > 900 || !this.bot.expansionManager.expContested[op.key])
		{
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m clearing aborted at ${op.x.toFixed(0)},${op.z.toFixed(0)} (age=${((this.bot.turn - op.turn) / 300).toFixed(1)}m, army=${armyEnts.length})\n`);
			this.clearCool[op.key] = this.bot.turn;
			standDown();
			return false;
		}
		if (this.bot.turn < this.bot.defenseManager.armyCmdTurn)
			return true;
		this.bot.defenseManager.armyCmdTurn = this.bot.turn + 10;
		// Same contest rule as the raid and the purge: soldiers clear enemy
		// units standing within 100 m of the spot first; structures are
		// attacked (capture allowed) only once the field is theirs.
		const foes = [];
		for (const ent of gameState.getEnemyUnits().values())
		{
			if (ent.owner() === 0)
				continue;
			const pos = ent.position();
			if (pos && SquareDistance(pos, [op.x, op.z]) < 100 * 100)
				foes.push(ent);
		}
		let struct, structDist;
		for (const ent of gameState.getEnemyStructures().values())
		{
			if (ent.owner() === 0)
				continue;
			const pos = ent.position();
			if (!pos || SquareDistance(pos, [op.x, op.z]) >= 100 * 100)
				continue;
			const d = SquareDistance(pos, [op.x, op.z]);
			if (!struct || d < structDist)
			{
				struct = ent;
				structDist = d;
			}
		}
		// Remember the structure under attack: if it flips to us, standDown
		// hands it to the hold-or-delete sweep (manageCaptures).
		if (struct)
			op.structId = struct.id();
		const structCap = struct ? this.shouldCapture(struct, armyEnts) : false;
		for (const ent of armyEnts)
		{
			if (!ent.position())
				continue;
			if (SquareDistance(ent.position(), [op.x, op.z]) >= 60 * 60)
			{
				ent.attackMove(op.x, op.z, "Unit", false);
				continue;
			}
			if (foes.length)
			{
				let best, bestDist;
				for (const foe of foes)
				{
					const d = SquareDistance(foe.position(), ent.position());
					if (best === undefined || d < bestDist)
					{
						best = foe;
						bestDist = d;
					}
				}
				ent.attack(best.id(), false);
				continue;
			}
			if (struct)
				ent.attack(struct.id(), structCap);
		}
		if (struct)
			for (const ram of ramEnts)
			{
				if (SquareDistance(ram.position(), struct.position()) < 50 * 50)
					ram.attack(struct.id(), false);
				else
					ram.attackMove(op.x, op.z, this.ramMarchFilter, false);
			}
		for (const ent of healerEnts)
			ent.move(op.x, op.z);
		return true;
	}

	if (this.bot.armyManager.armyCount() < 60)
		return false;
	// Clearing exists to unblock CC orders; with the expansion stages off
	// there is nothing to unblock. (No plan-completeness gate: an exhausted
	// plan is exactly when clearing is needed — the recompute adds spots.)
	if (!this.bot.expansionManager.reliefOn && !this.bot.expansionManager.expansionOn())
		return false;
	// Their main force loitering near home pins the army (same rule as the purge).
	let campN = 0;
	for (const p of mil)
		if (SquareDistance(p, homePos) < 220 * 220)
			campN++;
	// Longest-contested clearable spot wins. A scan-sourced entry needs 1.5 min
	// of continuous presence before it is worth an army; a proven one (a dead
	// builder party) is eligible at once, even with the killers momentarily
	// gone — the march doubles as the re-order's escort, and the hold-through-
	// gap is what lets the escorted order slip in (s47). A spot with no enemy
	// left near it and nothing proven is dropped — the veto is already gone.
	let best, bestKey, bestDef, bestProven, eligible = 0;
	for (const key in this.bot.expansionManager.expContested)
	{
		const c = this.bot.expansionManager.expContested[key];
		if (!c.proven && this.bot.turn - c.since < 450)
			continue;
		if (this.bot.turn - c.seen > 150 && (!c.proven || this.bot.turn > c.until))
			continue;
		if (this.clearCool[key] && this.bot.turn - this.clearCool[key] < 1800)
			continue;	// 6 min: an area that resisted one op stays dangerous
		let def = 0;
		for (const p of this.bot.armyManager.enemyMobilesPos || [])
			if (SquareDistance(p, [c.x, c.z]) < 100 * 100)
				def++;
		let fortress = false, structs = 0;
		for (const ent of gameState.getEnemyStructures().values())
		{
			if (ent.owner() === 0)
				continue;
			const pos = ent.position();
			if (pos && SquareDistance(pos, [c.x, c.z]) < 100 * 100)
			{
				structs++;
				if (ent.hasClass("Fortress"))
					fortress = true;
			}
		}
		if (!def && !structs && !c.proven)
		{
			delete this.bot.expansionManager.expContested[key];
			continue;
		}
		eligible++;
		// A fortress cannot be cracked without siege (the purge's rule).
		if (fortress && ramEnts.length < 1)
			continue;
		if (best === undefined || def < bestDef)
		{
			best = c;
			bestKey = key;
			bestDef = def;
			bestProven = c.proven;
		}
	}
	if (!best || campN >= 15 || this.bot.armyManager.armyCount() < bestDef * 1.5)
	{
		// Blocked-launch forensics, throttled: which gate keeps a contested
		// spot from getting its clearing op (camp pins, no superiority,
		// fortress without rams, or no eligible candidate yet).
		const entries = Object.keys(this.bot.expansionManager.expContested).length;
		if (entries && this.bot.turn - (this.clearBlockedLog || -300) >= 300)
		{
			this.clearBlockedLog = this.bot.turn;
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m clearing blocked (entries=${entries} eligible=${eligible} bestDef=${best === undefined ? "-" : bestDef} army=${this.bot.armyManager.armyCount()} camp=${campN})\n`);
		}
		return false;
	}
	this.clearOp = { "x": best.x, "z": best.z, "key": bestKey, "turn": this.bot.turn, "proven": bestProven || undefined };
	print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m clearing expansion spot ${best.x.toFixed(0)},${best.z.toFixed(0)} (defenders=${bestDef}, contested ${((this.bot.turn - best.since) / 300).toFixed(1)}m${bestProven ? ", proven" : ""}, army=${armyEnts.length})\n`);
	for (const ent of armyEnts)
		ent.setStance("aggressive");
	return true;
};
