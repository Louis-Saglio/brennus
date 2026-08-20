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
| 5 | City Phase < 20 in-game min | PASSED (5 seeds, published) | see git log |
| 6 | Master the economy by 30 min | **next** | — |

## Next: goal 6 (economy mastery by 30 in-game min)

Needs all of: 300 population (already hits popMax ~t=22–25m), all economic
technologies researched, City Phase (done ~t=15m), ≥ 10 traders, ≥ 1000
resources earned from trader trading, ≥ 300 wood bartered to stone at the
market.

- The market is already built (goal 5): traders
  (`units/{civ}/support_trader`) train there, and barter is a market
  ability (`Barter` class). Check `docs/ai_engine_api.md` for barter and
  trade APIs (`getTraderTemplatesGains`, entity `trade`/`barter` orders?).
- Trade income needs a trade route: traders between two markets (or a
  market and a dock/allied market). With one CC + one market the bot may
  need a second market far away for meaningful gain.
- "All economic technologies": enumerate from the game data (field,
  farmstead/storehouse, market techs); some need buildings the bot does
  not build yet (farmstead, storehouse, corral?).
- Verification recipe: copy `tmp/goal5/run.sh` to `tmp/goal6/run.sh`
  (sed goal5→goal6). Goal-6 outcomes live in the end-of-game statistics
  JSON (trade income, barter) and `metadata.json`; 30-min runs as usual.

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
