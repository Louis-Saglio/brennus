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
| 7 | City Phase AND 300 pop by 15 min | **PASSED (5/5 seeds)** | (this session's commit) |

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
