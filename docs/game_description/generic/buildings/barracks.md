# barracks

Buildable by **15** civilisations. Generic (non-civ-specific) building of 0 A.D. 0.28.0 — see `docs/game_description/generic/buildings/README.md` for the method.

Generic stats resolved from the shared template `simulation/templates/template_structure_military_barracks` (deepest template common to all civilisation variants; variants may override, see below).

## Guide

The Barracks is the main infantry production building: it trains the full roster of citizen-soldier and champion infantry (spearmen, pikemen, swordsmen, archers, etc.) and researches infantry technologies, so building one is the standard way to start producing a fighting army. It is available from the Village phase for 200 wood and 100 stone (300 wood for brit/gaul/maur) — the stone is a scarce, premium resource, making it more of an investment than a wood-only building — takes 150 s to build, and can garrison 10 units. Its 50 m territory influence with weight 40000 also expands your borders. Note that some civilisations (germ, han, pers, spart) train reduced or specialised unit lists from it.

## Basic stats

- **Generic name:** Barracks
- **Health:** 2000 HP
- **Armor:** 24 hack / 35 pierce / 3 crush
- **Cost:** 200 wood, 100 stone
- **Build time:** 150 s
- **Territory influence:** radius 50 m, weight 40000
- **Garrison:** 10 slots
- **Vision:** 32 m
- **Capture points:** 500
- **Build territory:** own
- **Placement:** land
- **Requirements:** phase_village
- **Trains:** units/{civ}/infantry_clubman units/{civ}/infantry_spearman_b units/{civ}/infantry_pikeman_b units/{civ}/infantry_maceman_b units/{civ}/infantry_axeman_b units/{civ}/infantry_swordsman_b units/{civ}/infantry_javelineer_b units/{civ}/infantry_slinger_b units/{civ}/infantry_archer_b units/{civ}/champion_infantry_spearman units/{civ}/champion_infantry_pikeman units/{civ}/champion_infantry_maceman units/{civ}/champion_infantry_axeman units/{civ}/champion_infantry_swordsman units/{civ}/champion_infantry_javelineer units/{civ}/champion_infantry_slinger units/{civ}/champion_infantry_archer
- **Classes:** Structure ConquestCritical
- **Visible classes:** Military Village Barracks

## Civilisations that can build it

- **athen** — `structures/athen/barracks`
- **brit** — `structures/brit/barracks`
- **cart** — `structures/cart/barracks`
- **gaul** — `structures/gaul/barracks`
- **germ** — `structures/germ/barracks`
- **han** — `structures/han/barracks`
- **iber** — `structures/iber/barracks`
- **kush** — `structures/kush/barracks`
- **mace** — `structures/mace/barracks`
- **maur** — `structures/maur/barracks`
- **pers** — `structures/pers/barracks`
- **ptol** — `structures/ptol/barracks`
- **rome** — `structures/rome/barracks`
- **sele** — `structures/sele/barracks`
- **spart** — `structures/spart/barracks`

## Civilisation-specific overrides

These civilisations override the generic stats above (only differing values are listed):

- **brit** — `structures/brit/barracks`
  - cost 300 wood
- **gaul** — `structures/gaul/barracks`
  - cost 300 wood
- **germ** — `structures/germ/barracks`
  - trains units/{civ}/infantry_spearman_b units/{civ}/infantry_swordsman_b units/{civ}/infantry_javelineer_b units/{civ}/infantry_slinger_b units/{civ}/champion_infantry_maceman
- **han** — `structures/han/barracks`
  - trains units/{civ}/infantry_spearman_b units/{civ}/infantry_pikeman_b units/{civ}/infantry_archer_b units/{civ}/infantry_crossbowman_b
- **maur** — `structures/maur/barracks`
  - cost 300 wood
- **pers** — `structures/pers/barracks`
  - trains units/{civ}/infantry_spearman_b units/{civ}/infantry_javelineer_b units/{civ}/infantry_archer_b units/{civ}/champion_infantry units/{civ}/champion_infantry_archer_upgrade
- **spart** — `structures/spart/barracks`
  - trains units/{civ}/infantry_spearman_b units/{civ}/infantry_javelineer_b units/{civ}/champion_infantry_swordsman units/{civ}/infantry_spearman_neodamodes
