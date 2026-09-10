# Century sweep: seeds 1-100, standard settings

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-10 via kiln, bot at commit 0db887a (relief expansion).

**Outcome: 1 loss, 9 timeout, 90 win**

Previous century sweeps: c8e6d31 (2026-09-10): 1 loss, 14 timeout, 85 win; a612a00 (2026-09-10): 1 loss, 20 timeout, 79 win; 689584f (2026-09-09): 0 loss, 20 timeout, 80 win.

Verdict rules: `timeout` = 45-min in-game limit reached (kiln marks player 1 won regardless); `win`/`loss` = game ended before the limit; `errors` = ERROR/script-exception lines in stdout.log (a win with JS errors does not count).

Vs the c8e6d31 baseline: six timeouts converted to wins (seeds 20, 37, 38, 41, 66, 87); seed 88 regressed from a 43.9-min win to a timeout (it was grinding the last enemy CC at t=44.8 when the cap hit — the relief-expansion build-order shift left the endgame raid ~1 min behind on a map that was already at the limit). Among the 84 seeds that won in both sweeps, mean game time improved by 0.55 min. Loss: seed 70 again (same hard map as the two previous sweeps). Zero JS errors on all 100 seeds.

| seed | result | game min | JS errors | artifacts |
|---|---|---|---|---|
| 1 | win | 41.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s1` |
| 2 | win | 41.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s2` |
| 3 | win | 37.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s3` |
| 4 | win | 32.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s4` |
| 5 | win | 30.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s5` |
| 6 | win | 41.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s6` |
| 7 | win | 33.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s7` |
| 8 | win | 33.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s8` |
| 9 | win | 29.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s9` |
| 10 | win | 31.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s10` |
| 11 | win | 40.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s11` |
| 12 | win | 37.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s12` |
| 13 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s13` |
| 14 | win | 29.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s14` |
| 15 | win | 30.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s15` |
| 16 | win | 31.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s16` |
| 17 | win | 33.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s17` |
| 18 | win | 35.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s18` |
| 19 | win | 41.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s19` |
| 20 | win | 41.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s20` |
| 21 | win | 32.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s21` |
| 22 | win | 30.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s22` |
| 23 | win | 43.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s23` |
| 24 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s24` |
| 25 | win | 33.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s25` |
| 26 | win | 35.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s26` |
| 27 | win | 42.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s27` |
| 28 | win | 33.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s28` |
| 29 | win | 31.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s29` |
| 30 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s30` |
| 31 | win | 29.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s31` |
| 32 | win | 32.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s32` |
| 33 | win | 39.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s33` |
| 34 | win | 35.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s34` |
| 35 | win | 38.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s35` |
| 36 | win | 38.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s36` |
| 37 | win | 36.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s37` |
| 38 | win | 28.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s38` |
| 39 | win | 34.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s39` |
| 40 | win | 40.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s40` |
| 41 | win | 38.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s41` |
| 42 | win | 31.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s42` |
| 43 | win | 23.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s43` |
| 44 | win | 31.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s44` |
| 45 | win | 40.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s45` |
| 46 | win | 33.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s46` |
| 47 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s47` |
| 48 | win | 35.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s48` |
| 49 | win | 40.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s49` |
| 50 | win | 29.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s50` |
| 51 | win | 40.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s51` |
| 52 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s52` |
| 53 | win | 30.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s53` |
| 54 | win | 35.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s54` |
| 55 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s55` |
| 56 | win | 37.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s56` |
| 57 | win | 32.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s57` |
| 58 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s58` |
| 59 | win | 31.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s59` |
| 60 | win | 36.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s60` |
| 61 | win | 33.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s61` |
| 62 | win | 44.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s62` |
| 63 | win | 28.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s63` |
| 64 | win | 41.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s64` |
| 65 | win | 39.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s65` |
| 66 | win | 35.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s66` |
| 67 | win | 28.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s67` |
| 68 | win | 31.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s68` |
| 69 | win | 39.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s69` |
| 70 | loss | 42.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s70` |
| 71 | win | 32.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s71` |
| 72 | win | 38.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s72` |
| 73 | win | 34.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s73` |
| 74 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s74` |
| 75 | win | 24.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s75` |
| 76 | win | 37.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s76` |
| 77 | win | 35.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s77` |
| 78 | win | 32.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s78` |
| 79 | win | 39.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s79` |
| 80 | win | 39.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s80` |
| 81 | win | 26.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s81` |
| 82 | win | 38.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s82` |
| 83 | win | 42.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s83` |
| 84 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s84` |
| 85 | win | 37.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s85` |
| 86 | win | 28.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s86` |
| 87 | win | 38.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s87` |
| 88 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s88` |
| 89 | win | 37.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s89` |
| 90 | win | 25.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s90` |
| 91 | win | 32.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s91` |
| 92 | win | 33.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s92` |
| 93 | win | 35.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s93` |
| 94 | win | 32.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s94` |
| 95 | win | 27.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s95` |
| 96 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s96` |
| 97 | win | 29.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s97` |
| 98 | win | 39.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s98` |
| 99 | win | 31.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s99` |
| 100 | win | 28.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-0db887a/artifacts/s100` |
