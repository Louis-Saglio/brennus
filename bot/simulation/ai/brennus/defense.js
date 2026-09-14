import { SquareDistance } from "simulation/ai/brennus/helpers.js";

export function DefenseManager(bot)
{
	this.bot = bot;
	// Ids recalled to a home threat; live only while the threat does.
	this.recalled = {};
	// Active foundation denial ({id, x, z, needed, defenders, template, turn})
	// and per-foundation retry cooldown.
	this.deny = undefined;
	this.denyTried = {};
	// Army command-block throttle, shared with the offense ops (they reset it
	// to force a rally on the next block).
	this.armyCmdTurn = 0;
	// Worker shelter memory (holder id -> last danger turn).
	this.shelterDanger = {};
	// Last turn with a serious threat; garrisons eject 30 turns after it clears.
	this.lastSeriousTurn = 0;
	this.hadThreat = false;
	this.swatting = false;
}

DefenseManager.prototype.manageDefense = function()
{
	const gameState = this.bot.gameState;

	this.bot.armyManager.maintainRoster(gameState);

	this.bot.buildupManager.manageDefenseBuildings();
	this.bot.buildupManager.manageDefenseTraining();
	this.bot.buildupManager.manageMilitaryTechs();

	// Enemy soldiers/siege in the world, once for the threat scan and the shelter.
	const mil = [];
	const milSiege = [];
	for (const ent of gameState.getEnemyUnits().values())
	{
		if (ent.owner() === 0 || (!ent.hasClass("Soldier") && !ent.hasClass("Siege")))
			continue;
		const pos = ent.position();
		if (!pos)
			continue;
		mil.push(pos);
		if (ent.hasClass("Siege"))
			milSiege.push(pos);
	}

	// Threat: enemies within 120 m of an own CC; the CC nearest home wins.
	// Serious means a real assault (8+ units, or siege within 160 m) — only a
	// serious threat cancels or blocks a raid; small probing parties are the
	// standing army's everyday job and must not pin it at home forever.
	const ccType = gameState.applyCiv("structures/{civ}/civil_centre");
	const homePos = this.bot.getCivicCentre()?.position();
	let threat;
	for (const ent of gameState.getOwnStructures().values())
	{
		if (ent.templateName() !== ccType || !ent.position())
			continue;
		const cp = ent.position();
		let n = 0, sx = 0, sz = 0;
		for (const p of mil)
		{
			if (SquareDistance(p, cp) > 120 * 120)
				continue;
			n++;
			sx += p[0];
			sz += p[1];
		}
		let siegeN = 0, gsx = 0, gsz = 0;
		for (const p of milSiege)
			if (SquareDistance(p, cp) < 160 * 160)
			{
				siegeN++;
				gsx += p[0];
				gsz += p[1];
			}
		if (!n && !siegeN)
			continue;
		const score = homePos ? SquareDistance(cp, homePos) : -(n + siegeN);
		if (!threat || score < threat.score)
			// n == 0 happens on a siege-only threat: fall back to the siege
			// centroid, or sx/Math.max(n,1) = (0,0) sends the army to the
			// top-left map corner (rams killing a CC while the army walked away).
			threat = { "x": n ? sx / n : gsx / siegeN, "z": n ? sz / n : gsz / siegeN, "n": n, "siegeN": siegeN, "score": score, "ccx": cp[0], "ccz": cp[1], "ccId": ent.id() };
	}

	const serious = threat && (threat.n >= 8 || threat.siegeN > 0);
	// Garrisoning happens only under a serious outnumbered threat; once the
	// threat is no longer serious the reason to hide is gone. Eject (30-turn
	// settle against border-flapping) or the garrisoned army stays invisible
	// to armyEnts forever while sub-8 leftovers burn the outer economy in
	// reach of the minor-probe swat that never gets its soldiers back.
	if (serious)
		this.lastSeriousTurn = this.bot.turn;
	else
	{
		// A proportional recall lives only while its threat does.
		this.recalled = {};
		if (this.bot.turn - this.lastSeriousTurn > 30)
		{
			const ejected = this.bot.armyManager.ejectArmyGarrisons(gameState);
			if (ejected)
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m ejecting ${ejected} garrisoned soldiers (threat over)\n`);
		}
	}

	// Wave early warning for the working army: 5+ enemy soldiers/siege within
	// 250 m of home recall the gatherers before the 120 m threat ring does.
	let nearHome = 0;
	if (homePos)
		for (const p of mil)
			if (SquareDistance(p, homePos) < 250 * 250)
				nearHome++;
	// A border foundation going up is a threat too: keep the army mobilized
	// for the denial (Petra founds border fortresses during our boom).
	const denyTarget = this.findDenyTarget(mil, homePos);
	this.bot.armyManager.manageDemobilization(gameState, serious || !!threat || nearHome >= 5 || !!denyTarget || !!this.deny);

	const armyEnts = [];
	for (const id in this.bot.armyManager.army)
	{
		if (this.bot.armyManager.demobilized[id])
			continue;
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			armyEnts.push(ent);
	}
	// Healers trail the army everywhere it is sent; they heal passively.
	const healerEnts = [];
	for (const id in this.bot.armyManager.healers)
	{
		const ent = gameState.getEntityById(+id);
		if (ent?.position())
			healerEnts.push(ent);
	}
	if (serious)
	{
		// threat.n counts only enemies already within 120 m of the CC;
		// the rest of the wave is still marching in (agg9 s3: threat.n=8
		// hid a 105-unit wave — the 59-strong army attack-moved into the
		// open and melted in 1.5 min). Compare against everyone within
		// 150 m of the threat centroid instead.
		let nearThreat = 0;
		for (const p of mil)
			if (SquareDistance(p, [threat.x, threat.z]) < 150 * 150)
				nearThreat++;
		nearThreat = Math.max(nearThreat, threat.n);
		// A denial sits near home by construction — the threat's army handles
		// it. An away raid/purge does not automatically die to a home threat:
		// recall only the shortfall — enough to deal with it at 1.5x plus 4
		// per siege engine (rams are tanky) — when the away force stays at or
		// above the raid's 50-strong regroup floor (0cae013 s57: the whole
		// 98-man army was grinding a border fortress 290 m out while 2 rams
		// burned the home CC). Below the floor the away mission is canceled
		// and everyone comes home, as before. Recalls are sticky and additive:
		// recalled ids count as responding wherever they are, so a marching
		// detachment is not re-recalled every block while a growing threat
		// still escalates.
		if (this.deny)
			this.deny = undefined;
		if (this.bot.offenseManager.target || this.bot.offenseManager.purgeTarget)
		{
			const needed = Math.ceil(nearThreat * 1.5) + threat.siegeN * 4;
			let responding = 0;
			for (const ent of armyEnts)
				if (this.recalled[ent.id()] ||
					SquareDistance(ent.position(), [threat.x, threat.z]) < 150 * 150)
					responding++;
			const shortfall = needed - responding;
			// The away force after recalling is armyEnts - responding -
			// shortfall = armyEnts - needed: check the floor against needed
			// itself, or block-by-block escalation slides the away mission
			// below the regroup floor one shortfall at a time (s3 probe:
			// 55 already recalled, +3 more, away kept 47 < 50).
			if (shortfall > 0 && armyEnts.length - needed >= 50)
			{
				const byDist = armyEnts.slice().sort((a, b) =>
					SquareDistance(a.position(), [threat.x, threat.z]) - SquareDistance(b.position(), [threat.x, threat.z]));
				let n = 0;
				for (const ent of byDist)
				{
					if (this.recalled[ent.id()])
						continue;
					this.recalled[ent.id()] = 1;
					ent.setStance("defensive");
					if (++n >= shortfall)
						break;
				}
				if (n)
				{
					let rc = 0;
					for (const id in this.recalled)
						rc++;
					print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m recalling ${rc} soldiers for the home threat, away mission keeps ${armyEnts.length - rc}\n`);
				}
			}
			else if (shortfall > 0)
			{
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m recalling the whole army for the home threat, away mission canceled (army=${armyEnts.length}, threat=${nearThreat})\n`);
				this.bot.offenseManager.target = undefined;
				this.bot.offenseManager.purgeTarget = undefined;
				this.recalled = {};
				for (const ent of armyEnts)
					ent.setStance("defensive");
				if (homePos)
					for (const id in this.bot.armyManager.rams)
					{
						const ram = gameState.getEntityById(+id);
						if (ram?.position())
							ram.move(homePos[0], homePos[1]);
					}
			}
			// shortfall <= 0: enough responders are already home — the away
			// mission continues untouched.
		}
		if (!this.hadThreat)
		{
			let cavN = 0;
			for (const ent of armyEnts)
				if (ent.hasClass("Cavalry"))
					cavN++;
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m engaging ${threat.n} enemies (siege=${threat.siegeN}) near CC ${threat.x.toFixed(0)},${threat.z.toFixed(0)} (army=${armyEnts.length}${cavN ? `, cav=${cavN}` : ""})\n`);
		}
		if (this.bot.turn >= this.armyCmdTurn)
		{
			this.armyCmdTurn = this.bot.turn + 10;
			// Responders: everyone when the army fights at home; under a split
			// recall only the recalled and whoever is already near the threat —
			// the rest of the army keeps its away-mission orders.
			const split = !!(this.bot.offenseManager.target || this.bot.offenseManager.purgeTarget);
			const responders = [];
			for (const ent of armyEnts)
				if (!split || this.recalled[ent.id()] ||
					SquareDistance(ent.position(), [threat.x, threat.z]) < 150 * 150)
					responders.push(ent);
			// Garrisoned soldiers (not the ungarrisoned remainder) decide
			// superiority — 20 in the CC is +20 arrows, and they eject into
			// the fight once the balance flips.
			// Shelters: the threatened CC, then built defense towers within
			// 120 m of it. A stone tower holds 5 infantry at +1 arrow each
			// (default 4, GarrisonArrowMultiplier 1, GarrisonArrowClasses
			// Infantry) — five full towers shelter 25 soldiers behind ~45
			// extra arrows; the CC alone could not hold the army (agg10 s3:
			// the 39-man overflow stood outside and was slaughtered).
			const shelters = [];
			{
				const ccEnt0 = gameState.getEntityById(threat.ccId);
				if (ccEnt0)
					shelters.push(ccEnt0);
				const towerType = gameState.applyCiv("structures/{civ}/defense_tower");
				for (const ent of gameState.getOwnStructures().values())
					if (ent.templateName() === towerType && ent.position() &&
						ent.foundationProgress() === undefined &&
						SquareDistance(ent.position(), [threat.ccx, threat.ccz]) < 120 * 120)
						shelters.push(ent);
			}
			if ((split ? responders.length : this.bot.armyManager.armyCount()) >= nearThreat)
			{
				// Local superiority: eject the garrisons (wherever they are —
				// the fight may have moved CCs since they hid) and take the
				// fight to them.
				this.bot.armyManager.ejectArmyGarrisons(gameState);
				// Cavalry hunts its preferred targets directly (siege first,
				// then the ranged back line) instead of blobbing in with the
				// attackMove — an attackMove would drop it onto the enemy's
				// melee frontline, which is exactly where it is weakest.
				// The foe scan runs at most once per command round and only
				// when cavalry is actually among the responders.
				let cavFoes;
				for (const ent of responders)
				{
					if (ent.hasClass("Cavalry"))
					{
						if (cavFoes === undefined)
						{
							cavFoes = [];
							for (const foe of gameState.getEnemyUnits().values())
							{
								if (foe.owner() === 0 || (!foe.hasClass("Soldier") && !foe.hasClass("Siege")))
									continue;
								const fp = foe.position();
								if (fp && SquareDistance(fp, [threat.x, threat.z]) < 100 * 100)
									cavFoes.push(foe);
							}
						}
						const target = this.bot.armyManager.pickCavalryTarget(cavFoes, ent.position());
						if (target)
						{
							ent.attack(target.id(), false);
							continue;
						}
					}
					ent.attackMove(threat.x, threat.z, "Unit", false);
				}
				if (!split)
					for (const ent of healerEnts)
						ent.move(threat.x, threat.z);
			}
			else
			{
				// Outnumbered: garrison the shelters, CC first. Each
				// garrisoned soldier is +1 arrow (civil_centre and tower
				// GarrisonArrowMultiplier), the CC garrison heals at 1 hp/s
				// and the CC cannot be captured while manned — standing
				// outside and trading against a bigger blob is a donation
				// (agg3 s3: 34 basics melted into a 106-unit wave at 16m
				// while the CC idled).
				const frees = shelters.map(s => Math.max(0, (+s.garrisonMax() || 0) - s.garrisonedSlots()));
				const garrisonIn = ent =>
				{
					for (let i = 0; i < shelters.length; i++)
						if (frees[i] > 0)
						{
							ent.garrison(shelters[i]);
							frees[i]--;
							return true;
						}
					return false;
				};
				for (const ent of responders)
				{
					ent.setStance("defensive");
					if (!garrisonIn(ent) && SquareDistance(ent.position(), [threat.ccx, threat.ccz]) > 40 * 40)
						ent.move(threat.ccx, threat.ccz);
				}
				if (!split)
					for (const ent of healerEnts)
						if (!garrisonIn(ent))
							ent.move(threat.ccx, threat.ccz);
			}
		}
	}
	else if (this.manageDeny(gameState, armyEnts, mil, homePos, denyTarget))
	{
		// foundation denial in progress, commands issued there
	}
	else if (this.bot.offenseManager.raid(gameState, armyEnts, healerEnts, mil, homePos))
	{
		// raid in progress, commands issued there
	}
	else if (threat)
	{
		// Minor probes while no raid is on: swat them.
		if (this.bot.turn >= this.armyCmdTurn)
		{
			this.armyCmdTurn = this.bot.turn + 10;
			for (const ent of armyEnts)
				ent.attackMove(threat.x, threat.z, "Unit", false);
			for (const ent of healerEnts)
				ent.move(threat.x, threat.z);
		}
	}
	else if (this.bot.offenseManager.purge(gameState, armyEnts, healerEnts, mil, homePos))
	{
		// purge in progress, commands issued there
	}
	else if (this.bot.offenseManager.clearance(gameState, armyEnts, healerEnts, mil, homePos))
	{
		// clearing a contested expansion spot, commands issued there
	}
	else if (homePos)
	{
		// No threat: if a siege camp loiters near home (Petra piles its
		// army just outside our territory, which both blocks the raid windows and
		// farms our outlying storehouses), sortie against it once we are strong
		// enough — the fight happens under our towers and CC arrows.
		// War-stage only: before city the sortie is a donation — agg5 s1 sent
		// the whole 60-strong muster into Petra's 75-106 blob at 16m and the
		// base fell 9 minutes later.
		let sortie = false;
		if (this.bot.expansionManager.warOn())
		{
			let campN = 0, cx = 0, cz = 0;
			for (const p of mil)
				if (SquareDistance(p, homePos) < 220 * 220)
				{
					campN++;
					cx += p[0];
					cz += p[1];
				}
			// Sortie only with clear superiority: the camp GROWS while the army
			// marches (Petra converges), and agg8 s2's 20.7m sortie at 60-vs-32
			// turned into 60-vs-83 mid-field and donated ~30 soldiers. 1.5x or
			// stay home and let the towers and CC arrows bleed the camp instead.
			if (campN >= 15 && this.bot.armyManager.armyCount() >= 100 && this.bot.armyManager.armyCount() >= campN * 1.5 && this.bot.turn >= this.armyCmdTurn)
			{
				sortie = true;
				this.armyCmdTurn = this.bot.turn + 10;
				print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m sortie against siege camp ${(cx / campN).toFixed(0)},${(cz / campN).toFixed(0)} (camp=${campN}, army=${armyEnts.length})\n`);
				for (const ent of armyEnts)
					ent.attackMove(cx / campN, cz / campN, "Unit", false);
				for (const ent of healerEnts)
					ent.move(cx / campN, cz / campN);
			}
		}
		if (!sortie && this.bot.turn >= this.armyCmdTurn)
		{
			// Dispersed leftovers: raiders beyond every CC's 120 m threat ring
			// but still inside the economy's reach burn outer buildings while
			// the army stands idle (s63 loss-review note — the threat scan is
			// CC-centric and never sees them). Swat the biggest such group
			// (3-14: 15+ is a siege camp, the sortie's job) with a proportional
			// detachment; the serious branch preempts if a real wave lands.
			let swat;
			if (armyEnts.length >= 6)
			{
				const ccps = [], anchors = [];
				for (const ent of gameState.getOwnStructures().values())
				{
					const p = ent.position();
					if (!p || ent.foundationProgress() !== undefined)
						continue;
					anchors.push(p);
					if (ent.templateName() === ccType)
						ccps.push(p);
				}
				const cand = [];
				for (const p of mil)
				{
					let nearCC = false;
					for (const c of ccps)
						if (SquareDistance(p, c) < 120 * 120)
						{
							nearCC = true;
							break;
						}
					if (nearCC)
						continue;
					for (const a of anchors)
						if (SquareDistance(p, a) < 60 * 60)
						{
							cand.push(p);
							break;
						}
				}
				let best;
				for (let i = 0; i < cand.length; i++)
				{
					let n = 0, sx = 0, sz = 0;
					for (let j = 0; j < cand.length; j++)
						if (SquareDistance(cand[i], cand[j]) < 50 * 50)
						{
							n++;
							sx += cand[j][0];
							sz += cand[j][1];
						}
					if (n >= 3 && n < 15 && (!best || n > best.n))
						best = { "n": n, "x": sx / n, "z": sz / n };
				}
				if (best)
					for (const c of ccps)
						if (SquareDistance([best.x, best.z], c) < 250 * 250)
						{
							swat = best;
							break;
						}
			}
			if (swat)
			{
				this.armyCmdTurn = this.bot.turn + 10;
				if (!this.swatting)
					print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m swatting ${swat.n} leftover raiders at ${swat.x.toFixed(0)},${swat.z.toFixed(0)} (army=${armyEnts.length})\n`);
				this.swatting = true;
				const det = Math.min(armyEnts.length, Math.max(6, swat.n * 2));
				for (let i = 0; i < det; i++)
					armyEnts[i].attackMove(swat.x, swat.z, "Unit", false);
			}
			else
			{
				this.swatting = false;
				if (this.bot.expansionManager.warOn())
				{
				// Rally: at a pending expansion CC (escort the builders) else home.
				let rally = homePos;
				for (const pb of this.bot.constructionManager.pendingBuilds)
					if (pb.template === ccType)
					{
						rally = [pb.x, pb.z];
						break;
					}
				if (rally === homePos)
					for (const f of gameState.getOwnFoundations().values())
						if (f.position() && gameState.getBuiltTemplate(f.templateName()).templateName() === ccType)
						{
							rally = f.position();
							break;
						}
				if (rally)
				{
					let far = false;
					for (const ent of armyEnts)
						if (SquareDistance(ent.position(), rally) > 60 * 60)
						{
							far = true;
							break;
						}
					if (far)
					{
						this.armyCmdTurn = this.bot.turn + 25;
						for (const ent of armyEnts)
							if (SquareDistance(ent.position(), rally) > 60 * 60)
								ent.move(rally[0], rally[1]);
						for (const ent of healerEnts)
							ent.move(rally[0], rally[1]);
					}
				}
				}
			}
		}
	}
	this.hadThreat = !!serious;

	// Shelter: workers garrison the nearest holder with room when enemies are
	// close (60 m); holders eject once no enemy has been within 100 m for 20 turns.
	const holders = [];
	for (const ent of gameState.getOwnStructures().values())
	{
		if (!ent.position() || ent.foundationProgress() !== undefined || !ent.isGarrisonHolder())
			continue;
		if (ent.healthLevel() < 0.15)
			continue;
		holders.push({ "ent": ent, "pos": ent.position(),
			"free": (+ent.garrisonMax() || 0) - ent.garrisonedSlots() });
	}
	for (const h of holders)
		for (const p of mil)
			if (SquareDistance(p, h.pos) < 100 * 100)
			{
				this.shelterDanger[h.ent.id()] = this.bot.turn;
				break;
			}
	for (const h of holders)
		if (h.ent.garrisonedSlots() > 0 &&
			this.bot.turn - (this.shelterDanger[h.ent.id()] ?? -1000) > 20)
			h.ent.unloadAll();
	if (!mil.length)
		return;
	for (const ent of gameState.getOwnUnits().values())
	{
		if (!ent.isGatherer() || !ent.position() || (this.bot.armyManager.army[ent.id()] && !this.bot.armyManager.demobilized[ent.id()]) || ent.id() === this.bot.economyManager.herderId)
			continue;
		const state = ent.unitAIState() || "";
		if (state.indexOf("GARRISON") !== -1 || state.indexOf("REPAIR") !== -1)
			continue;
		const wp = ent.position();
		let danger = false;
		for (const p of mil)
			if (SquareDistance(p, wp) < 60 * 60)
			{
				danger = true;
				break;
			}
		if (!danger)
			continue;
		let best, bestD = 90 * 90;
		for (const h of holders)
		{
			if (h.free <= 0)
				continue;
			const d2 = SquareDistance(h.pos, wp);
			if (d2 < bestD)
			{
				bestD = d2;
				best = h;
			}
		}
		if (best)
		{
			best.free--;
			ent.garrison(best.ent);
		}
	}
};

