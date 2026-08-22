# Current state — Brennus (2026-08-21, end of session)

Pick-up document for the next session. Read `AGENTS.md` and
`docs/GOALS.md` first; this file only tracks where the work stands.

## Goals status

| Goal | Description | Status | Commit |
|---|---|---|---|
| 1 | Function without errors | PASSED (5 seeds, published) | `992b680` |
| 2 | Gather resources | PASSED (5 seeds, published) | `eec1c13` |
| 3 | Grow population | PASSED (5 seeds, published) | `90b6299` |
| 4 | Town Phase < 12 in-game min | PASSED (5 seeds, published) | `953dd20` |
| 5 | City Phase < 20 in-game min | PASSED (5 seeds, published) | `5e75362` |
| 6 | Master the economy by 30 min | PASSED (5 seeds, published) | `e56c87b` |
| 7 | City Phase AND 300 pop by 15 min | **PASSED (5/5 seeds)** | `287c8af` |

## Goal 7 — DONE (Louis's round-3 tips audit session)

Final batch (5 seeds + determinism, zero JS errors, all city and pop300
≤ 15.0): seed1 14.7/14.9, seed2 14.3/14.9, seed3 14.3/14.8,
seed4 13.7/13.6, seed5 14.5/14.3. Determinism hash stable.

Louis's five tips were implemented **one at a time** on a freshly
re-derived baseline (v71 herding band reverted — it regressed both probe
seeds; v70 kept) and kept only when the batch improved:

- **Tip 1** (cav kills+collects non-fleeing animals directly) — DISCARDED
  (seed 1 pop300 14.9→16.1). Source dive showed ALL alive huntables flee
  on attack (passive/skittish stances, UnitAI.js); "non-fleeing" = dies to
  the first javelin (≤20 HP). Collection of far kills cost more herding
  time than the meat paid.
- **Tip 2** (cav collects its kill before the next target) — DISCARDED
  (seeds 3/5 pop300 +0.3/+0.5).
- **Tip 3** (farmstead by ≥300-food carcass clumps) — DISCARDED (never
  fired on any seed; chickens die next to the CC, herded kills get
  collected).
- **Tip 4** (concentrate miners on ONE mine per resource) — **KEPT, the
  goal-7 pass**. `mineId` pin nearest-to-CC, spill at isFull(); see
  LESSONS_LEARNED for the numbers.
- **Tip 5** (spread field workers to least-crowded field) — DISCARDED
  (seed 1 14.9→15.1 global; 25 m window version pushed city +0.7).

All outcomes + the flee-mechanics source dive are recorded in
`docs/LESSONS_LEARNED.md` (round-3 section).

## Goal 7 — hunting optimization (Louis's flee-speed strategy, v82)

Implemented and verified after the goal-7 pass: slow animals
(chicken/sheep/pig) killed in place and collected by the cav one at a time;
fast fleers (deer/gazelle) herded to the nearest food dropsite, collected
by the cav only when killed outside territory; civilians take in-territory
carcasses before fields once the berries are gone (latched). Re-derived
baseline first (seeds 1-5: 14.7/14.9, 14.3/14.9, 14.3/14.8, 13.7/13.6,
14.5/14.3). v82 batch: 14.5/14.7, 14.4/14.8, 14.3/14.7, 13.3/13.4,
13.8/14.4 — mean city -0.24, pop300 -0.10, zero JS errors, seed-1 rerun
hash identical. Kept; details in `experiments/goal-07.md` (hunting
experiment section).

## Goal 7 — wound-then-steer herding (Louis's follow-the-flee idea, v83)

Implemented and verified after v82: the cav wounds a deer ONCE, cancels
its own attack order immediately (the engine would fire the killing shot
~2 s later on its own), then follows the fleeing animal on the far side
to steer it to the nearest food dropsite, killing it there. Batch vs v82:
seeds 1-4 byte-identical (no deer in the herding band), seed 5 city
13.8→13.6, pop300 14.4→13.6, meat by t=8m 694→1049. Kept; details in
`experiments/goal-07.md` (wound-then-steer section).

## Builder ping-pong fix (sticky assignments, SHIPPED — re-tuned, DONE)

