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
- **Kiln `NonVisualTrigger.js` harness semantics**: at `in_game_limit_min`
  the trigger marks player 1 won and the stats print; but if Petra loses
  ALL civic centres earlier, conquest fires and the match ends before the
  stockpile bars are due. A goal-9 bot must never raze the last enemy CC.
- **Dismiss/retrain is a silent food hemorrhage.** Every pop-capped
  dismissal (army pop room, trader room) followed by a civilian retrain
  leaks ~50 food; hundreds per game ≈ 10-45k food. Fix the source:
  training stops at the pop cap unconditionally, dismissals only happen
  when the replacement unit is trained immediately, and hysteresis
  between the worker cap and the dismissal floor must exceed the batch
  size.
- **Timeout a pending build by builder travel distance.** A flat 150-turn
  timeout is shorter than the walk to a frontier CC spot (~1.8 m/turn),
  so far orders "failed" and poisoned their spot while the party was
  still walking. `150 + dist/1.5` turns works.
- **Petra captures expansion CCs rather than razing them.** A CC planted
  in contested territory flips to Petra with its territory; frontier
  expansion must be gated on military dominance (enemyArmy ≤ 100 and own
  army ≥ 50), not just on the spot being momentarily enemy-free.
- **percentMapControlled swings with the end-of-game border position**:
  the same bot scored 45% and 59% on seed 1 across consecutive versions
  because one fewer enemy CC had been razed by t=45m. Evaluate map%
  across several seeds, never one.

## 2026-08-24

- **The game_description generator scripts don't exist in the repo.**
  `docs/game_description/README.md` claims the entity files are generated
  by versioned `tools/analyze.py` / `buildings.py` / `technologies.py` /
  `auras.py` / `civ.py`, but no such scripts are in `tools/` (the current
  `tools/analyze.py` is the match-report analyzer). The carthage docs were
  hand-written, with stats resolved by a scratch extractor
  (`tmp/extract_cart.py`) that reimplements the template merge. Do not
  regenerate those docs until the scripts are recreated — regeneration
  would overwrite the handwritten Guide sections.
- **CParamNode merge semantics** (verified in `ParamNode.cpp ApplyLayer`,
  used to resolve template stats): parent chains apply deepest-first;
  multi-parents `"A|B"` apply **right-to-left** (B as base, A on top);
  `datatype="tokens"` lists merge with `-token` removal; plain elements
  override by name; `op="add"`/`"mul"` modify the parent value;
  `disable=""` removes a node; **XML attributes are stored as
  `@`-prefixed child nodes** (so `Square width="37"` becomes the `@width`
  child — attribute overrides resolve through the normal merge, which is
  why "last block wins" footprint logic is wrong when a child omits the
  Height).
- **Engine arithmetic is CFixed_15_16 integer fixed-point**:
  `int(v*65536)` (truncating), multiply = `(a*b)>>16`. The docs' displayed
  values only reproduce with this emulation: run speed 9.5 × 1.67 →
  15.86 (not 15.87), cart merc spear damage 4.95 × 1.1 → 5.44 (not 5.45).
  Run speed is never stored — it is walk × `RunMultiplier` (infantry
  1.67, cavalry 1.4) computed in fixed point.
- **Carthage data quirks** (all verified against templates): the
  mercenary mixin `disable`s `ResourceGatherer` (mercs cannot gather);
  `mixins/merc_inf` sets 60-metal / ×0.7-build-time costs,
  `mixins/merc_cav` 90 metal + 20 food and a 300-XP elite promotion
  (infantry mercs: 100 XP); `structures/cart/embassy` (the all-in-one
  embassy) and `tophet` are vestigial (no builder lists them), which
  makes the Samnite Swordsman and Iberian Heavy Cavalry unreachable
  through the build UI; the "Triple Walls" bonus (class `Wall`) skips the
  palisade and the cart Low Wall because their segments carry no `Wall`
  class; cart's stone walls are own-territory-only while the Low Wall is
  own+neutral.
- **Pre-existing doc gaps found while writing the cart docs** (not
  fixed — docs are off-limits without instruction): `ship_movement_speed`
  (cart+pers) and `ship_capture_resistance` (all but rome) have no files
  in `generic/technologies/`, though the civ.md files reference them as
  generic techs.
