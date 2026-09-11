# Century sweep: seeds 1-100, standard settings

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-11 via kiln, bot at commit b041c34 (spot-clearing ops).

**Outcome: 1 loss, 8 timeout, 91 win**

Previous century sweeps: 0db887a (2026-09-10): 1 loss, 9 timeout, 90 win; c8e6d31 (2026-09-10): 1 loss, 14 timeout, 85 win; a612a00 (2026-09-10): 1 loss, 20 timeout, 79 win.

Verdict rules: `timeout` = 45-min in-game limit reached (kiln marks player 1 won regardless); `win`/`loss` = game ended before the limit; `errors` = ERROR/script-exception lines in stdout.log (a win with JS errors does not count).

Vs the 0db887a baseline: one timeout converted to a win (seed 30, 44.3 min — a clearing op sanitized the contested spot and the escorted CC stood). No verdict regressed. Seed 47 (the pattern the change targets) still times out but the replacement CC now stands under army escort at t=40 instead of five builder parties dying; its map is lost militarily upstream. Among the 90 seeds that won in both sweeps, mean game time improved by 0.18 min. Clearing ops fired on 28 seeds and held a spot until the CC stood on 5 (19, 27, 35, 47, 83). Loss: seed 70 again (same hard map as the three previous sweeps). Zero JS errors on all 100 seeds.

| seed | result | game min | JS errors | artifacts |
|---|---|---|---|---|
| 1 | win | 41.7 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s1` |
| 2 | win | 39.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s2` |
| 3 | win | 38.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s3` |
| 4 | win | 32.6 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s4` |
| 5 | win | 30.9 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s5` |
| 6 | win | 41.3 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s6` |
| 7 | win | 33.6 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s7` |
| 8 | win | 33.8 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s8` |
| 9 | win | 29.5 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s9` |
| 10 | win | 31.4 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s10` |
| 11 | win | 39.9 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s11` |
| 12 | win | 36.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s12` |
| 13 | timeout | 45.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s13` |
| 14 | win | 29.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s14` |
| 15 | win | 29.9 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s15` |
| 16 | win | 31.4 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s16` |
| 17 | win | 33.2 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s17` |
| 18 | win | 39.6 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s18` |
| 19 | win | 44.3 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s19` |
| 20 | win | 41.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s20` |
| 21 | win | 32.8 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s21` |
| 22 | win | 31.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s22` |
| 23 | win | 43.7 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s23` |
| 24 | timeout | 45.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s24` |
| 25 | win | 33.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s25` |
| 26 | win | 35.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s26` |
| 27 | win | 37.8 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s27` |
| 28 | win | 33.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s28` |
| 29 | win | 31.9 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s29` |
| 30 | win | 44.3 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s30` |
| 31 | win | 29.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s31` |
| 32 | win | 32.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s32` |
| 33 | win | 39.8 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s33` |
| 34 | win | 35.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s34` |
| 35 | win | 39.8 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s35` |
| 36 | win | 38.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s36` |
| 37 | win | 36.5 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s37` |
| 38 | win | 28.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s38` |
| 39 | win | 34.5 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s39` |
| 40 | win | 40.8 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s40` |
| 41 | win | 38.4 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s41` |
| 42 | win | 31.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s42` |
| 43 | win | 23.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s43` |
| 44 | win | 31.6 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s44` |
| 45 | win | 40.3 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s45` |
| 46 | win | 33.5 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s46` |
| 47 | timeout | 45.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s47` |
| 48 | win | 35.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s48` |
| 49 | win | 40.9 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s49` |
| 50 | win | 29.8 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s50` |
| 51 | win | 40.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s51` |
| 52 | timeout | 45.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s52` |
| 53 | win | 30.8 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s53` |
| 54 | win | 34.4 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s54` |
| 55 | timeout | 45.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s55` |
| 56 | win | 37.4 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s56` |
| 57 | win | 32.2 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s57` |
| 58 | win | 28.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s58` |
| 59 | win | 35.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s59` |
| 60 | win | 36.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s60` |
| 61 | win | 33.2 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s61` |
| 62 | win | 44.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s62` |
| 63 | win | 28.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s63` |
| 64 | win | 40.5 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s64` |
| 65 | win | 39.7 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s65` |
| 66 | win | 34.6 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s66` |
| 67 | win | 28.4 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s67` |
| 68 | win | 33.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s68` |
| 69 | win | 38.9 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s69` |
| 70 | loss | 42.3 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s70` |
| 71 | win | 32.2 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s71` |
| 72 | win | 38.2 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s72` |
| 73 | win | 34.5 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s73` |
| 74 | timeout | 45.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s74` |
| 75 | win | 24.7 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s75` |
| 76 | win | 37.3 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s76` |
| 77 | win | 35.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s77` |
| 78 | win | 32.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s78` |
| 79 | win | 31.9 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s79` |
| 80 | win | 38.2 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s80` |
| 81 | win | 25.7 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s81` |
| 82 | win | 38.1 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s82` |
| 83 | win | 38.3 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s83` |
| 84 | win | 28.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s84` |
| 85 | win | 38.6 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s85` |
| 86 | win | 28.2 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s86` |
| 87 | win | 38.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s87` |
| 88 | timeout | 45.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s88` |
| 89 | win | 35.5 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s89` |
| 90 | win | 25.6 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s90` |
| 91 | win | 32.9 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s91` |
| 92 | win | 33.9 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s92` |
| 93 | win | 35.4 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s93` |
| 94 | win | 33.9 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s94` |
| 95 | win | 27.4 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s95` |
| 96 | timeout | 45.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s96` |
| 97 | win | 29.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s97` |
| 98 | win | 39.4 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s98` |
| 99 | win | 31.8 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s99` |
| 100 | win | 28.0 | | `/home/ubuntu/brennus/sweeps/2026-09-11-b041c34/artifacts/s100` |
