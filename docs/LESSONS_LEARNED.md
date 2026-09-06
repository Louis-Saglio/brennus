# Lessons learned

Cleared 2026-08-29. Reference knowledge was migrated into
`docs/game_description/`, `docs/ai_engine_api.md` and `docs/pyrogenesis_cli.md`.

## 2026-09-06 (b7fc612 century-sweep loss autopsy: s55, s61, s99)

- The b7fc612 sweep lost s55 (38.7m), s61 (32.6m), s99 (40.6m). s61/s99 were
  timeouts in the e02d97b sweep: the #4.x fixes flipped 5 of 6 old losses
  and churned 2 new ones in. s55 is the same holdout as before.
- Demobilization fired 0 times in all 3 losses (grep "demobilizing"). The v2
  gates (food<100 AND civFood<6 AND civWorkers<12 alive) detect a DEAD
  civilian economy; the post-raid reality in all 3 losses is 12+ women alive
  (sheltered) and 15-26 soldiers idle — logStatus `idle=` confirmed 15 (s55
  t=15), 26 (s61 t=18), 14 (s99 t=15-20). The "count heads" fix made the
  insurance unreachable exactly where it was designed for.
- Pre-city the army receives NO orders between threats (the rally is
  warOn-only, deliberate) and no code path attacks an enemy structure or
  build crew: raid/purge/sortie are all warOn-gated, purge needs army>=60
  and only targets CC *foundations*. Petra's forward CC (s99 ~19m), tower
  (s61 ~18m) and fortress (s55 ~26m) were unanswerable by construction.
- s55 and s99 never researched city although stone/metal were banked (s99:
  1314/1119 by t=18, 5012/6441 at the end). phase_city_generic costs 750
  stone + 750 metal and requires **3 Town-class structures** (gaul: CC,
  market, temple/tavern, forge — barracks is Village). Both games sat at
  `town=2` for 20+ min: trio buildings were razed as foundations by repeat
  raids, and managePhaseUp returns silently on canResearch=false — no log,
  no watchdog, no rush-rebuild of the missing Town structure.
- Sticky assignments: assignGatherers only reassigns IDLE units. Stone/metal
  shares drop to 0 once the 850/850 bank is full, but miners stay on their
  mines forever — s99 used only 300 of 5631 stone and 600 of 7023 metal
  gathered, while wood stock sat at 4-141 all game (lumberjacks massacred at
  exposed woodlines; mean dropsite distance 43-80m, rates 6-18%). Food
  mountain: 21.5k at t=35. The wood collapse (not food) blocked the
  re-muster: army stayed 1-6 from t=28 with 9-15k food in stock.
- Engine gather autocontinue drift is corrected for wood and fruit/meat but
  NOT stone/metal: exhausted-mine miners chain to far unserved mines (s99:
  21 miners at a mine ~180m from the CC at t=16, rates 35-57%). The
  underserved-mine storehouse orders then FAILED 3x (placementOK=true,
  terrOwner=1 — territory flip by Petra's forward CC and/or the documented
  same-block stock race; wood was 39-107 in that window).
- Barter has no food->wood path pre-city (only stone/metal excess -> wood at
  >=1300 in the post-spend balance, which never fired in s99). Worse, s99
  SOLD wood for stone/metal at t=24.1-24.6 while wood was ~40-100 and
  stone/metal already >1300/900: the buy branch picks sell=max(food,wood) on
  the post-defense-spend balance and has no floor protecting the bottleneck
  resource.

## 2026-09-06 (working army + gatherer reallocation: s55/s61/s99 fixes 1+2)

- Louis's doctrine: a citizen-soldier works or fights; idling is only legal
  briefly while a threat converges. Implemented as full demobilization of
  the gatherer-capable roster to the worker pool (assignGatherers treats
  them as workers; armyEnts skips them) after 40 quiet turns pre-war, NO
  standing guard kept. Recall when `incoming` (serious threat, threat flag,
  or 5+ enemy military within 250 m of the home CC), war on, or defense
  off. On recall soldiers move to the home CC instead of stopMoving in
  place — converge before contact, not a piecemeal walk into the blob.
- Reallocation: assignGatherers now stops up to 2 assigned workers per
  block whose resource exceeds its share by >= 4 heads (GATHER state only,
  herders excluded); they go idle and the share logic reassigns. Cures the
  s99 shape (46 miners on banked stone/metal while wood starved).
