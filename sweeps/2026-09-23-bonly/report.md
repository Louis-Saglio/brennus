# bonly — Fix B only, full validation (38-seed surface)

Variant: Fix B (farRinged muster-engage) alone, vs the chk baseline
(6fa2ab9). Seeds: the 17-seed timeout set + the 21 val1 seeds (32 run here;
162/356/372/170/140/215 covered by fix10).

Result: **zero regressions, 5 bonus flips.**
- All 8 chk-win seeds hold: 41 W 44.3, 162 W 35.5, 230 W 37, 267 W 44.6,
  285 W 34, 316 W 36.3, 356 W 36.6, 373 W 44.5.
- Bonus flips (timeout in chk → win): 2 W 29.3, 66 W 33.4, 76 W 44.97
  (buzzer, 13492 turns), 152 W 34, 172 W 33.6.
- Unchanged timeouts (baseline-consistent): 140, 170, 215, 263.
- val1: all 17 true baseline wins hold (see below); 52/70/320 capped as in
  baseline; 352 defeat 39.8m — NOT a regression: the val1 results.tsv
  "352 win" was a misclassification (val1 stats.json shows player 1 defeated,
  identical game to bonly's). 352 was a defeat in the chk baseline; A+B+C
  (fix5) had flipped it to a genuine win, a flip not preserved here.
- Zero JS errors everywhere.

Note: the val1 baseline audit re-classified all 21 games strictly
(time-limit + CC kills / Petra defeated): only 352 was misclassified.
