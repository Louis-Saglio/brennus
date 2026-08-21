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
- Command as in `experiments/goal-01.md`; runner `tmp/goal7/run.sh`
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
