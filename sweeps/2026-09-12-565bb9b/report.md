# Sweep: seeds 1-200, standard settings

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-12 via kiln, bot at commit 565bb9b (war machine: full tech tree, fortress+assembly, champions/hero/carnyx, ram focus + march filter, bank leveling, dead-storehouse razing).

**Outcome: 3 losses, 8 timeouts, 189 win — 0 JS errors in 200 games**

Previous century sweeps: b041c34 (2026-09-11): 3 loss, 23 timeout, 174 win; 0db887a (2026-09-10): 1 loss, 9 timeout, 90 win (first hundred only).

Verdict rules: `timeout` = 45-min in-game limit reached (kiln marks player 1 won regardless); `win`/`loss` = game ended before the limit; `errors` = ERROR/script-exception lines in stdout.log (a win with JS errors does not count).

vs the b041c34 baseline, per seed: **15 timeouts converted to wins (13, 24, 52, 74, 104, 121, 134, 136, 139, 142, 151, 152, 155, 158, 174), zero regressions.** The 3 losses are the same documented hard maps (70, 138, 141 — Petra's raids grind the home CC while the army is too thin). Mean win time 32.5 min vs 33.2. The remaining timeouts: 47, 55, 88, 96, 111, 125, 148, 170.

Feature incidence across the 200 games (results.tsv columns):

| feature | games | total | notes |
|---|---|---|---|
| champions trained (stats) | 169 | 3065 | unlock_champion_infantry + every 3rd barracks batch |
| fortress built | 142 | 143 | for Will to Fight |
| assembly built | 159 | 173 | for heroes/carnyx |
| hero trained | 142 | 173 | chain Vercingetorix → Viridomarus → Brennus (s83 used 2) |
| carnyx trained | 140 | 375 | ~2.7 per game |
| Will to Fight researched | 35 | 35 | s121 at 42.3 |
| wonder ordered | 68 | 82 | s121 36.6, s83 34.9 |
| +20% pop tech researched | 23 | 23 | pop limit exceeded 300 in 4 games (83, 105, 119, 121) |
| war-machine barter deals | 185 | 2123 | food → scarcer ore |
| bank-leveling deals | 85 | 218 | food↔wood above a 5k gap |
| dead storehouses razed | 163 | 887 | ~4.4 per game, no wood collapse |
| corral built | 0 | 0 | removed |
| rams focusing a fortress/tower | 0 | 0 | trigger (fortress within 60 m of the raid CC) never occurred on these maps — the military-only march filter is the behavioral change that actually fires |

Stock-shape spot check: the 20k-food-vs-hundreds-wood pattern is gone where the leveling engages (probe s203 ended 10.0k/5.8k).
