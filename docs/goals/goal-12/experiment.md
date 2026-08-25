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
  open): probing seeds 1-3.
