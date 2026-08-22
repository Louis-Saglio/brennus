# Goal 7-S — Boom on the steppe biome (2026-08-22)

Louis's side goal on top of goal 7 (the boom): optimize the boom on
`generic/steppe` — minimize the time to pop300 and city — while temperate
keeps the goal-7 bar (both ≤ 15.0 min).

## The metric (Louis)

**Max(pop300, city), minimized** — NOT both independently. Delaying pop300
to pull city in is explicitly acceptable when city is the slower one.

## Biome facts (from `docs/game_description/biomes/steppe.md`)

- Wood: the weakest wood economy of all biomes. "Trees" are steppe bushes
  at ~100 wood each (temperate: 200-600), ~900 bushes on mainland 192 →
  total wood ~90,000 vs ~260,000 temperate. 4 gatherers per bush.
- Huntables: horses (200 meat each — double the temperate deer), chickens
  (40). Horses flee FAST (faster than the cavalry — the deferred problem).
- Fruit: berry_01 (200) — same as temperate. No apple stragglers.
- Stone/metal: standard.

## Harness

- `tmp/goal7/run1-steppe.sh <seed> <tag> [limit-minutes=30]`: like the
  goal-7 runner but biome `generic/steppe` and the time-limit trigger is
  sed-extended to 30 in-game min (the 18 min cap is too short to measure
  the steppe boom: on seed 5 the bot never reaches city within it).
- Metric extraction: the same `[HARNESS] t=…m phase=phase_city_generic`
  and `population=300` lines as goal 7.

## Baseline (commit d1f4e09, 30 min cap, zero JS errors)

| seed | town | city | pop300 | max |
|------|------|------|--------|-----|
| 1 | 7.4 | 19.3 | 19.4 | 19.4 |
| 2 | 7.7 | 17.1 | 18.0 | 18.0 |
| 3 | 6.3 | 14.7 | 15.2 | 15.2 |
| 4 | 6.3 | 14.2 | 14.8 | 14.8 |
| 5 | 6.9 | never (30 m cap) | 19.4 | >30 |

Mean max 19.5 (seed 5 counted as 30). Storehouse churn: 10-24 builds and
7-16 destroys per game.

## Storehouse churn investigation (Louis's piste, 2026-08-22)

Louis: the bot builds storehouses in droves and destroys them — costly on
a wood-poor biome. Findings:

- The churn is real: 7-16 destroyed storehouses per game (destruction
  refunds nothing — each destroyed storehouse is 100 w sunk). A few are
  doomed at birth: built at the cutting-front centroid, dead in 18 s
  (s1: storehouse at 546,293 t=4.6m, destroyed t=4.9m).
- **Build-gate experiments (threshold 500/800/2000 wood within 40 m of
  the centroid), DISCARDED**: the gate is binary on these seeds (clumps
  are either ≥800 or <400). At 800: s2 18.0→15.7, s3 15.2→14.8, s5
  >30→21.0 (city finally reached!) but s1 19.4→20.2 and s4 14.8→19.8
  (+5.0: woodline service collapsed, dist 25→106 m, rate 76%→33%). The
  storehouses on the wood-rich seeds genuinely earn their keep; a static
  gate trades seeds. Reverted.
- **Trio reserve on wood storehouses (v11 applied to dropsites),
  DISCARDED**: s4 byte-identical, s5's trio still pinned at 19.4 m — the
  storehouses were not the pinner. Reverted.

**The real s5 city killer, found while instrumenting: the field stream.**
On s5 the wood stock sits at 28-93 for ~12 min while stone/metal pile up
(1202/1716 at t=18) — the field branch (exempt from every wood reserve by
design, v3/v5) builds at every 100 w window: 2→22 fields = ~2000 w eaten
before the trio ever sees the 300 w it needs (market). On temperate the
wood income outruns the fields; on steppe it does not. First lever of the
goal: make the field stream trio-aware / meat-aware on wood-poor biomes
(food on steppe should come from the abundant horses, not from grain).

## Status

Ongoing. Baseline pinned; first lever identified (fields vs trio wood).

## Lever 1 — trio-aware fields on wood-poor biomes (SHIPPED, 2026-08-22)

The field stream (exempt from every wood reserve by design, v3/v5) ate
every 100 w window on steppe before the trio ever saw its 300 w. Fix: a
`woodPoor` flag detected from the map data (no wood supply holds 200 —
steppe bushes are ~100) gates the field branch in town phase with the
trio pending: fields must leave `nextTrioWood()` untouched, exactly like
the houses. Village bootstrap fields untouched; wood-rich biomes keep the
old behavior (temperate runs byte-identical, gate never fires there).

