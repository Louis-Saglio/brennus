# sweep200-market: market lot hold on scarcity + relaxed enemy rule (vs eab6f18)

Standard settings, seeds 1-200, paired against `2026-11-09-sweep200-outpost`
(eab6f18). Run 2026-11-09, `tools/run.sh -H thinkpad:4`, all 200 games ran.

Changes (placement.js, army.js):
- **Market lot hold**: until a market is ordered and once at most 2 empty
  lots still fit one, the nearest is held for the market alone (houses,
  fields and free-standing dropsites never take it).
- **Relaxed enemy rule**: after 2 min of market placement failures, only
  enemy structures that shoot (towers, fortresses, CCs) keep it 100 m away;
  other enemy structures block within 40 m (mobiles still 60 m).

| | eab6f18 | variant |
|---|---|---|
| verdicts | 196W / 2T / 2L | 196W / 2T / 2L |
| mean win time | 26.27 m | 26.01 m (paired both-won -0.26, t -1.38) |
| city median | 18.60 m | 18.50 m (paired -0.16, t -0.99) |
| unitsLost.Civilian | 8158 | 7011 (-5.7/game, t -2.02) |
| CCs lost | 13 | 8 |
| identical games | | 56/200 |

Target seeds: s29 city 42.0 -> 20.1 m, timeout -> win 32.8 m; s83 city
30.5 -> 16.5 m, win 35.1 -> 21.5 m. City later than 26 m or never: base
29 57 83 90 179, variant 57 90 177 179. The relaxed rule fired once (s87).
s177 win -> timeout: same economy to 13 m (pop 131/150 both), the first
wave went worse (army 39 -> 19 vs 39 -> 22, pop 89 vs 115) and the market
came later (city 28.6 vs 21.7) — layout chaos, no market mechanism.

Rejected first version (tmp sweep200-market): the hold from minute 0 in
every game — houses spilled 0.9 min earlier, pop at 10 m -1.2 (t -1.84),
191W/4T/5L; s80/s176/s177 lost their first wave with smaller armies.
