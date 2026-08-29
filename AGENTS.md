# AGENTS.md — Brennus

Brennus is an in-engine JavaScript AI bot for 0 A.D. (Petra is the reference
implementation), shipped as a 0 A.D. mod and developed against **0.28.0 only**.

## Layout

- `bot/` — the mod: `mod.json` + `simulation/ai/brennus/` (data.json + JS).
- `tools/` — reusable experiment harness: headless match runner, run
  analyzers, paired A/B comparison, game-data↔docs verification (see
  `tools/README.md`).
- `docs/game_description/` — game mechanics and entity data reference, all
  grounded in the pinned game copy. Consult before writing bot logic.
- `docs/ai_engine_api.md` — reference of the AI scripting API the bot uses.
- `docs/pyrogenesis_cli.md` — the engine command line, headless usage.
- `docs/kiln.md` — the remote match-running farm: MCP tools, job-spec
  format, reading results, waiting without polling.

## Hard constraints

- **Determinism is a hard requirement**: same seed → identical behavior. The
  bot must never use unseeded randomness; gamesetup defaults that resolve
  randomly (biome, player placement) must be pinned on the command line.
- Engine, game data and source are version-pinned in
  `~/0ad-reference/` (0.28.0); trust it over general 0 A.D.
  knowledge. Trust the source over docs when they disagree.
- **Everything is verified by running the game headless** with kiln. A change
  to the bot is not done until a headless match ran without JS errors.
- AI performance matters: the bot must not slow the simulation — no full-map
  scans per tick, prefer cached entity collections and shared resource maps.

## Editing boundaries

- **Never edit `AGENTS.md` or any file under `docs/`** (except the one file
  below). These documents are the project's fixed reference; if one seems
  wrong, report it to Louis instead of changing it.
- **The one exception is `docs/LESSONS_LEARNED.md`** — you are allowed, and
  encouraged, to update it. Record there the things you learn while
  developing the bot (engine quirks, failed approaches, verified facts, perf
  measurements) so the knowledge is not investigated again and the same
  mistakes are not made twice. Keep entries short, dated, and factual.

## Telemetry and logging

Understanding what happened during a game is a first-class requirement:
implement telemetry and logging **in the mod**, not only in the bot code.
Any JS the engine executes is fair game — AI scripts
(`simulation/ai/brennus/`), map trigger scripts (e.g. a
`maps/scripts/NonVisualTrigger.js` override), autostart JS — wherever the
data lives. **Never patch the engine (C++)**: the pinned 0.28.0 binary stays
untouched so results remain comparable.

Channels: `print()` goes to stdout (tag bot lines, e.g. `[HARNESS]`), the
engine prints per-player statistics JSON at game end, and trigger scripts
can run arbitrary JS on game events/intervals.

Logging has a cost: printing every turn or in hot `OnUpdate` paths slows the
simulation measurably (see the turn-rate figures in
`docs/pyrogenesis_cli.md`). Log sparingly and coarsely (init, phase changes,
end-of-game summaries), and when in doubt measure the turn rate with and
without the logging enabled.

## Running a game

Use kiln through its MCP to run games headless — **never run test games
on this VPS** (full matches are too heavy here; kiln runners are
~5-10× faster). The local harness (`tools/run.sh`) remains only as a
fallback if kiln is unavailable. See `docs/kiln.md` for the how-to: MCP
tools, job-spec format, reading results, waiting without polling.

## Standard settings

The standard match for all experiments and validation — Brennus (Gauls) vs
Petra (Rome):

- map `random/mainland`, size `192`, biome `generic/temperate`,
  placement `circle`, victory `conquest_civic_centers`
- Brennus: `gaul`, diff `3`, behavior `aggressive`, team `1`
- Petra: `rome`, diff `3` (medium), behavior `aggressive`, team `2`
- observer (`player: -1`), `in_game_limit_min: 45`, `wall_budget_s: 1800`
- `seed = aiseed`, both pinned

## Iterating

- **Vary the probe seed while iterating**: tuning against a single
  seed overfits behavior to that map (e.g. seed 1 mainland is unusually
  poor in berries). Rotate seeds for iteration probes; validate with the
  full multi-seed batch.
- **The bot is chaotic**: a small, anecdotal change can propagate and derail
  the whole behavior significantly. When a change that should theoretically
  be good seems at first to yield bad results, keep it and try to rebalance
  the behavior around it before discarding it. Discard it only when you
  understand why the change is theoretically incorrect.

## Sharing progress

- **Commit and push** to `main` on GitHub (Louis-Saglio/brennus) every time
  significant progress is made — a working feature, a behaviour improvement, or a doc
  update worth keeping. Don't batch unrelated changes.
- **After each non pure doc commit, publish the mod as a zip on the file server** so Louis
  can try it. Build it with `mod.json` at the archive root and publish a stable `brennus.zip`.
