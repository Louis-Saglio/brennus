# Sweep: seeds 1-200, standard settings — war-machine spend order experiment

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-13 via kiln, bot at commit f2e9433.

Experiment (Louis): reverse the war-machine spend order from "forge tiers 1-2, Will to Fight, wonder, forge tier 3" to "full forge line through tier 3, Will to Fight, wonder". The forge line is exempt from the 1700-metal hold; the wonder's order, funding window and barter priority all wait for Will to Fight to be funded first.

**Outcome: 3 losses, 9 timeouts, 188 win — 0 JS errors in 200 games**

Baseline is the 565bb9b sweep one day earlier: 3 losses, 8 timeouts, 189 win. Verdict rules identical (see that report).

Verdict vs baseline: **188W/9T/3L against 189W/8T/3L — one flip, s135 win→timeout, zero conversions.** On the 188 paired wins: mean delta +0.03 min, median 0.00, 29 seeds >=1 min faster, 29 >=1 min slower. Mean win time 32.5 min, same as baseline. War-stage-on, expansion-on and first-raid medians are identical to the decimal across all 200 games (18.4 / 25.1 / 24.8 min) — the reorder does not touch the early or mid game. s135's whole-game 5-minute drift is chaos, not a systematic delay. The losses are the same 3 documented hard maps (70, 138, 141), the remaining timeouts the same set (47, 55, 88, 96, 111, 125, 148, 170) plus 135.

Feature incidence vs baseline:

| feature | 565bb9b | f2e9433 | notes |
|---|---|---|---|
| forge tier-3 techs researched | 0 | 171 games / 566 techs | the point of the change — they never fired before |
| Will to Fight researched | 35 | 3 | collapses behind the forge line's metal draw |
| wonder ordered | 68 | 56 | now waits for Will |
| +20% pop tech | 23 | 15 | follows the wonder |
| champions trained (stats) | 169 | 163 | small shared-income dip, no outcome effect |
| hero trained | 142 | 135 | same |
| fortress built | 142 | 134 | same |
| war-machine barter deals | 185 | 185 | unchanged |
| bank-leveling deals | 85 | 103 | |
| dead storehouses razed | 163 | 167 | |

Conclusion: **the new order is exactly neutral on wins and kill speed.** It converts a 1650-metal gate that filled in only 35/200 games into real tier-3 techs in 171/200 games, and the games that lost Will to Fight did not slow down (median -0.1 min on those 35 seeds). Attack/armor tech level is not the bottleneck in this matchup — neither order moves the needle. Kept on the strength of "researched techs beat hypothetical techs", not on evidence of improvement.
