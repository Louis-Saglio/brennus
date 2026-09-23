# fix10 — Fix B only (attribution probe)

Variant: Fix A and Fix C removed; Fix B (farRinged muster-engage) alone.

Result: 162 W 35.5m, 356 W 36.6m, 372 W 30.4m — the three val2 regressions all
un-regress without the demobilize gate. 170 timeout (= chk baseline). 140/215
stay capped — Fix B alone does NOT flip the targets.

Conclusion: the behind-gate (Fix C) was the sole cause of the 162/356/372
regressions; Fix B is safe on these seeds but insufficient for the task.
