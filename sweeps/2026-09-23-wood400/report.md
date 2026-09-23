# wood400 sweep: seeds 0-400, standard settings, wood-system rewrite

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Bot: the wood storehouse + chopper assignment rewrite (gather-cycle cost model, saturation-triggered woodline placement, cluster districts, relocation-walk penalty).

**Outcome: 385 win / 14 timeout / 2 loss (96.0% win rate), 0 JS errors, 0 failed-AI, 0 missing HARNESS, all runner exit codes 0.** Win durations: min 20.9 / avg 28.2 / max 44.9 game-min.

**Wood (the point of the change):** wood@10min mean 5627 / median 5620 / p10 4989 / min 3727 / max 6912. Wood gathered total mean 36477 / median 34575.

## Provenance

- 401 seeds run 2026-09-23 via kiln (`pc` 14 slots + `vps` 2 slots, 0.28.0); submitted one batch per seed (`wood400-s<seed>`), all jobs done in ~85 wall minutes. Collector: `collect.py` (also extracts the bot's one-shot `t=10.0m gathered wood=` telemetry and end-game `resourcesGathered.wood`).

## Vs the 2026-09-21 s400 sweep (seeds 1-400, 29bfb48: 383W/17T/0L)

Shared seeds (400): +15 baseline timeouts -> wins, -12 baseline wins -> timeouts, -2 -> losses.

- Timeout->win (15): 2, 41, 66, 76, 152, 162, 170, 172, 215, 230, 267, 285, 316, 356, 373.
- Win->timeout (12): 1, 20, 52, 105, 171, 204, 264, 270, 317, 334, 335, 336.
- Win->loss (2): 7, 134 — both military defeats (Petra's 147-195 army), wood metrics healthy (late rates 58-83%).
- Timeout->timeout (2): 140, 263 (the documented hard seeds).

The 12 win->timeout seeds all have healthy wood metrics (wood10 4827-6173, late rates 41-74%, 0-1 wood warnings): near-cap / offense / kill-clock chaos, not wood failures. The wood economy is never the losing factor on them.

## Feature validation (probes before the sweep)

- Seed 70 (Louis's reporter): timeout -> win, total wood 22457 -> 32675-43613 across iterations. Root cause was the forest-density gate vetoing every storehouse site on the straggler-field map + drift-driven placement; the new cluster-floor district model builds on real forests instead.
- 20-seed validation batch: 18W/2T/0L, 0 JS errors; s70/s90/s373 timeout -> win.
