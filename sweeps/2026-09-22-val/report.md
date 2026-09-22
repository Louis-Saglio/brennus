# val — fix2 full validation (2026-09-22)

Bot: fix2 (hysteresis + overflow shelters). 38 jobs: 11 bad + 21-won
regression sample (fast/mid/slow/race) + 6 canaries.

Results: bad seeds 6/11 wins (66 152 172 230 285 316; capped 41 162 170
215 267); won sample 17/21 (70 320 340 352 capped); canaries 3/6 (2 140
263 win; 76 356 373 capped); zero JS errors. Verdict: fix2 regresses
the won-seed surface — reverted in favor of fix1 (see val1).