Louis saw builders walking back and forth between adjacent foundations
without building. Root cause: the sweep re-issued `repair` to the nearest
units of every under-staffed foundation each block; adjacent foundations'
nearest sets overlap, the last order wins. Four fix variants were probed
(all regressed the boom — see LESSONS_LEARNED for the numbers); by
Louis's call the **persistent sticky variant is shipped anyway** (a
claimed unit is never re-targeted until its foundation is gone; herder
excluded — it would be a phantom builder). Zero churn verified.

**Re-tune (done):** the sticky ship regressed city/pop300 to
14.6/16.0, 14.6/14.6, 15.0/14.4, 14.2/13.7, 14.5/14.4 (seed 1 pop300
and seed 3 city). [BUILD] telemetry + a side-by-side v83 reference run
isolated two mechanisms: on seed 1 the sticky crews finish the 3rd house
by ~1.5m, flipping `canResearch(town)` and starting the hard bank before
wicker/fields are ordered; on seed 3 a storehouse flood pins wood under
the market's 300w and delays the trio. Two fixes shipped: (1) hold the
town bank while completed bootstrap fields < 2 and fruitStock < 1500
(fallback t=5m); (2) village-phase houses take 2 builders (3 from town
on). Final batch (5 seeds, zero JS errors, seed-1 rerun hash identical):
**city/pop300 14.1/14.9, 14.7/14.8, 14.3/14.0, 13.5/13.6, 14.3/13.9** —
mean city 14.18 / pop300 14.24 (v83: 14.02/14.24). Goal-7 criteria all
≤ 15.0 restored with the sticky fix kept. Probed-and-discarded variants
(P2 trio-wood floor, fields-before-dropsites, house-2-everywhere,
5 house foundations) are in LESSONS_LEARNED.

## Building orientation (SHIPPED — aligned on the CC angle, DONE)

Louis's report: buildings stand at angle 0 while the starting CC sits at
135°, so the base looks twisted. All buildings now take the CC yaw
(`cc.angle()`, runtime 135.0° on every seed); the house/field plot grids
rotate with the same angle (rigid rotation preserves the 14/24 m pitches),
and the placement prefilter checks the rotated footprint exactly, inflated
by 0.75 m (half a navcell diagonal) — the rotated-AABB variant pushed
near-tree placements outward and cost seed 1 its pop300; the un-inflated
exact check produced 88 engine-rejected orders. A/B vs the re-derived
baseline (5 seeds, zero JS errors, determinism OK): mean city 14.17→14.23
(+0.06), pop300 14.35→14.08 (-0.27) — neutral/slightly positive, all 5
seeds ≤ 15.0. Statistical confirmation on 10 fresh seeds (11-20, never
iterated on): city paired delta -0.03 ± 0.27 min (p=0.734), pop300
-0.02 ± 0.37 min (p=0.868) — no measurable impact; both variants hold
≤ 15.0 on all 10. Details: `experiments/goal-07.md` (orientation section)
and LESSONS_LEARNED.

## Combined food pool (Louis: carcasses == berries) — SHIPPED with herder carve-out

