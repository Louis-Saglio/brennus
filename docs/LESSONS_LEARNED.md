# Lessons learned

Cleared 2026-08-29. Reference knowledge was migrated into
`docs/game_description/`, `docs/ai_engine_api.md` and `docs/pyrogenesis_cli.md`.

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
