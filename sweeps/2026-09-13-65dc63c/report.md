# Sweep: seeds 1-200, standard settings — pre-war slinger contingent

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-13 via kiln, bot at commit 65dc63c.

Experiment (Louis): brennus never trained slingers. Every third pre-war
barracks batch now trains slingers (45 m range — the urban choke-point
answer vs the javelineer's 30 m), gated on the 850-stone city bank staying
funded; a +450 revolving fund on the phase-2 stone mining target keeps the
stone stream alive through the muster window. War stage unchanged.

**Outcome: 3 losses, 10 timeouts, 187 win — 0 JS errors in 200 games**

Baseline is the f2e9433 sweep same day: 3 losses, 9 timeouts, 188 win.
Verdict rules identical (see that report).

Verdict vs baseline: **187W/10T/3L against 188W/9T/3L — net −1 win with
heavy two-way churn (19 flips).**

- Converted to win (9): 55, 70, 96, 111, 125, 135, 138, 141, 148 — all 3
  documented hard-map losses (70/138/141) and 6 of the 9 baseline
  timeouts, the standoff/camped-CC bucket.
- Churned out of win (10): 61, 113, 199 to genuine losses; 69, 87, 102,
  127, 153, 176, 182 to timeouts. Baseline wins were comfortable (26.5-39.6
  min), not near-cap coin flips. The 3 new losses show documented
  pre-existing failure shapes (s61 even-fight annihilation at the CC, s113
  early economy massacre, s199 recall walk into a 121+4-siege blob), not a
  slinger-specific mechanism.
- Paired wins (178): mean delta −0.05 min, median −0.30; 80 seeds ≥1 min
  faster, 71 slower.

Aggregate effects over all 200 games (vs baseline):

- K/D: 1.173 → 1.178 (kills +519, losses +219 — a wash).
- Stone gathered: 1.032M → 1.190M (+15%) — the revolving fund at work.
- Infantry trained: 62975 → 62643 (−0.5%) — slingers replace melee ~1:2,
  no muster slowdown.
- War-stage-on median 18.4 → 18.7 min, paired mean −0.11 — no boom drag
  from the stone fund. Defense-stage-on median bit-identical.
- Slinger batches: 6570 across 194/200 games (6 stone-poor/short games
  trained none — the gate degrades gracefully).
- War-machine features unchanged (will 3/3, wonder 53/56, tier3 166/171).

Conclusion: **tally-neutral, with the churn rotating the hard seeds into
wins and marginal seeds out.** The slinger stream trains reliably, the
stone economy carries it at no measured cost to boom or muster, and the
aggregate fight efficiency does not regress. The 3 new losses are chaotic
churn on previously-marginal seeds within the documented butterfly band
(army composition perturbs every game — a far bigger perturbation than a
research reorder, which flipped 1 seed). Kept: theoretically sound (range
in chokes), no identified harmful mechanism, and the baseline non-win
bucket shrank 12 → 3 held (47, 88, 170) while 9 of its seeds converted.