Implemented on top of goal 7: `findSupply` now treats served fruit and
dead in-territory animals as ONE pool — nearest supply within 40 m of a
food dropsite wins, fields fall through; the old fruit-stock gate and the
carcass latch are gone, the drift-stop covers meat too. Engine facts
verified: carcasses never rot (no `<Change>` in the merged corpse
ResourceSupply) and civils gather fruit/meat at the same rate (1.0).
foodmix telemetry confirms meat flows from the first window alongside
berries. Carve-out (Louis's pick): the carcass the herder is actively
collecting stays the herder's; in-territory fast kills remain in the pool.

Pure pool (no carve-out) regressed the 5-seed batch (city +0.22, pop300
+0.14, seed 1 pop300 15.3): civilians walked to the herder's served slow
kills the cavalry collects anyway (~25% cycle loss in the first window,
compounds). Carve-out batch vs baseline: 14.6/15.1, 14.5/14.4, 14.4/13.6,
13.3/13.6, 13.7/13.5 (baseline 14.1/14.9, 14.7/14.8, 14.3/14.0,
13.5/13.6, 14.3/13.9) — mean city -0.08, pop300 -0.20, zero JS errors,
determinism OK. Confirmation on 10 fresh seeds (11-20): city 14.17 vs
14.21 baseline, pop300 13.74 vs 13.82 — no measurable cost, NO seed
breaks ≤ 15.0. Details: `experiments/goal-07.md` (combined food pool
sections) + LESSONS_LEARNED.

## Herding distance re-probed — SHIPPED 200 m band, nearest-first

Louis asked to extend the herdable distance again (the food pool should
make it free) and find the herd/collect compromise. Three knobs added to
`manageHerding`: `herdMax=200` (probed 200/240/280 — 200 is the sweet
spot: meat gains with no measurable boom cost; beyond, metrics go
flat-to-worse), `herdCutoff=200` (herding wins at EVERY distance: chasing
a far skittish pushes the kill ~50 m further out and the cavalry's
collection round trips dwarf the steer — 1 vs 6 far deer on seed 5; only
non-fleeing animals are collect-mode), `herdPrefer=false` (preferring
herdables over nearer chickens cost seed 5 city +0.5). Fresh-seed paired
deltas (11-20): city -0.03 ± 0.28, pop300 +0.02 ± 0.42 — v71's pre-pool
regression is gone. Seed 11 outlier (pop300 15.2): one 182 m sheep →
town-bank cascade; seeds 1-5 all ≤ 15.0. Details:
`experiments/goal-07.md` (herding distance section) + LESSONS_LEARNED.

## Kill-shot accuracy + micro-pause fixes — SHIPPED

Louis's two reports, both fixed and verified. (1) Kill shot: standoffs
reduced 12→6 m and the kill branch approaches to ~2 m on the far side,
shooting only from ≤5 m — the javelin spread (Spread 4, MaxRange 30)
no longer makes the finisher miss. (2) Micro-pauses: instrumented seed 5
showed 697 drift stops in 18 min — 74 on the herder (stale turn-0 food
assignment + the drift stop extended to meat by the food-pool commit
stopped it every block beyond 45 m of a dropsite) and 533 civilian
permanent loops (findSupply's generic path could return unserved
fruit/meat, which the drift stop killed next block). Fixed: herder exempt
+ assignment cleared; generic path serves-only for fruit/meat. After: 81
stops, max 4/unit, no loops. Batch vs baseline: city +0.10, pop300 +0.12
(noise-level), all ≤ 15.0; fresh seeds 11-20 paired city +0.06 ± 0.25,
pop300 +0.15 ± 0.41. Details: `experiments/goal-07.md` (fixes section) +
LESSONS_LEARNED.

## Herder frozen mid-herd — fixed (steppe diagnosis, watchdog)

Louis's report: after a few animals the cavalry stops working and stands
still while game remains. Reproduced on the steppe biome: (1) the stall
check mixed distance bases (best drop-site distance vs CC distance at
pick) and could never trip once the drop site ≠ CC — horses fled AWAY
from the dropsite (dropDist 117→242→540 m) with the herder trailing in
move/stop fits forever; (2) steppe horses outrun the cavalry, so the
far-side positioning never converges and the pre-wound phase had no
timeout at all. Fixed: stall baseline = drop-site distance at the wound;
60 s per-target watchdog attacks straight away (pre-wound included) and
sets herdKill so the cavalry collects the carcass itself; the kill
approach gives up 30 s after the wound. Steppe: every stuck target killed
within ~1 s of the watchdog, herding continues, zero JS errors. Temperate
impact: 5-seed batch 4/5 byte-identical (seed 4 back to its historical
13.3), fresh seeds 11-20 9/10 byte-identical, mean -0.01 ± 0.03 — free.
Details: `experiments/goal-07.md` (frozen-herder section) + LESSONS_LEARNED.

## Next up (goal 8: defeat sandbox Petra < 40 in-game min)

Tier 3 begins: `experiments/goal-08.md` doesn't exist yet — create it and
mirror the goal-7 run harness (opponent Petra difficulty 0, but now the
bot must actually FIGHT; the time-limit trigger should be sized from the
40 min budget). Nothing military exists yet: no barracks, no army
production, no attack logic.

## Operational notes

- Runs: copy `bot/` into an isolated HOME under `tmp/goalN/`, command as
  in `experiments/goal-01.md` (sandbox Petra opponent for tier 1).
- Experiment logs per goal live in `experiments/goal-NN.md`.
- Engine facts and pitfalls are in `docs/LESSONS_LEARNED.md` — check it
  before investigating engine behavior.
- Mod zip published after each commit:
  `https://files.louissaglio.fr/brennus/brennus.zip` (stable name = latest
  commit; commit-named archives alongside).
