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
- **Status**: not yet attempted.
