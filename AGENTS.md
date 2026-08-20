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
