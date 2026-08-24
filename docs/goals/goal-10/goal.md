# Goal 10 — Defeat medium aggressive Petra

- **Bot**: `brennus_gaul_generic_land_map` (copied from the goal-9 bot as a
  starting point; free to diverge — no goal 8/9 behaviour needs preserving,
  this bot only needs to win this goal)
- **Settings**: `random/mainland` size 192, biome `generic/temperate`,
  placement `circle`, victory `conquest_civic_centers`; bot plays gaul,
  opponent Petra (difficulty 3 = medium, behaviour `aggressive`) plays rome.
- **Criteria**: defeat Petra — win under `conquest_civic_centers` (all enemy
  civic centers destroyed or captured, per the statistics `playerState`) in
  **under 45 in-game minutes** (`timeElapsed`). The mod's 45-minute time-limit
  trigger stays as the cap: a run the trigger has to end does not pass (a win
  at the trigger marks player 1 won regardless, so the experiment log must
  check `timeElapsed < 45` rather than trust the recorded winner).
- **New for goal 10**: Petra is aggressive — it raids and attacks from early
  on. The bot must survive the pressure and then convert its economy into an
  army strong enough to take the enemy civic centers, not just hold territory.
- **Status**: not yet attempted.
