# fix5 — Fix A + B + C on the 21 val1 seeds (regression check)

Variant: same code as fix4.

Result: 19 wins — all 17 true val1 baseline wins hold, plus 70 (W 37.3) and
352 (W 44.3, buzzer) flip from baseline losses. 52 defeat 31.9m and 320 capped
(both losses in the baseline too). Zero JS errors.

Note: 352's baseline "win" in val1 results.tsv was later found to be a
misclassification (val1 stats.json shows a defeat) — the 352 flip credited
here is genuine (fix5 stats: player 1 won, pop 291).
