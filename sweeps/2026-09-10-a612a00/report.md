# Century sweep 3: seeds 1-100, standard settings

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-10 via kiln, bot at commit a612a00 ("rally the war-stage army at a gated forward staging point").

**Outcome: 1 loss, 20 timeout, 79 win**

Previous century sweeps:
- 2026-09-09, commit 689584f: 0 loss, 20 timeout, 80 win
- 2026-09-06, commit b7fc612: 3 loss, 42 timeout, 55 win

Churn vs 689584f: 10 seeds flipped timeout->win (5, 7, 13, 24, 45, 63, 71, 80, 83, 94), 9 flipped win->timeout (6, 29, 30, 41, 54, 73, 84, 95, 99), seed 17 flipped timeout->loss. Avg win time 35.5 min (was 35.2). Within the bot's usual chaotic variance — no measurable aggregate change from the staging-rally commit.

The loss (seed 17): genuine, no JS errors. Brennus's army was destroyed mid-game and never rebuilt — army=6 vs enemyArmy=131 at t=35m, CC fell at ~38.5 min. Same seed was a timeout in the previous sweep.

Seed-17 dig (vs the 689584f run): the two games are event-identical through the t=30m snapshot — same early raid, same 68->27 army wipe at ~29m, which is therefore NOT staging's fault (the 149-strong wave made the gates refuse staging; the army fought at home in both runs). The runs diverge exactly at the first staging order (t=31.2m). Staged forward, the remnant bled 27->17 in a frontier denial fight (the home-rallied old run lost 1), then swat/engage orders chased raider squads 100-150 m from home while the second Roman wave closed (enemyNear 189m -> 39m in 2 min). When the wave hit, only 6 garrisoned vs 13 in the old run; the old run held the CC and rebuilt to pop 106 by t=38m, the new run lost the CC at ~38.5m. Root cause: the staging strength gates only gate the rally order — swat/deny/engage branches still pull the army beyond the staging envelope and override the retract (see docs/LESSONS_LEARNED.md 2026-09-10).

Verdict rules: `timeout` = 45-min in-game limit reached (kiln marks player 1 won regardless); `win`/`loss` = game ended before the limit; `errors` = ERROR/script-exception lines in stdout.log (a win with JS errors does not count). No job had JS errors, no AI-creation failures, no crashes (all exit_code 0).

| seed | result | game min | JS errors | artifacts |
|---|---|---|---|---|
| 1 | win | 29.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s1` |
| 2 | win | 36.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s2` |
| 3 | win | 36.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s3` |
| 4 | win | 28.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s4` |
| 5 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s5` |
| 6 | win | 33.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s6` |
| 7 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s7` |
| 8 | win | 38.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s8` |
| 9 | win | 29.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s9` |
| 10 | win | 30.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s10` |
| 11 | win | 43.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s11` |
| 12 | win | 40.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s12` |
| 13 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s13` |
| 14 | win | 35.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s14` |
| 15 | win | 41.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s15` |
| 16 | win | 40.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s16` |
| 17 | loss | 38.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s17` |
| 18 | win | 33.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s18` |
| 19 | win | 32.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s19` |
| 20 | win | 33.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s20` |
| 21 | win | 33.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s21` |
| 22 | win | 37.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s22` |
| 23 | win | 34.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s23` |
| 24 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s24` |
| 25 | win | 38.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s25` |
| 26 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s26` |
| 27 | win | 39.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s27` |
| 28 | win | 29.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s28` |
| 29 | win | 32.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s29` |
| 30 | win | 42.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s30` |
| 31 | win | 26.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s31` |
| 32 | win | 31.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s32` |
| 33 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s33` |
| 34 | win | 32.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s34` |
| 35 | win | 41.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s35` |
| 36 | win | 35.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s36` |
| 37 | win | 37.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s37` |
| 38 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s38` |
| 39 | win | 36.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s39` |
| 40 | win | 34.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s40` |
| 41 | win | 39.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s41` |
| 42 | win | 35.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s42` |
| 43 | win | 34.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s43` |
| 44 | win | 28.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s44` |
| 45 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s45` |
| 46 | win | 40.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s46` |
| 47 | win | 31.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s47` |
| 48 | win | 41.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s48` |
| 49 | win | 29.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s49` |
| 50 | win | 38.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s50` |
| 51 | win | 28.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s51` |
| 52 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s52` |
| 53 | win | 39.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s53` |
| 54 | win | 39.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s54` |
| 55 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s55` |
| 56 | win | 43.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s56` |
| 57 | win | 34.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s57` |
| 58 | win | 32.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s58` |
| 59 | win | 33.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s59` |
| 60 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s60` |
| 61 | win | 26.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s61` |
| 62 | win | 37.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s62` |
| 63 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s63` |
| 64 | win | 33.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s64` |
| 65 | win | 30.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s65` |
| 66 | win | 39.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s66` |
| 67 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s67` |
| 68 | win | 34.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s68` |
| 69 | win | 37.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s69` |
| 70 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s70` |
| 71 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s71` |
| 72 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s72` |
| 73 | win | 40.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s73` |
| 74 | win | 36.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s74` |
| 75 | win | 37.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s75` |
| 76 | win | 35.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s76` |
| 77 | win | 29.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s77` |
| 78 | win | 29.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s78` |
| 79 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s79` |
| 80 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s80` |
| 81 | win | 42.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s81` |
| 82 | win | 35.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s82` |
| 83 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s83` |
| 84 | win | 44.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s84` |
| 85 | win | 34.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s85` |
| 86 | win | 36.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s86` |
| 87 | win | 33.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s87` |
| 88 | win | 36.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s88` |
| 89 | win | 38.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s89` |
| 90 | win | 40.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s90` |
| 91 | win | 25.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s91` |
| 92 | win | 34.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s92` |
| 93 | win | 41.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s93` |
| 94 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s94` |
| 95 | win | 35.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s95` |
| 96 | win | 37.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s96` |
| 97 | win | 39.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s97` |
| 98 | win | 32.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s98` |
| 99 | win | 44.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s99` |
| 100 | win | 30.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-a612a00/artifacts/s100` |
