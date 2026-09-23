# forestgate — pattern-selected wood storehouse strategy (2026-09-23)

Bot: the wood storehouse strategy is now selected by the observed
tree-distribution pattern at init (observeWoodPattern, union-find clumps
at 25 m link). Temperate mainland classifies dense-forest (93% of wood in
clumps of >=10 trees on every measured seed) and gets
ForestWoodStorehouseStrategy: same payback model, but a storehouse site
must have >=8 trees within 40 m (measured split: straggler sites 1-4,
forest sites 14-48). Straggler-only demands find no site, never spend;
the pull-back walks those choppers to the served forest. The opening
storehouse is exempt (thin home groves are load-bearing, 2026-09-05
lesson). Other patterns keep the plain strategy.

Motivation (Louis's review of house2's 3 non-wins): on temperate
mainland, trees are dense forests plus stragglers, and Brennus placed
wood storehouses on 1-4-tree straggler clumps that passed the payback
gate on walk distance alone (value scales with d0). Measured on house2's
logs: 10 such storehouses across s259/s320/s70 (~1000 wood plus
rush-build churn).

34 seeds standard spec, zero JS errors. 31W/1D/2T.

- val1 set (21 seeds) vs house2: 18W/2D/1T -> 18W/1D/2T. 259/320
  defeats -> timeouts (survive the cap), 70 timeout -> 37.2m win,
  340 win -> 37.5m defeat (military rout at 18-23m after a stronger
  boom — chaotic military-chain flip, storehouse gate verifiably
  correct in its log, accepted per the rebalancing rule).
- val2 timeout set (9 seeds: 2 41 76 162 170 172 267 285 356): all
  wins (162 T->W, 170 D->W, 356 T->W).
- Golden seeds 1-5: all wins; timelines rebaselined.
- Probes (same code): s70 win 37.2, s259/s320 timeouts, controls
  250/43 wins.
