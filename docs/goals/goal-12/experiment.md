# Goal 12 — Defeat very hard aggressive Petra (started 2026-08-25)

**Status: in progress.**

All runs local (`tools/run.sh -a super_brennus -d 5 -v aggressive -t 900 bot
tmp/goal12 <tag>=<seed>...`) — kiln unused per the goal file. Spec:
`random/mainland` 192, temperate, circle, `conquest_civic_centers`, bot =
`super_brennus` gaul vs Petra diff 5 **aggressive** rome. Verdict read from
`<outdir>/<tag>/stdout.log` (`playerState` + `timeElapsed`; a 45-min
trigger-ended run does not count).

## Baseline (super_brennus = goal-9 boom copy, zero military) — seeds 1-3

All 3 seeds **defeated**. Zero JS errors. The boom works (s1: 82 pop at
t=10m, town 4.4m) but the base is wiped the moment very-hard Petra's army
arrives: pop 82 → 1 between t=10m and t=13m on s1 (wave lands ~10-12 min,
~4-6 min earlier than medium's ~16 min). End stats: bot trained 94-166
civilians, 0 military; Petra trained 178-292 military and gathered 2-7×
more (83k vs 12k on s1, the longest game at ~26 min).

## Iterations (probes on seeds 1-3)

- **mil1** (ported the goal-10 military layer: defenseOn at town / warOn at
  city gates, standing army (target 60 pre-city, 120 after), barracks
  spear/javelin muster at flow-level floors pre-city, 3 barracks + 5 home
  towers from town, arsenal+rams (6) + temples (fanatics) + forge at city,
  garrison-shelter defense with superiority check on the 150 m threat
  centroid, sortie gate army ≥ 100 AND ≥ 1.5× camp, raids at 75+ army with
  ≥ 2 rams, war-stage worker cap 150 / dismissal floor 145 / phase-3 mining
  shares 0.06 stone 0.12 metal until 400s/800m banked, military state in
  Serialize, failedSpots expire after 1500 turns): **all 3 seeds defeated,
  zero JS errors** (s1 28.6m, s2 24.3m, s3 28.9m). The layer buys ~15 min
  vs baseline but the muster is too small at contact: army 20/11/23 when
  the first wave lands at 10.6/11.5/10.8m (goal 10 had 60 by 16m — the
  wave arrives ~5 min earlier at diff 5 and town-phase barracks leave only
  ~6 muster minutes). No seed ever researched city: the camping wave kills
  the food/wood income (workers shelter), grain techs land late, and the
  phase-up gate + zero food/wood block the research — s1 banked
  1123s/1275m it could never spend. No fanatics, no rams, slow death.
- **mil2** (2 barracks from the village phase at t=3:30 — a missing pre-war
  military building now freezes the economy's wood spending until its 320
  gate is banked, because the boom spends the flow and a bare floor never
  fires (goal-10 agg1/agg2 lesson); muster starts at the first barracks
  with target 25 pre-town / 60 from town / 120 at city, counting
  soldier-gatherers so training does not overshoot; trained citizen
  soldiers keep gathering until the defense stage forms the roster):
  **all 3 seeds defeated, zero JS errors** (s1 32.3m, s2 32.75m, s3 30.0m).
  Barracks stand at 3.5-4.7m ✓, army at first contact 20/42/32 (vs 20/11/23
  in mil1) — but town slipped to 9.6/6.8/6.4m (baseline 4.4m: the wood hold
  + military spending tax the boom), and the 42-strong army on s2 still
  melted 42→15 in the first clash because the 1× superiority check sent it
  attack-moving into the open (the agg9-s3 failure — the wave is still
  marching in). The trades are actually favorable (p1 kills 318/276/254,
  loses 116/144/100 military) but Petra trained 411-450 military total:
  she replaces losses, the bot cannot — each wave farms the outlying
  workers (food income → 0), city never lands (stone went to 5 early
  towers, food/wood starve the techs and the bank). Bug found: an empty
  wants list fell through to the tower placer, buying a tower at t=0:00
  and 5 more at t=5.5m on the starting 300/300 stock.
- **mil3** (engage rule: pre-city garrison every serious threat and let the
  arrows bleed the wave, eject only at 2× local superiority — post-city
  stays 1×; towers gated on defense stage or t=5:00 (kills the t=0 tower
  bug) with the placeTower floor at 200w/200s so they land between barracks
  and wave; stone mining from t=5:00 instead of t=8:00 (5 towers = 500
  stone before the wave); worker shelter radius 60→75 m): **s2 SURVIVED to
  the 45-min trigger (not a pass — trigger-ended), s1 defeated 34.0m, s3
  defeated 26.3m**; zero JS errors. City researched at 22.2/39.8/19.8m —
  first times ever — and s3 trained its first ram at 23.6m. Turtle recipe
  works for survival. Three blockers found: (1) the 50-turn pendingBuilds
  timeout is shorter than the walk to a 70-90 m tower spot — the same five
  tower spots failed and re-placed in a loop all game on s2 (zero towers
  stood, and the failedSpots entries carried no turn so the 1500-turn
  expiry never worked); (2) the nearEnemy(60 m) placement filter froze ALL
  civic construction while Petra camped the base — s2 sat on 4992 wood but
  could not place the town trio for 25 min (city at 39.8m, town structures
  < 4); (3) even with city at ~20m (s1/s3) the mid-game waves still farm
  the workers and raze the fields — the army bleeds out by 26-34m.
- **mil4** (pendingBuilds timeout = 60 + walk distance in turns (1 m/turn
  budget) instead of a flat 50; failedSpots entries now carry the turn so
  the 1500-turn expiry works; new nearEnemyForBuild for all building
  placement — enemy mobiles inside the home guard ring (60 m of the CC,
  covered by its arrows) no longer block construction, enemy structures
  within 100 m still do): **all 3 seeds defeated** (s1 33.7m, s2 35.9m —
  a regression from mil3's cap survival, chaos —, s3 27.5m); zero JS
  errors. City at 26.7/35.1/23.7m, still too late. Root cause of the
  tower failures FOUND: the stone defense tower requires `phase_town` by
  template — every pre-town attempt is engine-rejected and looped the
  placer (19-47 failed orders per seed, confirmed in a Petra-free sandbox
  run). The village-phase sentry tower (100 wood, 40 s) upgrades to the
  stone tower at town for 50w/100s — kept in reserve if towers land too
  late.
- **mil5** (stone towers gated on town researched; village barracks cut
  from 2 to 1 — the wood hold funding them stalled the boom and pushed
  town to 9.6m on s1): town at **6.2/6.5/5.5m ✓** (best since the
  baseline), towers stand (0-10 failed orders), army 30-43 through 10-18m
  — but **all 3 seeds defeated again** (s1 29.5m, s2 30.4m, s3 30.9m) and
  city NEVER researched. Blockers found: stone stuck at 320-560 (5 towers
  ate 500, the 0.18 mining share cap is too slow to refill) while METAL
  sat at 1400 idle — the 750s/750m bank never completed; ~20 workers
  still died per wave at woodlines 50+ m out (the 75 m shelter check
  triggers only once the enemy is between the worker and home); pop stuck
  at 50-74 the whole mid-game.
- **mil6** (barter sells surplus metal for stone directly when metal ≥
  900 and stone < 700 — the city bank was the blocker; temple trains 2
  healers then fanatics pre-boom (was 4 healers) — 200-HP fanatics should
  cut the muster's replacement bleed; serious threat now recalls ALL
  outlying workers home before contact and shelters in place those
  already home; phase-2 mining share cap 0.18 → 0.25): **all 3 seeds
  defeated** (s1 31.3m, s2 30.4m, s3 36.4m); zero JS errors. City at
  27.4/30.1/26.5m — the metal→stone barter fired (once, s2 29.1m) but the
  bank completes too late anyway: the economy fights at 50-75 pop against
  150+ and never gets the 2-3 peace minutes to stock 1500 resources.
  Structural conclusion: to win under 45 min, city must land by ~15-18m
  (raids need ~15 min after it), so the pre-city spend must be LEAN and
  the bank must be the priority, not the muster.
- **mil7** (city rush behind lean defense: pre-city army target 60 → 35
  (35 + garrison arrows held in mil3); the grain-tech hold on the city
  research is REMOVED (metal refills by mining + barter, but every delay
  minute is off the kill clock); trio order market-first so barter comes
  online earlier): **all 3 seeds defeated** (s1 27.5m, s2 40.1m, s3
  26.5m); zero JS errors. City EARLIER: 24.1/20.8/never (vs 27-30 in
  mil6). But no raid ever fired on s2 despite 19 min post-city: the army
  froze at ~35 because the war-stage training floors (batch 5 at
  300f/300-400w) never fired in the wartime subsistence economy (stock
  food sat at 7-72 for 15 min) — the agg1/agg2 floors lesson applying to
  the POST-city stage this time. Rams (gate army ≥ 40) never started.
- **mil8** (war-stage training draws from the flow when poor: rich =
  stock ≥ 300f/300-400w → batches of 5 at those floors; poor → batches of
  1 at cost-level floors; every train order checked against the live
  snapshot first; same split for healers and fanatics): **all 3 seeds
  defeated** (s1 27.2m — no city at all —, s2 27.2m city 21.1m, s3 34.5m
  city 33.1m); zero JS errors. WORSE than mil7 on s2 (27.2 vs 40.1):
  flow-training 85 missing soldiers from a starving flow cannibalizes the
  women stream — the goal-10 flow lesson holds for a BOUNDED pre-city
  target, not for the 120 post-city one. Real blocker identified
  underneath: the food income itself (~37 food gatherers at t=23m) cannot
  feed women + soldiers streams, because the mid-game fields get razed
  wave after wave (the 58-96 m ring is beyond tower cover).
- **mil9** (field ring moved under the arrows: 58-96 m → 42-66 m, CC +
  tower range covers it, spillover goes outward through the generic
  fallback; post-city sortie gate army ≥ 100 → ≥ 40 (still 1.5× camp) so
  the standing army clears the camp instead of letting it farm workers
  between waves; poor war-stage soldier training gated on workers ≥ 100 —
  below that the food flow goes to the women stream): **all 3 seeds
  defeated** (s1 27.2m no city, s2 39.3m, s3 27.3m); zero JS errors.
  **s2 city at 17.2m** (target ≤ 18m hit) and the army MASSED to 76 by
  28.3m (workers-100 gate + dismissal for pop room worked — 10-dismissal
  storm in 18 s, ugly but effective). Yet zero raids in 22 post-city
  minutes: (1) zero rams — the whole post-city metal income went to forge
  techs and healers, the 350w/200m ram floors never met (goal-10 lesson
  #2 again: metal flow gates the kill clock); (2) every wave (every ~6
  min) cancels any raid — the recall loop thrash; (3) Petra's siege
  arrived at ~28m and crushed the 76-strong basic army 76→27 by 32m.
- **mil10** (rams before forge techs — military techs held until 6 rams
  stand or metal ≥ 500; a raid with army ≥ 75 no longer comes home for a
  serious threat: base race over the recall loop, home holds on towers +
  garrisoned workers; dismissal storm calmed: throttle 3 → 15 turns and
  only when missing ≥ 5): **all 3 seeds defeated** (s1 27.2m, s2 31.3m,
  s3 27.3m); zero JS errors. Metal banked (320-362 post-city ✓) but ZERO
  rams again: the ARSENAL only landed at 27.9m — 10.7 min after city —
  because the wants list puts the 4th barracks before it and the
  boom-stage 350-wood floor never fired in the subsistence economy (the
  floors lesson, building edition). Root cause chain complete: city early
  ✓ (17.2m) → metal banked ✓ → arsenal ✗ → rams ✗ → raids ✗.
- **mil11** (arsenal FIRST in the post-city wants list (2 arsenals before
  the 4th barracks and temples); the wood-spending hold now also applies
  post-city while the arsenal is unfunded — houses/fields pause ~1 min so
  the 350 floor actually fires): **all 3 seeds defeated** (s1 27.2m, s2
  43.4m, s3 27.1m); zero JS errors. Arsenals at 19.0/21.7m ✓ (vs 27.9m),
  metal banked ✓, sorties fired at 29.1m (army 56-60 vs camp 26-34) ✓ —
  but ZERO rams AGAIN: the ram gate was army ≥ 40 (army hit 40 only at
  ~29m) with floors 350w/200m that never fired (wood sat at 40-190 for 10
  min post-city — the floors lesson, ram edition). Chain now: city ✓ →
  metal ✓ → arsenal ✓ → rams ✗ → raids ✗.
- **mil12** (ramHold: while the army can escort (≥ 30) and rams < 6, the
  economy's wood spending pauses until the 300w/150m cost banks, then the
  ram trains at real cost (no 350/200 floors); ramHold honored by
  manageConstruction and manageResearch; ram gate army ≥ 40 → ≥ 30):
  **all 3 seeds defeated** (s1 27.2m, s2 38.9m, s3 27.1m); zero JS
  errors. STILL zero rams: the army oscillates 21-35 around the ≥ 30 gate
  — ramHold flickers off half the time, construction unholds, the wood
  never banks. And underneath: the army cannot GROW past ~28 because the
  ~30-house women stream drinks the whole food flow (soldiers replace
  wave deaths but never mass). Twelve iterations of stable ~30-min
  turtling defeats: the equilibrium cannot be broken by allocation rules.
  Structural conclusion: turtling vs a +56% booming aggressive opponent
  is a losing game — the bot must bleed HER boom in the windows right
  after her waves die on our arrows.
- **mil13** (counter-raid doctrine: eco-raid — when warOn, army ≥ 40 and
  her least-guarded CC has defenders ≤ army × 0.5, the whole army
  attack-moves her base to kill workers (rams stay home); aborts when
  guard ≥ army or after 3 min; recalls on serious threat (no base race
  below 75 army); CC raid unchanged (≥ 75 army, ≥ 2 rams, base race)):
  **all 3 seeds defeated** (s1 27.2m, s2 41.6m, s3 27.1m); zero JS
  errors. The eco-raid FIRED (s2 28.1m, army 40 vs guard 13) but lasted
  1.1 min: guard jumped 13 → 40 as her army converged home, raid over at
  army 26. Whole-army eco-raids are too clumsy (2-min walk, her +56%
  production answers instantly). Still zero rams (army gate flicker).
- **mil14** (telemetry: logStatus now prints the REAL enemy army curve
  (emil/esiege/eciv = visible enemy soldiers/siege/civilians every 750
  turns) — twelve iterations designed against 120 m threat samples of
  8-21 while the real wave sizes were unknown; ram gate army ≥ 30 → ≥ 25
  against the flicker): **all 3 seeds defeated**; zero JS errors. FIRST
  ram trained (s2 34.7m, 1/6). The telemetry is the payoff — s2 enemy
  army curve: 33 soldiers at 8m, 47 at 10m, 66-70 at 15-18m, 101 at 23m,
  105+4 siege at 28m, 141+6 at 35m, 198+10 at 40m — her standing army is
  **2-4× ours from t=10m and grows ~5-7/min sustained**, the infantry
  race is unwinnable as played. But her BASE is thin (guard 13 at 28m
  while her army was 105): her force is committed forward, her economy
  exposed to anything fast.
- **mil15** (cavalry raid force: stable from town (gaul stable = 250
  wood, no stone), 10 javelineer cavalry (100f+50w each) in a separate
  roster — cavalry is pulled OUT of the infantry blob; manageCavRaids
  raids her worker clusters with ≥ 6 cav (best cluster: ≥ 3 peers within
  50 m and ≤ 3 soldiers within 60 m), retreats home when guard ≥ 4 or the
  cluster is bled (< 2 workers left), re-raids every 15 turns; cavForce
  in Serialize): **all 3 seeds defeated, WORSE** (s1 26.4m, s2 26.8m —
  from 41.6m —, s3 27.6m); zero JS errors. The mechanic NEVER fired:
  stable at 10.1m (behind barracks/temple in the wants order) and the
  100f floor sat behind the infantry muster — zero cavalry trained all
  game; the regression is chaos + the stable's boom tax. Concept untested.
- **mil16** (stable in the village wants from t=4:30 (the wood hold funds
  it, 250w < 320 gate); cavalry training moved BEFORE the infantry
  muster): **all 3 seeds defeated** (s1 24.5m, s2 29.7m, s3 27.2m); zero
  JS errors. Stables stand at 4.5-4.7m ✓ but STILL zero cavalry: the
  100f cost never accumulates against the women+muster 50f drains —
  pre-city food has no slack for a raid force, period.
- **mil17** (cavalry goes POST-city only (stable in the boom wants, cav
  training gated on warOn); the worker recall is now targeted: only
  workers within 110 m of the threat centroid and beyond 45 m of the CC
  come home — recalling everyone on every 8-unit probe stopped the
  economy outright; pre-city engage rule 2× → 1.3× when the threat
  centroid is within 100 m of the CC (under tower/CC arrows), 2× in the
  open): first run broke on a TDZ (`boom` used before its `const` in the
  cav branch — 2504-5552 JS errors); **mil17b** (fix: `this.warOn()`
  inline): s1 29.6m, s2 43.1m (city 23.6m, eco-raid fired 27.5m army 40
  vs guard 12), s3 26.8m; zero JS errors. But the eco-raid pulled the
  army out and the 28.7m wave killed ~60 workers — quiet-launch raids
  come home to a graveyard. p1 trained 0 cavalry / 0 champions / 0 siege
  all game (stable last in the wants loop behind the 350-wood floor).
  Her whole war machine: 56 workers trained TOTAL (we killed 29) — her
  ~30-worker economy out-produces our 120-worker one 3:1 because ours
  keep dying. Killing her 30 workers IS the win.
- **mil18** (stable from town (250w via the wood hold) so the cav force
  forms at city; cavHold: the women stream pauses at food < 100 while
  cavTotal < 10; eco-raid launches only within 100 turns after a serious
  threat clears (the post-wave window), gate army ≥ 55; ram target 6 →
  4): **all 3 seeds defeated** (s1 27.8m, s2 27.6m, s3 28.7m); zero JS
  errors (one botched sed produced `&&&` and a no-op run, fixed). THE
  CAVALRY RAIDS FIRE: s2 city 21.7m, raids from 23.2m with 6→9
  javelineers. But: (a) each sortie kills ~2-3 civs then retreats at
  guard ≥ 4 (6 kills in 4 sorties — javelins volley once and the fleeing
  workers outrun them); (b) cavHold for all 10 stopped the women stream
  for minutes — our pop crashed to 47-58 (vs 84-169) and we died at
  27.6m (from 43.1m).
- **mil19** (cavalry_swordsman instead of javelineer — gaul's +10% melee
  cav bonus and swords stick to fleeing workers (100f+40w+10m); retreat
  rule guard ≥ 4 → guard > cav × 1.5 (fight small guards, then kill the
  workers); cavHold only for the first 6, replacements trickle without
  hold): **all 3 seeds defeated** (s1 27.8m, s2 27.8m, s3 28.7m); zero JS
  errors. Raids fire but the swords die in the guard fights (cav 6 → 3 →
  6 → 2), 5 civs killed on s2 — the trade is ~2:1 AGAINST us (100f cav vs
  50f civs, garrisoned CC arrows overhead).
- **mil20** (assembly in boom wants after arsenal; hero training —
  Viridomarus first (+15% gather), Vercingetorix on his death — plus 3
  trumpeters; forge techs held only until 2 rams / metal ≥ 300 (was 4/500
  — zero techs researched in most games); healer target 4 when poor, 10
  when rich): identical to mil19 on s2 (deterministic replay — the
  assembly never lands before the 27.8m death). The cavalry program's
  cost-benefit verdict is final: ~1500f and the women-stream pause for
  5-6 kills per sortie against a garrisoned base — a losing trade that
  costs 15 min of survival (27.8m vs 43.1m on mil17b).
- **mil21** (cavalry program CUT (no stable, no cavHold, no cav training;
  the roster split and manageCavRaids stay as dead code); arrow-fortress
  doctrine: fortress in boom wants after the assembly (10 default arrows
  + 1/garrisoned Soldier ×20), towers 5 → 8 around the home CC, fortress
  added to the garrison shelters): probing seeds 1-3.
- **mil21** (cavalry program CUT; arrow-fortress doctrine: fortress in
  boom wants, towers 5 → 8, fortress in garrison shelters): s1 29.6m, s2
  39.9m, s3 26.8m; zero JS errors. Survival recovered (cav cut worked).
  First ram 30.2m (1/4). But the 30×30 fortress found NO spot within
  130 m in own territory (failed every placement), and HER siege (4-7
  from 28m) razes the towers — the infantry-only defense has no answer.
- **mil22** (fortress kind in tryConstruct (20-130 m coarse search);
  anti-siege priority: when siegeN > 0 and army ≥ 0.8× nearThreat the
  army attacks the siege, not the blob): s2 35.1m; fortress STILL failed
  twice (151,140 / 243,107) — no 30×30 clear area in own territory near
  the base exists on these maps. Fortress cut in mil23.
- **mil23** (expansion: one forward CC post-city (200 m rule,
  own-or-neutral spot away from Petra's base), army rallies at the
  pending foundation, towers per CC (8 home / 4 expansion)): never fired
  — the 350w/350s/300m resource gate never coexisted before death. s2
  30.9m. But the eco-raid fired at army 61 (best yet).
- **mil24** (TIMING ATTACK: pre-city, army ≥ 28 && t ≥ 7:30, the whole
  muster marches on her least-guarded CC — her field army is committed
  forward and her ~30-worker economy is the one thing her +56%
  production cannot retrain; base race by design (raidHolds), abort at
  army < 12 or guard ≥ 8 or 4 min): fired at 15.7/15.2m — SIX minutes
  late because the muster reaches 28 only at ~15m; killed 8/0/0 civs
  (her civs GARRISON the CC when attacked — without rams the raid just
  sits in arrow fire).
- **mil25** (muster acceleration: roster from t=4m (the 4 starting
  soldiers fight, not gather), 2 village barracks, house women stream
  paused until the raid (every 50f is a soldier at 8:30); timing abort
  guard ≥ 8 → fight logic reverted): army 19 at 8m ✓ 32 at 10m ✓ — but
  the launch window (army ≥ 28 AND quiet AND defenders ≤ 0.5×) was
  missed by minutes again; fired at 15.2m and aborted in 30 s (guard 12
  ≥ 8 instantly). 11 civs killed. Interaction bug: launch gate admits
  what the abort threshold forbids.
- **mil26** (timing army gate 28 → 25; timing abort guard ≥ 8 → guard ≥
  army × 1.2 — 25+ swords vs a dozen guard is a WIN, then the workers
  are catchable): probing seeds 1-3.
- **mil26** (timing army gate 28 → 25; timing abort guard ≥ 8 → guard ≥
  army × 1.2): s2 42.4m; the attack fired at 15.2m anyway (the launch
  window muster-25 → wave-contact is ~1 min and needs quiet AND
  defenders ≤ 0.5×). 8 civs killed.
- **mil27** (manageOffense evaluated FIRST so the timing launch fires
  into the teeth of the wave; eco-raid aborts on serious home threat):
  identical replay of mil26-s2 — the real blocker was the defender
  count, not the quiet gate.
- **mil28** (timing defender gate 0.5× → 1.0×): the attack fired EARLY
  (8.4m/11.4m) — straight into her whole army still at home (guard 35 at
  launch, raid dead in 1 min, 6 civs). **The timing-attack premise is
  FALSE at diff 5: she fields a wave AND a 30+ home guard
  simultaneously from ~10m — the empty-base window does not exist.**
- **mil29** (timing attack CUT; worker war cap 150 → 170, dismissal
  145 → 160): s1 29.0m, s2 28.9m, s3 37.0m — pop limit grows but pop
  doesn't follow; the waves shave faster than the cap matters.
- **mil30** (expansion expHold): identical replay — the expansion never
  fired again (city 26.7-28.9m too late; spot/resources never there).
  **Verdict after 30 iterations: the home-grown architecture (boom bot +
  ported defense layer) converges to "survive ~40 min, never win" — the
  defense layer was re-derived but the expansion/trade war economy that
  actually won goal 10 was never ported. Re-base.**

## Re-base (rb) on the goal-10 winner

super_brennus is now `brennus_gaul_generic_land_map.js` (the goal-10
winner — boom → defend → expand → trade → war → raid, all integrated
and debugged through def1-17) + the diff-5 hardening measured in
mil1-30: expansionOn gated on city only (no pop 300); 2 village barracks
+ muster from the first barracks (target 35 pre-city, counting
soldier-gatherers); roster from t=4m; milBuildingHold pre-war +
arsenal-hold post-city; towers 8 home/4 expansion, placeTower floor
200/200; engage rules pre-city 2× open / 1.3× under arrows + anti-siege
priority at ≥ 0.8×; worker shelter 75 m + recall-on-path (110 m of the
threat centroid, 45 m of the CC); sortie gate army ≥ 40 (1.5× camp);
rams 4 + ramHold at army ≥ 25 (no 350/200 floors); military techs held
only until 2 rams / metal ≥ 300; assembly (Viridomarus → Vercingetorix,
3 trumpeters); flow-level training when poor gated on workers ≥ 100;
eco-raid (army ≥ 55, defenders ≤ 0.5×, post-wave window ≤ 100 turns,
recall on serious); raids evaluated FIRST + raidHolds at army ≥ 75;
barter metal → stone for the city bank; worker war cap 170, dismissal
floor 160 throttle 15; nearEnemyForBuild for all building placement;
construction timeout ∝ walk distance for every template.

- **rb1**: probing seeds 1-3.
- **rb1** (re-base on the goal-10 winner + the 16 mil-hardening edits):
  all 3 seeds defeated (s1 27.6m, s2 30.2m, s3 27.1m); zero JS errors —
  the re-base is mechanically sound. City+expansion at 25.3m on s2.
- **rb2** (stone mining from t=5:00, phase-2 share cap 0.18 → 0.25):
  **s2 40.1m** (best of the rb line), s1 28.2m, s3 28.6m; zero JS
  errors. The expansion machinery RUNS (lattice candidates, plan
  recompute every 750 turns) but only 1-3 of 19 anchors are buildable
  under Petra's territory/army pressure, and far CCs are correctly
  escort-gated (enemyArmy 87-136 vs our 17-35) — the war economy never
  starts. Army 50 + sorties at 28m (closest to the raid gate yet), then
  siege 4-7 grinds it down.
- **rb3** (army-first opening: women capped at 60 until the first wave
  is beaten, muster target 60): all defeated (28.7/29.2/26.9m). The
  muster reached only 30 at 10m — the constraint is the food-flow
  production rate, not the allocation. Reverted in the consolidation.
- **rb4** (2 temples from town, fanatic muster): ZERO champions trained
  — at 120f the fanatic never beats the 50f muster for the food flow
  (stock never crosses 120). **rb5** (fanaticHold: barracks pause while
  the temple banks 120f): identical replay — healers (100f) have the
  same barrier, healerCount stays 0, the chain never starts. Lesson: in
  a flow economy nothing ≥ 100f ever trains pre-city.
- **rb6** (citizen-soldier economy: the standing army farms the fields
  under the towers between waves): s1 REGRESSED to 24.5m — soldiers
  scattered across fields die one field at a time. **rb7** (recall at
  150 m): s1 24.9m still — the oscillation (enemies constantly near)
  keeps them off work. Reverted in the consolidation.
- **Walls are impossible from the AI API** (verified headless: a plain
  construct order for `structures/palisades_long` is accepted but no
  foundation ever appears — no WallSet chaining exposed; Petra never
  builds walls either).
- **rb8** (consolidation: rb2 config + 2 temples, rb3/rb6/rb7 reverted):
  s1 27.2m, s2 34.1m, s3 25.4m; zero JS errors. Committed as 2e5a287.
- **rb9** (raid gate 75 → 60 + raidHolds 60 — her CC guard measured at
  12-13 at 28m and the army masses to 56-61 but never 75, so the 75
  number was a medium value never tested here): identical replay — the
  gate is not the binding constraint; the rams (0-1) and the mass are.

## Assessment after ~100 matches (2026-08-26, night)

Zero wins across two architectures (home-grown boom+defense, and the
re-based goal-10 winner with full expansion/trade) and ~40 strategy
variations. The invariant, measured every way: **at difficulty 5,
Petra's standing army is 2-4× ours from t=10m and grows ~5-7/min
sustained; the bot's army mass rate (~1-2/min net) is set by the food
flow, which is set by worker survival, which is set by the same waves
the food is needed to fight.** Her home guard is never thin (timing
attacks die into 30+ defenders), her workers garrison on contact (raids
kill 0-11 civs), her siege arrives ~28m and out-ranges the towers. The
defense itself is excellent (kill ratios 1.8-2.3× in our favor,
survivals to 40-45m) but defense cannot convert: a raid needs 75 army +
2 rams assembled by ~30m and the food flow never banks it. Walls (the
one structure that would break the worker-death cycle) are not exposed
to the AI API. Remaining honest options: (a) accept this as the
current ceiling and report; (b) a qualitatively different frame not yet
found.
- **rb10** (towers BEFORE the military wants list — the diagnosis: s1 had
  ZERO towers all game because the temple/barracks spend starved them):
  towers stand on all seeds (5/5/4), **s2 city at 15.0m (record)**.
- **rb11** (engage rule also requires advantage vs her TOTAL visible
  army, not just the 150 m centroid count): the army survives waves
  (52 at ~33m) and the first rams train (2/4 at 27.8m).
- **rb12-13** (trader-hunt cavalry: stable from town, 6 swords-cav,
  cavHold): hunts fire (28 cav trained) but kill ZERO traders.
- **rb14-15** (siege wood hold covers training+research, gated on army
  ≥ 60): arsenal 21.5m (from 29.2m) but the pause weakened the army.
- **rb16** (eco-raid cut as net-negative — 27 soldiers for ≤ 1 civ):
  **FIRST CC RAID FIRES** (28.6m, 55+2 rams) — intercepted mid-field in
  12 s.
- **rb17-19** (defenders at 150 m ≤ 0.8×, dip gates): never fire — her
  army is monotonic, the dip doesn't come on its own.
- **rb20-21** (two-stage doctrine: eco-raid CREATES the dip → CC raid):
  eco fires at 22.8m (84→57) but rams only stand at 27-28m — the window
  is mistimed by ~5 min.
- **rb22** (arsenal before towers post-city — 8 towers = 800w were
  starving it): still 26.2m, batch-5s burn the wood.
- **rb23** (siege reserve: 300 wood out of EVERY spender's reach until
  4 rams stand): **arsenals at 18.6/18.9m (1 min after city!), rams
  4/4 at 21.4m** — but the reserve slowed the batch-5s (army 35-45,
  died 26.5m).
- **rb24-26** (CC raid gate army ≥ 55 + 2 rams + defenders(150m) ≤ army
  + path clear ≤ 12): raid FIRES at 23.7m (61+4 rams, defenders 16-17)
  — intercepted/bleeding mid-march (army 61 → 34 in 66 s, spent before
  contact). Path-clear-at-launch does not protect the 2-min walk.
- **rb27** (the raid marches with plain `move`, not attackMove — slips
  PAST her mid-map force instead of stopping to fight it): **FIRST
  ENEMY CC RAZED AT 24.4m** (0.7 min raid, defenders 17). The raze is
  free (~20 army left) but her counter (194-207 + 6 siege) ends the
  game at 31.5m before raid #2 can form.
- **rb28** (anti-siege gated on !outmassed): raze repeats at 24.4m; post-raze
  the counter (~168+6 siege) razes our base at ~31m — raid #2 never forms.
- **rb29-30** (blitz chain to the next CC): fires, but dies to her recall
  mid-march (55 → 23-27 in 18 s — her recall covers 350 m in ~20 s at run
  speed; and a roster-split artifact pulled the whole cavForce out of the
  army count mid-raid, fixed in rb30).
- **rb31** (escort screens, does NOT capture — Louis tip 2): raze cost per
  CC drops 20 → 6.
- **rb32-33** (blitz target = farthest from her force): dies mid-march all
  the same — the march, not the target defense, is the killer.
- **rb34** (path margin 100 m; blitz only when clearly free): rallies
  instead of suiciding, survives to 33.4m post-raze, rams restock — but
  raid #2 never assembles (army 20-27 vs her 180-211).
- **rb35** (ambush staging): REFUTED — she is omniscient; the staging
  point is found and the force killed there. Hiding is impossible.
- **rb36-37** (launch also during a serious threat at home; rally after
  raze): identical to rb34 — no raid #2.
- **rb38** (retreat home passive): the post-raze SORTIE into her recall
  blob donates the survivors (55 → 24 at 24.4m).
- **rb39** (sortie cooldown 60 s post-raze): survives 32.5m, still no
  raid #2 (army 19-23 vs her 190+).
- **rb40-42** (raid gate 50 → 42): raid #1 EARLIER (23.0-23.1m), raze
  23.7m. Counter at ~24.5-25m with ~196 kills the ~35 survivors. The
  detour retreat (rb41) DOES save the force (49 back vs ~24-30 before).
- **rb43** (anti-siege at our doorstep when army ≥ 25 and ≥ 4× siegeN):
  no visible change — the counter still ends it at 30.3m.
- **rb44** (raid gate 90 — only raze with a real army): NO raid at all;
  the army peaks at 63 at ~26m and dies at 27.4m. The 108-army of rb13
  was an outlier from a 36-minute game, not a reproducible peak.

## The campaign problem, measured

Petra has **3 CCs** (1 start + 2 expansions, ~350 m apart; she does not
rebuild a lost one). Razing #1 at ~23-24m provokes her FULL army
(~150-200) onto us within ~1 min; our ~35-63 army + towers + garrison
cannot hold it, and the base falls at ~28-31m before raid #2 can form.
The counter is what kills, not the raze. The two honest directions left:
(a) raze EARLIER (rams by ~19m, counter ~110-130 not 196) — needs the
whole chain ~3 min faster; (b) accept the counter but survive it with a
bigger standing army — the army peaks at 63-84 by ~26m on this config.
