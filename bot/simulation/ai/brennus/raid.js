import { SquareDistance } from "simulation/ai/brennus/helpers.js";

/**
 * Razzia: a squad of Gaul javelin cavalry (trained at the CC — a gaul CC
 * trains cavalry_javelineer_b) harasses the enemy's unarmed workers from
 * the war stage on: a second front, away from the main army's CC siege.
 *
 * Rules: targets are enemy Support units (women, traders, healers) standing
 * away from every enemy structure that shoots (CC, towers, fortress). The
 * squad moves passively to the nearest such worker cluster, then each rider
 * picks the nearest valid target to itself. It breaks off when enemy
 * soldiers close in, rides home on a home threat (and fights there), and a
 * rider under 35% health is retired to the home army.
 *
 * The squad is a separate roster: army, economy, defense and expansion skip
 * its members (isRaider), so no other manager ever commands a rider.
 */
export function RaidManager(bot)
{
	this.bot = bot;
	this.squad = {};         // id -> 1
	this.retired = {};       // id -> 1: ex-riders, never re-recruited
	this.state = "idle";     // idle | approach | raid | retreat | home
	this.trained = 0;        // riders ordered so far (lifetime budget)
	this.recruited = 0;      // riders that came out of the CC
	this.cooldownUntil = 0;  // turn
	this.sortie = 0;
	this.sortieKills = 0;
	this.kills = 0;
	this.targets = {};       // rider id -> enemy id
	this.done = false;
}

RaidManager.prototype.squadSize = 5;
// One squad, no replacements: a 10-rider budget plus a priority reserve
// went 10W/2T vs 12W on the 12-seed probe.
RaidManager.prototype.trainBudget = 5;
// Enemy structures that shoot: a worker inside this radius is off-limits.
RaidManager.prototype.dangerRadius = 85;
// Enemy soldiers within this radius of the squad centroid count as a response.
RaidManager.prototype.alarmRadius = 45;

RaidManager.prototype.isRaider = function(id)
{
	return this.squad[id] !== undefined;
};

/** A razzia-trained rider not yet recruited nor retired: the army roster must leave it. */
RaidManager.prototype.claims = function(ent)
{
	return !this.done && !this.retired[ent.id()] && ent.getMetadata(this.bot.player, "razzia") === true;
};

RaidManager.prototype.minutes = function()
{
	return (this.bot.gameState.getTimeElapsed() / 60000).toFixed(1);
};

RaidManager.prototype.riders = function()
{
	const gameState = this.bot.gameState;
	const out = [];
	for (const id in this.squad)
	{
		const ent = gameState.getEntityById(+id);
		if (!ent || !ent.position())
		{
			delete this.squad[id];
			delete this.targets[id];
			continue;
		}
		out.push(ent);
	}
	return out;
};

/** Recruit idle javelin cavalry fresh from the CC (never the herder, never an ex-rider). */
RaidManager.prototype.recruit = function()
{
	const gameState = this.bot.gameState;
	const herder = this.bot.economyManager.herderId;
	const jav = gameState.applyCiv("units/{civ}/cavalry_javelineer_b");
	for (const ent of gameState.getOwnUnits().values())
	{
		const id = ent.id();
		if (this.squad[id] || this.retired[id] || id === herder || ent.templateName() !== jav ||
			!ent.position())
			continue;
		if (ent.getMetadata(this.bot.player, "razzia") !== true)
			continue;
		delete this.bot.armyManager.army[id];
		this.squad[id] = 1;
		this.recruited++;
		delete this.bot.economyManager.assignments[id];
		ent.setStance("passive");
	}
};

RaidManager.prototype.train = function(riders)
{
	const gameState = this.bot.gameState;
	if (this.trained >= this.trainBudget || riders.length >= this.squadSize)
		return;
	const cc = this.bot.getCivicCentre();
	if (!cc || cc.foundationProgress() !== undefined || (cc.trainingQueue()?.length || 0) > 2)
		return;
	if (gameState.getPopulation() + 2 > gameState.getPopulationLimit())
		return;
	const res = this.bot.arbiter.books("raid");
	const n = Math.min(this.squadSize - riders.length - (this.trained - this.recruited), this.trainBudget - this.trained);
	if (n < 1)
		return;
	const cost = { "food": 100 * n, "wood": 50 * n };
	// Surplus only: the war-stage economy floats well above this, and a
	// priority reserve (needed in the boom, where every block's balance is
	// spent) taxed the war machine.
	if (res.food < cost.food + 600 || res.wood < cost.wood + 400)
		return;
	cc.train(gameState.getPlayerCiv(), gameState.applyCiv("units/{civ}/cavalry_javelineer_b"), n, { "razzia": true });
	this.bot.arbiter.spend(res, "raid", cost, `razzia riders x${n}`);
	this.trained += n;
	print(`[RAZZIA] t=${this.minutes()}m training ${n} javelin riders (squad=${riders.length}, trained=${this.trained})\n`);
};