/**
 * Foundation denial: an enemy military foundation (tower, fortress, army
 * camp, CC) going up at our border is the cheapest fight we will ever get
 * against it — kill the builders and the foundation before it completes.
 * Once a fortress stands, taking it without siege is a grind the army loses
 * (0.28 fortress: 5200 hp, 8x capture points at 45 cp/s regen; 0cae013 s57:
 * a 98-man purge ground 1.5 min on a built rome fortress, took the losses,
 * and the home CC fell to 2 rams while the army was away). Denial therefore
 * runs from the town phase on — Petra founds border fortresses during our
 * boom — with a proportional detachment (2x defenders, 8-30), and it
 * preempts starting a raid or purge but never interrupts an active raid.
 * Returns true while a denial is commanded.
 */
DefenseManager.prototype.manageDeny = function(gameState, armyEnts, mil, homePos, denyTarget)
{
	if (this.deny)
	{
		const target = gameState.getEntityById(this.deny.id);
		// owner() === us: a captured structure flips mid-denial — that is a
		// win, not a reason to keep attacking it.
		if (!target || !target.position() || target.owner() === this.bot.player)
		{
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m denied enemy foundation at ${this.deny.x.toFixed(0)},${this.deny.z.toFixed(0)}\n`);
			this.deny = undefined;
			this.armyCmdTurn = 0;
			return false;
		}
		let defenders = 0;
		for (const p of mil)
			if (SquareDistance(p, [this.deny.x, this.deny.z]) < 100 * 100)
				defenders++;
		if (target.foundationProgress() === undefined || this.bot.turn - this.deny.turn > 600 ||
			this.bot.armyManager.armyCount() < this.deny.needed || defenders * 2 > this.bot.armyManager.armyCount())
		{
			// Too late (it completed), stalled, the army melted, or Petra
			// reinforced the foundation beyond what the roster can beat — a
			// built structure from here on follows the purge rules, and the
			// donation rule forbids feeding the detachment into a lost fight.
			print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m foundation denial abandoned at ${this.deny.x.toFixed(0)},${this.deny.z.toFixed(0)} (built=${target.foundationProgress() === undefined}, defenders=${defenders}, army=${this.bot.armyManager.armyCount()})\n`);
			this.denyTried[this.deny.id] = this.bot.turn;
			this.deny = undefined;
			this.armyCmdTurn = 0;
			return false;
		}
	}
	else if (denyTarget)
	{
		this.deny = denyTarget;
		this.deny.turn = this.bot.turn;
		// The purge re-targets once the denial is over.
		this.bot.offenseManager.purgeTarget = undefined;
		print(`[DEFENSE] t=${(gameState.getTimeElapsed() / 60000).toFixed(1)}m denying enemy foundation ${denyTarget.template} at ${denyTarget.x.toFixed(0)},${denyTarget.z.toFixed(0)} (defenders=${denyTarget.defenders}, detachment=${denyTarget.needed}, army=${armyEnts.length})\n`);
	}
	else
		return false;
	if (this.bot.turn < this.armyCmdTurn)
		return true;
	this.armyCmdTurn = this.bot.turn + 10;
	const byDist = armyEnts.slice().sort((a, b) =>
		SquareDistance(a.position(), [this.deny.x, this.deny.z]) - SquareDistance(b.position(), [this.deny.x, this.deny.z]));
	const det = byDist.slice(0, this.deny.needed);
	for (const ent of det)
	{
		// On approach prefer units: killing the builders stalls the
		// foundation even when the detachment cannot finish it.
		if (SquareDistance(ent.position(), [this.deny.x, this.deny.z]) < 60 * 60)
			ent.attack(this.deny.id, false);
		else
			ent.attackMove(this.deny.x, this.deny.z, "Unit", false);
	}
	return true;
};

