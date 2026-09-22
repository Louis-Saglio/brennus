# fix2 — hysteresis + overflow shelters, probe (2026-09-22)

Bot: fix1 + two-sided hysteresis band (stay engaged unless army <
0.9x nearThreat or wave > 1.15x army) + overflow shelters (garrison
overflow sent to other CCs/towers instead of standing outside the
threatened CC) + unload position guard.

Seeds: 4 remaining bad (41 152 170 215) + fix1 winners 162/267/66 +
controls 1/3/25 + canaries 76/140. Results: 152 (36.8m) and 140 (34.9m)
flip to wins, but 162 and 267 regress from fix1 wins to capped — both
traced to marginal engage timing (one-round-early charge into a still-
arriving wave), not fix2 logic. Full validation (val) then showed 6
previously-won seeds capped (70 320 340 352 356 373): both additions
regress the won-seed surface and were reverted.