/** One scan of enemy units: valid worker targets and soldier positions. */
RaidManager.prototype.scan = function()
{
	const danger = [];
	const workers = [];
	const soldiers = [];
	const hunters = [];
	for (const ent of this.bot.gameState.getEnemyEntities().values())
	{
		if (ent.owner() === 0)
			continue;
		const pos = ent.position();
		if (!pos)
			continue;
		if (ent.hasClass("Structure"))
		{
			if (ent.hasClass("CivCentre") || ent.hasClass("Tower") || ent.hasClass("Fortress"))
				danger.push(pos);
			continue;
		}
		if (ent.hasClass("Support"))
			workers.push(ent);
		else if (ent.hasClass("Soldier") || ent.hasClass("Hero"))
		{
			// Petra gathers with citizen soldiers: a soldier busy on its
			// resource is no response (counting them aborted every sortie
			// on arrival, 0 kills in 12 seeds); any other state is.
			const state = ent.unitAIState() || "";
			if (state.indexOf("GATHER") === -1 && state.indexOf("RETURNRESOURCE") === -1 &&
				state.indexOf("REPAIR") === -1 && state.indexOf("GARRISONED") === -1)
			{
				soldiers.push(pos);
				// Hunters: soldiers whose current order targets a rider.
				const tgt = ent.unitAIOrderData()?.[0]?.target;
				if (tgt !== undefined && this.squad[tgt])
					hunters.push(pos);
			}
		}
	}
	const d2 = this.dangerRadius * this.dangerRadius;
	const g2 = 40 * 40;
	// Exposed: out of tower/CC range and not covered by 3+ free soldiers.
	const safe = workers.filter(w => !danger.some(p => SquareDistance(p, w.position()) < d2) &&
		soldiers.filter(p => SquareDistance(p, w.position()) < g2).length < 3);
	return { safe, soldiers, hunters };
};

RaidManager.prototype.centroid = function(riders)
{
	let x = 0, z = 0;
	for (const r of riders)
	{
		x += r.position()[0];
		z += r.position()[1];
	}
	return [x / riders.length, z / riders.length];
};

RaidManager.prototype.goHome = function(riders, state, why)
{
	const cc = this.bot.getCivicCentre();
	if (!cc)
		return;
	const p = cc.position();
	for (const r of riders)
	{
		if (state === "home")
		{
			r.setStance("aggressive");
			r.attackMove(p[0], p[1]);
		}
		else
		{
			r.setStance("passive");
			r.move(p[0] + 15, p[1] + 15);
		}
	}
	this.targets = {};
	if (this.state === "raid" || this.state === "approach")
		print(`[RAZZIA] t=${this.minutes()}m sortie ${this.sortie} ends (${why}): kills=${this.sortieKills} riders=${riders.length}\n`);
	this.state = state;
};

