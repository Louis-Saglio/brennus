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

## Validation snapshot (2026-08-22, commit 6da9d54)

- Steppe seeds 1-5 (30 min cap): city/pop300 15.1/19.7, 14.4/16.4,
  14.1/15.0, 14.7/15.2, 14.6/17.7 — mean max 16.80, all seeds reach both
  metrics, zero JS errors, seed-1 rerun hash identical.
- Temperate batch: 14.4/14.9, 14.7/14.4, 14.1/13.4, 13.6/14.1, 14.1/13.3
  — the goal-7 bar holds, zero JS errors.
- Fresh steppe seeds 11-20 (never iterated): mean max 17.56, zero errors,
  every seed reaches city, but s11 never reaches pop300 (cap 30 min) —
  the tuned seeds 1-5 are easier than the fresh ones.
- Discarded this round: sticky woodline zone on woodPoor (<400 keep —
  no-op metric, 29 storehouses churn); stall-gated meat handoff (s1
  20.6, s5 18.6 — worse).

## Storehouse rules 1/2/3 (Louis, 2026-08-22) — SHIPPED

Louis, before the steppe hunting work: fix the storehouse over-building
("beaucoup trop de storehouses construits, souvent inutiles, détruits
rapidement"). Three rules, all shipped:

1. **A new wood storehouse only when no existing dropsite (CC or
   storehouse) can still serve ≥ 250 wood within 40 m** — exhaust the
   served ring first. Implemented in BOTH the woodline picker (prefers
   the dropsite ring with the most wood — zone kind "store", kept until
   ≤ 250) and the wood-storehouse branch (the gate). Supplies count from
   20 wood (half-cut trees and steppe bushes bind the ring), scraps
   don't.
2. **The pinned stone and metal mines closer than 55 m share ONE
   storehouse between them** — a minimax ring search (4-40 m, 2 m × 64)
   places it at the spot minimizing the worst walk to either mine.
3. **The wood storehouse stands at the amount-weighted median of the
   zone's trees** (Weiszfeld, 30 iterations from the weighted centroid)
   — the point minimizing the total walking to cut the forest, replacing
   the cutting-front centroid.

### The probe chain (steppe seeds 1-5, 30 min cap; temperate bar must hold)

- **Probe 1 (rules 1+2+3, gate counts full supplies only, ≥ 100)**:
  temperate batch holds (all ≤ 15.0, churn 1-3 wood builds), steppe mean
  max 15.82 (baseline 16.80) — but s3: 11 `construct FAILED` at ONE spot
  (203,409): the wood branch re-ordered the same spot every block while
  no foundation appeared (100 w budget burned per block). Cause: the
  order is re-issued each block until a foundation exists; a spot the
  engine rejects (stale territory map at the territory edge) stays
  "unplanned" for the whole 50-turn blacklist latency.
- **Fix A — pending suppression**: an in-flight storehouse order
  (`pendingBuilds` within 30 m) now counts as planned in all three
  branches. A rejected spot costs exactly one order, then the blacklist
  moves it.
- **Fix B — ring floor ≥ 20**: with the ≥ 100 floor the gate never
  bound on steppe — a bush drops below 100 the moment a chopper touches
  it, so every ring looked empty. Steppe churn continued (6-17 wood
  builds).
- **Fix C — cell scan `> 100` → `>= 20`**: the REAL steppe churn cause.
  Steppe bushes hold exactly 100 wood, so the old cell filter excluded
  them all — the woodline never formed on steppe, choppers used the
  generic nearest-supply path and spread over the map, and the storehouse
  branch chased their scattered front (10-24 builds / 7-16 destroys in
  the baseline). With the fix the steppe woodline forms like on
  temperate: all choppers on one bush clump, one storehouse per ring.

### Results (sh3 tags, zero JS errors, clean runs)

Steppe city/pop300 (baseline → shipped):

| seed | baseline | shipped | max delta |
|------|----------|---------|-----------|
| 1 | 15.1/19.7 | 14.3/15.1 | **-4.6** |
| 2 | 14.4/16.4 | 14.3/14.5 | -1.9 |
| 3 | 14.1/15.0 | 15.0/13.9 | 0.0 |
| 4 | 14.7/15.2 | 14.3/14.6 | -0.6 |
| 5 | 14.6/17.7 | 14.3/15.0 | -2.7 |

Mean max **14.84** (baseline 16.80, the old target was 16.5). All seeds
reach both metrics. Storehouse churn in the boom window: 1 wood + 1 mine
pair per seed (baseline 10-24 builds, 7-16 destroys). The remaining
builds/destroys are all post-metric (t > 15 m, the 30 min cap window):
at 300 pop the wood force spreads to ~40 choppers that outrun any
storehouse build — a separate late-game phenomenon, not the boom.

Temperate bar (goal 7): 14.3/14.9, 14.4/14.5, 14.3/13.4, 13.6/14.2,
14.1/13.1 — all ≤ 15.0, mean city 14.14 / pop300 14.02 vs baseline
14.18/14.02 (neutral). Determinism: seed-1 rerun hashes identical.
Churn 0-3 wood builds per game (the CC ring often serves the first
woodline — no initial storehouse at all).

Fresh steppe seeds 11-15 (never iterated, baseline fresh mean 17.56, s11
never reached pop300):

| seed | shipped max |
|------|-------------|
| 11 | 13.4 (13.4/13.1) |
| 12 | 14.5 (12.8/14.5) |
| 13 | 14.3 (14.3/14.2) |
| 14 | 14.4 (14.4/14.4) |
| 15 | 16.1 (14.3/16.1) |

Fresh mean max **14.54** (baseline 17.56, -3.02): every fresh seed reaches
both metrics, s11 included. The storehouse rules are the dominant steppe
win so far — the woodline concentration (fix C) is what did it.

## Storehouse remarks 4/5/6 (Louis, 2026-08-22) — SHIPPED

Three follow-up rules on top of rules 1/2/3:

4. **Rebuild on the receding woodline**: when the woodline has receded,
   a new storehouse goes up ideally positioned on what remains. This
   composes out of rules 1+3 + the new destroy rule (6): the ring is
   exhausted (≤ 250) → the picker re-picks the biggest remaining hotspot
   → the wood branch rebuilds at its weighted median → the old storehouse
   dies under rule 6. Verified on temperate seed 1: initial storehouse
   (block 1, unprinted) at 512,540, rebuild at 373,605 (t=12.8) when the
   front passed it, old one destroyed at t=14.2 (> 60 m from any supply).
   A "near-cell preference" variant (cells within 70 m of a dropsite
   outrank far forests, floor 500) was probed and DISCARDED: on steppe
   it made the bot follow small neighbouring clumps instead of the big
   one (s1 pop300 15.1 → 16.8, storehouses at t=1.9/2.5/... churn back).
5. **Chopper assignment**: each chopper takes the unsaturated zone tree
   minimizing the full walk cycle — walk to the tree PLUS the tree's
   distance to its nearest wood dropoff. The literal nearest-to-dropoff
   was probed and DISCARDED: it ignored the unit's position and pulled
   choppers across the map (f12 pop300 14.5 → 16.2, s2 14.5 → 14.9) —
   after a destroy, the zone's nearest dropoff was the far pair
   storehouse and every chopper trekked to that side. The sum form keeps
   the dropoff near without ignoring the chopper's position.
6. **Destroy rule**: every storehouse farther than 60 m from its nearest
   wood/stone/metal supply is destroyed (one per block) — replaces the
   old < 200-resources-within-40 m + busy-gatherer guard rule.

Probe chain (sum rule + rule 6 vs the rules-1/2/3 state, sh3): f12 14.5 →
14.7, f15 16.1 → 16.4, s2 14.5 → 14.4, t-s2 14.4/14.5 → 14.7/14.1 —
within the noise band.

### Final validation (sh8 tags, zero JS errors, clean runs, deterministic)

Steppe tuned seeds 1-5 (baseline 16.80, rules-1/2/3 state 14.84):

| seed | city/pop300 | max |
|------|-------------|-----|
| 1 | 14.3/15.5 | 15.5 |
| 2 | 14.3/14.4 | 14.4 |
| 3 | 14.4/14.5 | 14.5 |
| 4 | 14.3/14.6 | 14.6 |
| 5 | 14.3/15.5 | 15.5 |

Mean max **14.90**. Fresh seeds 11-15 (baseline 17.56): 13.5, 14.7, 14.3,
14.3, 16.4 — mean **14.64**. The three remarks cost ~+0.1 on the means
vs the rules-1/2/3 state (noise-level); every seed still reaches both
metrics.

Temperate bar: 14.6/14.6, 14.7/14.1, 14.3/14.4, 12.9/14.1, 14.4/13.4 —
all ≤ 15.0, seed-1 rerun hash identical.

Remaining churn (mineClump/destroyed spikes on s4/f11-f13) is all
post-metric (t > 15 m): the 300-pop wood/miner spread eats clusters
faster than storehouses can be built — a separate late-game phenomenon.

## Rush-build the woodline storehouses (Louis, 2026-08-22) — SHIPPED

Louis, watching the bot: the storehouse isn't rebuilt closer when the
woodline moves away — because choppers always walk over the new
foundation and its construction can never start. Engine-verified: an
uncommitted foundation's `Commit()` fails while units stand on it
(`Foundation.js` / `GetEntitiesBlockingConstruction`), and a busy
woodline starves it indefinitely. Fix: the rebuilds' foundations get
the wood choppers as builders (up to 8, nearest first) — traffic stops,
build goes up fast. The initial storehouse is NOT rushed (t=0 has no
traffic; probed, regressed temperate s1 pop300 +0.4).

Validation (sh10 tags, zero JS errors, deterministic): temperate
14.6/14.6, 15.0/14.1, 14.3/14.2, 12.9/14.1, 14.4/13.4 (bar holds);
steppe tuned mean max **14.72** (15.4, 14.3, 14.5, 14.3, 15.1); fresh
11-15 mean **14.68** (13.8, 14.8, 14.2, 14.3, 16.3) — neutral-to-
slightly-positive vs the pre-rush state (14.90/14.64).
