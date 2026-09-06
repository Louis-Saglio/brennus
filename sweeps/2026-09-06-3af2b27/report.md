# Century sweep: seeds 1-100, standard settings

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-06 via kiln, bot at commit 3af2b27 (foundation denial + proportional recall).

**Outcome: 2 loss, 56 timeout, 42 win**

Verdict rules: `timeout` = 45-min in-game limit reached (kiln marks player 1 won regardless); `win`/`loss` = game ended before the limit; `errors` = ERROR/script-exception lines in stdout.log (a win with JS errors does not count). No JS errors in any game.

vs the parent commit 0cae013 (36 win / 63 timeout / 1 loss): +6 wins, -7 timeouts, +1 loss. The s57 border-fortress loss is fixed (fortress foundation denied at t=25.0; game now goes to the 45-min wire — the probe run won it at the cap, the sweep run timed out mid-raid on the last CC). New losses: s33 (timeout in all prior sweeps — no rams ever trained, no raids, out-massed 121 vs 216 by t=28; the no-ram stall is pre-existing, 0cae013 s33 also had rams=0) and s87 (win in b7fc612 — army annihilated in an even mid-game fight at t=17.5-18.9, 92->15, then never re-massed; both are the documented pre-existing failure modes, not denial damage).

| seed | result | game min | JS errors | artifacts |
|---|---|---|---|---|
| 1 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s1` |
| 2 | win | 39.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s2` |
| 3 | win | 41.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s3` |
| 4 | win | 29.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s4` |
| 5 | win | 41.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s5` |
| 6 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s6` |
| 7 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s7` |
| 8 | win | 36.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s8` |
| 9 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s9` |
| 10 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s10` |
| 11 | win | 37.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s11` |
| 12 | win | 43.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s12` |
| 13 | win | 32.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s13` |
| 14 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s14` |
| 15 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s15` |
| 16 | win | 32.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s16` |
| 17 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s17` |
| 18 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s18` |
| 19 | win | 36.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s19` |
| 20 | win | 38.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s20` |
| 21 | win | 35.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s21` |
| 22 | win | 39.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s22` |
| 23 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s23` |
| 24 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s24` |
| 25 | win | 30.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s25` |
| 26 | win | 31.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s26` |
| 27 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s27` |
| 28 | win | 41.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s28` |
| 29 | win | 37.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s29` |
| 30 | win | 32.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s30` |
| 31 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s31` |
| 32 | win | 34.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s32` |
| 33 | loss | 33.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s33` |
| 34 | win | 42.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s34` |
| 35 | win | 28.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s35` |
| 36 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s36` |
| 37 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s37` |
| 38 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s38` |
| 39 | win | 34.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s39` |
| 40 | win | 33.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s40` |
| 41 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s41` |
| 42 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s42` |
| 43 | win | 32.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s43` |
| 44 | win | 27.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s44` |
| 45 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s45` |
| 46 | win | 38.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s46` |
| 47 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s47` |
| 48 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s48` |
| 49 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s49` |
| 50 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s50` |
| 51 | win | 29.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s51` |
| 52 | win | 44.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s52` |
| 53 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s53` |
| 54 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s54` |
| 55 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s55` |
| 56 | win | 33.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s56` |
| 57 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s57` |
| 58 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s58` |
| 59 | win | 30.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s59` |
| 60 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s60` |
| 61 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s61` |
| 62 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s62` |
| 63 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s63` |
| 64 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s64` |
| 65 | win | 39.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s65` |
| 66 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s66` |
| 67 | win | 36.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s67` |
| 68 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s68` |
| 69 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s69` |
| 70 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s70` |
| 71 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s71` |
| 72 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s72` |
| 73 | win | 35.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s73` |
| 74 | win | 35.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s74` |
| 75 | win | 31.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s75` |
| 76 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s76` |
| 77 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s77` |
| 78 | win | 29.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s78` |
| 79 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s79` |
| 80 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s80` |
| 81 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s81` |
| 82 | win | 40.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s82` |
| 83 | win | 39.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s83` |
| 84 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s84` |
| 85 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s85` |
| 86 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s86` |
| 87 | loss | 29.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s87` |
| 88 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s88` |
| 89 | timeout | 44.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s89` |
| 90 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s90` |
| 91 | win | 29.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s91` |
| 92 | win | 32.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s92` |
| 93 | win | 40.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s93` |
| 94 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s94` |
| 95 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s95` |
| 96 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s96` |
| 97 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s97` |
| 98 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s98` |
| 99 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s99` |
| 100 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-06-3af2b27/artifacts/s100` |
