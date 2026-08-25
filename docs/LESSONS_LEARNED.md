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

## 2026-08-24

- **Persia data quirks** (verified against templates while writing the
  pers docs): the pers hall ("Gate of All Nations") has **no Trainer and
  no Researcher** in 0.28 and no builder lists it — vestigial, as are the
  Kardakes (`kardakes_hoplite`/`kardakes_skirmisher` — nothing trains
  them), `arstibara` (Apple Bearer), `hero_xerxes_i_chariot`, and the
  house variants `house_a`/`house_b`/`warehouse`/`apartment_block`/`inn`.
  Pers heroes are trained at the **tachara** (Winter Palace), and the pers
  fortress trains nothing (the generic fortress trainer is entity-less).
  Pers's entire siege park is the battering ram (no oxybeles/ballista/
  lithobolos/tower templates → `siege_bolt_accuracy` and
  `siege_pack_unpack` are `notciv: pers`); the navy has no fire or siege
  ship.
- **`BuildRestrictions/Category` limits come from `template_player.xml`
  `EntityLimits`, not from the category itself.** The generic
  `Category Structure` (inherited by every building) has no `Limits`
  entry and is unlimited; only categories with a matching entry are
  constrained (`Yakhchal 5`, `Palace 1`, `Wonder 1`, `CivilCentre 1`
  until phase_town, …). Don't read "one per player" off a category name.
- **`Trainer/Entities` token lists merge through the parent chain and are
  then filtered by template existence** (the engine's
  `filter_trainer`-style `{civ}` substitution): the generic trainer lists
  deliberately include civ-specific names (e.g. `units/{civ}/cavalry_axeman_b`,
  `units/{civ}/champion_cavalry_archer`) that resolve only for pers, so a
  civ's real training roster is the merged list minus the templates it
  lacks.
- **`equine_transports` is a tech with zero `modifications`** — its whole
  effect is gating the `Identity/Requirements` of the pers
  `cavalry_*_trireme` templates, which the pers arrow/ram warships list
  unconditionally in their `Trainer`. Techs-as-gates, not techs-as-mods.
- **Auras can modify costs of trained units**: the pers team bonus
  ("Training Regimes") multiplies `Cost/Resources/wood|stone` on
  Barracks/Stable — a property of the *building*, applied to whatever is
  trained there (the buildings themselves cost no wood/stone, so the
  bonus does not discount the buildings).
- **`tmp/extract_cart.py` `dump_ranks` has a bug**: the elite-name
  fallback `promo.split("/")[-1].replace("_a", "_e")` rewrites every
  `_a` in the stem ("cavalry_axeman_a" → "cavalry_exeman_e"). Also its
  `dump_unit` prints the `# title` heading, which must be stripped when
  splicing output into doc files. Both patched in `tmp/extract_pers.py`
  (and its `emit`/`assemble` modes generate the per-entity doc skeletons).
- **Citizen cavalry promotes at 150 XP in 0.28** (`template_unit_cavalry`
  `Promotion/RequiredXp = 150`; infantry 100, mercenary cavalry 300 via
  `mixins/merc_cav`).

## 2026-08-24

- **Ptolemaic data quirks** (verified against templates while writing the
  ptol docs): the ptol **mercenary camp has no builder** — nothing lists
  `structures/ptol/mercenary_camp` in a `Builder/Entities` list, so it is
  unreachable through the build UI (and redundant anyway: the military
  colony trains the same four mercenaries). The ptol **lighthouse,
  library and Temple of Isis are built only by women and mercenary
  infantry** (their builder lists carry the three templates; the generic
  `mixins/builder.xml` does not). The `champion_juggernaut` super-ship is
  vestigial (no trainer), while its surrounding machinery is live: the
  `juggernauts` tech (dock, Warships +25% HP −10% speed), the `Juggernaut`
  limit of 1, and a `LimitChangers` entry giving the hero Ptolemy IV +4
  to that limit.
