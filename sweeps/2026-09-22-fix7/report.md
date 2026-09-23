# fix7 — A+B+standing-core 0.6 (demobilize floor = min(standing, enemyArmy*0.6))

Variant: Fix A + Fix B + Fix C-soft (when the gate fires, demobilize only down
to 60% of the enemy army instead of keeping everyone standing).

Result: un-regresses 230/373, but **215 still capped, 263 conquered-loss,
316 still capped**, and the borderline val seeds bleed: 170 timeout (was win in
fix4), 70 timeout (was win in fix5), 320 defeat. Only 52 improves.

Conclusion: dead end — the 0.6 floor is simultaneously too weak to flip the
behind seeds and still costly enough to regress the even ones. Dropping Fix A
and making the gate itself conditional (fix9) is the next probe.