Steppe results (30 min cap, zero JS errors):

| seed | baseline city/pop300 | gated city/pop300 | max delta |
|------|----------------------|-------------------|-----------|
| 1 | 19.3/19.4 | 16.1/20.3 | +0.9 |
| 2 | 17.1/18.0 | 14.6/18.4 | +0.4 |
| 3 | 14.7/15.2 | 15.4/16.3 | +1.1 |
| 4 | 14.2/14.8 | 13.1/15.1 | +0.3 |
| 5 | never/19.4 | 14.6/19.3 | -10.7 |

Mean max 19.5 → 17.9. City improved on ALL seeds (s5 from never to
14.6); pop300 slipped (+0.3 to +1.1) — the delayed grain now makes
pop300 the binding metric. Louis's accepted trade direction, but it
overshoots: the balance point lies in feeding the pop stream from meat
(the abundant steppe horses) instead of the delayed grain. Temperate
5-seed batch with the gate: byte-identical to baseline (14.4/14.9,
14.7/14.4, 14.1/13.4, 13.6/14.1, 14.1/13.3 — all ≤ 15.0). Run tags:
`stf-s1..5` (steppe), `stf-t1..5` (temperate, ungated variant — broke
the bar: s1 pop300 15.9, s2 city 15.1), `stw-t1..5` + `stw-s5`
(woodPoor-gated).

## Next lever

pop300 is food-bound on steppe after the gate: the civilians' meat path.
The cavalry's kills are collect-mode (cav delivers, rate 5.0, cap 20 —
10 trips per 200-meat horse) and civilians only take in-territory
carcasses within 40 m of a dropsite. Options: let the cav leave served
kills to the civilians (it currently collects them anyway — duplication),
or steer slower animals (chickens/sheep) toward dropsites on steppe.

## Lever 2 — wood storehouses leave the trio's wood on wood-poor biomes (SHIPPED)

The field gate alone left the wood-storehouse stream as the next
100 w eater: on steppe seed 5, 10 storehouses (8 woodlines + 1 mine)
went up between t=2.0 and 11.1m before the market could order (market
ordered 18.6m). The wood-storehouse branch now applies the same
trio reserve on woodPoor maps. Combined results (30 min cap, zero JS
errors; `stf` = field gate only, `sts` = both gates):

| seed | stf max | sts max | delta |
|------|---------|---------|-------|
| 1 | 20.3 | 19.6 | -0.7 |
| 2 | 18.4 | 18.0 | -0.4 |
| 3 | 16.3 | 15.9 | -0.4 |
| 4 | 15.1 | 15.1 | 0.0 |
| 5 | 19.3 | 19.4 | +0.1 |

Mean max 17.88 → 17.60 (baseline 19.5). Trio ordering unblocked on s5
(forge 8.3m, market 12.5m, tavern 12.8m vs market 18.6m before). City
now 13.1-15.1 on all seeds; pop300 (19.4-19.6 on s1/s5) is the binding
metric — the remaining gap is the food stream. Temperate with both
gates: byte-identical to baseline, bar held. Run tags: `sts-s1..5`,
`sts-t1..5`.

## Discarded lever — served-kill handoff to civilians

Probed (steppe seeds 1-5): let the cavalry leave collect-mode kills that
landed in territory near a dropsite to the civilian pool, plus far-side
positioning before the first attack to push kills toward the base.
Results mixed (s1/s5 better, s2/s3/s4 worse: pop300 18.4→22.0 on s2,
16.3→20.6 on s3), mean max 19.08 — worse than stf. Reverted. The
far-side positioning delays the kills and the served-radius pulls
civilians into 40 m walks; the horses stay out of civilian reach without
a steer (the deferred faster-horse problem).

## Lever 3 — direct-attack kill on wood-poor biomes (SHIPPED)

Louis's report: the cavalry has a hard time killing horses (faster than
it) near the dropsite. Speeds checked: horse flee ~9.4 m/s (walk 5.6 ×
1.67) vs cavalry walk 12.6 m/s — the cavalry IS faster; the problem is
the kill-shot approach's stop-and-go churn (move → arrive → stop → the
animal pulls away → move ...), which lets the horse stay ahead. Fix: on
woodPoor maps the kill branch attacks straight away — the attack pursuit
moves the cavalry continuously and closes the gap; the animal always
stops at its flee distance, where the kill lands.