- **ptol's `CivilCentre` limit removal requires a hero**: the player
  template overrides `EntityLimits/LimitRemovers/CivilCentre` with
  `RequiredTechs phase_town` **plus** `RequiredClasses Hero`. The
  `LimitRemovers` semantics (EntityLimits.js `UpdateLimitRemoval`): the
  limit is lifted only when all required techs are researched AND
  `classCount[cls] > 0` for every required class (the player owns ≥1
  entity of that class); it is re-imposed when the condition stops
  holding. So ptol's second CC needs the City phase (heroes) — and dying
  heroes re-lock CC expansion.
- **`pair_*` techs are UI groupings, not researchables**: a tech with
  `"top"`/`"bottom"` (e.g. `pair_unlock_cult_ptol`) is returned by the
  Researcher as `{pair: true, top, bottom}`; the UI presents the two
  referenced techs as one paired slot. No engine-level exclusivity
  between top and bottom.
- **Errors found in the pre-existing generic docs (fixed after Louis
  confirmed)**: `generic/units/infantry_swordsman_merc_b.md` said the
  mercenary swordsman costs "60 metal plus 50 food, 40 wood" and "can
  gather" — wrong on both counts: `mixins/merc_inf` zeroes the
  food/wood/stone costs and the `mercenary` mixin `disable`s
  `ResourceGatherer` (resolved cost: 60 metal, 7 s, no gather rates). The
  same "can gather" error existed in
  `generic/units/cavalry_spearman_merc_b.md` and
  `generic/units/cavalry_javelineer_merc_b.md` (all four civ variants use
  `merc_inf`/`merc_cav`). Fixed the Guides and added "no gathering
  (ResourceGatherer disabled)" to each civilisation-override block. The
  merc infantry DO keep the `Builder` class, which is how they build the
  ptol special buildings. Also: the library building (`mace`/`ptol`/`sele`)
  and its "Center of Scholarship" aura have no files in `generic/` — they
  are documented in `ptol/civ.md` instead.
- **`hellenistic_metropolis` is researched at the civil centre** and the
  military colony's researcher explicitly removes it (`-hellenistic_metropolis`
  in `template_structure_civic_civil_centre_military_colony.xml`), along
  with the phase techs.

## 2026-08-24 (goal 10: beating medium aggressive Petra)

- **BuildingAI arrow math (0.28 templates)**: civil centre = 6 default
  arrows + 1 per garrisoned Soldier (multiplier 1); stone defense tower
  = 4 default + 1 per garrisoned **Infantry** (`GarrisonArrowClasses`),
  holds 5. A 5-tower + full-CC shelter fields ~70 arrows and protects 45
  soldiers — this is what makes a 2:1 attacker disadvantage survivable.
- **Against aggressive Petra the first decisive wave lands ~16-17 min
  with 85-120 units.** An army caught in the open at 1:2 odds melts in
  ~90 s. Local threat scans (enemies within X m of a CC) massively
  undercount an incoming wave — count enemies around the threat
  *centroid* before deciding to engage.
- **Petra's camp grows while your army marches** (it converges): a
  sortie launched at 60-vs-32 became 60-vs-83 mid-field and donated the
  army. Sortie only at ≥ 1.5x superiority, else let towers/CC bleed the
  camp.
- **Raid age caps must exceed cross-map walk time** (~2 min on mainland
  192): a 2-min raid-age abort produced an abort/relaunch loop where the
  army never even reached the target CC.
- **Phase-3 gatherer shares with ~1% stone/metal silently starve the war
  economy**: rams/forge techs/towers eat metal continuously, and the
  first ram trained 11 min after the arsenal was ordered. Keep explicit
  war-stage mining shares until a working buffer (400s/800m) is banked.
- **Only siege razes garrisoned CCs fast enough.** Ramless raids and
  2-ram raids all failed; 6 rams + 75-escort razes a CC in ~1 min.
