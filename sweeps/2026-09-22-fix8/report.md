# fix8 — Fix B + full Fix C, no Fix A (isolate Fix A as the 316 culprit)

Variant: Fix A fully reverted; Fix B (farRinged muster-engage) + Fix C full
(`enemyArmy > musterTarget` → keep whole army standing).

Result: **140 W 29.0m, 215 W 28.3m, 263 W 28.8m, 316 W 44.5m (buzzer)**,
66/152 hold. **230, 373 still capped.**

Conclusions:
- Fix A was indeed the 316 regression (dropping A un-regresses it).
- The remaining conflict is purely Fix C's breadth: full-C flips the
  behind seeds (140/215/263) but starves the even boom seeds (230/373).
- Next (fix9): make Fix C fire ONLY when behind — gate on
  `enemyArmy > armyCount` instead of a fixed musterTarget. Even seeds then
  behave exactly like chk (demobilize all gatherers); behind seeds keep the
  army standing.
