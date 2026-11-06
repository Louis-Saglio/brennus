# AGENTS.md — Brennus

Brennus is an in-engine JavaScript AI bot for 0 A.D. (Petra is the reference
implementation), shipped as a 0 A.D. mod and developed against **0.28.0 only**.

## Layout

- `bot/` — the mod: `mod.json` + `simulation/ai/brennus/` (data.json + JS).
- `tools/` — reusable experiment harness: headless match runner, run
  analyzers, paired A/B comparison, local install, game-data↔docs
  verification (see `tools/README.md`).
- `docs/game_description/` — game mechanics and entity data reference, all
  grounded in the 0 A.D. source reference. Consult before writing bot logic.
- `docs/ai_engine_api.md` — reference of the AI scripting API the bot uses.
- `docs/pyrogenesis_cli.md` — the engine command line, headless usage.
- `sweeps/` — records of past multi-seed sweeps (reports + results; the
  heavy per-game artifacts are gitignored).

## Hard constraints

- **Determinism is a hard requirement**: same seed → identical behavior. The
  bot must never use unseeded randomness; gamesetup defaults that resolve
  randomly (biome, player placement) must be pinned on the command line.
- The engine and game data are the installed `0ad 0.28.0-3` /
  `0ad-data 0.28.0-1` packages. **The 0 A.D. source reference** is a
  checkout of the official repository
  (https://gitea.wildfiregames.com/0ad/0ad) at tag `v0.28.0` — on
  boobynator, `~/Work/0ad`. Its text files are identical to the installed
  game data (binary LFS assets are not fetched). Trust it over general
  0 A.D. knowledge, and trust the source over docs when they disagree.
  Every path the docs cite is relative to its root (`source/…` = engine
  C++, `binaries/data/mods/public/…` = the public mod: simulation, AI,
  maps), so a citation also resolves at
  `https://gitea.wildfiregames.com/0ad/0ad/src/tag/v0.28.0/<path>`. Keep
  the checkout on the tag; work on 0 A.D. itself (e.g. a pull request) goes
  in a separate `git worktree`.
- **Everything is verified by running the game headless** (`tools/run.sh`).
  A change to the bot is not done until a headless match ran without JS
  errors.
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

Matches run headless on boobynator (Louis's daily PC) with `tools/run.sh`:
the documented `pyrogenesis` command (`docs/pyrogenesis_cli.md` §3) with
the standard settings below pinned, one isolated HOME per match, under
`nice`/`ionice`. Budget set by Louis: **12 parallel matches** locally (the
default). The thinkpad (`ssh thinkpad`, same packages) takes up to 4 more
with `-H thinkpad:4` when it is on and on mains power; `run.sh` skips it
otherwise. Games are bit-identical across both machines, and the archived
kiln sweeps reproduce exactly when rerun with their own code (see
`docs/LESSONS_LEARNED.md`, 2026-11-05). Run batches as background jobs with
a completion notification — never poll. `tools/analyze.py` summarizes a
batch.

Syntax-check the mod before a batch — a broken JS file wastes every slot:
`for f in bot/simulation/ai/brennus/*.js; do node --input-type=module --check < "$f"; done`.

## Standard settings

The standard match for all experiments and validation — Brennus (Gauls) vs
Petra (Rome):

- map `random/mainland`, size `192`, biome `generic/temperate`,
  placement `circle`, victory `conquest_civic_centers`
- Brennus: `gaul`, diff `3`, behavior `aggressive`, team `1`
- Petra: `rome`, diff `3` (medium), behavior `aggressive`, team `2`
- observer (`-autostart-player=-1`); the mod's
  `maps/scripts/NonVisualTrigger.js` ends the game at 45 in-game minutes
  by marking player 1 won — a "win" with `time limit reached` in stdout
  is a timeout; 1800 s wall-clock cap per match
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
- **After each non pure doc commit, install the mod into the local 0 A.D.**
  (`tools/install-local.sh`) so Louis can play against it on this machine.