Louis's worker-wall idea probed first (5 workers posted in a line between
the wounded horse and the dropsite, held via wallHold exemptions):
mechanical success (s5 in-territory horse kills 3 → 17) but a wash on
the metric (mean 17.66 vs 17.60) — s1/s3 improved, s2/s5 regressed (the
wall steals workers from the boom). Reverted; the direct attack alone
turned out to be the fix.

Steppe results (30 min cap, zero JS errors; `sts` = levers 1+2):

| seed | sts max | stk max | delta |
|------|---------|---------|-------|
| 1 | 19.6 | 20.2 | +0.6 |
| 2 | 18.0 | 16.6 | -1.4 |
| 3 | 15.9 | 14.9 | -1.0 |
| 4 | 15.1 | 15.1 | 0.0 |
| 5 | 19.4 | 17.8 | -1.6 |

Mean max 17.60 → 16.92 (baseline 19.5, target 16.5). s5's horse kills
land in territory again (13 vs 3). s1 is the new outlier (pop300 20.2).
Temperate: byte-identical (spot-checked seeds 1/3/5). Run tags:
`stw2-s1..5`, `stw3-s1/5` (wall, discarded), `stk-s1..5`, `stk-t1/3/5`.

## Lever 4 — ironaxes first on wood-poor biomes (SHIPPED)

On wood-poor maps the wood rate is the whole economy: the +25% wood tech
(gather_lumbering_ironaxes) jumps ahead of the grain-rate techs in the
research order. Landed at 8.7-10.0m instead of ~12-14m. Steppe results
(30 min cap, zero JS errors; `stk` = levers 1-3):

| seed | stk max | sti max | delta |
|------|---------|---------|-------|
| 1 | 20.2 | 20.0 | -0.2 |
| 2 | 16.6 | 16.4 | -0.2 |
| 3 | 14.9 | 15.0 | +0.1 |
| 4 | 15.1 | 15.4 | +0.3 |
| 5 | 17.8 | 17.7 | -0.1 |

Mean max 16.92 → 16.90. Temperate s1 byte-identical. Probed and discarded
this round: 4 concurrent field foundations on woodPoor (s1 20.2, s5 18.0 —
the extra builders cost more than the faster ramp); bootstrap meat guard
(wash: s1/s5 better, s3/s4 worse); trio-ordered gate release (no-op);
foundation-counting town-bank gate (no-op, the t=5m fallback dominates).
Run tags: `sti-s1..5`, `sti-t1`, `stf4-s1/5`, `stb-s1..5`, `sto-s1/5`,
`stbk-s1/5`.

## Discarded — extended field wood demand (2026-08-22)

s1's sprint field stream stalls when the wood stock hovers under 100 (ONE
field built in t=15-18 while wood sat at 78). Probing `fieldDemand` past
the bootstrap (houses leave the 100 w window): full demand gives s1
16.5/18.5 (max -1.5) but s5 15.4/20.6 (+2.9); half-target demand s1
14.3/18.1 but s5 still 20.6 — the house stream IS s5's pop engine, and
any demand pause throttles it. The s1/s5 asymmetry has no clean static
discriminator yet. Reverted; sti remains the shipped state.

## Lever 5 — field-stall wood demand on wood-poor biomes (SHIPPED)

s1's sprint field stream stalls when the wood stock hovers under 100
(ONE field built in t=15-18, wood at 78, the houses eat every 75 w
window) — the grain ramp never comes and pop300 lands at 20. Fix: detect
the stall directly (field count unchanged for 20 s while under half the
target) and set fieldDemand — the houses then leave the 100 w window,
exactly like the bootstrap demand. Steppe (30 min cap, zero JS errors;
`sti` = levers 1-4):

| seed | sti max | stst max | delta |
|------|---------|----------|-------|
| 1 | 20.0 | 19.7 | -0.3 |
| 2 | 16.4 | 16.4 | 0.0 |
| 3 | 15.0 | 15.0 | 0.0 |
| 4 | 15.4 | 15.2 | -0.2 |
| 5 | 17.7 | 17.7 | 0.0 |

Mean max 16.90 → 16.80. s2/s3/s5 byte-identical (the stall never fires
there — s5's house stream untouched). Temperate s1 byte-identical.
Discriminator notes: firing the demand at any deficit or before t=12
throttled s5 (pop300 20.6) — the stall detector is the safe form. Run
tags: `stfd-s1/5`, `stfd2-s1/5`, `stfd3-s1..5`, `stst-s1/5`.
