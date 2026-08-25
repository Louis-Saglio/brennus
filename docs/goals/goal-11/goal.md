# Goal 11 — Win vs medium Petra with an efficient economy

- **Bot**: `brennus_gaul_generic_land_map`, modified in place (continues from
  goal 10 — the goal-10 win behaviour must be preserved, this goal adds
  economy-quality requirements on top of it).
- **Settings**: `random/mainland` size 192, biome `generic/temperate`,
  placement `circle`, victory `conquest_civic_centers`; bot plays gaul,
  opponent Petra (difficulty 3 = medium, behaviour `aggressive`) plays rome.
- **Criteria**:
  1. Defeat Petra — win under `conquest_civic_centers` (all enemy civic
     centers destroyed or captured, per the statistics `playerState`) in
     **under 45 in-game minutes** (`timeElapsed`), as in goal 10. The mod's
     45-minute time-limit trigger stays as the cap: a run the trigger has to
     end does not pass.
  2. **Worker efficiency**, measured over the whole match and verified via
     the end-of-match telemetry summary. One aggregate per resource class:
     - **wood** (`wood.tree`), **stone** (`stone.rock`), **metal**
       (`metal.ore`), **fruits** (`food.fruit`): efficiency **> 80%** of
       theoretical;
     - **fields** (`food.grain`): efficiency **> 90%** of theoretical.
     - Fruits are the softest class: if their efficiency bounces across
       seeds despite reasonable effort (bushes exhaust, and berry
       availability varies a lot by seed), treat the number as informational
       rather than a blocker — wood, stone, metal and fields are the real
       bars.
- **Out of scope**: hunting (`food.meat`) and ruins (all `*.ruins`
  subtypes) are telemetry-logged but part of no bar.

## Efficiency definition (pinned)

- **Theoretical rate** of a worker = its live gather rate as reported by
  `ResourceGatherer.GetTargetGatherRate`: `Rates × BaseSpeed` with
  technologies and auras applied, times the supply's diminishing-returns
  multiplier (`docs/game_description/mechanics/resources_and_gathering.md`).
  Sampled over time; the class denominator accumulates Σ rate × seconds.
  Reference rates (gaul worker, no techs, no DR): wood 0.7, fruit 1.0,
  stone 0.35, metal 0.35, grain 0.5 per second.
- **Efficiency** of a class = `total gathered ÷ Σ (theoretical rate × tasked
  seconds)`. **Tasked time only**: from gather-task assignment until the
  worker goes idle or is reassigned — walking to the supply, gathering,
  walking back and dropping all count. Untasked idle is excluded from the
  bars and reported separately as utilization.
- **Aggregate per resource class** (resource-weighted): a worker belongs to
  the class of what it actually gathers, so one worker can contribute to
  several classes over the match. No cross-class merging. Per-worker
  histogram and median are logged as diagnostics.
- **Window**: the bars apply to the whole match; the telemetry also prints
  per-5-minute buckets per class.
- **Techs are deliberately not a criterion**: because the theoretical rate
  is the live, tech-adjusted rate, researching gather techs or training
  Viridomarus raises throughput, never the efficiency %. Efficiency stays a
  pure waste metric in [0, 100%]; tech discipline shows up in total gathered
  and in the win, not in the bars.

## Step 1 — worker-efficiency telemetry

Implemented in the mod as an override of `maps/scripts/ConquestCivicCentres.js`
(public copy kept intact, telemetry appended). Home choice: the natural
`NonVisualTrigger.js` does **not** work under kiln — kiln mounts its harness
mod last (`-mod=kiln`), so its own `NonVisualTrigger.js` always shadows the
mod's copy. `ConquestCivicCentres.js` is also part of the autostart trigger
set, the kiln harness does not ship a copy, and the goal's victory condition
is fixed at `conquest_civic_centers`, so it runs in every goal match:

- Tracks every player-1 worker's time per state (gathering / walking /
  dropping / idle) and resources delivered, bucketed by the five classes;
  samples every 200 ms of sim time via an `OnInterval` trigger.
- Samples each tasked worker's live theoretical rate
  (`ResourceGatherer.GetTargetGatherRate`) and accumulates `rate × dt` per
  class.
- Counts pick-ups as positive carry deltas, plus reconstruction of the one
  case carry sampling cannot see: a pick-up that fills the carry while the
  dropsite is already in gather range commits in the same sim turn (the
  bot's farmsteads sit next to its fields, so this is the field workers'
  normal last pick-up — without it fields undercount ~5%).
- Prints one `[HARNESS]`-tagged per-class summary at game end (efficiency %,
  gathered, theoretical output, utilization) plus per-5-minute buckets,
  next to the statistics JSON (`OnPlayerWon` / `OnPlayerDefeated` handlers
  registered alongside the victory conditions). No per-tick spam.
- Observation only: no RNG, no simulation state touched — deterministic
  (same seed → identical match, verified).
- Validated on kiln: per-class counts match the end-of-game statistics
  tracker's own pick-up counts to <0.1% (sandbox isolate, 12-min match), so
  the bars are measured, not approximated.

- **Status**: step 1 (telemetry) implemented 2026-08-25, definition pinned;
  goal not yet attempted.
