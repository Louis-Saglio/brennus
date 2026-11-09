# sweep200: baseline of 8275472 (annex CC on), seeds 1-200

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive),
mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game
limit, seed == aiseed. Run 2026-11-09 with `tools/run.sh -H thinkpad:4`
(12 local + 4 thinkpad slots), mod content hash 2d7c1c935ec32543.
seed130 was lost to an ssh timeout to the thinkpad mid-batch and rerun
locally from the batch's mod snapshot (same content hash). Per-game
table: `results.tsv` (`tools/analyze.py`).

## Results

| | |
|---|---|
| verdicts | **195 win / 2 timeout / 3 loss**, 0 JS errors, 0 failed AI, 0 nonzero exit |
| win time | mean 26.4 m, median 25.0, p10 22.2, p90 32.3 (20.2-43.1) |
| city phase | median 18.6 m (p10 17.1, p90 21.7); never on s90, s179 |
| pop 300 | reached on 186/200, median 22.8 m |
| wood at 10 m | median 5403 |
| first Petra contact (<120 m from home) | median ~14.5 m; 39 games before 13.5 m (36 won) |
| annex CC | ordered on 198, built on 190 (order median 13.5 m, built 15.2 m); 87 orders took the least-exposed fallback (no candidate with exposure <= 0) |
| CCs lost | 12 games (8 of them wins) |
| unitsLost.Civilian | total 7653, median 26.5 per game (wins: mean 35.7) |
| throughput | 200 games in 29 min wall; per game median 120 s; 65 turns/s local, 57 thinkpad (16 matches in parallel) |

## Non-wins

| seed | result | mechanism |
|---|---|---|
| 90 | loss 24.9 m | no annex (no buildable lattice node); only 9 soldiers at pop 173 when a 60-man wave arrived at 12.4 m; pop 173 -> 97 in 2 min, home CC lost |
| 159 | loss 37.3 m | wave hit the annex (100,217) at 17.6 m, army 98 vs 91: 11 garrison<->engage flips, army 98 -> 12 for 57 kills; rebuilt to 208 pop, second wave of 120+ at 28 m finished it |
| 179 | loss 42.5 m | earliest contact of the batch (11.1 m, 57 vs 25): pop 85 -> 33, never recovered (city phase never reached) |
| 64 | timeout | exposed annex (+86 m, fallback); 41 rapid flips at the outpost, recurring waves keep pop 50-100 |
| 194 | timeout | contested exposed annex (+148 m, 59 soldiers seen); 38 rapid flips at the outpost (army 92 -> 42 at 20.6 m) |

## Main finding: decision churn at the outpost CC

`[THREATDEC]` alternates garrison <-> engage within 0.15 min (≈ one
armyCmd cycle) 428 times across the batch, **377 of them while defending
an outpost CC** (last shelter line "outpost"), 48 at home. Games with ≥ 4
such flips: 22, of which 4 non-wins (18 % vs 1/178 elsewhere; Fisher
one-sided p = 0.0005); their wins are also slower (mean 32.2 vs 25.8 m).

Likely loop (defense.js ~331-343): outnumbered at the outpost -> garrison
branch, the overflow falls back to home (> 200 m) -> next cycle the mean
responder distance to the threatened CC exceeds 120 m, so `farRinged`
fires -> engage branch marches them back -> within 120 m again ->
garrison -> fall back… The 15 % superiority band does not cover this
because the flip is driven by `respDist`, not by the army/threat ratio.
It is a side effect of the outpost fall-back added in 8275472.

Other notes: 87/198 annex orders found no non-exposed candidate (the
fallback picks the least exposed, up to +148 m); exposed-annex games
won 85/87 and safe ones 109/111, so exposure alone is not what loses.
Early waves alone are survivable (36/39 early-contact games won).
