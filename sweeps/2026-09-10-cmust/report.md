# Century sweep 3 (muster): seeds 1-100, standard settings

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-10 via kiln, bot at commit 3b9f55e (raid early-warning + pre-battle role-layered muster line, incl. m4 anti-flap).

**Outcome: 3 loss, 34 timeout, 63 win**

Previous century sweep (2026-09-09, commit 689584f, `sweeps/2026-09-09-689584f`): **0 loss, 20 timeout, 80 win**. The muster change regresses outcomes at century scale: -17 wins, +14 timeouts, +3 losses. It contradicts the 15-seed validation (`sweeps/2026-09-10-muster`, 14W/1TO), which was a false positive — see notes below.

Verdict rules: `timeout` = 45-min in-game limit reached (kiln marks player 1 won regardless); `win`/`loss` = game ended before the limit; `errors` = ERROR/script-exception lines in stdout.log (a win with JS errors does not count).

| seed | result | game min | JS errors | artifacts |
|---|---|---|---|---|
| 1 | win | 40.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s1` |
| 2 | win | 37.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s2` |
| 3 | win | 35.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s3` |
| 4 | win | 32.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s4` |
| 5 | win | 34.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s5` |
| 6 | win | 36.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s6` |
| 7 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s7` |
| 8 | win | 43.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s8` |
| 9 | win | 35.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s9` |
| 10 | win | 29.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s10` |
| 11 | win | 41.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s11` |
| 12 | win | 31.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s12` |
| 13 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s13` |
| 14 | win | 33.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s14` |
| 15 | win | 34.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s15` |
| 16 | win | 28.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s16` |
| 17 | loss | 41.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s17` |
| 18 | win | 36.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s18` |
| 19 | win | 38.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s19` |
| 20 | win | 39.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s20` |
| 21 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s21` |
| 22 | win | 28.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s22` |
| 23 | win | 42.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s23` |
| 24 | win | 29.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s24` |
| 25 | win | 42.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s25` |
| 26 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s26` |
| 27 | win | 44.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s27` |
| 28 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s28` |
| 29 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s29` |
| 30 | loss | 40.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s30` |
| 31 | win | 37.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s31` |
| 32 | win | 39.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s32` |
| 33 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s33` |
| 34 | loss | 41.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s34` |
| 35 | win | 44.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s35` |
| 36 | win | 37.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s36` |
| 37 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s37` |
| 38 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s38` |
| 39 | win | 37.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s39` |
| 40 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s40` |
| 41 | win | 36.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s41` |
| 42 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s42` |
| 43 | win | 35.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s43` |
| 44 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s44` |
| 45 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s45` |
| 46 | win | 34.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s46` |
| 47 | win | 39.1 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s47` |
| 48 | win | 30.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s48` |
| 49 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s49` |
| 50 | win | 40.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s50` |
| 51 | win | 37.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s51` |
| 52 | win | 37.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s52` |
| 53 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s53` |
| 54 | win | 30.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s54` |
| 55 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s55` |
| 56 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s56` |
| 57 | win | 27.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s57` |
| 58 | win | 28.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s58` |
| 59 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s59` |
| 60 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s60` |
| 61 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s61` |
| 62 | win | 37.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s62` |
| 63 | win | 40.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s63` |
| 64 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s64` |
| 65 | win | 35.2 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s65` |
| 66 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s66` |
| 67 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s67` |
| 68 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s68` |
| 69 | win | 40.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s69` |
| 70 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s70` |
| 71 | win | 40.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s71` |
| 72 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s72` |
| 73 | win | 39.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s73` |
| 74 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s74` |
| 75 | win | 32.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s75` |
| 76 | win | 40.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s76` |
| 77 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s77` |
| 78 | win | 31.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s78` |
| 79 | win | 29.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s79` |
| 80 | win | 40.4 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s80` |
| 81 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s81` |
| 82 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s82` |
| 83 | win | 38.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s83` |
| 84 | win | 39.9 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s84` |
| 85 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s85` |
| 86 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s86` |
| 87 | win | 40.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s87` |
| 88 | win | 42.6 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s88` |
| 89 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s89` |
| 90 | win | 39.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s90` |
| 91 | win | 43.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s91` |
| 92 | win | 40.7 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s92` |
| 93 | win | 40.5 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s93` |
| 94 | timeout | 45.0 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s94` |
| 95 | win | 36.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s95` |
| 96 | win | 44.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s96` |
| 97 | win | 30.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s97` |
| 98 | win | 43.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s98` |
| 99 | win | 43.3 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s99` |
| 100 | win | 30.8 |  | `/home/ubuntu/brennus/sweeps/2026-09-10-cmust/artifacts/s100` |

## Conversions vs 689584f

- timeout → win (9): s6, s41, s52, s54, s73, s79, s84, s95, s99
- timeout → loss (2): s17 (41.4m, KD 2.63), s30 (40.4m, KD 1.71)
- win → timeout (25): s7, s13, s21, s28, s37, s40, s42, s44, s45, s49, s53, s56, s59, s61, s64, s66, s68, s74, s77, s81, s82, s85, s86, s89, s94
- win → loss (1): s34 (41.1m, KD 0.87 — outfought)

## Military stats (aggregate, 100 seeds)

| metric | 689584f baseline | 3b9f55e muster |
|---|---|---|
| mil kills / losses (KD) | 36629 / 24700 (1.48) | 42149 / 26841 (1.57) |
| KD on wins only | 1.51 | 1.64 |
| kills per game-min | 9.86 | 10.57 (+7%) |
| mil losses per game-min | 6.65 | 6.73 (+1%) |
| worker losses per game-min | 8.46 | 9.54 (+13%) |
| avg win duration | 35.2 min | 37.0 min |

The army does fight slightly better (more kills/min, better KD), but the
improvement does not convert into wins: victories come later, and 26 net
games slip past the 45-min cap or are lost outright.

## Why the 15-seed validation misled

- Its 15 seeds were probe-selected (chosen because they showed the
  arrow-bleed problem) — a biased sample. On those same 15 seeds this
  century gives 10W/3TO/2L, not the validation's 14W/1TO.
- The m4 anti-flap fix was validated on only 3 seeds (s57/s63/s90). The
  other 12 seeds ran the pre-m4 code in validation; under m4 they degrade
  (s17 win→loss, s30 win→loss, s33 win→TO, s42 win→TO, slower wins on
  s1/s2/s3/s9/s20/s50). m4 (`musterHoldUntil` re-arming per detection) is
  the prime suspect for the regression, not the muster line itself.
- Determinism across kiln runners confirmed: the 3 seeds validated at
  exactly the m4 code reproduce bit-identically here (s57 27.0m, s63 40.9m,
  s90 39.0m). Same code + same seed = identical game.

All 100 runs: 0 JS errors, exit code 0.
