# storehouse

Buildable by **15** civilisations. Generic (non-civ-specific) building of 0 A.D. 0.28.0 — see `docs/game_description/generic/buildings/README.md` for the method.

Generic stats resolved from the shared template `simulation/templates/template_structure_economic_storehouse` (deepest template common to all civilisation variants; variants may override, see below).

## Guide

The Storehouse is the resource dropsite for wood, metal and stone: build it near forests, mines or quarries so gatherers waste less time walking back to the Civic Centre. Its `DropsiteWood DropsiteMetal DropsiteStone` classes mean one cheap, easy-to-mass building (only 100 wood, an abundant resource, and 40 s build time) covers all three non-food resources, so placing one at each remote resource cluster is a core economic move. It is available from the village phase with no further requirements and must be placed in your own territory; its 20 m territory influence also nudges your border outward at the new site.

## Basic stats

- **Generic name:** Storehouse
- **Health:** 800 HP
- **Armor:** 9 hack / 20 pierce / 1 crush
- **Cost:** 100 wood
- **Build time:** 40 s
- **Territory influence:** radius 20 m, weight 30000
- **Vision:** 20 m
- **Capture points:** 500
- **Build territory:** own
- **Placement:** land
- **Requirements:** phase_village
- **Classes:** Structure DropsiteWood DropsiteMetal DropsiteStone
- **Visible classes:** Economic Village Storehouse

## Civilisations that can build it

- **athen** — `structures/athen/storehouse`
- **brit** — `structures/brit/storehouse`
- **cart** — `structures/cart/storehouse`
- **gaul** — `structures/gaul/storehouse`
- **germ** — `structures/germ/storehouse`
- **han** — `structures/han/storehouse`
- **iber** — `structures/iber/storehouse`
- **kush** — `structures/kush/storehouse`
- **mace** — `structures/mace/storehouse`
- **maur** — `structures/maur/storehouse`
- **pers** — `structures/pers/storehouse`
- **ptol** — `structures/ptol/storehouse`
- **rome** — `structures/rome/storehouse`
- **sele** — `structures/sele/storehouse`
- **spart** — `structures/spart/storehouse`

## Civilisation-specific overrides

These civilisations override the generic stats above (only differing values are listed):

- **han** — `structures/han/storehouse`
  - garrison 1 slots
