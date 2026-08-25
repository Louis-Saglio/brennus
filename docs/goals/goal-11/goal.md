# Goal 11 — Defeat hard aggressive Petra

- **Bot**: `brennus_gaul_generic_land_map`, modified in place (no goal-11
  copy — beating hard Petra implies beating medium, so goal-10 behaviour does
  not need preserving)
- **Settings**: `random/mainland` size 192, biome `generic/temperate`,
  placement `circle`, victory `conquest_civic_centers`; bot plays gaul,
  opponent Petra (difficulty 4 = hard, behaviour `aggressive`) plays rome.
- **Criteria**: defeat Petra — win under `conquest_civic_centers` (all enemy
  civic centers destroyed or captured, per the statistics `playerState`) in
  **under 45 in-game minutes** (`timeElapsed`). The mod's 45-minute time-limit
  trigger stays as the cap: a run the trigger has to end does not pass (a win
  at the trigger marks player 1 won regardless, so the experiment log must
  check `timeElapsed < 45` rather than trust the recorded winner).
- **Status**: not yet attempted.
