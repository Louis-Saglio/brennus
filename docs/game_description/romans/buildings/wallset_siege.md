# wallset_siege

Roman-specific building of 0 A.D. 0.28.0 — only the romans can build it. See `docs/game_description/romans/buildings/README.md` for the method; shared buildings are documented in `docs/game_description/generic/buildings/`.

Stats resolved from `simulation/templates/structures/rome/wallset_siege` (full roman template chain).

Note: this is a **wall set**, not a single building — it defines the wall segments placed with the wall tool. Segment stats come from `template_structure_defensive_wall_*`.

## Guide

The Siege Wall is the Roman offensive wall set: unlike normal walls, its segments can be built in own, neutral **and enemy** territory (`BuildRestrictions`), making it the tool for walling off an area right at the enemy's doorstep. It requires `phase_city` and costs only wood (60 wood per long segment, 30 s build time), an abundant resource, so it is easy to mass, but segments are weaker than standard stone walls (Health ×0.75), so it is a field fortification rather than a permanent defense. Its gate/tower templates plus the `army_camp` fort let a bot establish a forward fortified position; build it to protect a siege or forward base, not as a substitute for the stone `wallset_stone` at home.

## Basic stats

- **Generic name:** Siege Wall
- **Requirements:** phase_city
- **Classes:** CivSpecific
- **Visible classes:** Wall SiegeWall

## Built by

- **rome** — `structures/rome/wallset_siege`
