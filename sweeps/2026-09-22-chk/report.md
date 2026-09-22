# 2026-09-22-chk — timeout classification under shipped code

Purpose: re-classify the timeout seeds under the shipped fix1 code
(`097e809`, fix1 + unload position guard) into bad-position vs winnable,
like the original 17-timeout autopsy.

20 jobs: the 11 original bad-set seeds (4 re-run + 7 rechecks), canaries
(76, 140), the 3 regressed wins (52, 70, 320), and 4 canary rechecks
(2, 263, 356, 373). Standard settings, seed = aiseed, 45-min cap.

## Results: 13 wins, 7 timeouts

- Wins: 2 (29.3m), 41 (44.3m), 66 (33.4m), 76 (44.8m), 152 (34.0m),
  162 (35.5m), 172 (33.6m), 230 (37.0m), 267 (44.4m), 285 (33.8m),
  316 (36.2m), 356 (36.6m), 373 (44.5m). No JS errors anywhere.
- Timeouts: 52, 70, 140, 170, 215, 263, 320.

Of the original 11 bad seeds, 9 now win (41 and 152 flipped to wins
because of the unload guard). 76 is a genuine buzzer win (44.8m).

## Classification of the 7 timeouts

- Clearly bad: **140** (economy in ruins: pop 88/110, food rates 8–27%,
  army 13 vs 109+8 siege), **215** (pop-blocked raid held outnumbered
  123 vs 189, stock 2551f/1136w it cannot convert, 0 Petra CCs killed).
- Borderline / bad-ish: **170** (army 74 vs ~129, 0 Petra CCs killed,
  but pop recovering 146→236 and an active fortress purge), **320**
  (army 62 vs ~116, raid repelled at 39m, but economy big and growing,
  Petra only 1 CC), **263** (raid collapsing at the cap: army 64→30 in
  the final minute, garrisoned 30 vs 66 at 44.6m; economy still big,
  pop 249/300, but 0 Petra CCs killed vs Petra's 3).
- Winnable, minutes away: **52** (defenders collapsing at the cap:
  rams battering the CC, enemy 27→16 at 45.0m), **70** (6 rams battering
  Petra's only CC at 45.0m, army 95 vs 42 contesters).

Note: 263 won pre-guard (36.6m) and caps under the shipped code — the
unload guard flipped it, same mechanism that flipped 41/152 to wins.