RaidManager.prototype.update = function()
{
	if (this.done)
		return;
	const bot = this.bot;
	const gameState = bot.gameState;
	// War stage only: funded during the boom (8 min on) the 750-resource
	// squad delayed the city phase by 1-3 min and cost seed 37 its city
	// (11W/1L vs 12W baseline). At war the economy has the surplus, and the
	// razzia becomes a second front while the main army besieges a CC.
	if (!bot.expansionManager.warOn())
		return;

	this.recruit();
	let riders = this.riders();

	// Count kills: a targeted worker that vanished while its rider was close.
	for (const id in this.targets)
		if (!gameState.getEntityById(this.targets[id].target))
		{
			this.sortieKills++;
			this.kills++;
			// Several riders may share one victim: count it once.
			const dead = this.targets[id].target;
			for (const other in this.targets)
				if (this.targets[other].target === dead)
					delete this.targets[other];
		}

	// Wounded riders go home for good and join the army there.
	for (const r of riders)
		if (r.healthLevel() < 0.35)
		{
			const cc = bot.getCivicCentre();
			delete this.squad[r.id()];
			delete this.targets[r.id()];
			this.retired[r.id()] = 1;
			r.setStance("passive");
			if (cc)
				r.move(cc.position()[0], cc.position()[1]);
		}
	riders = this.riders();
	this.train(riders);

	const army = bot.armyManager;
	const homeThreat = army.enemyNearestHome < 150 && army.enemyArmy >= 6;
	if (homeThreat)
	{
		if (this.state !== "home")
			this.goHome(riders, "home", "home threatened");
		return;
	}
	if (this.state === "home")
	{
		this.state = "idle";
		this.cooldownUntil = bot.turn + 150;
	}
	if (!riders.length)
	{
		this.state = "idle";
		return;
	}
	if (this.state === "retreat")
	{
		const cc = bot.getCivicCentre();
		if (!cc || SquareDistance(this.centroid(riders), cc.position()) < 40 * 40 || bot.turn > this.cooldownUntil)
			this.state = "idle";
		return;
	}
	if (this.state === "idle" && (riders.length < 4 || bot.turn < this.cooldownUntil))
		return;

	// Scans only while out (every block: ~300 enemy entities, cheap).
	const { safe, soldiers, hunters } = this.scan();
	const c = this.centroid(riders);
	// Alarm: soldiers chasing a rider within the alarm radius, plus any free
	// soldier already inside 20 m (javelins outrange that, so kiting holds).
	const a2 = this.alarmRadius * this.alarmRadius;
	let alarm = 0;
	for (const p of hunters)
		if (SquareDistance(p, c) < a2)
			alarm++;
	for (const p of soldiers)
		if (SquareDistance(p, c) < 20 * 20)
			alarm++;
	// Break off on attrition or a real counter-force, not on first contact:
	// a melee chaser is kited below (javelins outrange and riders outrun it).
	let hp = 0;
	for (const r of riders)
		hp += r.healthLevel();
	hp /= riders.length;
	if (this.state !== "idle" && (alarm > 2 * riders.length || hp < 0.6))
	{
		this.cooldownUntil = bot.turn + 225;
		this.goHome(riders, "retreat", hp < 0.6 ? `squad health ${Math.round(100 * hp)}%` : `${alarm} soldiers responding`);
		return;
	}
	if (!safe.length)
	{
		if (this.state !== "idle")
		{
			this.cooldownUntil = bot.turn + 300;
			this.goHome(riders, "retreat", "no exposed workers");
		}
		return;
	}

	// Nearest exposed worker to the squad (from home when idle).
	let best, bestD = Infinity;
	for (const w of safe)
	{
		const d = SquareDistance(w.position(), c);
		if (d < bestD)
		{
			bestD = d;
			best = w;
		}
	}
	if (this.state === "idle")
	{
		this.sortie++;
		this.sortieKills = 0;
		print(`[RAZZIA] t=${this.minutes()}m sortie ${this.sortie}: ${riders.length} riders toward workers at ${best.position()[0].toFixed(0)},${best.position()[1].toFixed(0)} (exposed=${safe.length})\n`);
		this.state = "approach";
	}
	if (this.state === "approach" && bestD > 60 * 60)
	{
		for (const r of riders)
			r.move(best.position()[0], best.position()[1]);
		return;
	}
	this.state = "raid";
	// Each rider keeps a live target, else takes the exposed worker nearest to it.
	const safeIds = new Set(safe.map(w => w.id()));
	for (const r of riders)
	{
		// Kite: a free soldier inside 15 m pushes the rider 25 m straight away.
		const rp = r.position();
		let near, nd = 15 * 15;
		for (const p of soldiers)
		{
			const d = SquareDistance(p, rp);
			if (d < nd)
			{
				nd = d;
				near = p;
			}
		}
		if (near)
		{
			const dx = rp[0] - near[0], dz = rp[1] - near[1];
			const len = Math.max(1, Math.sqrt(dx * dx + dz * dz));
			r.move(rp[0] + 25 * dx / len, rp[1] + 25 * dz / len);
			delete this.targets[r.id()];
			continue;
		}
		const cur = this.targets[r.id()];
		if (cur && safeIds.has(cur.target) && !r.isIdle())
			continue;
		let tgt, td = Infinity;
		for (const w of safe)
		{
			const d = SquareDistance(w.position(), r.position());
			if (d < td)
			{
				td = d;
				tgt = w;
			}
		}
		if (!tgt || td > 120 * 120)
			continue;
		this.targets[r.id()] = { "target": tgt.id() };
		r.attack(tgt.id(), false);
	}
};
