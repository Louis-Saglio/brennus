# Muster sweep: raid early-warning + pre-battle formation, seeds 1-90 subset (15)

Standard settings (Brennus gaul vs Petra rome, both diff 3 aggressive, mainland
192, temperate, circle, conquest_civic_centers, 45 min in-game limit,
seed == aiseed). Run on 2026-09-10 via kiln. Baseline: the century sweep at
689584f (`sweeps/2026-09-09-689584f`), same seeds.

Change under test: `detectWave` (a cluster of 8+ enemy soldiers/siege within
400 m of an own CC = incoming raid) recalls the gatherers and forms the army
at the threatened CC BEFORE contact — melee in front, healers behind, ranged
at the back, defensive stance — and the serious-branch engage attack-moves
ranged 20 m short of the threat centroid and holds healers 15 m back.

Rounds: m1 = formation line 55 m ahead of the CC (3 probe + 12 validation
seeds). m2 = line pulled to 42 m (musterMeleeDist/HealerDist/RangedDist
42/34/26) after m1 regressed the arrow-bleed seeds. m3 = first anti-flap
attempt (broken: hold timestamp lived on the replaced wave object; run
bit-identical to m2, kept as proof). m4 = anti-flap fixed (`musterHoldUntil`
bot state, re-arms per detection, 50-turn bridge), 3 re-run seeds.

Verdict rules as in the century sweep: `TO` = 45-min limit reached; KD =
military units killed/lost (Infantry+Cavalry+Champion+Hero, workers excluded);
wL = workers lost. All runs 0 JS errors.

| seed | baseline | final (m2, m4 for s57/s63/s90) |
|---|---|---|
| 1 | win 26.4m KD 2.34 wL 164 | win 33.0m KD 2.64 wL 230 |
| 2 | win 34.4m KD 0.96 wL 391 | win 33.1m KD 1.97 wL 308 |
| 3 | win 33.8m KD 1.43 wL 273 | win 33.4m KD 1.34 wL 333 |
| 6 | TO 45.0m KD 1.52 wL 583 | win 38.9m KD 1.74 wL 402 |
| 9 | win 32.1m KD 3.26 wL 108 | win 33.9m KD 1.82 wL 236 |
| 13 | win 27.6m KD 1.79 wL 148 | TO 45.0m KD 2.13 wL 344 |
| 17 | TO 45.0m KD 3.08 wL 313 | win 41.5m KD 2.19 wL 257 |
| 20 | win 33.0m KD 2.07 wL 164 | win 37.0m KD 1.59 wL 271 |
| 30 | TO 45.0m KD 1.49 wL 566 | win 41.0m KD 2.00 wL 332 |
| 33 | TO 45.0m KD 1.38 wL 518 | win 44.7m KD 0.91 wL 619 |
| 42 | win 35.0m KD 1.18 wL 404 | win 37.5m KD 1.49 wL 313 |
| 50 | win 42.5m KD 1.25 wL 452 | win 41.5m KD 2.28 wL 329 |
| 57 | win 34.3m KD 2.26 wL 195 | win 27.0m KD 2.07 wL 212 |
| 63 | win 43.6m KD 1.02 wL 531 | win 40.9m KD 1.96 wL 395 |
| 90 | win 30.9m KD 1.28 wL 306 | win 39.0m KD 1.47 wL 412 |

**Totals: baseline 11W/4TO, milK/D 5794/3901 = 1.49, workerLost 5116 →
final 14W/1TO, milK/D 5837/3296 = 1.77, workerLost 4993.**

TO → win: s6, s17, s30, s33. win → TO: s13. 0 losses both sides. Soldier
losses -16%, kills +1%. Worker losses roughly unchanged (4993 vs 5116): they
drop hard on the leaky-defense seeds (s6 -31%, s30 -41%, s63 -26%) and rise
on seeds whose baseline defense was already tight.

m1 (55 m line) on the same 15 seeds: 13W/2TO, KD 1.46 — pulling the line to
42 m recovered the CC/tower arrow umbrella (60 m range) and is worth
+0.3 aggregate KD.

Artifacts: `m1/s<N>/`, `m2/s<N>/`, `m3/s90/`, `m4/s<N>/` under this directory.
