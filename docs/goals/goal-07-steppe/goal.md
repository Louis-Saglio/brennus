# Goal 7-S — Boom on the steppe biome

- **Bot**: `brennus_gaul_boom_generic_land_map`
- **Settings**: `random/mainland` size 192, biome `generic/steppe`,
  placement `circle`, victory `conquest_civic_centers`; bot plays gaul,
  opponent Petra (difficulty 0) plays rome; 30-minute time limit.
- **Criteria**: minimize **max(pop300, city)** — one single score, not
  the two metrics independently (delaying pop300 is fine whenever city
  is the slower one). Every steppe seed must reach ≤ 14.5, and temperate
  must keep the goal-7 bar (pop300 AND city ≤ 15 on its own 5-seed
  batch). Steppe wood is ~100-wood bushes gathered by 4 workers (≈¼ of
  temperate's wood); horses give 200 meat but flee fast — the boom must
  be wood-conservative and meat-driven.
- **Status**: not met yet — fresh mean 17.56 → 14.54, but seed 15 at
  16.1; temperate bar holds. See `experiment.md`.
