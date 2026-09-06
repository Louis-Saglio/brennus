# Century sweep: seeds 1-100, standard settings

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-06 via kiln, bot at commit 8ac30f0 (expansion-ring placement fallback).

**Outcome: 1 loss, 28 timeout, 71 win**

vs the parent commit 3af2b27 (42 win / 56 timeout / 2 loss): **+29 wins, -28 timeouts, -1 loss**. Flips: 34 timeout -> win; 5 win -> timeout (s8, s29, s46, s73, s83 — marginal-seed churn, all late-arsenal or raid-bounce shapes); s33 loss -> timeout. s87 unchanged (the documented even-fight annihilation at t=17.5-18.9, same 29.7m loss). No JS errors in any game.

Remaining 28 timeouts by shape (arsenal time, rams, raids, CCs razed): arsenal placement is fixed as a *silent* failure — only s38/s81 never build one (both never reach city: the pre-existing managePhaseUp stall and the massacred-economy stall). The rest: (a) arsenal >= 36m, out of clock — s7, s17, s29, s37, s45, s46, s63, s69, s88, s99; (b) raids fire but bounce off camped defenders or lose the raze-vs-rebuild race with 0-2 CCs down and Petra's army dead at the cap — s31, s33, s47, s50, s57, s60, s61, s70, s73, s76, s83, s84, s85, s96; (c) pop-lock: rams ordered but never spawn at pop 300/300 (queued units mask the army shortfall, so civilian dismissal stops and nothing retrains) — confirmed on s31 (4 rams queued at t=28.4, pop pinned 299-300/300, 51k food banked, zero raids), same "rams>0 raids=0" signature on s8, s69, s79 (not individually autopsied).

Verdict rules: `timeout` = 45-min in-game limit reached (kiln marks player 1 won regardless); `win`/`loss` = game ended before the limit; `errors` = ERROR/script-exception lines in stdout.log (a win with JS errors does not count).

| seed | result | game min | JS errors | artifacts |
|---|---|---|---|---|
| 1 | win | 36.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s1` |
| 2 | win | 38.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s2` |
| 3 | win | 33.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s3` |
| 4 | win | 28.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s4` |
| 5 | win | 36.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s5` |
| 6 | win | 32.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s6` |
| 7 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s7` |
| 8 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s8` |
| 9 | win | 32.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s9` |
| 10 | win | 29.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s10` |
| 11 | win | 37.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s11` |
| 12 | win | 44.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s12` |
| 13 | win | 32.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s13` |
| 14 | win | 31.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s14` |
| 15 | win | 38.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s15` |
| 16 | win | 30.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s16` |
| 17 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s17` |
| 18 | win | 40.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s18` |
| 19 | win | 41.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s19` |
| 20 | win | 28.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s20` |
| 21 | win | 42.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s21` |
| 22 | win | 38.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s22` |
| 23 | win | 43.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s23` |
| 24 | win | 31.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s24` |
| 25 | win | 30.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s25` |
| 26 | win | 28.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s26` |
| 27 | win | 39.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s27` |
| 28 | win | 33.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s28` |
| 29 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s29` |
| 30 | win | 34.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s30` |
| 31 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s31` |
| 32 | win | 33.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s32` |
| 33 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s33` |
| 34 | win | 40.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s34` |
| 35 | win | 28.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s35` |
| 36 | win | 35.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s36` |
| 37 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s37` |
| 38 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s38` |
| 39 | win | 38.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s39` |
| 40 | win | 31.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s40` |
| 41 | win | 35.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s41` |
| 42 | win | 33.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s42` |
| 43 | win | 32.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s43` |
| 44 | win | 27.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s44` |
| 45 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s45` |
| 46 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s46` |
| 47 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s47` |
| 48 | win | 31.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s48` |
| 49 | win | 40.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s49` |
| 50 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s50` |
| 51 | win | 35.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s51` |
| 52 | win | 44.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s52` |
| 53 | win | 35.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s53` |
| 54 | win | 33.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s54` |
| 55 | win | 42.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s55` |
| 56 | win | 37.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s56` |
| 57 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s57` |
| 58 | win | 39.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s58` |
| 59 | win | 31.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s59` |
| 60 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s60` |
| 61 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s61` |
| 62 | win | 35.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s62` |
| 63 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s63` |
| 64 | win | 34.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s64` |
| 65 | win | 38.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s65` |
| 66 | win | 41.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s66` |
| 67 | win | 32.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s67` |
| 68 | win | 40.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s68` |
| 69 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s69` |
| 70 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s70` |
| 71 | win | 34.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s71` |
| 72 | win | 36.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s72` |
| 73 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s73` |
| 74 | win | 35.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s74` |
| 75 | win | 31.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s75` |
| 76 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s76` |
| 77 | win | 38.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s77` |
| 78 | win | 30.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s78` |
| 79 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s79` |
| 80 | win | 37.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s80` |
| 81 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s81` |
| 82 | win | 38.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s82` |
| 83 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s83` |
| 84 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s84` |
| 85 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s85` |
| 86 | win | 40.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s86` |
| 87 | loss | 29.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s87` |
| 88 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s88` |
| 89 | win | 43.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s89` |
| 90 | win | 29.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s90` |
| 91 | win | 33.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s91` |
| 92 | win | 34.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s92` |
| 93 | win | 31.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s93` |
| 94 | win | 34.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s94` |
| 95 | win | 27.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s95` |
| 96 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s96` |
| 97 | win | 35.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s97` |
| 98 | win | 44.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s98` |
| 99 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s99` |
| 100 | win | 27.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0/artifacts/s100` |