- Results (kiln, standard settings): probe 8 seeds 0 errors, s55 loss ->
  timeout (first city at 30.5m), s99 loss -> timeout, s61 unchanged loss
  (accumulation race, not idleness). 15-seed validation vs baseline: wins
  6 -> 10, losses 3 -> 2, but two churn regressions (s7 timeout -> loss,
  s30 win -> loss; s30's first wave met cavalry-led contact before the
  recalled infantry converged — motivated the converge-home recall).
  Re-probe with converge-home: ALL 5 timeout, 0 errors, s61 loss ->
  timeout. Final validation tally 10W/5T/0L (baseline 6W/6T/3L).
- Demob fires from t=4.3-6.9 (town) and recalls land before waves. The
  demob= counter in logStatus makes the working army directly observable
  (peaks 40-88 mid-game).
- KNOWN OPEN ITEM (standoff stall, pre-existing, now visible as churn):
  when Petra camps permanently within 250 m, `incoming` never clears and
  the army never demobilizes (s55/s99 idle=51-65 rows while the camp
  lingers — both still held as timeouts). s99 also shows demob<->remob
  oscillation (~0.2 min period) when the camp sits on the 250 m boundary.
  Options: shrink the recall radius, or allow demob when a standoff
  persists N minutes without turning serious. Awaiting Louis's call.
- Marginal-seed chaos is real: s7/s30 flipped on a one-line recall tweak
  between two validation runs of the same code intent. Verdicts on
  individual marginal seeds are noise; the 15-seed tally is the signal.

## 2026-09-06 (failed approach: mass-behind guard on the leftover swat)

- Hypothesis: s55's post-#4.4 death was swat detachments donated into
  Petra's standing camp (army 59 -> 18 in a minute at t=30-31). Guard:
  refuse the swat when enemy mass within 120 m of the group centroid
  exceeds max(cap, 2n).
- Empirics (6 raid-heavy seeds, caps 12 and 24): the block list is a mix of
  wave-adjacent bait (mass 37-107 — blocking helped s21 +22%, s81 +14%) and
  retreating cleanup columns (mass 13-32 — blocking hurt s57 -47%, s70
  -25%, s63 -13%). No cap separates them: mass count cannot tell
  "advancing wave's leading edge" from "broken raid's stragglers". Net
  -11% aggregate wood, same 5/6 wins, s55 unsaved — REVERTED.
- In the guarded s55 timeline the bleed did not even reproduce: the army
  grew 34 -> 50 during t=28-32 and the base fell to Petra's 103+2 rolling
  in while the boom sat wrecked from two early raid crashes (pop 109 -> 56,
  96 -> 58). s55's residual death is the ACCUMULATION RACE (Petra masses
  100-175 at ~190 m while our muster throughput is ~15 soldiers/min), not
  positioning. The original loss-review death modes for s55 (army across
  the map purging; swat bleed) no longer occur post-#4.1..#4.5.
- The pre-city turtling discipline (no sortie before war stage; the agg5
  donation) means a looming camp pre-city is answered only by muster
  throughput. Raising that (4th barracks vs boom wood) is a trade against
  the 19 winning seeds — open question, not started.

## 2026-09-06 (demobilization: soldiers restart a massacred economy)

- The pre-war deadlock from the #4.1 post-mortem: a raid wipes the food
  economy -> food stock 0 -> no women trainable -> no gatherers -> the army
  sits at ~20 for 15 min. `manageDemobilization` lends up to 10
  citizen-soldiers (never more than half the army, `canGather("food")` only
  — champions can't) to the gatherer pool; they stay in the army roster but
  are skipped by armyEnts and treated as workers by assignGatherers and the
  shelter logic. Recall all on: serious threat, war stage, food > 400, or
  8+ civilian food gatherers.
- The gate must be ALIVE civilian workers < 12, not gathering-food workers
  < 6: v1 keyed on gatherers and fired on shelter episodes (garrisoned
  workers have no position -> uncounted -> civFood=0 while 19 workers sat
  alive in the CC). s57 churned 8-10 soldiers through 12-18 s
  demobilize/remobilize cycles during the defense window and flipped to a
  loss. Sheltered != dead; count heads, not assignments.
- Probe v2 (6 raid-heavy seeds): demob never fired — every game
  bit-identical to the #4.4 baseline (s57 and s70 recovered their wins).
  Dormant insurance, like the #4.3 eject: the massacre scenario no longer
  occurs in the 20-seed suite now that the swat+eject keep economies alive.
  The plumbing itself was live-fired by v1 (soldiers got assignments,
  gathered, recalled; zero JS errors).
- Validation (the other 14 seeds): 14/14 wins, zero JS errors, demob never
  fired — every game bit-identical to the #4.4 wave (wood matched to the
  unit). Scoreboard unchanged: 19/20, only s55 loses (positioning item).

