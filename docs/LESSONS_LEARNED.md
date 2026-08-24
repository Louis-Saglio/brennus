# Lessons learned

## 2026-08-23

- **The engine's `-replay` path skips `InitVfs`**, so `psLogDir()` stays
  empty and the engine writes `profile.txt` / `crashlog.txt` / `profile2.jsonp`
  *relative to the process CWD* (main.cpp replay branch creates the VFS and
  mounts `cache/` directly). Under systemd the CWD is `/`, which is not
  writable → EACCES → replay aborts without printing `# Final state:`.
  Fix (no engine patch): always spawn games with a writable CWD (kiln sets
  `current_dir` to the job HOME). Also makes the profile write retried
  every turn go away, so replays are much faster.
- **`-autostart-team=N:TEAM` is 1-based** (`cmd_line_args.js` does
  `team - 1` internally); passing `-1` corrupts the internal team index and
  makes both players win instantly at turn 0. "No team" = omit the flag.
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

## 2026-08-24

- **The kiln harness mod wins mod precedence over the tested mod's
  `maps/scripts/NonVisualTrigger.js`** — a time-limit trigger shipped in
  the bot mod is inert on kiln runs. The in-game limit on kiln comes only
  from the job spec's `in_game_limit_min`; full goal-9 runs must pass 45.
- **Foundations report a `foundation|…` `templateName()`**, so any "do we
  already have building X" check that only compares `templateName()`
  against the built template misses foundations and spams duplicate
  orders (goal-9 defense v1 ordered 7 barracks). Count foundations via
  `gameState.getBuiltTemplate(f.templateName()).templateName()`.
- **A construct order given to an army unit is cancelled by the army's
  next rally/attack-move command.** `placeOrder` picked the nearest own
  unit regardless of role; once a standing army exists it must exclude
  army members (`filter(ent => !this.army[ent.id()])`), else CC/corral
  orders randomly "construct FAILED" when the nearest unit is a soldier.
