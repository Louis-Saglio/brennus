# Current state — Brennus (2026-08-20)

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
| 6 | Master the economy by 30 min | PASSED (5 seeds, published) | see git log |

Goal 6 final numbers (details in `experiments/goal-06.md`): town 6.0–8.4,
city 13.9–16.3, 26/26 techs at 27.1–28.9, traders 14–17, tradeIncome
1358–1921, barter 500/356–393, pop 300, zero errors, determinism OK.

**Next: goal 7 — defeat a sandbox Petra in under 40 in-game minutes.**
The bot has no military logic at all yet (no barracks, no soldiers beyond
the starting ones, no attacks). Sandbox Petra does not attack but DOES
defend; `conquest_civic_centers` requires destroying/capturing its CC.

## Verification protocol (Louis's instruction)

- Iterate with a SINGLE seed run (`tmp/goal6/run1.sh <seed> [tag]`,
  ~40 s wall). Run the full 6-run batch (`tmp/goal6/run.sh`, 5 seeds +
  seed-1 determinism rerun, 2 parallel waves) only when the single run
  looks good.
- Analyze with `tmp/goal6/analyze.py` (stats JSON, HARNESS lines,
  interestinglog ERRORs, determinism hash).

## Known blemishes / ideas

- Trade income varies with route distance (map-dependent territory
  shape): 1358–1921 across seeds at ~170–270 m routes.
- `logStatus` still carries goal-6 debug fields (enemyDist, fieldFail,
  founds, failedSpots) — cheap (every 1500 turns); prune when they stop
  being useful.
- Seed 1 shows occasional single idle workers late; not criterion-relevant.

## Operational notes

- Runs: copy `bot/` into an isolated HOME under `tmp/goalN/`, command as
  in `experiments/goal-01.md` (sandbox Petra opponent for tier 1).
- Experiment logs per goal live in `experiments/goal-NN.md`.
- Engine facts and pitfalls are in `docs/LESSONS_LEARNED.md` — check it
  before investigating engine behavior (gaia is an "enemy" diplomatically,
  construct commands rejected at processing when unaffordable, CC root
  territory radius 140 m, foundation inclusion in getOwnStructures,
  trade gain formula, tech liquidity, etc.).
- Mod zip published after each commit:
  `https://files.louissaglio.fr/brennus/brennus.zip`.
