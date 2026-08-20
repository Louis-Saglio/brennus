# farmstead

Buildable by **15** civilisations. Generic (non-civ-specific) building of 0 A.D. 0.28.0 — see `docs/game_description/generic/buildings/README.md` for the method.

Generic stats resolved from the shared template `simulation/templates/template_structure_economic_farmstead` (deepest template common to all civilisation variants; variants may override, see below).

## Guide

The Farmstead is the food-economy building: its `DropsiteFood` class lets gatherers deposit food closer to fields and bushes, and its tooltip states it is where food-gathering technologies are researched (the `gather_farming_*` tech line). At 100 wood and 45 s build time in `phase_village`, it is the cheap early investment a bot should place near farms as soon as food gathering starts. Its 20 m territory influence also helps expand buildable territory into farming areas.

## Basic stats

- **Generic name:** Farmstead
- **Health:** 900 HP
- **Armor:** 9 hack / 20 pierce / 1 crush
- **Cost:** 100 wood
- **Build time:** 45 s
- **Territory influence:** radius 20 m, weight 30000
- **Vision:** 20 m
- **Capture points:** 300
- **Build territory:** own
- **Placement:** land
- **Requirements:** phase_village
- **Classes:** Structure DropsiteFood
- **Visible classes:** Economic Village Farmstead

## Civilisations that can build it

- **athen** — `structures/athen/farmstead`
- **brit** — `structures/brit/farmstead`
- **cart** — `structures/cart/farmstead`
- **gaul** — `structures/gaul/farmstead`
- **germ** — `structures/germ/farmstead`
- **han** — `structures/han/farmstead`
- **iber** — `structures/iber/farmstead`
- **kush** — `structures/kush/farmstead`
- **mace** — `structures/mace/farmstead`
- **maur** — `structures/maur/farmstead`
- **pers** — `structures/pers/farmstead`
- **ptol** — `structures/ptol/farmstead`
- **rome** — `structures/rome/farmstead`
- **sele** — `structures/sele/farmstead`
- **spart** — `structures/spart/farmstead`

## Civilisation-specific overrides

These civilisations override the generic stats above (only differing values are listed):

- **han** — `structures/han/farmstead`
  - garrison 1 slots
