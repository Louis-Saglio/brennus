# pair_unlock_champions_sele

Seleucid-specific technology of 0 A.D. 0.28.0 — only the seleucids can get it. See `docs/game_description/sele/technologies/README.md` for the method; shared technologies are documented in `docs/game_description/generic/technologies/`.

Data file: `simulation/data/technologies/pair_unlock_champions_sele.json`.

## Basic stats

- **Name:** Traditional Army vs Reform Army
- **Top:** `traditional_army_sele`
- **Bottom:** `reformed_army_sele`
- **Requirements:** `{"civ": "sele"}`

## Seleucids

- barracks

Note: a **pair tech** — not a researchable technology itself but a UI
grouping: the Researcher returns it as a `{pair, top, bottom}` object, so
the barracks presents the two army doctrines ("Traditional Army" and
"Reform Army") as one paired City-phase slot, and picking one removes the
pair from the UI. There is no engine-level exclusivity between the two
halves (each is an independent tech gated only by `phase_city` + `sele`,
and each champion template requires its own half), so both could in
principle be researched and both champions unlocked.
