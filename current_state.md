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
| 7 | City Phase AND 300 pop by 15 min | IN PROGRESS (city met, pop 0.5 over) | — |

## Goal 7 — where it stands (2026-08-21, Louis's dropsite/woodline tips session)

Target: `phase_city_generic` AND `population=300`, both ≤ 15.0 in-game min.

**Louis's directives this session** (all implemented in the working tree):
fields near farmsteads with free space; first farmstead at max food within
30 m; all woodcutters on the ONE biggest woodline, migrate on depletion;
destroy storehouses with no wood/metal/stone nearby; farmsteads for
fruit/berry pickers + fruit rate/distance telemetry.

Best single-seed-1 results (city / pop300): **v53/v54 ≈ 14.6–14.8 /
15.5–15.6**. City is under deadline since v44 (13.6 best); pop is stuck
~0.5 min over. Milestone history: v34 17.3/18.0 (pre-tips baseline with
v34 delta), v37 16.7/15.7 (tips working), v44 13.6/16.9 (rate-matched
mining), v48 14.9/15.6, v51 14.6/15.6 (fertility at t=4), v54 14.8/15.6
(tavern in trio). No run has both ≤ 15 yet.

What is in the tree on top of the v33 base (all verified by probes):

- **Woodline concentration** (`updateWoodline`): wood supplies binned in
  30 m cells, densest 90 m neighbourhood wins, zone = trees within 45 m of
  its centre, kept until < 800 wood remains, then re-picked. Choppers only
  gather zone trees (`findSupply` wood branch). First storehouse goes to
  the zone centre.
- **Storehouse lifecycle**: destruction when < 200 resources within 40 m
  AND no gatherer working within 40 m (both guards needed — see
  LESSONS_LEARNED).
- **Fields**: placed next to the least-crowded farmstead with free space
  (grid fallback); fieldCap 30.
- **First farmstead**: max food in 30 m among in-territory reachable
  patches, top 5 patches tried (`placeFirstFarmstead`).
- **Fruit farmsteads** in `manageDropSites` (≥ 3 pickers > 18 m from a
  food dropsite); `rates fruit=NN%` and `dist fruit=Nm` in logStatus.
- **Rate-matched mining** (`currentShares(total)`): no mining before t=8,
  then just enough miners to fill 750/750 + pending grain-tech metal by
  t=13.5, zero once the city research starts; miners are also actively
  stopped when the research starts (`minersFreed`).
- **Tech sequencing**: grain techs + pop_house_01 may spend into the city
  bank (miners pre-fill); the city research waits for them (hard fallback
  13:20); a pending rate tech freezes discretionary houses
  (`techPendingWood`); boomTechs order: wicker, plows, training, harvester,
  ironaxes, pop_house_01, capacity, strongeraxes, pop_house_02, fertilizer.
- **Gaul tavern in the trio** (`trioTypes`): forge+market+tavern
  (100w+100s, +10 pop, class House) instead of the 300w temple.
- Fertility Festival gate at t=4 (was t=5); sprint cap override: houses
  ordered regardless of margin from t=10 while popLimit < max.

**The remaining blocker is food volume**: pop300@15 needs ~15k food
gathered by t=15; the bot gets ~11.5–12k. Grain rate telemetry is 80–86%
(good), dist grain 1–3 m (good) — the deficit is raw worker×rate, not
dropsites. The end sprint is food-limited (food stock ~0–100 always,
~37 food/s at t=14 vs ~80/s trainer demand). Ideas not yet tried:

- Tavern as the sprint cap building (+10 pop for 100w+100s; stone is
  nearly free after the bank — converts stone to cap). Careful: 20x20
  footprint, build time 200.
- Trade income as food (market from ~t=7, traders buy food indirectly via
  barter). Goal-6 code has trading removed from goal-7? — traders were
  goal 6; the market exists from the trio. Untested in goal 7.
- More fields than gatherers/3 (diminishing returns: 5/field = 0.82 avg
  rate, 3/field = 0.90).
- Earlier farming_training (fires 11.9–13.5 depending on wood/metal
  pinch; each minute earlier ≈ +400 food).

## Verification protocol (Louis's instruction)

- Iterate with a SINGLE seed run (`tmp/goal7/run1.sh <seed> [tag]`,
  ~40 s wall). Run the full 6-run batch (`tmp/goal7/run.sh`, 5 seeds +
  seed-1 determinism rerun, 2 parallel waves) only when the single run
  looks good.
- Analyze with `tmp/goal7/analyze.py` (city/pop300 milestone times vs the
  15.0m deadline, stats JSON, interestinglog ERRORs, determinism hash).
- The tree is deterministic across probes: same code + seed 1 reproduces
  identical status lines (v51 vs v52 diff check).

## Known blemishes / ideas

- `logStatus` still carries goal-6 debug fields (fieldFail, founds,
  failedSpots) — cheap (every 750 turns); prune when they stop being
  useful.
- Fruit pickers still trek far when base berries run out before fields
  ramp (fruit dist 100–200 m windows); farmstead-at-fruit fires rarely
  because wood is pinned then anyway.
- Trade income varies with route distance (map-dependent territory
  shape): 1358–1921 across seeds at ~170–270 m routes (goal 6).

## Operational notes

- Runs: copy `bot/` into an isolated HOME under `tmp/goalN/`, command as
  in `experiments/goal-01.md` (sandbox Petra opponent for tier 1).
- Experiment logs per goal live in `experiments/goal-NN.md`.
- Engine facts and pitfalls are in `docs/LESSONS_LEARNED.md` — check it
  before investigating engine behavior.
- Mod zip published after each commit:
  `https://files.louissaglio.fr/brennus/brennus.zip` (this tree, v54).
