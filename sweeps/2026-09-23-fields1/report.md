# fields1 — field system rewritten from first principles (2026-09-23)

Bot: old field code removed (placement.js lattice + construction.js
demand/placement), replaced by fields.js FieldManager. Demand: program
starts when served fruit < 4000 or t > 90 s; desired = max(2,
ceil(foodGatherers/3)) (diminishing-returns knee, occupancy 3), no
phase/expansion caps; one field ordered per block, max 3 in flight, wood
gated behind the house declaration. Placement: minimize edge distance to
the nearest food dropsite (CC + farmsteads, nearest-home first) — rings
from axis-adjacent out to halfDiag+110 m (CC) / +60 m (farmstead),
32 angles x 2 m step, filtered by failedSpots / land region / explicit
rotated-box overlap (48 m spatial hash), scored by nearest-dropsite edge,
validated best-first (nearEnemy, placementOK).

21 val1 seeds, standard spec. Results: 19W/1D(259)/1T(70), zero JS
errors. Baseline house2 (b5d1934): 18W/2D(259 320)/1T(70). 320 flips
defeat -> 32.1m win; 259 stays a defeat (39.4m); 70's timeout matches
baseline. Mean win time 28.7m vs house2's 27.9m — within the inter-sweep
jitter (house1's 28.9m had the same tally), and the big per-seed swings
run both ways (52 -10.7m, 387 -11.5m faster; 249 +8.3m, 340 +7.8m
slower): chaotic propagation, not systematic slowdown.

Food economy (the point of the rewrite): mean player-1 food gathered
39808 vs baseline 35719 (+11.4%), 14 seeds up / 7 down; the down seeds
are mostly faster wins (52, 387) with less time to gather. 320 (+31.5k)
and 340 (+19.8k) lead.

Placement quality over 734 field orders: median edge 16 m, p90 41 m,
max 90 m; 51% at <=16 m, 72% at <=30 m. Zero field construct FAILED
across the sweep (explicit box-overlap check covers the walkable-field
passability gap); 9 transient no-placement warnings at peak crowding,
all recovered on retry. Fields destroyed in contested border areas are
rebuilt on the same spot (verified s340: 4 orders at 697,480, farmstead
planner later references the standing field there).