## 2026-09-06 (leftover swat: the threat scan is no longer CC-centric)

- The threat scan counted enemies only within 120 m of an own CC, so raid
  leftovers burning outer storehouses/fields beyond the ring never got an
  army answer (the second half of the s63 loss-review note). Now, when the
  army would otherwise idle (no serious threat, no raid, no purge), the
  biggest leftover group — 3-14 enemies beyond every CC ring but within
  60 m of an own structure and 250 m of an own CC — gets a proportional
  detachment (`max(6, 2n)`) attack-moving its centroid. 15+ is a siege
  camp: the war-stage sortie's job, not a swat.
- Detachment, not whole army: the bulk stays home while Petra's main army
  looms; the serious branch re-scans every block and preempts within 5
  turns if a real wave lands. Pre-city gets the swat but deliberately NOT
  the rally (validated behavior — a misleading "fall through to the rally"
  comment said otherwise; the rally lived inside the war-stage else).
- Probe (6 raid-heavy seeds): all 5 wins held, s55 loss but +13% wood;
  s57 +80% wood (25.5k -> 45.8k — the swat protects the outer economy where
  the stuck-at-20 army used to stand), s63 +5%, s45 +5%, s81 -10%, s21 -4%
  (chaotic variation, wins held). Zero JS errors.
- Validation (the other 14 seeds): 14/14 wins, zero JS errors, swats fired
  on every seed (3-17 per game). Wood gathered 752k -> 937k aggregate
  (+25%): s2 +148%, s4 +120%, s22 +81%, s3 +54%; s39 -29% and s47 -39%
  are chaotic variation on games that still won comfortably. Scoreboard
  post-fix: 19/20, only s55 loses (positioning item).

## 2026-09-06 (army garrison eject: hide only while the serious threat lasts)

- Engine/API fact: garrisoned units have no `position()`, so they silently
  drop out of `armyEnts` — every consumer downstream of a garrison order
  (minor-probe swat, raid, purge, rally) runs at reduced strength until an
  explicit `unload`. `armyCount()` (roster by id) still counts them, so the
  HARNESS `army=` line hid this; the `gar=` field now reports it.
- The deadlock (s63 loss-review note): the outnumbered branch garrisons the
  army, but eject existed only in the serious+superiority branch and in the
  worker-shelter timer (needs zero enemies within 100 m for 20 turns). A
  sub-8 leftover group lingering in the 100-120 m ring kept the threat
  non-serious AND the shelter timer refreshing — the army hid forever while
  the outer economy burned.
- Fix: eject roster soldiers/healers from all own holders
  (`ejectArmyGarrisons`) whenever no serious threat for 30 turns (settle
  against border-flapping), and from the superiority branch regardless of
  which CC they hid in (the fight may have moved). Workers stay managed by
  the shelter logic.
- Evidence: the eject print can only fire when soldiers sat garrisoned
  30+ turns past the last serious threat. Probe on 6 raid-heavy seeds: it
  fired once on s55 at 13.8m (9 soldiers freed; loss but wood 11.7k ->
  15.1k); the other 5 seeds stayed bit-identical to the pre-fix run
  (outcomes + wood matched exactly), i.e. the fix is dormant where threats
  end cleanly.
- Validation (the other 14 seeds): 14/14 wins, zero JS errors, eject never
  fired — every game bit-identical to the #4.2 wave (wood matched to the
  unit). Dormant-but-safe everywhere except where the deadlock is real.
  Scoreboard post-fix: 19/20, only s55 loses (positioning item).

## 2026-09-06 (defense buildings at cost level + pop-gated accumulation hold)

