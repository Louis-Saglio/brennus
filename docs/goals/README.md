# Goals

One directory per goal: `goal.md` (target, target bot, settings it must
be achieved in) and, once attempted, `experiment.md` (the run log).

Bots live in `bot/simulation/ai/<name>/`; names encode civ, specialty
and map class (e.g. `brennus_gaul_boom_generic_land_map`).

## Passing a goal

A goal passes when achieved on **5 distinct seeds** in a row, with:

- zero JS errors in the interesting log,
- the same seed always producing an identical result (determinism),
- the end-of-game statistics JSON showing the required outcome.

In-game time means the statistics `timeElapsed` (simulation time), not
wall time. "Defeat" = the bot wins under `conquest_civic_centers` (all
enemy civic centers destroyed or captured), per the statistics
`playerState`. Time-box goals are about bot speed, not just winning
eventually — a win past the limit does not pass.

When a goal passes, record the run (command line, seeds, statistics) in
its `experiment.md`.
