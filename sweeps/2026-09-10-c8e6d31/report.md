# Century sweep: seeds 1-100, standard settings

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-10 via kiln, bot at commit c8e6d31.

**Outcome: 1 loss, 14 timeout, 85 win**

Previous century sweeps: a612a00 (2026-09-10): 1 loss, 20 timeout, 79 win; 689584f (2026-09-09): 0 loss, 20 timeout, 80 win; b7fc612 (2026-09-06): 3 loss, 42 timeout, 55 win.

Verdict rules: `timeout` = 45-min in-game limit reached (kiln marks player 1 won regardless); `win`/`loss` = game ended before the limit; `errors` = ERROR/script-exception lines in stdout.log (a win with JS errors does not count).

Loss: seed 70 — Petra razed Brennus's only Civic Centre at 41.8 min. Brennus won the attrition war (420 enemy units killed vs 443 lost, 47.0k vs 38.3k value) but never touched Petra's base (0 enemy buildings destroyed, 18% peak map control vs Petra's 71%). Seed 70 was already a timeout in the 689584f sweep — a hard map for this bot.

| seed | result | game min | JS errors | artifacts |
|---|---|---|---|---|
| 1 | win | 41.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s1` |
| 2 | win | 40.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s2` |
| 3 | win | 32.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s3` |
| 4 | win | 32.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s4` |
| 5 | win | 36.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s5` |
| 6 | win | 37.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s6` |
| 7 | win | 33.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s7` |
| 8 | win | 33.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s8` |
| 9 | win | 31.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s9` |
| 10 | win | 31.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s10` |
| 11 | win | 40.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s11` |
| 12 | win | 37.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s12` |
| 13 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s13` |
| 14 | win | 29.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s14` |
| 15 | win | 34.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s15` |
| 16 | win | 34.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s16` |
| 17 | win | 33.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s17` |
| 18 | win | 41.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s18` |
| 19 | win | 43.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s19` |
| 20 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s20` |
| 21 | win | 32.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s21` |
| 22 | win | 30.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s22` |
| 23 | win | 43.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s23` |
| 24 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s24` |
| 25 | win | 33.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s25` |
| 26 | win | 32.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s26` |
| 27 | win | 44.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s27` |
| 28 | win | 32.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s28` |
| 29 | win | 31.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s29` |
| 30 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s30` |
| 31 | win | 29.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s31` |
| 32 | win | 32.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s32` |
| 33 | win | 39.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s33` |
| 34 | win | 35.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s34` |
| 35 | win | 42.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s35` |
| 36 | win | 38.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s36` |
| 37 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s37` |
| 38 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s38` |
| 39 | win | 34.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s39` |
| 40 | win | 40.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s40` |
| 41 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s41` |
| 42 | win | 35.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s42` |
| 43 | win | 24.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s43` |
| 44 | win | 31.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s44` |
| 45 | win | 40.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s45` |
| 46 | win | 37.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s46` |
| 47 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s47` |
| 48 | win | 35.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s48` |
| 49 | win | 41.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s49` |
| 50 | win | 30.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s50` |
| 51 | win | 40.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s51` |
| 52 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s52` |
| 53 | win | 35.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s53` |
| 54 | win | 35.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s54` |
| 55 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s55` |
| 56 | win | 37.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s56` |
| 57 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s57` |
| 58 | win | 38.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s58` |
| 59 | win | 31.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s59` |
| 60 | win | 36.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s60` |
| 61 | win | 33.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s61` |
| 62 | win | 44.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s62` |
| 63 | win | 28.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s63` |
| 64 | win | 39.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s64` |
| 65 | win | 39.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s65` |
| 66 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s66` |
| 67 | win | 28.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s67` |
| 68 | win | 31.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s68` |
| 69 | win | 39.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s69` |
| 70 | loss | 41.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s70` |
| 71 | win | 33.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s71` |
| 72 | win | 44.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s72` |
| 73 | win | 34.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s73` |
| 74 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s74` |
| 75 | win | 24.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s75` |
| 76 | win | 36.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s76` |
| 77 | win | 31.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s77` |
| 78 | win | 32.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s78` |
| 79 | win | 39.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s79` |
| 80 | win | 39.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s80` |
| 81 | win | 26.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s81` |
| 82 | win | 34.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s82` |
| 83 | win | 39.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s83` |
| 84 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s84` |
| 85 | win | 37.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s85` |
| 86 | win | 27.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s86` |
| 87 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s87` |
| 88 | win | 43.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s88` |
| 89 | win | 38.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s89` |
| 90 | win | 33.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s90` |
| 91 | win | 32.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s91` |
| 92 | win | 34.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s92` |
| 93 | win | 35.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s93` |
| 94 | win | 32.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s94` |
| 95 | win | 27.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s95` |
| 96 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s96` |
| 97 | win | 38.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s97` |
| 98 | win | 39.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s98` |
| 99 | win | 31.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s99` |
| 100 | win | 28.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-c8e6d31/artifacts/s100` |
