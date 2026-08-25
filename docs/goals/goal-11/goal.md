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
     the end-of-match telemetry summary:
     - average worker efficiency of **lumberjacks** (wood gatherers) and
       **miners** (stone and metal gatherers) **> 80%** of theoretical;
     - average worker efficiency of **field workers** (farm `food.grain`
       gatherers) **> 90%** of theoretical.

## Efficiency definition

- **Theoretical rate** of a worker = its per-second gather rate for the
  resource subtype it gathers, per the unit templates (`Rates × BaseSpeed`,
  with researched technologies applied). A worker that spent its whole task
  time actively gathering scores 100%; the losses this metric catches are
  walking to/from dropsites, idling, and retargeting.
- **Class efficiency** = total resources of the class actually gathered ÷
  total theoretical output (Σ worker task-seconds × theoretical rate), i.e.
  the resource-weighted average over the class's workers.
- **Fields and diminishing returns**: fields use diminishing returns 0.90
  (`resources_and_gathering.md`), so each worker on a saturated n-worker
  field runs at `(1-0.9^n)/(1-0.9)/n` × base rate — a full 5-worker field
  caps each worker at ~82%, below the 90% bar. The telemetry step must
  decide and pin whether the theoretical rate includes this multiplier
  (recommended: include it, tracked per supply, so the criterion isolates
  walking/idle waste rather than silently forcing ≤3 workers per field).

## Step 1 — worker-efficiency telemetry

Set up telemetry in the mod (natural home: the already-overridden
`maps/scripts/NonVisualTrigger.js`, which runs in every `-autostart-nonvisual`
match and can observe any player — bot and Petra alike, so petra serves as a
comparison baseline):

- Track every worker's time per state (gathering / walking / dropping /
  idle) and resources delivered, bucketed by class: wood, stone+metal, field.
- Print one `[HARNESS]`-tagged per-class summary at game end (efficiency %,
  gathered, worker-seconds), next to the statistics JSON. No per-tick spam.
- Validate on a headless match that the summary matches the end-of-game
  resource statistics and the gaul template rates.

- **Status**: step 1 (telemetry) started 2026-08-25; goal not yet attempted.
