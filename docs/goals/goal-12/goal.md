# Goal 12 — Defeat very hard aggressive Petra

- **Bot**: `super_brennus` (copied from `brennus_gaul_boom_generic_land_map` as
  a starting point; free to diverge — no earlier goal's behaviour needs
  preserving, this bot only needs to win this goal)
- **Settings**: `random/mainland` size 192, biome `generic/temperate`,
  placement `circle`, victory `conquest_civic_centers`; bot plays gaul,
  opponent Petra (difficulty 5 = very hard, behaviour `aggressive`) plays
  rome.
- **Criteria**: defeat Petra — win under `conquest_civic_centers` (all enemy
  civic centers destroyed or captured, per the statistics `playerState`) in
  **under 45 in-game minutes** (`timeElapsed`). The mod's 45-minute
  time-limit trigger stays as the cap: a run the trigger has to end does not
  pass (a win at the trigger marks player 1 won regardless, so the experiment
  log must check `timeElapsed < 45` rather than trust the recorded winner).
  This is the **only** criterion — no goal-10/11 economy or efficiency
  requirements carry over.
- **New for goal 12**: Petra is very hard — its resource gather rate and
  trade gain are **+56%** over medium (pinned petra `data.json`), on top of
  the aggressive behaviour. The bot must beat a faster-booming, aggressive
  opponent, not just survive and eventually push a late raid through.

## Tips (Louis)

These stay in force for the whole goal; keep them when the session compacts:

1. **Do not let the enemy build towers and fortresses next to your border.**
   Destroy them in priority.
2. **Do not attack buildings with soldiers.** Attack buildings only with
   siege. You can capture a building with soldiers, but if it's garrisoned
   it's difficult.
3. **When your citizen soldiers are not fighting, they should be working.**
4. **Monitor your workers' gathering efficiency.** Their gathering rate
   should be close to the theoretical one. Otherwise your economy will sink.
5. **Re-read the relevant content in `docs/game_description/`** to keep game
   knowledge up to date. Especially the `mechanics/` and `gaul/` directories.
6. **Make use of all the units in the gaul roster.** Each unit has its role.
7. **kiln is not available for this goal.** Use the pyrogenesis command
   directly instead: the local headless runner is `tools/run.sh` (see
   `docs/pyrogenesis_cli.md` §3), e.g.
   `tools/run.sh -a super_brennus -d 5 -v aggressive bot tmp/goal12 s1=1`.
   There is no `in_game_limit_min`/`wall_budget_s` locally — the mod's own
   45-minute `NonVisualTrigger` caps the game and `timeout` caps the wall
   clock. Results land under `<outdir>/<tag>/stdout.log` instead of kiln's
   results dir.

- **Status**: not yet attempted.
