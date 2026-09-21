# s400 sweep: seeds 1-400, standard settings, wavrec bot at HEAD 29bfb48

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Bot at commit 29bfb48 (recovery muster + war surge + wave-inbound early recall + pop-block waiver hold).

**Outcome: 383 win / 17 timeout / 0 loss** (95.8% win rate, zero defeats), 0 JS errors, 0 failed-AI, 0 missing HARNESS, all runner exit codes 0. Win durations: min 19.7 / avg 27.8 / max 44.4 game-min.

Timeout seeds (cap reached, no defeat): 2, 41, 66, 76, 140, 152, 162, 170, 172, 215, 230, 263, 267, 285, 316, 356, 373.

## Provenance

- 374 seeds run 2026-09-21 via kiln (`pc` 14 slots + `vps` 2 slots, both canary_ok, 0.28.0); submitted one batch per seed (`w400-s<seed>`), all jobs done in ~75 wall minutes.
- 26 seeds reused from `2026-09-21-wavrec` (same commit, no bot change since): 206, 215, 221, 230, 234, 243-246, 262-268, 279, 316, 320, 327, 340, 352, 353, 356, 357, 361. Four of them (263, 264, 267, 357) ran there without the waiver gate; that report's bit-identical argument stands (the gate never held on their trajectories).
- Note: wavrec's `results.tsv` reads 20W/6T for its 26 seeds; its report.md's "21W/5T" was a miscount. The tsv is the ground truth used here.

## Vs the 2026-09-17 baseline (d5d6ccd, seeds 201-400)

Baseline 201-400: 187W / 9T / 4L. This sweep on the same range: **192W / 8T / 0L**. All four baseline losses are gone (279 win; 316, 356, 373 timeout). Changed seeds:

| seed | baseline | this sweep |
|---|---|---|
| 279 | loss (31.0m) | win (39.4m) |
| 285 | win (44.5m) | timeout (45.0m) |
| 316 | loss (35.0m) | timeout (45.0m) |
| 320 | timeout (45.0m) | win (43.0m) |
| 340 | timeout (45.0m) | win (39.2m) |
| 352 | timeout (45.0m) | win (30.0m) |
| 356 | loss (36.4m) | timeout (45.0m) |
| 372 | timeout (45.0m) | win (43.0m) |
| 373 | loss (43.1m) | timeout (45.0m) |
| 387 | timeout (45.0m) | win (42.3m) |

Vs recmust3 (2026-09-20, seeds 201-361: 153W/5T/3L): the same range now reads 154W/7T/0L — its three losses (244, 263, 267) are win/timeout/timeout and 327 flipped timeout->win, at the cost of 285 flipping win (44.5m)->timeout, a near-cap coin-flip.

Verdict rules as before: `timeout` = 45-min in-game limit reached; `win`/`loss` = game ended before the limit. Per-seed data in `results.tsv`; per-seed logs under `artifacts/s<seed>/` (gitignored).
