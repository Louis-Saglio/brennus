# wallset_stone

Buildable by **15** civilisations. Generic (non-civ-specific) building of 0 A.D. 0.28.0 — see `docs/game_description/generic/buildings/README.md` for the method.

Generic stats resolved from the shared template `simulation/templates/template_wallset` (deepest template common to all civilisation variants; variants may override, see below).

Note: this is a **wall set**, not a single building — it defines the wall segments (short/medium/long/tower/gate) placed with the wall tool. Segment stats come from `template_structure_defensive_wall_*`.

## Guide

The Wall set is a defensive structure: it lets you enclose your base or critical buildings with stone wall segments to block or delay enemy attacks, with towers providing defensive strength and a gate letting your own units pass. It requires the town phase, so it is not available in the village phase — the bot can only start walling once it has advanced. Segments cost stone (a short segment is 12 stone and 12 s build time, a long one 36 stone and 36 s, a tower 48 stone and 48 s), so building a full enclosure is a premium investment, since stone is a scarce resource. Build walls only if you have a steady stone income and a genuine need to protect a static position; they are buildable by 15 civilisations including gaul.

## Basic stats

- **Generic name:** Wall
- **Requirements:** phase_town
- **Visible classes:** Wall

## Civilisations that can build it

- **athen** — `structures/athen/wallset_stone`
- **brit** — `structures/brit/wallset_stone`
- **cart** — `structures/cart/wallset_stone`
- **gaul** — `structures/gaul/wallset_stone`
- **germ** — `structures/germ/wallset_stone`
- **han** — `structures/han/wallset_stone`
- **iber** — `structures/iber/wallset_stone`
- **kush** — `structures/kush/wallset_stone`
- **mace** — `structures/mace/wallset_stone`
- **maur** — `structures/maur/wallset_stone`
- **pers** — `structures/pers/wallset_stone`
- **ptol** — `structures/ptol/wallset_stone`
- **rome** — `structures/rome/wallset_stone`
- **sele** — `structures/sele/wallset_stone`
- **spart** — `structures/spart/wallset_stone`
