# fix9 — Fix B + behind-conditional Fix C (the discriminator)

Variant: Fix A dropped. Fix B (farRinged muster-engage) + Fix C gated on
`enemyArmy > armyCount`: when the enemy out-masses our whole roster, keep every
soldier standing (no demobilization); when even or ahead, demobilize all
gatherers exactly like chk. Even games are behaviorally identical to chk by
construction; behind games keep the army standing instead of feeding waves
piecemeal from the fields.

Result: **8/8 wins.**
- Targets flip: 140 W 24.5m, 215 W 35m.
- Borderline flips: 263 W 31.6m.
- fix6/fix8 regressions all un-regress: 230 W 31.3m, 373 W 43.4m (faster than
  chk's 44.9m — no boom slowdown), 316 W 39.4m.
- Controls hold: 66 W 35.9m, 152 W 26.3m.

Mechanism check (logs): s140's first wave met by a 67-blob (-20 for -33, was
46:24 piecemeal), second battle 98v99 held as one army (was the -52-for-3
garrison-march). s215's t=20.8m battle -15 for -65. Note: s215 shows brief
demob/remob churn at the 40-turn hysteresis boundary around 21-23m (5 cycles,
self-stabilized) — cosmetic here, watch-item.

Next: full regression (val2) on the 9 remaining timeout seeds + 21 val1 seeds.
