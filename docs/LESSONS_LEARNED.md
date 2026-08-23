# Lessons learned

## 2026-08-23

- **`Engine.ReadJSONFile` in map-trigger scripts is restricted to
  `simulation/` paths** (verified building the kiln harness mod):
  `ERROR: JavaScript error: maps/scripts/NonVisualTrigger.js line 51 —
  Restricted access to harness.json. This part of the engine may only read
  from "simulation/"!` (JSInterface_VFS.cpp `PathRestrictionMet`). Files a
  trigger reads must live at `simulation/...` in the VFS, i.e. in the
  mod's `simulation/` directory.
- **`GetStatisticsJSON()` output is pretty-printed multi-line JSON**, one
  `{...}` block per player (playerID / playerState / statistics), not a
  single line. Harvesters must collect blocks (lines `{` … `}`), not
  JSON-per-line.
- **The public mod's `mod.json` declares `"name": "0ad"`** (not "public").
  Mod dependencies match on that name: `"dependencies": ["0ad=0.28.0"]`
  is correct, `"public-0.28.0"` is flagged incompatible.
- **Petra "defensive" behaviour still kills an undefended boom bot.**
  Goal-9 first full match (seed 1): Petra difficulty 3 + behaviour
  `defensive` conquered the goal-8 bot at turn 9270 (~31 in-game min) —
  killed 1068 of 1069 workers and every expansion CC. "Defensive"
  restrains tempo, not willingness to attack an economy with no army.
- **Sim rate drops with a real opponent.** ~32 turns/s vs medium Petra
  (9270 turns in ~5:10 wall incl. startup) versus ~113 turns/s vs a
  sandbox. A 45-min match ≈ 7 wall minutes serial; size goal-9 batches
  accordingly (parallelize across cores).
- `-autostart-aibehavior` values (0.28.0): `random` / `balanced` /
  `defensive` / `aggressive` (autostart default `balanced`); difficulty
  index 3 = medium.
