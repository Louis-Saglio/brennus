# sweep200-outpost: no far-army engage at an outpost CC (vs 8275472)

Same standard settings and seeds 1-200 as `2026-11-09-sweep200-8275472`
(the baseline, same parent commit). Variant: `farRinged` in defense.js
applies only when the threatened CC is home. Run 2026-11-09,
`tools/run.sh -H thinkpad:4`, mod content hash 7425e6a627352428; seeds 31
and 102 lost to a thinkpad ssh timeout and rerun locally from the batch's
mod snapshot (same hash).

| | baseline 8275472 | variant |
|---|---|---|
| verdicts | 195W / 2T / 3L | **196W / 2T / 2L** |
| mean win time | 26.41 m | 26.27 m (paired, both won: -0.18 m, t -1.26) |
| city median / pop 300 median | 18.65 / 22.80 m | 18.60 / 22.75 m |
| rapid garrison<->engage flips | 428 (377 outpost, 48 home) | **83 (45 outpost, 36 home)** |
| games with >= 4 flips | 22 | 2 |
| units lost (sum) | 33692 | 32490 (-6/game, t -1.60) |
| unitsLost.Civilian (sum) | 7653 | 8158 (+2.5/game, t 1.51; s29 alone +244) |
| CCs lost | 16 in 12 games | 13 in 12 games |

161/200 games are bit-identical (equal stats hash); 38 of the 39 changed
games had an outpost-CC threat in the baseline — the change only touched
that path.

Verdict changes: s159 loss -> win 32.3 m (army no longer bled 98 -> 12 at
the annex), s194 timeout -> win 34.0 m, s29 win 33.6 -> timeout. s29: the
annex fight went better (79 -> 94, then -49 for -74), but the market found
no spot for 24 min ("no placement for market", 26 of 68 spots rejected
for nearby enemies — Petra camping and founding fortresses by the free
lots), city at 42.0 vs 21.7 m. That placement weakness exists in 29
games of both runs; not caused by the defense change.

On the 22 baseline flip-heavy seeds: 18W -> 19W, mean game length
34.1 -> 32.2 m, flips 359 -> 25.

Remaining non-wins: s90 (9 soldiers vs a 12-min wave, no annex), s179
(earliest wave, 11 m), s64 (timeout, residual flips at the 15 % band
edge: army 69 vs 60 x 1.15), s29 (market placement).
