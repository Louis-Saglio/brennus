# Current state — Brennus (2026-08-20)

Pick-up document for the next session. Read `AGENTS.md` and
`docs/GOALS.md` first; this file only tracks where the work stands.

## Goals status

| Goal | Description | Status | Commit |
|---|---|---|---|
| 1 | Function without errors | PASSED (5 seeds, published) | `992b680` |
| 2 | Gather resources | PASSED (5 seeds, published) | `eec1c13` |
| 3 | Grow population | PASSED (5 seeds, published) | `90b6299` |
| 4 | Town Phase < 12 in-game min | PASSED (5 seeds, published) | see git log |
| 5 | City Phase < 20 in-game min | **next** | — |

## Next: goal 5 (City Phase < 20 in-game min)

- `managePhaseUp` already maps phase 2 → `phase_city_generic` with a
  stone/metal buffer (850/850), but city requires **3 Town-class
  structures** — the bot currently builds only houses/fields (Village
  class). Add construction of Town-class buildings (barracks, market,
  forge, temple…). Check `docs/game_description/generic/buildings/` for
  which are Town class and their costs.
- Stockpiles at t=10–15m are ample (stone/metal ~2000+), so once Town
  buildings go up around t=8–10m, city by ~t=12–15m looks reachable.
- Verification recipe: copy `tmp/goal4/run.sh` to `tmp/goal5/run.sh`
  (sed goal4→goal5), same command; check the `[HARNESS] phase=` lines
  and zero ERROR in each run's interestinglog; rerun seed 1 for
  determinism.

## Known blemishes / ideas

- Seed 1 shows idle=13 at t=25m (pop maxed at 300, nearby food
  saturated). Other seeds idle ≤ 3. Consider capping food gatherers or
  more fields later if it matters for tier-2 goals.
- After popMax is reached, training keeps trying (harmless; queue
  blocked). Could skip training at popMax to save food for phases.
- The 30-min time limit in `bot/maps/scripts/NonVisualTrigger.js` is the
  harness cap for all tier-1 runs; probes can temporarily lower it.

## Operational notes

- Runs: copy `bot/` into an isolated HOME under `tmp/goalN/`, command as
  in `experiments/goal-01.md` (sandbox Petra opponent for tier 1).
- Experiment logs per goal live in `experiments/goal-NN.md`.
- Engine facts and pitfalls are in `docs/LESSONS_LEARNED.md` — check it
  before investigating engine behavior (passability bit semantics,
  currentPhase() numeric, construct/autorepair, etc.).
- Mod zip published after each commit:
  `https://files.louissaglio.fr/brennus/brennus.zip`.
