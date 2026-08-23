# Goal 8 — Expand the base (work in progress, 2026-08-22)

**Status: territory bar met (88% on seed 1); resource bars under
investigation — the map physically cannot carry 50000 stone.**

## Criteria

- Boom first (goal-7 bar): City Phase AND 300 pop ≤ 15 min — **holds**
  (seed 1: 14.6/14.6).
- By t=30: `percentMapControlled` ≥ 70 — **met with margin** (seed 1: 88%).
- By t=30: ≥ 50000 stockpiled of food, wood, stone, metal
  (`resourcesCount`).
- Match ends at the 30-minute mark (in-mod trigger, 18 → 30 min).
- Zero JS errors; 5 seeds; seed-1 rerun identical.

## Setup

- Opponent: Petra sandbox (difficulty 0), rome — unchanged from tier 1-2.
- Runner `tmp/goal8/run.sh` (5 seeds + rerun), single-seed
  `tmp/goal8/run1.sh <seed> [tag]`, probe `tmp/goal8/run-probe.sh`.

## Map supply census (the constraint this goal runs into)

Probed on seeds 1-5 (full-information supply scan at init):

| seed | stone | metal | territoryPassableTiles | 70% bar |
|---|---|---|---|---|
| 1 | 29000 | 40000 | 6496 | 4548 |
| 2 | 28000 | 39000 | 6374 | 4462 |
| 3 | 29000 | 43000 | 6451 | 4516 |
| 4 | 27000 | 39000 | 6451 | 4516 |
| 5 | 28000 | 40000 | 6493 | 4546 |

The map holds ~27-29k stone and ~39-43k metal TOTAL (large mines 5000,
small 1000). The population cap is a hard 300 (min(300, Σ building
bonuses) — CCs add +20 but only under the cap). Market barter is
price-degrading (each 500-deal drifts the sold/bought prices ~8%, restore
0.5 per 5 s) — a barter simulation over the 15-minute window caps at
~15k bought per resource at ruinous 200:1 tail prices, realistically
~5-8k at sane rates. Trade yields ~0.05-0.15/s per trader (goal 6
measured ~100/trader per 30 min). **Estimated physical ceiling ≈ 40k
stone / 45k metal / 50k+ food / 50k+ wood — the 50000 stone bar appears
unreachable on this map size; measurement below.**

## Implementation (this commit)

- Trigger: 30 in-game minutes.
- Expansion stage latches on city researched AND pop ≥ 300 — everything
  before the gate is the untouched goal-7 code.
- `manageExpansion`: CC plan from a hex-packed 210 m lattice, filtered by
  the CC build rules (own/neutral territory, 200 m from every CC,
  passable rotated footprint, land region, away from enemies), picked
  greedily by simulated marginal territory coverage (engine-style
  influence floodfill: linear falloff, cost 1/4, diagonal √2) until 72%
  of the passable map is predicted. CCs ordered one per block with
  stock floors (600w/750s/550m — a tight check races the same-block
  research/barter orders and the engine rejects on cost), re-validated
  against the live state before ordering. 10 sticky builders each.
- `expansionShares`: mining crews sized to deplete every served mine
  (within 130 m of a CC/storehouse) by t=30; rest food/wood.
- `manageExpansionTechs`: post-city mining techs (+25% stone/metal each)
  and trade gains.
- Proactive storehouses at big unserved in-territory mines (dropsites
  must come to the mine — miners never walk to unserved mines).
- `manageExpansionBarter`: price-aware (getBarterPrices ratios), buys
  stone/metal with food/wood surpluses.
- `manageTrade`: goal-6 mechanic restored — 10 traders shuttling the two
  farthest markets, extra markets planted at the far end of the map.

## Results — 5-seed batch (tags f-seed1..5, f-seed1-rerun)

Zero JS errors on all 5 seeds; boom bars intact (city 12.9-15.0, pop300
13.4-14.6); determinism: seed-1 rerun byte-identical statistics
(sha f993bb875806). All Louis's levers in: wonder + Glorious Expansion
(pop 360), the full econ tech tree (27-28 research orders incl. the
wonder tech and stockbreeding via a corral), a 34-45-trader fleet
(tradeIncome 595-2800, idle civilians dismissed for pop), and the worker
efficiency telemetry (logStatus rates: grain 89-100%, wood 44-57%,
stone/metal 60-80%).

| seed | city | pop300 | map% | food | wood | stone | metal | trade | pop |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 14.6 | 14.6 | 93 | 46783 | 52651 | 8460 | 8245 | 595 | 360 |
| 2 | 15.0 | 14.1 | 77 | 61759 | 49337 | 12170 | 12263 | 2800 | 360 |
| 3 | 14.3 | 14.0 | 94 | 42881 | 55726 | 10849 | 10659 | 0 | 359 |
| 4 | 12.9 | 14.0 | 77 | 69276 | 47421 | 5113 | 9167 | 605 | 360 |
| 5 | 14.2 | 13.4 | 81 | 73985 | 48193 | 7704 | 7624 | 2070 | 360 |

**Territory: PASSED (≥ 70% on all 5 seeds, 77-94%). Boom: PASSED.
Determinism: PASSED. Resources: food 43-74k (3/5 seeds ≥ 50k), wood
47-56k (3/5 ≥ 50k), stone 5-12k, metal 7-12k.**

The food/wood bars sit right at the allocation frontier: every worker
moved between fields and woodline shifts ±2-5k per seed, and the
seed-to-seed variance (food 43-74k) is bigger than any remaining knob.
Stone/metal stay map-bound: the deposits hold ~28k stone / ~40k metal in
total and the hard 300-pop base cap (360 with Glorious Expansion) limits
the workforce — mining everything + the market's price-degrading barter
(~5-7k bought at sane rates) + trade (~0.5-1.5k of each) cannot reach
the 50000 bars, which exceed the map's total stone. The stone/metal
stockpiles are therefore deliberately traded away for food/wood workers
(the reachable bars): mining is capped at 26% of the workforce.

## Next

- Wood to 50k: shave construction spending (fields/storehouses) and/or
  shift a few miners to wood.
- Whatever recalibration Louis picks for stone/metal.