- **Pop discipline under the 300 cap**: 150 workers + 10 healers + 6
  rams (3 pop each) + 120 soldiers = 298. A 175-worker cap pop-blocked
  the army at ~60 while 14k food sat banked.
## 2026-08-24

- **Iberian data quirks** (verified against templates while writing the
  iber docs): the iber **archery range is buildable but useless** — the
  generic range template has no `Researcher` and iber has no archer
  templates, so it trains nothing and researches nothing (and
  `archer_attack_spread` is `notciv: iber` anyway). The iber
  **monument has no `TerritoryInfluence`** and is **uncapturable**
  (`Capturable` disabled); it is built by the iber women and the four
  citizen infantry types (their templates add it to the builder list —
  cavalry and champions do not). The iber **fortress trains the three
  heroes** (unlike pers/ptol, whose fortresses train none);
  `hero_indibil_infantry` is vestigial (no trainer, no upgrade link).
  Iberia has **no civ-specific techs at all** — every bonus is template-
  or map-level (the Massive Towers tower, the Starting Walls skirmish
  replacements, the monument aura).
- **`civs/iber.json`'s "Massive Towers" description is stale**: it claims
  "+60% health", but `structures/iber/defense_tower` sets 2400 HP vs the
  generic stone tower's 1000 (+140%). The other claims (−50% wood, +150%
  stone, +33% build time, +3 garrison, +1 arrow) all match the template.
  Trust the templates over `civs/*.json` descriptions.
- **`unit_elite`/`unit_advanced` rank-tech artifacts in Guides**: the
  standard "Gather base speed ×0.7/×0.49" rank lines are meaningless for
  units whose `ResourceGatherer` is disabled (mercenaries, champions) —
  the docs keep them for format consistency, but don't read them as real
  gather rates.
- **Auras with `"type": "garrison"`** (iber Caros "Valiant Defender")
  apply only while the carrier is garrisoned, modifying the *building's*
  stats (BuildingAI/GarrisonArrowMultiplier, MaxArrowCount) — the only
  garrison-type hero aura among the civs documented so far.
## 2026-08-24