- The two reserve deadlocks flagged by #4.1 are fixed: tower floors
  300/300 -> 100/100 (cost), muster-building floor 320 -> 300, and while a
  muster building is missing AND unaffordable the bot holds
  `constructionDefense` — honored in `manageConstruction` AFTER the
  dropsite call, so storehouses/one-time civic buildings keep firing and
  only houses/fields pause. This is the same lesson as the s90 storehouse:
  a rigid stock floor starves the very investment that matters in a war.
- The hold needs a pop-margin gate: `popLimit - population - queuedPop`
  must exceed `defenseHoldMinPopMargin` (8) or the hold releases. Without
  it, a pop-choked bot (s90 sat 40/40 from 4.5m to 10m, wood <300 the
  whole time) stalls its own boom — v1 (full construction hold) and v2
  (houses/fields only) both starved s90's storehouses exactly this way
  (8.3k wood, loss). With the gate: margin 0 -> houses fire (s90); margin
  14-20 -> hold accumulates (s21).
- Probe (s90/s21/s57/s63/s55): 4 wins, zero JS errors; s90 95.2k wood (its
  best ever), barracks at 6.8-9.2m (was 9.2-12.7m pre-#4.2), towers built
  on every seed. s55 still loses — same deathball-razes-home-CC-while-army-
  purges-away positioning death, the remaining #4.x item, not this fix.
- Validation (the other 15 seeds): 15/15 wins, zero JS errors, towers on
  every seed (3-25 per game). All 11 established winners held, watch seeds
  1-5 all win and s2 flipped to a win (its mid-game military death is what
  this fix targets). Scoreboard post-#4.2: 19/20; only s55 loses.
- Three-stage saga on one seed is the chaos tax: v1 and v2 both made s90
  strictly worse for a root cause invisible in stats (pop choke). The log
  diff (first divergence) found it in minutes; stats alone never would.

## 2026-09-05 (retraining surge: muster toward the observed enemy army)

- Pre-city, when the enemy's standing army exceeds `musterTarget`, the
  muster target becomes `min(enemyArmy, surge.cap=100)` (batch 3 instead of
  1). Re-fielding 60 against a 100+ wave lost every time (s55 met 120 with
  60; s70/s81 sat at army~20 for 15 min after the first wave). War stage
  (city) unchanged: armyTarget 120.
- The stuck-at-20 army on s57/s70/s81 was NOT a floor/tuning problem: the
  pre-war floors are already cost-level (50/50) — food stock sat at 0-40
  for 15 min because the raid kills the food economy and it never
  restarts (idle soldiers don't gather: that's the demobilization item).
  Batch size is queue depth, not throughput: 3 barracks cap at ~15
  soldiers/min from train time alone.
- Validation (20 seeds): 12 wins on the losing set (was 11 post-#3; 57,
  70, 81 flipped to wins; 21, 63 churned to losses on near-neutral target
  changes — 62/63 vs 60 — pure butterfly), 4/5 watch. s55 still loses but
  fields 100 by 25m (was 60): the final blow was a 145+6-siege deathball
  razing the home CC while our 68-strong army purged fortresses across the
  map — positioning/response, not retraining.
- Two reserve-deadlock sightings for a future defense-readiness fix:
  towers need wood>=300 in stock to place (cost 100) — s57 built ZERO
  towers with stone at 1400; barracks need wood>=320 — s21's three
  barracks landed at 12.7m although town phase came ~6m earlier. Both are
  the s90-storehouse pattern (a rigid stock floor starving the very
  investment that matters during a war).

## 2026-09-05 (wood-mass gate: no storehouses on straggler clumps)

- The wood storehouse trigger now ranks demand points farthest-first and
  walks clumps until one passes a mass gate: total remaining wood of trees
  within `woodServeDist` (30 m) of the clump centroid must be >=
  `storehouseMinWoodMass` (500). Thin clumps are skipped without spending;
  each gated spot is logged once (30 m dedup) with mass and ccDist.
- Measured on temperate (200 wood/tree): straggler traps are single trees
  or pairs, mass 140-400 (s21 alone had 24 gated demands <=200); the home
  groves that must stay covered start at ~700. The first cut at 1000
  blocked the home grove on s2 (714, 44 m from CC; first storehouse
  1.7m->9.3m) and s45 (800, 33 m; 0.0m->5.9m) and both games were lost —
  the early home-grove storehouse is load-bearing even when its grove is
  thin. 500 splits the two clusters with margin on both sides.
- A storehouse's payback is the wood it serves, not the demand point that
  triggered it: the per-tree gate (`storehouseMinTreeWood`) is not enough
  — a demand point on one 200-wood straggler passes it while the whole
  neighborhood holds nothing.
- Validation @500 (15 losing seeds + watch 1-5): 11 wins on the losing set
  (7, 21, 22, 30, 39, 45, 47, 63, 74, 77, 90; was 9 pre-#3), 4/5 watch.
  Every remaining loss (2, 55, 57, 70, 81) is the same military death —
  Petra's 100+ mid-game army meeting no defensive answer — with the
  economy healthy (s2 pop 180 @20m; s55 pop 187/266, town=4; s81 wood
  9.1k->21.9k). The economy bucket of the loss review is closed; what
  remains is the military chain.

## 2026-09-05 (fast rejection detection + short storehouse spot poison)

- Engine fact (Commands.js:1101 `TryConstructBuilding`): a construct
  command creates the foundation INSTANTLY at processing, or is silently
  rejected (BuildRestrictions — storehouses inherit `Territory own` —
  entity limits, tech, real stock; a rejection charges no resources). The
  "builders still walking" model behind the 50-turn pendingBuilds timeout
  was wrong: the wait only delayed the re-order.
- pendingBuilds: non-CC timeout 50 → 10 turns (2 blocks; no foundation by
  then = rejected). The FAILED print gains `t=` and `(placementOK,
  terrOwner)` forensics; failedSpots entries carry the template; storehouse
  spot poison 1500 → 300 turns so a transient rejection doesn't block the
  clump's best ring spot for 5 min.
- Validation on the 15 losing seeds vs the frontier-storehouse-only mod:
  no seed newly loses; the 4 genuine wins hold (22, 45, 63, 90); s30 went
  genuine → timeout through chaotic divergence in the CC *expansion* orders
  (games identical until t=23.4), not the storehouse path. Seeds with zero
  FAILEDs (39, 55, 57, 70, 81) produced identical economies — the change
  only acts on failures. Fast retry visible in s30: corral rejected at
  23.7/23.8/24.4, succeeded on the 4th spot in the same minute.
- The forensics split failures into placementOK=true/terrOwner=1
  (transient: stock race or grid lag — most storehouse failures) and
  placementOK=false (persistent spot invalidity). Corrals fail
  DETERMINISTICALLY with placementOK=true (s1 6x, s3 3x, s30 3x) — a
  separate unexplained subsystem (likely a same-block stock race or a grid
  disagreement our check can't see); not storehouses.

## 2026-09-05 (frontier storehouse: anticipate saturation, don't wait for stranding)

- The wood storehouse trigger no longer waits for stranded choppers:
  `assignGatherers` records every drifted chopper's tree in `woodFrontier`
  and the block's free served-tree slots in `woodFreeSlots`; when slots run
  below `woodSlotMargin` (4) and no chopper is stranded, `manageDropSites`
  builds at the drift frontier. The wood branch also ignores the reserve
  (`wood >= 100` flat): holding the 150 fundWood reserve against a wood
  storehouse deadlocked s90 (income collapsed → never 250 in stock → never
  a storehouse → income never recovers).
- Validated on all 15 losing seeds + 5 winning seeds, 0 JS errors: 5
  defeats → genuine wins (22, 30, 45, 63, 90), 4 → timeouts (7, 47, 74,
  77), 6 still lose (21, 39, 55, 57, 70, 81).
- Second storehouses land at 2.1-6.0 min (were 5:18-9:18); barracks come
  1-4 min earlier (s21: 13.4→9.4; s45's army at the wave: 28→60).
- Side effects to watch: storehouse volume up (15-44/game at 100 wood
  each). s81 got worse (wood 17.6k→9.1k, one barracks all game) — frontier
  storehouses there spent wood that never paid back. s3/s4 went genuine
  win → timeout (bigger mid-game armies, slower kill; chaotic, not
  understood). Levers if tightening is needed: min frontier size >= 2,
  per-clump wood-mass scoring.
- Turn rate: no bookkeeping regression (s1 timeout pair 62→77 t/s); s3/s4
  slower per turn but those games ran to the cap with more entities on the
  map — confounded, not attributed to the change.

## 2026-09-05 (15-seed loss review, all reproduced on kiln)

Re-ran the 15 losing seeds of the 1-100 sweep (standard settings) on the
current mod: all 15 reproduced as genuine defeats, 0 JS errors. Verified:

- Petra's first big wave is 44-105 soldiers arriving 11:18-16:36 — the
  "15-17 min wave" assumption near brennus.js:2516 is optimistic; it can
  land at 11:20. 13/15 losses die to this wave with army 0-59.
- Wood gather deficit vs Petra splits the losses cleanly: the
  storehouse-cluster seeds gathered 2.2-4.2x less wood; the
  military-cluster seeds (s45/s63/s77) were at parity (1.0-1.3x) — the
  defense chain loses games even with a healthy economy and 4 towers.
- The t=0 reactive storehouse fires in 14/15 seeds (initial trees are
  already >30 m from the CC). The failure is the SECOND storehouse: it
  waits for slot saturation, landing at 5:18-9:18 (s22: 9:18, s30: 8:54,
  s47: 9:00) while the distance warning fires from t=5.
- s90: first storehouse at 13:36 with NO placement failure and NO
  underserved burst before it — the 250-wood effective gate (100 + 150
  reserve while muster buildings are missing) plus failing income is a
  chicken-and-egg loop: no storehouse → no wood → can't afford the
  storehouse → no barracks ever (5.6k wood gathered all game).
- `construct FAILED` on storehouse foundations hit 6/15 losses (s30, s39,
  s55, s63, s74, s81): 100 declared wood + 5-min poisoned spot + coverage
  gap each time.
- A "storehouse for 1-2 underserved choppers" log line is the straggler
  signature (s21: 11 wood storehouses by 12:36, barracks delayed to 13:24;
  s70: 12 by 15:30).
- Zero `barter -> wood` lines in all 15 — the missing wood-buy path is
  systemic, not situational.
- s63 logged `[DEFENSE] engaging ... (army=0)`: `armyEnts` excludes
  garrisoned soldiers while `armyCount()` includes them — superiority was
  decided on paper and zero units actually attacked.
- s57: after repelling the wave the army rebuilt to 33 but worker
  utilization fell to 52% and wood efficiency hit 0% in the 25-m bucket —
  permanent army membership leaves a third of the population idle while
  the economy starves.

## 2026-08-30 (border purge: the army clears forward enemy structures)

- New `managePurge` in the defense chain (after the raid and the
  minor-threat swat, before the sortie/rally): war-stage only, army >= 60,
  1.5x local superiority, abort at army < 40 or 3 min. Targets enemy
  `Tower`/`Fortress`/`ArmyCamp` (any build state) and `CivCentre`
  foundations within 150 m of an own structure or 130 m of a planned
  expansion spot. Infantry attacks with `allowCapture=true` (its damage
  bounces off structure armor: stone tower hack 29); rams tag along but are
  not required. Pre-war, forward towers still get no army response.
- Class facts from the pinned templates: all towers (sentry/stone/bolt/
  artillery) inherit the `Tower` class; wall towers do NOT (`WallTower`
  under the wall parent). Rome's army_camp is class `ArmyCamp` (not
  `Fortress`), builds in neutral/enemy territory and does not decay there
  (`TerritoryDecay disable`) — it is the structure that farms our border.
- A captured purge target flips owner to us mid-purge; `owner() === self`
  must count as success or the army keeps attacking its own new structure.
- Validated on 8 seeds (probes 9/11/13, validation 2/4/6/8/10): 58 purges
  started, 0 aborted, 6 genuine wins, 2 timeouts, no JS errors, turn rate
  unchanged (65-123 t/s). Petra rebuilds forward towers on the razed spot;
  the purge re-razes them every time (s9: the same tower 5x). s9's timeout
  is the known arsenal-footprint failure (0 rams all game, no raids), not
  the purge.

## 2026-08-29 (siege-only threat centroid fix)

- Fixed the threat-centroid bug from the findloss review below: `manageDefense`
  now accumulates a siege centroid (gsx/gsz within 160 m) and uses it when
  `n == 0`, instead of `sx/Math.max(n,1)` = (0,0). Smoke match (mainland s7)
  ran clean: exit 0, no JS errors, all `[DEFENSE]` centroids on real CC
  positions.

## 2026-08-29 (findloss 112-seed review)

- The Gaul arsenal footprint is 29x29 (barracks 20x20, temple 22.5). Once the
  home-CC ring is crowded (~50 houses + fields + towers), `tryConstruct`
  finds no spot and `manageDefenseBuildings` fails silently: no log, no
  spend, the wants loop returns on the first missing type. 12 of 24 timeout
  seeds never built an arsenal, so no rams, so zero raids in 45 min.
- Rams have 35 pierce armor: garrison arrows (CC/towers) do ~2.5% damage to
  them. Garrisoning the army when outnumbered while enemy rams attack the CC
  loses the CC. Rams die to melee (hack armor 7).
- Threat centroid bug in `manageDefense`: a siege-only threat (n=0) computes
  centroid (0,0), so the superiority branch attack-moves the whole army to
  the map corner. Fired in 13+ games of the 112 (s77: 10 times).
- The storehouse self-raze rule (destroy when nearest supply > 60 m) throws
  away wood coverage mid-war; all 6 wood-collapse losses show self-razes
  right before the wood distance jumps to 100+ m for 10-25 min.
- Enemy towers are invisible to threat/shelter/gathering after the initial
  woodline scan: workers keep chopping under a new enemy tower until dead
  (s111), and the army never attacks lone forward towers (s109).
- No barter path buys wood: food mountains of 25-59k sat unspent while wood
  income was ~0 (s7 46k, s38 40k, s109 25k food at defeat).

## 2026-08-29 (woodline removal, woodrx batches)

- The woodline system (ring rule + hotspot scan + keep thresholds + fast/slow
  storehouse paths) was replaced by three per-gatherer rules: entry tree =
  min walk cycle among the 20 nearest trees (slot cap
  `treeMaxGatherers`=4 via `resourceSupplyNumGatherers()`); pull-back of
  empty-handed choppers whose tree is >`woodServeDist`=30 m from every wood
  dropsite; storehouse at the clump of choppers the pull-back could not
  serve, gated on the tree holding >=`storehouseMinTreeWood`=100.
  `woodPoor`, the stranded-storehouse self-raze, and the proactive first
  storehouse are gone.
- Validated on 6 mainland seeds vs the pre-rewrite baseline: all 6 won
  (baseline lost s1); wood gather rate 54-70% everywhere late (baseline
  dipped to 33%); mean lumberjack-dropsite distance 17-40 m late (baseline
  80-140 m on three seeds); no JS errors; turn rate unchanged.
- The reactive rule builds many more storehouses (16-39 wood storehouses per
  game vs 11-21 total before): each frontier advance of ~30 m spawns one.
  Affordable on wood-rich maps (stocks still reached 15-35k) but watch it on
  shrub maps now that `woodPoor` is gone.
- The old baseline over-built too in a different way (s3: 45 total) while
  still leaving choppers at 122 m mean distance — coverage gates and
  placement were decoupled from where choppers actually worked.

## 2026-09-05 (century sweep loss analysis)

- 100-seed sweep (standard settings): 55 win / 39 timeout / 6 loss
  (s2, s21, s55, s62, s63, s73). No JS errors in any game.
- All 6 losses share one shape: Petra's first 60-75 army arrives at
  t=13-17, the "retraining surge" fires at t=11-12.6 but Brennus has only
  4-56 soldiers then (wins have 37-59 at t=13). The decisive defensive
  battle is lost by t=16-28 and the army never recovers (stays at 6-36 for
  10+ min) while Petra camps the CC with 100-160 army + 2-8 siege.
- Losses are objective losses, not attrition losses: Brennus out-killed
  Petra in all 6 (e.g. s73 29.5k vs 23.4k) but lost its CC every time and
  never destroyed a Petra CC (0 in all 6; wins destroy 1-2).
- After the collapse Brennus retrains workers, not soldiers: pop recovers
  (s55 168→257, s62 539 workers trained vs 103 infantry) and resources
  stockpile unspent (s62: 7.5k food/2.5k metal at t=23-25; s21: 2.1k food
  at t=13) while army stays at 10-30.
- Siege timing splits the outcomes: wins train rams at t=18-27 and purge
  Petra structures from t=19; losses train 0 siege (s55: 4 rams at t=33,
  game over at t=35.7).
- Even-numbered mid-game battles are lost badly (s62: army 86→37 while
  enemy stayed ~88; s63: 68→23 vs 103→82) — [DEFENSE] lines show only
  9-19 enemies engaged near the CC at a time, i.e. the army fights
  fragmented while Petra's arrives as one ball; losses also lag on techs
  (2-8 vs 9-10 in wins by t=23-33).
- Battle location is the tell: losses fight within 20-250 m of the home CC
  from t=14 on; wins keep enemyNear at 300-500 m and erase Petra's army by
  t=23-28 (enemy <= 20).

### Code mechanisms behind the loss patterns (brennus.js)

- Surge trigger is a pure count threshold: `enemyArmy > 60` (full map
  visibility, no fog) — Petra crosses it at t=11-12.6, ~1-2 min before her
  wave arrives. Too late to matter when barracks are late: s2/s21 ordered
  the first barracks 5.9-6.8 min after town phase (wins: 0.2-1.9 min), so
  the surge had no trainers and first contact was met by 4-7 soldiers.
- The defense decision is binary on `armyCount() >= nearThreat` (enemies
  within 150 m of the threat centroid): superiority → whole army
  attack-moves the centroid; else → garrison CC + towers. With comparable
  totals (s62/s63/s73: 68-87 vs 80-100) this tips into attack-moving basic
  infantry (techs 1-2) into Petra's upgraded ball, and each new trainee
  walks from the barracks into the blob alone at the next 10-turn command
  tick.
- Post-collapse, every offensive path self-locks: raid needs warOn +
  army>=75 + 2 rams; purge needs warOn + army>=60 + NO camp of 15+ within
  220 m of home (Petra's camp permanently disables it); sortie needs
  warOn + army>=100 + 1.5x camp. An army of 10-40 with Petra camping has
  no legal move except garrison/eject oscillation.
- War-stage muster floors (wood >= 300) starve the rebuild exactly when
  the economy is raided: s62 sat on 2188-7554 food with army 15-25 because
  wood stayed 59-181 (< 300 floor) while workers sheltered. Food piles up
  unspent because infantry needs food AND wood above floors in the same
  block.
- Worker sheltering (enemy within 60 m → garrison) idles the whole economy
  while Petra camps: income → 0, muster floors unmet, barracks rebuilt
  slowly (builders sheltered). The 539 "workers trained" in s62 are mostly
  refills of raided workers, not growth.

## 2026-09-06 (border-fortress loss, 0cae013 s57)

- Loss shape: Petra founded a fortress 290 m from our home CC at ~t=25 while
  the working army was demobilized — nothing reacted (the purge was
  war-stage only). At t=30.4 the fresh war-stage purge ground the BUILT
  fortress with 0 rams for 1.5 min (army 98→88), and when 2 rams + escort
  hit the home CC at t=31.9 the recall walk was 290 m; the army bled 88→14
  at home and the CC fell. Defeat at 35.2m.
- 0.28 fortress: 5200 hp, capture points 8x the structure default at 45
  cp/s regen (template_structure_military_fortress). Infantry capture
  cannot beat the regen and hack damage bounces off — never send a purge
  against a built fortress without rams; deny the foundation instead.
- Foundation denial works: foundations carry the built template's classes
  (`foundation|structures/rome/fortress` still hasClass("Fortress")), so
  the class filter sees them. A detachment of 2x defenders (min 8) kills
  builders + foundation; s57 probe denied that exact fortress at t=25.0
  and won. Abort the denial when defenders mid-denial exceed half the
  roster (donation rule) — Petra reinforces foundations she cares about.
- Proportional recall: on a serious home threat during a raid/purge, recall
  only the shortfall (1.5x threat + 4 per siege engine) when the away force
  stays >= 50, else cancel the mission. Recall floor must be checked
  against the TOTAL needed (away keeps army-needed), not the per-block
  shortfall — block-by-block escalation otherwise slides the away force
  below the floor (s3 probe: 55 recalled, +3, away kept 47).
- Recalls must be sticky: recalled ids count as responding wherever they
  are, or a detachment still marching home is re-recalled every 5-turn
  block and the whole army ends up recalled anyway.
- Probe (5 seeds: 57, 63, 109, 3, 30): 5 wins, 0 JS errors.
