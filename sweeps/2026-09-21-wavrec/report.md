# wavrec probe rounds: recmust3 loss-seed autopsy fixes — wave-inbound recall + waiver hold

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-21 via kiln (vps runner only, 2 slots; pc down — no full sweep). Bot: recmust3 + telemetry, wave-inbound early recall, pop-block waiver hold (docs/LESSONS_LEARNED.md 2026-09-21).

Three rounds:

- **wavrec1** (9 seeds): telemetry + wave-inbound recall only. 6W/2T/1L, 0 JS errors. s263/s267 loss->timeout (matches the d5d6ccd baseline); 6 win guards (221/279/353/361/264/357) held; s244 still lost (wave sighted at 174 m, ~4 s before the ring — LOS limit, recall cannot fire early enough).
- **wavrec2** (7 seeds): + pop-block waiver hold (no ramless raid while armyCount < enemyArmy). 7W/0T/0L, 0 JS errors. s244 loss->win (44.4m); s327 timeout->win; waiver guards 221/279/353/361 re-held (one "pop-blocked raid held" line each, relaunched 1-7 min later at enemy 17-67 and won anyway).
- **wavval** (15 seeds): validation — loss neighbors 243/245/246/262/265/266/268, sweep timeouts 215/230/316/356, race wins 340/352, waiver wins 206/234. 11W/4T/0L, 0 JS errors. The four timeouts were timeouts in recmust3 too; every win stayed a win.

Final-code verdicts (26 seeds): **21 win / 5 timeout / 0 loss, 0 JS errors**. s263/s267/s264/s357 come from wavrec1 (ran without the waiver gate; the gate never holds on their trajectories — no waiver raids on 263/267, waiver launches at 94-vs-89 and 109-vs-32 on 264/357 — so the final code is bit-identical there).

Changed vs the recmust3 sweep for the same seeds:

| seed | recmust3 | final | note |
|---|---|---|---|
| 244 | loss (33.0m) | win (44.4m) | waiver hold kept the army home; garrisoned 112 vs 121 at t=29.9, then razed 3 CCs |
| 263 | loss (43.0m) | timeout | wave recall fired t=24.4 (164 closing at 207 m), saved the 120-man raid army |
| 267 | loss (43.0m) | timeout | sortie wave-gate; survived the t=39.4 donation, held to the cap |
| 327 | timeout | win (29.1m) |  |

Two wavrec1 jobs (320/327) were killed runner-side mid-run (exit 124 at 109 s and 14 s, same wall-clock second; not the 1800 s budget) and rerun in wavrec2.

Verdict rules as in recmust3: `timeout` = 45-min in-game limit reached; `win`/`loss` = game ended before the limit.
