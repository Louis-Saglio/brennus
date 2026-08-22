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

## Results — 5-seed batch (tags b-seed1..5, b-seed1-rerun)

Zero JS errors on all 5 seeds; boom bars intact (city 12.9-15.0, pop300
13.4-14.6); determinism: seed-1 rerun byte-identical statistics
(sha 4570ebae24e9).

| seed | city | pop300 | map% | food | wood | stone | metal |
|---|---|---|---|---|---|---|---|
| 1 | 14.6 | 14.6 | 93 | 51971 | 40652 | 19447 | 19726 |
| 2 | 15.0 | 14.1 | 77 | 86293 | 36638 | 14757 | 19444 |
| 3 | 14.3 | 14.0 | 86 | 61461 | 39737 | 19149 | 19381 |
| 4 | 12.9 | 14.0 | 74 | 68279 | 42786 | 14761 | 15409 |
| 5 | 14.2 | 13.4 | 93 | 89324 | 38771 | 12575 | 12670 |

**Territory: PASSED (≥ 70% on all 5 seeds, 74-93%). Boom: PASSED.
Determinism: PASSED. Resources: food ✓ 50k+ everywhere; wood ~37-43k;
stone ~12-20k; metal ~12-20k — the 50000 bars are NOT met, and the
stone/metal ones cannot be: the map holds ~28k stone / ~40k metal in
total (see the census above), so even mining every deposit plus the
market's ceiling lands ~20k short of 50k on stone.**

Why the resource bars are out of reach (numbers, not opinion):

- Stone on the map: 27-29k across seeds. Metal: 39-43k. Mining cannot
  create more than the deposits hold.
- The population cap is a hard 300 (min(300, Σ building bonuses)) — no
  worker count can scale past it.
- Market barter price-degrades (each 500-deal drifts the sold price ~8%
  down, the bought ~8% up; restore 0.5 per 5 s). A simulation of the
  15-minute window caps at ~15k bought per resource with prices pinned at
  200:1; at sane ratios ~5-8k. Measured: 5.5-7k bought per game.
- Trade (goal-6 mechanic, restored): ~0.05-0.15/s per trader, measured
  tradeIncome ≈ 0 (routes go up late; the fleet is small since each
  trader is a miner not mining under the 300 cap).

Achievable ceiling ≈ food 50k+, wood 45-50k (tunable), stone ~25-30k,
metal ~28-33k. The goal's 50000-each bar exceeds the map's physical
stone supply by ~20k. **Awaiting Louis's call on recalibrating the
resource bars** (e.g. "mine out the map" = ~25k stone / ~35k metal, or
keep 50k on food/wood only).

## Next

- Wood to 50k: shave construction spending (fields/storehouses) and/or
  shift a few miners to wood.
- Whatever recalibration Louis picks for stone/metal.
