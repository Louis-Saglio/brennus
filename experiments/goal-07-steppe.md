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
