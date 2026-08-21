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
