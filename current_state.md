# Current state — Brennus (2026-08-21, late session)

Pick-up document for the next session. Read `AGENTS.md` and
`docs/GOALS.md` first; this file only tracks where the work stands.

## Goals status

| Goal | Description | Status | Commit |
|---|---|---|---|
| 1 | Function without errors | PASSED (5 seeds, published) | `992b680` |
| 2 | Gather resources | PASSED (5 seeds, published) | `eec1c13` |
| 3 | Grow population | PASSED (5 seeds, published) | `90b6299` |
| 4 | Town Phase < 12 in-game min | PASSED (5 seeds, published) | `953dd20` |
| 5 | City Phase < 20 in-game min | PASSED (5 seeds, published) | `5e75362` |
| 6 | Master the economy by 30 min | PASSED (5 seeds, published) | `e56c87b` |
| 7 | City Phase AND 300 pop by 15 min | IN PROGRESS (4/5 seeds pass; seed 2 at 15.1) | — |

## Goal 7 — where it stands (2026-08-21, Louis's round-2 playtest tips session)

Target: `phase_city_generic` AND `population=300`, both ≤ 15.0 in-game min.

**Louis's round-2 directives** (all implemented in the working tree, v55–v71):
build storehouses near stone/metal mines when gathering them; collect berries
near a farmstead in priority, then chain-build farmsteads at the next
in-territory berry group; approach fleeing prey from the far side so it runs
toward the CC; better: use starting cavalry to herd animals near a dropsite,
civilians collect the carcass; civilians must never leave own territory for
meat (cavalry only — some animals don't flee, detect that behaviorally);
vary probe seeds to avoid overfitting (noted in AGENTS.md).

**Batch status (post seed-3 fix, ~v67):** seed1 14.5/14.9 PASS,
seed2 14.4/15.1 FAIL (0.1 over), seed3 14.4/14.7 PASS, seed4 13.1/13.7 PASS,
seed5 13.9/14.2 PASS, determinism OK, zero errors. Seed 2 is berry-poor; its
lag is a village pop-pin (pinned 24/25 until ~t=4 → town 5.0, all grain techs
~1 min late) plus weak early meat (100 by t=3 vs 330 on seed 1).
v68 (fertility gate 210000) and v69 (sprint cap t=9) both regressed the other
way and were reverted. v70 (fieldDemand gate fruitStock<800) kept.
**v71 = herding target band widened 35–160 → 30–200 m in `manageHerding`:
WRITTEN, SYNTAX-CHECKED, NOT YET PROBED.** Next move: probe seeds 1 and 2
(`bash tmp/goal7/run1.sh <seed> v71s<N>`), then the full batch if both pass.

What round 2 added on top of the round-1 tree (all in brennus.js):

- **Mine storehouses** in `manageDropSites`: ≥ 2 underserved miners > 18 m
  from a stone/metal dropsite edge → storehouse at their clump; stone/metal
  added to rateStats telemetry.
- **Served-fruit system**: `fruitStock` = fruit within 45 m of a food
  dropsite, CC region, no enemies, refreshed every 25 turns. While
  fruitStock > 400, food gatherers take nearest served fruit only; fields are
  gated on `fruitStock < 4000 || t > 90000`; proactive farmstead chaining
  when fruitStock < 600 (best in-territory unserved patch ≥ 250 score).
- **Anti-drift sweep**: fruit gatherers whose bush is > 45 m from every
  dropsite are stopped ONLY when in GATHER state AND empty-handed — stopping
  a loaded returner caused the v58 collapse (see LESSONS_LEARNED).
- **Territory rule for meat**: civilians skip `isHuntable()` supplies outside
  own territory; carcasses outside territory are gathered by the cavalry
  itself.
- **Far-side hunting approach**: move behind the animal relative to
  `nearestFoodDropsite`, then queued gather.
- **Herding v2** (`manageHerding`): cavalry exempt from worker shares
  (`herderId`); non-fleeing detection is behavioral (150 turns of attack
  without closing 10 m to CC → `herdNoFlee`, kill in place); `herdingDone`
  when no targets; new state serialized.
- **Field-ramp deadlock fixes** (the big win): fields exempt from the
  fertPending freeze (fields cost wood only, fertility needs food); the first
  2 bootstrap fields outrank the house stream via `fieldDemand` when
  fruitStock < 800 (v70). v61 deadlocked t=4–7.5 before this.
- **Seed-3 phase deadlock fix** (`managePhaseUp`): when phaseReady and pop is
  pinned at the cap, the CC queue can never drain → cancel it with
  `stopProduction(item.id)`.
- Throttled "house placement FAILED" debug print in tryHouse (every 750
  turns) — kept intentionally, diagnoses a silent failure mode.
- `logStatus` prints `fruitStock=` (kept, cheap).

## Verification protocol (Louis's instruction)

- Iterate with a SINGLE seed run (`tmp/goal7/run1.sh <seed> [tag]`,
  ~40 s wall). Run the full 6-run batch (`tmp/goal7/run.sh`, 5 seeds +
  seed-1 determinism rerun, 2 parallel waves) only when the single run
  looks good.
- **Vary the probe seed** while iterating (Louis, round 2): tuning against a
  single seed overfits — seeds differ a lot (seed 2 is berry-poor, seed 3
  hits the pop-cap queue deadlock). Probe at least seeds 1 and 2 before a
  batch.
- Analyze with `tmp/goal7/analyze.py` (city/pop300 milestone times vs the
  15.0m deadline, stats JSON, interestinglog ERRORs, determinism hash).
- The tree is deterministic across probes: same code + seed 1 reproduces
  identical status lines (v51 vs v52 diff check).

## Known blemishes / ideas

- Goal-6 debug fields pruned from `logStatus`; `fruitStock=` kept. The
  throttled "house placement FAILED" print in tryHouse stays on purpose.
- Fruit pickers still trek far in windows where fruitStock collapses before
  fields ramp; farmstead chaining (fruitStock < 600) helps but fires rarely
  when wood is pinned.
- Seed 2's village pop-pin (houses=1 at t=3, pinned 24/25 until ~t=4) is
  the remaining known inefficiency; the fix candidates (ignore fieldDemand
  for the first house when pinned, 2nd herder) were not tried — v63/v64
  oscillated on exactly this trade.

## Operational notes

- Runs: copy `bot/` into an isolated HOME under `tmp/goalN/`, command as
  in `experiments/goal-01.md` (sandbox Petra opponent for tier 1).
- Experiment logs per goal live in `experiments/goal-NN.md`.
- Engine facts and pitfalls are in `docs/LESSONS_LEARNED.md` — check it
  before investigating engine behavior.
- Mod zip published after each commit:
  `https://files.louissaglio.fr/brennus/brennus.zip` (stable name = latest
  commit; commit-named archives alongside).