/**
 * Deny-target scan: enemy military foundations near our border — the same
 * "near" rule as the purge (150 m of an own structure, 130 m of a planned
 * expansion spot). Runs every block from the town phase so the
 * demobilization logic sees the denial as incoming and keeps the working
 * army mobilized for it.
 */
DefenseManager.prototype.findDenyTarget = function(mil, homePos)
{
	if (!this.bot.expansionManager.defenseOn() || !homePos || this.bot.offenseManager.target || this.deny)
		return undefined;
	const gameState = this.bot.gameState;
	const spots = this.bot.expansionManager.expPlan?.spots || [];
	let best, bestScore, bestDef = 0;
	for (const ent of gameState.getEnemyStructures().values())
	{
		const pos = ent.position();
		if (!pos || ent.foundationProgress() === undefined)
			continue;
		if (!ent.hasClass("Tower") && !ent.hasClass("Fortress") &&
			!ent.hasClass("ArmyCamp") && !ent.hasClass("CivCentre"))
			continue;
		if (this.denyTried[ent.id()] && this.bot.turn - this.denyTried[ent.id()] < 600)
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
		// Too hot for a detachment: the donation rule stands — better no
		// denial than a 30-man feed into a 40-defender foundation.
		if (defenders * 2 > 30)
			continue;
		const score = defenders * 10000 + SquareDistance(pos, homePos);
		if (best === undefined || score < bestScore)
		{
			best = ent;
			bestScore = score;
			bestDef = defenders;
		}
	}
	if (!best)
		return undefined;
	const needed = Math.max(8, bestDef * 2);
	if (this.bot.armyManager.armyCount() < needed)
		return undefined;
	const bp = best.position();
	return { "id": best.id(), "x": bp[0], "z": bp[1], "needed": needed, "defenders": bestDef, "template": best.templateName() };
};
