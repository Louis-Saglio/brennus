# AGENTS.md — Brennus

Brennus is an in-engine JavaScript AI bot for 0 A.D. (Petra is the reference
implementation), shipped as a 0 A.D. mod and developed against **0.28.0 only**.

## Layout

- `bot/` — the mod: `mod.json` + one `simulation/ai/<bot>/` per bot
  (data.json + JS). Names encode civ, specialty and map class.
- `tools/` — reusable experiment harness: headless match runner, run
  analyzers, paired A/B comparison, game-data↔docs verification (see
  `tools/README.md`).
- `docs/goals/` — one directory per goal: `goal.md` (target, target bot,
  settings) + `experiment.md` once attempted. Work on goal n+1 only after
  goal n passes.
- `docs/game_description/` — game mechanics and entity data reference, all
  grounded in the pinned game copy. Consult before writing bot logic.
- `docs/ai_engine_api.md` — reference of the AI scripting API the bot uses.
- `docs/pyrogenesis_cli.md` — the engine command line, headless usage.

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
Use kiln through its MCP to run games in headless mode efficiently.
You can use this project custom game running harness only as a fallback if kiln is not available.
See "Running test games with kiln" below for the how-to.

## Iterating on goals

- **Vary the probe seed while iterating**: tuning against a single
  seed overfits behavior to that map (e.g. seed 1 mainland is unusually
  poor in berries). Rotate seeds for iteration probes; validate with the
  full multi-seed batch.
- **The bot is chaotic**: a small, anecdotal change can propagate and derail
  the whole behavior significantly. When a change that should theoretically
  be good seems at first to yield bad results, keep it and try to rebalance
  the behavior around it before discarding it. Discard it only when you
  understand why the change is theoretically incorrect.

## Parallel runs

Pyrogenesis is mostly single-threaded: one running match saturates roughly
one core. When several matches must be run (e.g. multi-seed verification),
run them **in parallel, one per core**, each with its own isolated HOME —
this speeds up verification batches a lot compared to running them serially.

## Running test games with kiln

Kiln is a distributed 0 A.D. test runner: a server holds a queue of job
specs, runners (machines with a pinned 0 A.D. install) pull jobs and run
them headless, and results come back with per-player statistics. It is
driven through MCP tools.

### Workflow

1. `list_runners` — see which runners are `active`, their free capacity
   (`slots`), benchmark speed (`benchmark_turns_per_sec`) and canary status.
   Only `active` runners with `canary_ok: true` pick up jobs.
2. `submit_batch` — pack a mod directory and submit one job spec. Returns a
   batch id and one job id.
3. `get_batch_status` — poll until every job is `done` or `failed`. Job
   states: `queued` → `running` → `done`/`failed`. A finished job embeds
   its full result inline.
4. `get_result` — fetch one job's result: `exit_code`, `wall_seconds`,
   `turn_count`, `turns_per_sec`, per-player `stats` (each with
   `playerState` = `won`/`defeated` and the full end-of-game statistics the
   engine prints), plus `result_dir` and `artifacts_tarball` paths.

One `submit_batch` call creates one batch containing one job. For a
multi-seed verification, submit one batch per seed (they run in parallel on
free runner slots).

### Job spec

```json
{
  "map": "random/mainland",
  "seed": 1,
  "aiseed": 1,
  "biome": "generic/temperate",
  "placement": "circle",
  "size": 192,
  "players": [
    {"ai": "<bot_ai_name>", "diff": 3, "behavior": "balanced", "civ": "gaul", "team": 1},
    {"ai": "petra",         "diff": 3, "behavior": "balanced", "civ": "rome", "team": 2}
  ],
  "victory": ["conquest_civic_centers"],
  "player": -1,
  "in_game_limit_min": 15,
  "wall_budget_s": 600,
  "collect_replay": false
}
```

All fields except `in_game_limit_min` and `collect_replay` are required —
`diff` and `behavior` must be given for **every** player, including your own
bot. Validation is strict (unknown values are rejected instead of silently
ignored by the engine):

- `map`: `random/<name>` (also skirmish/scenario maps) from the pinned
  0.28.0 allowlist.
- `players[].ai`: the AI directory name, i.e. a `simulation/ai/<name>/`
  with a `data.json` — `petra` or one of the bot's AI ids (see
  `bot/simulation/ai/`). **A wrong AI name does not fail the job**: the game
  runs with an idle player and `exit_code` stays 0. Detect it by checking
  the artifacts' `stdout.log` for `Failed to create AI player` and by
  confirming your bot's `[HARNESS]` line printed and its stats are non-zero.
- `players[].diff`: 0..=5. `players[].behavior`: `random`, `balanced`,
  `defensive` or `aggressive`.
- `players[].team`: `-1` (no team) or 1-based `1..=N` — **not** 0-based.
- `size`: 64..=1024. Max 8 players.
- `player`: local player slot, `-1` = observer (use that for bot matches).
- `seed`/`aiseed`: map and AI seeds. Pin both, plus `biome` and
  `placement`, to keep runs deterministic (verified: resubmitting the same
  spec yields identical turn counts and identical statistics; only
  wall-clock timings differ).
- `in_game_limit_min`: the kiln harness (a mod that mounts last and
  overrides `maps/scripts/NonVisualTrigger.js`) ends the game after this
  many in-game minutes by marking player 1 `won` and the rest `defeated`,
  so a capped run still exits cleanly and prints statistics. Always set
  it; 15 in-game minutes = 4499 turns. This means `playerState` in the
  stats only reflects real victory when the game ended before the limit.
- `wall_budget_s`: hard wall-clock kill enforced by the runner (server cap:
  7200). Size it generously above the expected run time — a killed job is
  `failed` and loses the clean end-of-game output.
- `collect_replay`: also uploads the `commands.txt` replay.

### Mod upload (`mod_dir`)

- `mod_dir` is a path **on the kiln server host**, read by the server
  process itself — it is not uploaded from your machine. If your working
  copy is not readable by the server, copy it to a directory it can read
  first. (A submit that fails with "not a directory" on a real directory
  means exactly this: wrong host, or the server process cannot traverse
  the path.)
- The directory's basename becomes the mod folder the runner installs and
  mounts (`-mod=<basename>`). Any name works — the runner mounts it
  consistently — but naming it after the mod avoids confusion.
- Omit `mod_dir` entirely for petra-only games.
- Bundles are content-addressed (sha256) and cached server-side, so
  resubmitting an unchanged mod costs nothing.

### Artifacts

`get_result` returns the server's local paths to `result_dir` and
`artifacts_tarball` (a .tar.gz). The tarball contains:

- `stdout.log` / `stderr.log` — full engine output; this is where
  `print()` lines (e.g. `[HARNESS]`) and JS errors land. **Always grep it
  for `ERROR`** before trusting a result.
- `stats.json` — the same per-player statistics as in the MCP result.
- `result.json` — exit code, wall seconds, turn count, turns/s.
- `metadata.json`, `mainlog.html`, `interestinglog.html` — engine logs.
- `replay/` — only when `collect_replay: true`.

These paths are on the kiln server host; you need shell access there (or a
copy step) to read them.

## Sharing progress

- **Commit and push** to `main` on GitHub (Louis-Saglio/brennus) every time
  significant progress is made — a passing goal, progress on a goal, a working feature, a doc
  update worth keeping. Don't batch unrelated changes.
- **After each non pure doc commit, publish the mod as a zip on the file server** so Louis
  can try it. Build it with `mod.json` at the archive root and publish a stable `brennus.zip`.
