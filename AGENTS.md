# AGENTS.md — Brennus

Brennus is an in-engine JavaScript AI bot for 0 A.D. (Petra is the reference
implementation), shipped as a 0 A.D. mod and developed against **0.28.0 only**.

## Layout

- `bot/` — the mod: `mod.json` + `simulation/ai/brennus/` (data.json,
  brennus.js). Currently a verified no-op skeleton.
- `docs/game_description/` — game mechanics and entity data reference, all
  grounded in the pinned game copy (see its README). Consult before writing
  bot logic.
- `docs/ai_engine_api.md` — reference of the AI scripting API the bot uses.
- `docs/pyrogenesis_cli.md` — the engine command line, headless usage.
- `tmp/` — scratch (isolated match HOMEs, smoke-run logs). Never commit-grade
  output.

## Hard constraints

- **Determinism is a hard requirement**: same seed → identical behavior. The
  bot must never use unseeded randomness; gamesetup defaults that resolve
  randomly (biome, player placement) must be pinned on the command line.
- Engine, game data and source are version-pinned in
  `/home/ubuntu/0ad-reference/` (0.28.0); trust it over general 0 A.D.
  knowledge. Trust the source over docs when they disagree.
- **Everything is verified by running the game headless** with
  `pyrogenesis -autostart-nonvisual` (see `docs/pyrogenesis_cli.md`). A change
  to the bot is not done until a headless match ran without JS errors.
- Never run matches with HOME on `/tmp` (small tmpfs); use isolated HOMEs
  under `tmp/` or an experiments directory.
- AI performance matters: the bot must not slow the simulation — no full-map
  scans per tick, prefer cached entity collections and shared resource maps.

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

## Keep game runs short

Running the game is the only way to test, and it is time-consuming: a match
runs flat-out (~113 turns/s on this machine, so ~20 in-game minutes ≈ 1 wall
minute), and an undecided game **never exits on its own** — the engine only
quits when a victory condition fires. Take measures so no run lasts longer
than strictly necessary:

- Always wrap runs in `timeout`, sized from the in-game budget the test
  actually needs (turns = in-game ms / 200; wall ≈ turns / 113).
- For anything short of a full goal attempt, cap game time **in the mod**
  (a time-limit trigger that marks players won so the engine exits cleanly
  and prints statistics) rather than relying on wall-clock `timeout` —
  SIGTERM skips `metadata.json` and end-of-game statistics.
- Prefer the smallest/fastest setup that exercises the change: a small map,
  a sandbox or no opponent, and only as many seeds/matches as the test
  requires.
- Never leave a run going "just in case": if the check you need has already
  printed what you need, stop the process.

## Smoke test

```sh
HOME=$PWD/tmp/smoke-home timeout 150 /usr/games/pyrogenesis \
  -autostart=random/mainland -autostart-seed=1 \
  -autostart-biome=generic/temperate -autostart-placement=circle \
  -autostart-nonvisual -autostart-players=2 -autostart-size=192 \
  -autostart-victory=conquest_civic_centers \
  -autostart-ai=1:brennus -autostart-ai=2:petra -autostart-aidiff=2:3 \
  -autostart-civ=1:gaul -autostart-civ=2:rome -autostart-player=-1 \
  -unique-logs -nosound -mod=public -mod=brennus
```

Before running, copy `bot/` into `$HOME/.local/share/0ad/mods/brennus`.
Success = `[HARNESS] brennus: loaded for player 1` on stdout, turns
progressing, zero `ERROR` lines in the interesting log
(`$HOME/.local/state/0ad/log/interestinglog_*.html`).

## Sharing progress

- **Commit and push** to `main` on GitHub (Louis-Saglio/brennus) every time
  significant progress is made — a passing goal, a working feature, a doc
  update worth keeping. Don't batch unrelated changes.
- **After each commit, publish the mod as a zip on the file server** so Louis
  can try it. Build it with `mod.json` at the archive root and publish a
  commit-named file plus a stable `brennus.zip`:

  ```sh
  SHA=$(git rev-parse --short HEAD)
  (cd bot && python3 -m zipfile -c ../tmp/brennus-$SHA.zip .)
  sudo install -D -o fileserver -g fileserver -m 644 \
    tmp/brennus-$SHA.zip /home/fileserver/files/brennus/brennus-$SHA.zip
  sudo install -o fileserver -g fileserver -m 644 \
    tmp/brennus-$SHA.zip /home/fileserver/files/brennus/brennus.zip
  ```

  Download URL: `https://files.louissaglio.fr/brennus/brennus.zip`
  (basic auth, see the global AGENTS.md). The file server is no-cache, so
  the stable name always serves the latest commit.
