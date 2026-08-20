# Goal 5 — Reach City Phase in under 20 in-game minutes (2026-08-20)

**PASSED** on 5 seeds in a row.

## Setup

- New: `manageConstruction()` builds three Town-class structures once in
  town phase — forge (200 wood), market (300 wood), temple (300 wood for
  gaul) — in that order, one at a time through the existing serialized
  `pendingBuild` path, after houses (higher priority) and before fields.
  Foundations do not count toward the phase requirement
  (`TechnologyManager` classCounts exclude them), so the bot tracks
  completed `Town`-class structures and treats foundations only as
  "already queued" to avoid duplicates.
- `managePhaseUp()` was already ready: `canResearch("phase_city_generic")`
  stays false until 3 Town structures are completed, then training pauses,
  the 750 stone / 750 metal (+buffer) is banked, and the CC researches it.
- Opponent: Petra sandbox, rome. 30 in-game-minute time limit.
- Command as in `experiments/goal-01.md`; runner `tmp/goal5/run.sh`
  (copy of goal-4's).

## Results

| seed | exit | JS errors | town phase at | city phase at | stats sha256 (16) |
|---|---|---|---|---|---|
| 1 | 0 | 0 | 7.2 min | 15.3 min | 227618d297865eea |
| 2 | 0 | 0 | 6.5 min | 15.0 min | 3328d19ebef27028 |
| 3 | 0 | 0 | 6.9 min | 14.7 min | 3a4c652cc95bff52 |
| 4 | 0 | 0 | 6.8 min | 15.7 min | 8159df3918a24106 |
| 5 | 0 | 0 | 7.3 min | 14.9 min | 417cc2a41a01dfcf |

All well under the 20-minute limit (~8 min from town to city: ~7 min to
build the three Town structures serially with 2 builders each, then the
60 s research once the bank was full — stone/metal stockpiles were
already > 850 when the third structure completed).

- Population growth maintained on every seed (5-min samples, pop/limit):
  33/45 at t=5m, ~90/100 at t=10m, 162–187 at t=15m, 243–286 at t=20m,
  300/300 by t=25m; never capped below popMax; idle ≤ 3 everywhere.
- No regressions on goals 1–4: town-phase timing unchanged (6.5–7.3 min,
  same as goal-4 runs), gathering and house training untouched.
- Determinism: seed 1 rerun byte-identical statistics JSON
  (sha 227618d297865eea).
- Note: wood dips low around t=9–11m (~90 on seed 1) while town buildings
  compete with house construction — never starves training, but watch it
  if more wood sinks are added.
