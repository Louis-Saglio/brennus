# dock

Buildable by **15** civilisations. Generic (non-civ-specific) building of 0 A.D. 0.28.0 — see `docs/game_description/generic/buildings/README.md` for the method.

Generic stats resolved from the shared template `simulation/templates/template_structure_military_dock` (deepest template common to all civilisation variants; variants may override, see below).

## Guide

The Dock is the entry point to everything naval: for 200 wood, an abundant resource, it is easy to afford and must be placed on a shoreline, from where it trains the full ship roster — `ship_fishing` (food economy), `ship_merchant` (trade), and warships (`ship_scout`, `ship_arrow`, `ship_ram`, `ship_fire`, `ship_siege`). Per its template, it also serves as a trade destination (Market component), a dropsite for all four resources, and the researcher for ship and fishing technologies. Build it only on maps with usable water: its economy and military value depend entirely on ships.

## Basic stats

- **Generic name:** Dock
- **Health:** 2500 HP
- **Armor:** 24 hack / 35 pierce / 3 crush
- **Cost:** 200 wood
- **Build time:** 150 s
- **Vision:** 40 m
- **Capture points:** 500
- **Build territory:** own ally neutral
- **Placement:** shore
- **Trains:** units/{civ}/ship_fishing units/{civ}/ship_merchant units/{civ}/ship_scout units/{civ}/ship_arrow units/{civ}/ship_ram units/{civ}/ship_fire units/{civ}/ship_siege
- **Classes:** Structure ConquestCritical
- **Visible classes:** Military Economic Naval Trade Village Dock

## Civilisations that can build it

- **athen** — `structures/athen/dock`
- **brit** — `structures/brit/dock`
- **cart** — `structures/cart/dock`
- **gaul** — `structures/gaul/dock`
- **germ** — `structures/germ/dock`
- **han** — `structures/han/dock`
- **iber** — `structures/iber/dock`
- **kush** — `structures/kush/dock`
- **mace** — `structures/mace/dock`
- **maur** — `structures/maur/dock`
- **pers** — `structures/pers/dock`
- **ptol** — `structures/ptol/dock`
- **rome** — `structures/rome/dock`
- **sele** — `structures/sele/dock`
- **spart** — `structures/spart/dock`

## Civilisation-specific overrides

These civilisations override the generic stats above (only differing values are listed):

- **athen** — `structures/athen/dock`
  - trains units/{civ}/ship_fishing units/{civ}/ship_merchant units/{civ}/ship_scout units/{civ}/ship_arrow units/{civ}/ship_ram units/{civ}/champion_marine_dock units/{civ}/infantry_archer_b_dock
- **cart** — `structures/cart/dock`
  - cost 150 wood
