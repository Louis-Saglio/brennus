# Goal 9 — Defend, boom and expand

- **Bot**: `brennus_gaul_defend_boom_and_expand_generic_land_map` (copy of
  the goal-8 bot; expansion shares still tuned for the 30-minute deadline
  — no defend logic yet, that is this goal's work)
- **Settings**: `random/mainland` size 192, biome `generic/temperate`,
  placement `circle`, victory `conquest_civic_centers`; bot plays gaul,
  opponent Petra (difficulty 3 = medium, behaviour `defensive`) plays
  rome; 45-minute time limit (the match must end at the 45-minute mark —
  stockpiles and borders are not monotone). Goal-8 reruns must pass
  `-l 30` to `tools/run.sh` to restore the 30-minute limit.
- **Criteria**: same bars as goal 8 — boom first (City Phase AND 300 pop
  ≤ 15 min), then by 45 in-game minutes control **at least 70% of the
  map** (`percentMapControlled`, share of passable map connected to the
  bot's roots) and stockpile **at least 50000 food and wood**
  (`resourcesCount`). The original 50000 stone/metal bars are physically
  unreachable on this map (deposits hold ~28k stone / ~40k metal) —
  recalibration pending.
- **New for goal 9**: the opponent is no longer a sandbox — Petra at
  medium difficulty, defensive behaviour, actively builds and defends
  territory. The bot's expansion must still reach the bars while
  surviving 45 minutes against it.
- **Status**: not yet attempted. Bot created as a copy of goal 8 and
  smoke-verified (zero JS errors, boom bars intact); first full match
  shows the starting gap — defeated by medium defensive Petra at ~31 min
  with peak 23% map control. See `experiment.md`.