- **Mauryan data quirks** (verified against templates while writing the
  maur docs): the maur **worker elephant is not a gatherer** — no
  `ResourceGatherer` at all; it is a mobile `ResourceDropsite`
  (food/wood/stone/metal, non-sharable) + builder. The maur **palace has
  no build limit** (it keeps the generic `Structure` category — the
  `Palace` limit in `template_player.xml` applies to the *category*
  `Palace`, which only the pers/ptol tachara uses). The **pillar is
  gated on the hero Ashoka**: `Limits` has `Pillar 0` and
  `LimitChangers` has `Pillar: Ashoka 5` — pillars are buildable only
  while an `Ashoka`-class entity is owned. The maur **fortress trains
  nothing** (like pers and ptol; iber's fortress does train its heroes).
  The
  **tower_double has no builder** (vestigial), and its tooltip ("up to
  16 archers", "only archers can garrison") is stale — the template
  inherits 5 garrison slots with no class restriction (the 16 turret
  points are cosmetic beyond the 5-slot cap).
- **`spec_champ` mixin** (`mixins/spec_champ.xml`): only `BuildTime ×0.75`
  — the Maiden Guards' speed and stats come from their
  champion-infantry parents, and they are gated on `phase_city` alone
  (no `unlock_champion_infantry`), making the palace the only unlock.
- **`Health/RegenRate` applies always, including in combat**
  (`Health.js:132-174`); the idle-only rate is the separate
  `IdleRegenRate`. Chanakya's "Regeneration" aura (+0.8 `RegenRate`)
  therefore heals Mauryan Humans mid-fight, not just out of combat.
- **The maur teambonus and Ashoka's "Buddhism" aura are identical
  modifiers on different carriers** (MutualAlly vs own-only): for the
  Mauryan player they overlap (no stacking — same ×0.5), so the
  hero-aura's value to the Mauryas is mostly the `Ashoka`-class pillar
  gate, not the temple discount.
- **`civs/maur.json` declares `"CivBonuses": []`** — the civ's real
  bonuses (starting elephant, pillar, maidens, food pair) are
  template/tech/map-level, with nothing listed in the civ file. Another
  case of the civ file under-describing the civ.
## 2026-08-24

- **Athenian data quirks** (verified against templates while writing the
  athen docs): the athen **citizen archer and javelineer are
  mercenary-mixin units** (`merc_inf` parents — 60 metal each, no
  gathering, ×0.7 build time, +10% damage, 0-XP promotion), while the
  hoplite spearman and slinger are ordinary citizens. The athen special
  buildings (gymnasium, prytaneion) are **added to every athen unit's
  builder list by the `mixins/civ/athen.xml` civ mixin** (the `civ/athen`
  first-parent pattern on all athen templates) — unlike cart/ptol/maur,
  whose special builders are per-unit overrides. The **slave is
  vestigial** (no trainer), as are `hero_xenophon` and the standalone
  `infantry_marine_archer_b` (the dock trains `infantry_archer_b_dock`
  instead), and the **`pheidian_workshop` tech has no researcher** —
  reachable only by direct command. The **`arsenal_philon` tech is
  researched at the dock** (it lives in the generic dock's researcher
  list, filtered by its `civ: athen` gate).
- **`unlock_champion_infantry` gates nothing for athen**: the
  `template_unit_champion_infantry_spearman` base carries no
  `Requirements` (pers's variant adds them, athen's does not), so the
  gymnasium's City Guard needs only the Town-phase building, and the
  elite-spearman → champion promotion at 250 XP is a pure XP check.
- **The `slave` template**: `Cost/Population 0`, `Health/RegenRate
  −0.25` (finite lifespan — 100 HP ≈ 400 s), `Unhealable true`,
  `Builder/Rate 0.5`, gather rates wood/stone/metal 1.0 vs the women's
  0.7/0.35/0.35 — the pop-free worker pattern, if ever un-vestigialised.
- **Base healer heals 5 HP per 2 s tick** (`template_unit_support_healer`
  `Heal/Health 5`, interval 2000 ms) — so Hippocrates' "Hippocratic
  Oath" (+3/tick) is a **+60%** heal-output buff, not the ~40% a naive
  reading suggests. Hero healers use `Heal/Health 15` (7.5 HP/s).

## 2026-08-25 (goal 11: worker-efficiency telemetry)

- **`-mod=<name>` looks for the mod under `<HOME>/.local/share/0ad/mods/<name>`**;
  if it is not there the engine reports `ERROR: Trying to start with
  incompatible mods: <name>.` — misleading: a *missing* mod is flagged
  "incompatible", not "not found" (`Mod::CheckForIncompatibleMods` pushes
  unavailable mods onto the same list). `tools/run.sh` already copies
  `bot/` there; a bare smoke command must do the same first. (The
  AGENTS.md smoke command also still says `-autostart-ai=1:brennus`, but
  there is no `brennus` AI dir anymore — bots live in
  `simulation/ai/brennus_gaul_*_map/`. Reported, AGENTS.md is off-limits.)
- **`Engine.GetAIs()` returns the *registered* AI descriptors** (all
  `simulation/ai/**/*.json` in the VFS, as `{id, data}`), not the AIs
  actually running in the current game — useless for mapping player → AI
  from a trigger script. The harness convention is player 1 = bot under
  test, and that is what the telemetry keys on.
- **UnitAI facts used by the efficiency telemetry** (all verified in
  `UnitAI.js`): gather tasks live in a `Gather` order whose
  `data.type = {generic, specific}`; during the drop walk the state is
  `INDIVIDUAL.GATHER.RETURNINGRESOURCE` and the order's `data.target` is
  swapped to the dropsite with the supply kept in `data.formerTarget`;
  re-targeting walks use a `GatherNearPosition` order (also carries
  `data.type`, no target). Tasked states = `INDIVIDUAL.GATHER.*` +
  `INDIVIDUAL.RETURNRESOURCE.*` (`GetCurrentState()`, order queue via
  `GetOrders()`).
- **`ResourceGatherer` facts for the telemetry**: carrying is per
  *generic* type only (`GetCarryingStatus()` → `[{type:"wood"|"food"|…,
  amount, max}]`), so subtype attribution (fruit vs grain) must come from
  the unit's current gather order, not from the carry. `GetTargetGatherRate(target)`
  already returns the live units/sec incl. techs/auras and the supply's
  diminishing-returns multiplier — exactly the "theoretical rate" the
  metric needs. Carry deltas only change on gather ticks (+1, ≥870 ms
  apart for rates ≤1.15) and full drop-offs, so 200 ms sampling counts
  every pick-up via positive deltas **except the "invisible fill"**: when
  a pick-up fills the carry while the dropsite is already within gather
  range (bot farmsteads sit next to their fields, so this is the field
  workers' normal last pick-up), the fill and the commit happen in the
  same 200 ms sim turn — no sampling frequency can see the carry at max.
  It must be reconstructed from the drop: prev carry == max−1, now
  absent, previous sample in GATHERING, same-generic gather order still
  queued ⇒ +1. Without it, field-class pick-ups undercount ~5%.
  `CommitResources` *deletes* the carrying key on drop (doesn't zero it),
  so "dropped" looks like a vanished key, not amount 0. Verified on kiln:
  with the reconstruction, per-class pick-up counts match the statistics
  tracker's own counts to <0.1% (sandbox isolate; the statistics tracker
  counts pick-ups at the gather tick, `ResourceGatherer.js:286`, so it is
  the ground truth).
- **Sandbox Petra is not passive**: difficulty 0 (sandbox) runs a full
  economy — it gathered 3038 wood / 2509 food in a 12-min mainland match.
  Only use sandbox as a no-combat opponent; it still consumes map
  resources and skews any supply-side accounting.
- **Foundation placement clears resources** (trees/rocks/ores in the
  footprint are destroyed without being gathered — and CC placement at
  game setup clears its footprint before the first trigger tick): supply
  depletion ≠ pick-ups, and tree/rock/ore template amounts vary on
  mainland, so per-supply accounting needs first-sight baselines, not
  assumed template sizes.
- **Trigger scripts can run periodic code deterministically** via
  `RegisterTrigger("OnInterval", name, {enabled:true, delay, interval})`
  — implemented with `cmpTimer.SetInterval`, so it rides the
  deterministic sim timer (Trigger.js `EnableTrigger`). Same for
  `DoAfterDelay` (already used by the harness time limit).
- **kiln's harness mod shadows the mod under test's `NonVisualTrigger.js`**:
  the kiln runner mounts `-mod=public <mod-under-test> -mod=kiln` (last
  wins), and `/var/lib/kiln/harness/` ships its own
  `maps/scripts/NonVisualTrigger.js` (statistics + `[KILN]` in-game limit
  read from `simulation/kiln/harness.json`). Anything the goal mod needs
  at game end must NOT live in `NonVisualTrigger.js`. The autostart
  trigger set also loads `scripts/TriggerHelper.js`,
  `scripts/ConquestCommon.js`, `scripts/ConquestCivicCentres.js` — the
  kiln harness ships none of those, so overriding
  `maps/scripts/ConquestCivicCentres.js` (11 lines in public, victory
  condition fixed at `conquest_civic_centers`) is the working hook for
  goal-11 telemetry. Multiple trigger scripts can each register their own
  `OnPlayerWon`/`OnPlayerDefeated` handlers (keyed by name) — they
  coexist.
- **Local VPS runs are now ~6× slower than kiln**: the goal-10 bot vs
  medium aggressive Petra measured ~18 turns/s here (10.4 in-game min in
  170 wall s, timed out) vs ~210 turns/s on the kiln `pc` runner (a
  goal-11 full match with the bot ran 106 turns/s). Follow Louis's rule —
  never run test games on the VPS, always use kiln.

## 2026-08-25

- **Seleucid data quirks** (verified against templates while writing the
  sele docs): the **sele civil centre trains the three heroes** — the
  only civ whose CC trainer lists heroes (ptol's trains at the
  City-phase Temple of Isis; the generic fortress trainer has no
  entities, and sele's fortress adds none). Sele shares the ptol
  **hero-gated CivilCentre limit**: `special/players/sele.xml` has the
  same `LimitRemovers/CivilCentre` override (`phase_town` + class `Hero`).
- **The library is buildable by ptol only**: ptol units list it in their
  `Builder` lists as **absolute paths** (`structures/ptol/lighthouse`,
  `structures/ptol/library`, `structures/ptol/temple_2` — not `{civ}`),
  and no mace/sele unit references the library at all, so
  `structures/mace/library` and `structures/sele/library` (and the
  "Center of Scholarship" aura) are vestigial for those civs. The
  generic buildings analysis had therefore counted the library as
  single-civ; like ptol, sele documents it in `civ.md` only.
- **Sele has no citizen archer or slinger**: its ranged infantry are the
  javelineer plus the **Syrian Archer mercenary** (`infantry_archer_merc_b`,
  single-civ — only `structures/sele/military_colony` references it).
  Also no citizen swordsman/maceman/axeman/clubman and no citizen melee
  cavalry (spearman/swordsman/axeman); citizen cavalry = javelineer +
  horse archer.
- **The sele military colony adds to, not replaces, the CC trainer**:
  its `Trainer/Entities` (three mercenaries) merges with the inherited
  CC trainer (women), whereas ptol's colony uses `replace` and trains
  only its four mercenaries — no women.
- **`pair_*` techs enforce mutual exclusivity in the engine** (correcting
  the earlier ptol-docs claim of "no engine-level exclusivity", which is
  wrong — the ptol cult pair has the same structure and the same rule):
  each half carries a `"pair"` back-reference, and
  `TechnologyManager.CanResearch` refuses a half unless the pair tech is
  itself still researchable (`simulation/components/TechnologyManager.js`
  line ~313) — the pair is blocked while either half is queued
  (`top`/`bottom` in progress, line ~309) and is auto-marked researched
  by `UpdateAutoResearch` the moment either half completes (line ~266).
  Net: for `traditional_army_sele` / `reformed_army_sele`, queueing one
  locks the other out, and only its champion infantry can ever be
  trained. The two halves are free, instant, City-phase techs with no
  `modifications`; the unlocks live in the champion templates'
  `Identity/Requirements/Techs` (pikeman: `traditional_army_sele`,
  swordsman: `reformed_army_sele`). Note the `-phase_city` prefix inside
  those requirement token lists is **template-merge subtraction** (removes
  the inherited `phase_city` token), not a negation — only `!tech` negates
  in RequirementsHelper (`simulation/helpers/Requirements.js`).
- **Rank stat changes come from auto-researched techs, not the `_a`/`_e`
  templates**: the rank templates only change `Identity/Rank`,
  `Promotion` and the actor, so resolving the `_a` template yields base
  stats. The `extract_ptol.py`-derived dump script printed the base
  value as the rank value (and mangled "archer" → "ercher" via
  `replace("_a","_e")` matching the `_a` in `_archer`); fixed in
  `tmp/extract_sele.py` by applying the `unit_advanced`/`unit_elite`
  modifiers (×1.25/×1.5625 health etc.) to the base stats and taking
  the elite template name from the advanced template's `Promotion`.
- **sele tech gates**: sele cannot research `unlock_champion_infantry`,
  `siege_bolt_accuracy`, `warship_arrow_attack`, `warship_health`,
  `warship_fireship_attack`; it CAN research `hellenistic_metropolis`,
  `unlock_champion_chariots` and `nisean_horses` (specific name
  "Nisioi", affects the cataphract: +10% HP, +10% build time).
- **sele champion stat deltas** (vs the generic champion templates): the
  Cataphract (`champion_cavalry`, parent `cataphract|...`) 260 HP, 8/9/20
  armor, 7 m spear reach, walk 14.4; the Armored War Elephant
  (`champion_elephant`, parent `elephant_indian|...`) 1100 HP, 33 + 49.5
  trunk, 330 food + 220 metal (the ×1.1 mixin); the Scythed Chariot
  300 HP, 1/5/20, bow 15 pierce, 30 s. The champion infantry are
  identity-only variants of the generic champion pikeman/swordsman.

## 2026-08-25 (britons)

- **British data quirks** (verified against templates while writing the
  brit docs): the **war dog is the only 0-population combat unit** in the
  game (100 food, 15 s, kennel) and the **fastest land unit** (27 m/s
  run — only scout ships at 28.39 are quicker, verified by a full
  template scan). Dogs carry the `Human` class (healable, affected by
  Cunobeline's regen aura) but **not** `Infantry` (so the Woad Warriors
  bonus skips them), and their attack is restricted to
  `!Structure !Ship !Siege`.
- **The brit civil-centre limit is generic**: unlike ptol/sele,
  `special/players/brit.xml` has no hero-gated `LimitRemovers` — the CC
  limit lifts at `phase_town` alone. The **crannog** counts as a
  `CivilCentre` (category + class via its CC parent): it enforces the
  200 m spacing and the CC limit, but the limit is already lifted when a
  crannog becomes buildable (Town phase), so the practical gate is only
  the spacing. The crannog also **researches `phase_city`** (its
  researcher removes `phase_town_{civ}` and `hellenistic_metropolis` but
  keeps `phase_city_{civ}`) — a water-borne age-up building.
- **Brit start includes a war dog** (`civs/brit.json` StartEntities adds
  `units/brit/war_dog` on top of the standard 4+2+2+1 pattern — the only
  civ with an extra starting combat unit).
- **The celtic kennel sits in the generic builder list**:
  `mixins/builder.xml` carries `structures/{civ}/kennel` and
  `structures/{civ}/crannog`, so every brit builder unit can place both;
  gaul's entries silently drop (no gaul templates). The **rotary mill
  and range are vestigial for brit** (no builder references), same as
  gaul. `civbonuses/celt_structures` ("Wooden Construction") is shared
  brit+gaul and lives in `generic/technologies/` — brit's only own tech
  is `civbonuses/brit_woad_warriors` (Infantry ×1.05 walk speed, +1
  Looter per resource — the `Looter` component is the corpse-loot
  mechanism, not the raze loot).
- **The celtic healer aura is shared**: brit's Druid and gaul's Druid
  both attach `units/celtic_healer` ("Deas Celtica", +5% soldier damage
  within 10 m) — documented in `generic/auras/`, not per-civ. The
  civs.json "Deas Celtica" display text ("increase attack rates… by 5%")
  is loose — the actual modification is +5% attack **damage** (melee and
  ranged), not rate.
- **Hero switcher variants are vestigial**: `hero_boudicca_sword`,
  `hero_boudicca_cavalry_javelineer` and `hero_cunobelin_infantry` exist
  as templates but nothing trains them; the trainable forms are the
  chariot Boudicca and the mounted Cunobeline.
- **Supremacy checks that surprised while writing**: Boudicca's 60-pierce
  javelin is *not* the strongest hero ranged attack (han's Wei Qing
  infantry crossbowman does 63, athen's Xenophon/Iphicrates 62), and the
  brit javelin chariot (36 pierce) is the hardest-hitting **chariot** but
  not the hardest-hitting ranged champion overall.
>>>>>>> 2ca01e5 (docs: add briton game description (per-entity guides + civ.md))
