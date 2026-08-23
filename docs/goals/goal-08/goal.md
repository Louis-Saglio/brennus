# Goal 8 — Expand the base

- **Bot**: `brennus_gaul_boom_and_expand_generic_land_map`
- **Settings**: `random/mainland` size 192, biome `generic/temperate`,
  placement `circle`, victory `conquest_civic_centers`; bot plays gaul,
  opponent Petra (difficulty 0) plays rome; 30-minute time limit (the
  match must end at the 30-minute mark — stockpiles and borders are not
  monotone).
- **Criteria**: boom first — City Phase AND 300 pop ≤ 15 min (the goal-7
  bar: `max(pop300, city) ≤ 15`) — then by 30 in-game minutes control
  **at least 70% of the map** (`percentMapControlled`, share of passable
  map connected to the bot's roots) and stockpile **at least 50000 food
  and wood** (`resourcesCount`). The original 50000 stone/metal bars are
  physically unreachable on this map (deposits hold ~28k stone / ~40k
  metal) — recalibration pending.
- **Status**: territory, boom and determinism pass on 5 seeds; food/wood
  3/5 at 50k; stone/metal map-bound. See `experiment.md`.
