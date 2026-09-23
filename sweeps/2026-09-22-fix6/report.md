# fix6 — A+B+C on the 8 chk-win seeds (regression isolation)

Variant: Fix A (war army-target scaling) + Fix B (farRinged muster-engage) + Fix C (full: demobilize gate `enemyArmy > musterTarget`).

Result: 5/8 wins hold (41, 162, 267, 285, 356); **230, 316, 373 regress to capped**.

Conclusion: full Fix C is too broad — it keeps the whole army standing whenever
Petra fields >55 soldiers, which starves the boom in even games. 230/373 are
buzzer wins (373 was raiding Petra's CC with rams at 44.9m in chk); 316 flipped
with Fix A present (see fix8: dropping A un-regresses 316).
