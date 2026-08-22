# LESSONS_LEARNED.md

Things learned while developing the bot, so they are not investigated again
and mistakes are not repeated. Short, dated, factual entries — newest first.

## 2026-08-22 — Goal 8: expansion mechanics and the resource ceiling (verified in-game)

- **Population is hard-capped at 300** (`Player.GetPopulationLimit()` =
  `min(maxPop, Σ building bonuses)`): the CC's +20 bonus only counts
  UNDER the cap — extra CCs never raise a 300-pop game. Everything past
  the boom must be planned on exactly 300 pop.
- **Map supply census (mainland 192 temperate, seeds 1-5)**: ~27-29k
  stone (large mines 5000 × ~4, small 1000) and ~39-43k metal total.
  `getResourceSupplies()` at init is full-information and reliable for
  this. The 50000-stockpile bar of goal 8 therefore exceeds the map's
  total stone — not tunable by play.
- **Barter is price-degrading** (`Barter.js`): each deal drifts the sold
  price −2%×gained/100 and the bought +2%×gained/100 (caps ±89), restore
  0.5 per 5 s. A 500-deal every block hammers the sold resource to 1:199
  within minutes (measured: 50.5k food sold → 6.7k bought). Sustainable
  ≈ one 500-deal per 15 s per resource pair; ~15k bought is the
  15-minute ceiling.
- **Trade is tiny** (`Market.js`/`Trade.js`): gain ≈
  0.75·√(1024/mapSize)·d²/(1+0.25d/mapSize) ≈ 3-36 per trip at
  200-700 m routes — ~0.05-0.15/s per trader (goal 6 measured ~100 per
  trader per 30 min). Not a mass-income mechanic in 0.28.
- **CCs are plantable in neutral territory** (Territory "own neutral"),
  foundations project territory immediately (no foundation special-case
  in the territory manager), and a foundation's own disk is CONNECTED
  (every CC is a root) — so a CC chain can be built outward without
  decay. Min CC distance 200 m checks only OTHER players' CCs
  (RangeManager query excludes the builder's player).
- **The construct command is validated at PROCESSING (~1 turn after
  PostCommand)**: BuildRestrictions + entity limits + tech requirements +
  the REAL stock cost. Ordering a construct and a research/barter in the
  same block races the engine's stock — keep cost floors (CC: 750s/550m)
  and the one-block `constructionHold`. The engine rejects silently; the
  bot only learns via the pendingBuilds timeout.
- **AI territory grid can disagree with the engine's** for a few turns
  (dirty-ID updates): re-validate CC spots against the live state right
  before ordering, and plan MORE spots than needed so failures/stale
  spots are absorbed (seed 2: 4 of 6 spots failed/stale).
- **The greedy territory simulator is conservative** (skips all
  Petra-owned tiles, counts only neutral gains): seed 1 sim 58% → real
  88%; seed 3 sim 55% → real 57%. Plan to ~72% sim for the 70% bar, and
  hex-pack candidates at ≥210 m (the 200 m rule) or the greedy
  deadlocks on mutual exclusion.
- **The storehouse flood**: each expansion branch (woodline reactive,
  mine reactive, mine proactive) can order one storehouse PER BLOCK, and
  the "nearest supply > 60 m" destroy rule frees the cap slot for an
  instant rebuild — 117 storehouse orders (=11.7k wood) on seed 1.
  Fixes: per-branch cooldowns (40-150 blocks), planned-radius gates at
  45-60 m, and skipping store-ring woodlines (they already have their
  dropsite).
- **The expansion techs starved behind the boom list**: `manageResearch`
  returns after every loop iteration, so the post-city techs appended
  after the loop never ran (seed 2: zero mining techs by t=28, mining at
  0.35 base rate). Give the expansion techs their own call at the TOP of
  manageResearch, and never latch a "done" flag while techs remain
  unaffordable (the first-block affordability failure froze the list on
  seeds 1/3).
- **Mining techs live on the STOREHOUSE** (`Researcher` list), farming
  techs on the farmstead, pop techs on houses, trade techs on the
  market, phases on the CC — `findResearchers` follows the templates.

## 2026-08-22 — Goal 8, round 2: Louis's levers, measured (SHIPPED)

- **The wonder's Glorious Expansion aura** (+20% max population per
  wonder, tech researched AT the wonder, 2000f/3000w/500s/500m): pop
  goes 300 → 360. The wonder must stand in own territory (own-only
  template) — placement at the border fails on the AI's stale territory
  grid (8 rejected orders on seed 1); search rings ≤ 95 m around the
  base CC or ≤ 60 m around a far CC only. The construct floor must
  COVER the cost (a 800 floor vs a 1500 cost orders on credit and the
  engine rejects on cost every block).
- **Foundations are Structure-class entities and appear in
  getOwnStructures()**: any `hasClass` scan double-counts a building
  (structure + its foundation) unless filtered with
  `foundationProgress() === undefined` — this "3 markets" ghost count
  silently stalled the far-market block.
- **manageResearch returns after every boom-list iteration**, so
  appended tech lists starve — and a `return false` on the first
  unfindable facility (stockbreeding: no corral) blocks every later tech
  forever. Walk the expansion list with `continue` semantics and call it
  at the TOP of manageResearch. Research concurrency: the 16-tech list
  serializes to ~20 min; up to 3 in flight (the storehouse, farmstead,
  market, house, CC and wonder research independently) lands it in ~7.
- **Trade, measured**: 42 traders + 3 markets (base + 2 at the farthest
  COMPLETED CCs — anchoring on planned far spots stalls until the last
  CCs go up) → tradeIncome 1960-2760 over the last ~7 min (~0.1/s per
  trader). Idle-civilian dismissal for pop works (destroy() on idle
  women) but the fleet eats 100 food/trader — the food bar must have
  headroom first.
- **The food/wood frontier**: with the mining share capped at 26% (the
  stone/metal bars are unreachable — map-bound), the fields (95% eff)
  and the woodline (44-57% eff, walk-bound) trade ±2-5k per seed; food
  43-74k and wood 47-56k oscillate around the 50k bar and seed variance
  dominates the remaining knobs.

## 2026-08-22 — Herd steer discipline: pinned dropsite, far-side-only attacks (Louis's pistes, SHIPPED)

Louis: (1) find the ideal food-dropoff distance at which to kill the
game — 25 m feels too close; (2) the cavalry must never make a herdable
flee away from the base, always drive it toward a food dropoff; if that
costs score, fix the civilian carcass reaction instead of stopping the
drive.

- **Flee geometry (source-verified)**: a wounded animal flees AWAY from
  the attacker's LIVE position until it is `distanceToFlee` away (fixed
  at flee-enter = distance at wound + FleeDistance 24, `UnitAI.js`
  FLEEING). The steer therefore works by keeping the herder beyond the
  animal on the line from the dropsite; anything else pushes the animal
  somewhere else. The stall `!fleeing` kill fires ~2 s after each flee
  stop, then the attack pursuit carries the animal toward the dropsite
  at its flee speed — that pursuit leg is why kills land ~15-25 m from
  the dropsite no matter where the kill trigger fires.
- **Unpinned dropsite = zigzag outward**: the steer used
  `nearestFoodDropsite(animal)` recomputed every block; when the animal
  crossed the midpoint between two dropsites the target flipped, the
  far-side point jumped across the animal, and the chase pushed the
  animal away from the base (s5: a horse went 135 → 187 m and died out
  of territory). Pin the dropsite at wound time.
- **A near-side attack pushes the animal away from the base** (flee =
  away from the attacker). Both the wound shot and the kill shot must
  only fire from the far side; reposition first, woodPoor included.
- **The old no-progress fallback was broken**: it compared the
  dropsite-distance against the CC-distance (mismatched) and
  `herdBestDist` only decreases, so after any progress it could never
  fire again — a pushed-away animal steered on indefinitely. Compare
  the current distance against the pinned wound-time distance instead.
- **A failed steer is the most expensive kill failure**: the carcass
  lands 300+ m out, the cavalry collects it alone (rate 5.0, cap 20 —
  10 round trips ≈ 5 min at 331 m), and no horse gets herded meanwhile.
  That single event is worth ~1.4 min of pop300 (s5 14.3 → 15.7 in the
  civilian-radius probes). The flee-away fix (shipped) removed it: s5
  15.1 → 14.3, steppe mean max 14.70 → 14.54.
- **Civilian carcass serving beyond 40 m regresses** (all three forms
  probed and reverted): radius 80 everywhere (workers trek to
  mid-distance meat at ~25% rate — s5 15.7); a fresh-kill map (the
  civilian walking to a 41 m kill crosses the base exactly when the
  next horse is steered through it and breaks the steer — s5 15.3); the
  map gated to > 60 m (s1's gain had come from the 40-60 m band, not
  the 79 m orphan — s1 15.5). The 40 m ring stays.
- **`herdKillDist` 40 is a wash**: s1 pop300 15.4 → 15.1 but s5
  14.3 → 14.6 with a new 167 m orphan. The kill-distance threshold is
  not the lever — the steer discipline is. 25 stays.
- Also verified this round: `stopMoving()` posts a "stop" command
  (`common-api/entity.js`), and the herd kills' dropDist distribution
  needs telemetry — the `[HUNT]` kill/carcass lines now print it.

## 2026-08-22 — Foundation commit blocked by unit traffic; rush-build the woodline storehouses (Louis, SHIPPED)

Louis's in-game observation: the woodline storehouse is not rebuilt when
the woodline moves away. He guessed why: choppers constantly walk over
the new foundation, so construction never starts — and proposed
drafting the woodline choppers as its builders. Engine-verified and
implemented:

- **The mechanic is real** (`public/simulation/components/Foundation.js`):
  an uncommitted foundation blocks NO movement (line 10), but
  `Foundation.Build` calls `Commit()` on every builder work tick, and
  `Commit()` returns false while `GetEntitiesBlockingConstruction()`
  finds units on the footprint (C++ `CCmpObstruction.cpp` — unit shapes
  with FLAG_BLOCK_CONSTRUCTION). Each failed commit orders the blockers
  off (`Order.LeaveFoundation`, 4 m) — but on a busy woodline another
  chopper is already crossing, so the commit can be starved
  indefinitely. Builders themselves don't block (the sweep sends the
  choppers `repair`, they stand at the foundation and build).
- **Fix (rush-build)**: wood-branch storehouse rebuilds are marked
  `rushBuilds`; once the foundation exists, the builder sweep drafts up
  to 8 wood-assigned choppers as its crew. Traffic stops AND the build
  finishes fast. Markers die with the built structure or after 200
  turns.
- **Do NOT rush the initial storehouse**: probed, regressed temperate s1
  pop300 14.6 → 15.0 — at t=0 there is no traffic to unblock, and
  drafting every chopper delays the whole bootstrap. Rebuilds only.
- The foundation entity exists from the moment the construct command is
  placed (the rush print at t=0.0 confirms), not when the first builder
  arrives — the bot's 50-turn construct timeout measures builder
  arrival/commit, not foundation creation.
- Batch (sh10): temperate all ≤ 15.0 (mean 14.24/14.08), steppe tuned
  mean max 14.72, fresh 14.68 — neutral-to-slightly-positive, zero JS
  errors, deterministic.

## 2026-08-22 — Storehouse remarks 4/5/6 (Louis, SHIPPED)

Follow-ups: rebuild on the receding woodline (composes out of rules
1+3+the destroy rule — verified on temperate s1: rebuild at 373,605,
old storehouse destroyed at 62 m), chopper assignment by full walk
cycle, destroy everything > 60 m from the nearest supply. Steppe mean
max stays ~14.9 tuned / ~14.6 fresh; temperate bar holds. Details in
`experiments/goal-07-steppe.md`.

- **Pure nearest-to-dropoff assignment regressed hard** (f12 pop300
  14.5 → 16.2): it ignores the unit's position — after a storehouse
  destroy, the zone's nearest dropoff was the far pair storehouse and
  every chopper trekked to that side of the zone. The rule that works
  minimizes the FULL cycle: dist(unit → tree) + dist(tree → nearest
  dropoff). Same idea as the gather-rate telemetry: the walk is paid
  twice per delivery.
- **A near-cell preference in the picker (cells within 70 m of a
  dropsite outrank far forests, floor 500) regressed steppe s1** (pop300
  15.1 → 16.8): steppe clumps are small, so "near the dropsite" kept
  winning over "biggest clump" and the bot rebuilt storehouses every
  minute. "Rebuild on the remains" must come from the ring-exhaustion
  cycle (rule 1), not from a proximity bonus.
- **The pair-branch can still burn several orders at the territory
  edge** (temperate s4: 5 orders in 0.5 min, 4 engine-rejected): the
  reject zone is smooth over > 12 m, so wider failedSpots boxes don't
  help (a 12 m box probe changed NOTHING on all 15 seeds — hashes
  identical — reverted), and the pending-suppression limits the damage
  to one order per spot per blacklist cycle. It self-heals once the
  territory expands; the metric impact was nil (s4 city 12.9).

## 2026-08-22 — Storehouse rules 1/2/3 (Louis, SHIPPED)

Three storehouse rules (exhaust served rings before building, one
storehouse between close stone/metal mines, median placement) plus two
fixes they forced. Steppe mean max(pop300, city) 16.80 → 14.84 (tuned
seeds) and 17.56 → 14.54 (fresh seeds 11-15); temperate bar holds with
neutral metrics. Details in `experiments/goal-07-steppe.md`.

Engine/code facts learned:

- **The steppe woodline never existed before this fix.** The woodline
  cell scan filtered supplies with `amount > 100`; steppe bushes hold
  exactly 100 wood (bush mixin, 4 gatherers), so every bush was excluded
  and `woodline` stayed null on steppe — choppers used the generic
  nearest-supply path and spread over the map. That spread is the whole
  reason steppe storehouse churn was 10-24 builds / 7-16 destroys per
  game: the storehouse branch chased the scattered cutting front. The
  `>= 20` floor restores the woodline on steppe (and changes nothing
  measurable on temperate: s2/s4 hashes byte-identical, metrics equal).
- **A gate counting only FULL supplies (≥ 100) never binds on steppe**: a
  bush drops below 100 the moment a chopper touches it, so every served
  ring looked empty. Ring/gate floors must be low (20 = scrap threshold)
  to count half-gathered supplies.
- **The wood/mine storehouse branches re-ordered the same spot every
  block while no foundation appeared** (the planned check only sees
  foundations): a spot the engine rejects — e.g. at the territory edge,
  where the AI's territory map can be a few turns staler than the
  engine's construct validation — gets one order per block, each burning
  100 w of the block's budget, until the 50-turn blacklist fires (11
  `construct FAILED` at one steppe spot in the probe). Fix: in-flight
  orders (`pendingBuilds` within 30 m) count as planned in all three
  branches — one wasted order per spot, then the blacklist moves it.
- The late-game (t > 15 m) steppe storehouse churn that remains is a
  separate phenomenon: at 300 pop the wood force spreads to ~40 choppers
  that eat a bush clump faster than a storehouse can be built. Post-
  metric only; not the boom.

## 2026-08-22 — Cavalry idle after the hunt: keep hunting beyond the band (Louis's report, SHIPPED)

Symptom: after hunting a few steppe horses, the cavalry stops hunting and
stands idle while game remains visible. NOT the steer hang (that one is
the faster-horse problem, deferred). Instrumented (`[HERDDONE]` +
`[STARVED]` prints): when the 200 m band runs dry, `herdingDone` sent the
cavalry back to the economy — but its ONLY gather rate is `food.meat`
(`template_unit_cavalry`: rates food.meat=5, capacities food=20, nothing
else), so `canGather` fails for every resource and `findSupply` can only
offer served meat; with no served carcass left, the shares have NOTHING
to assign it and it idles forever (seed 1 steppe: HERDDONE 6.92m,
STARVED cavalry 7.29m) while horses roam beyond the band.

Fix: when the in-band pick fails, keep hunting — a third pick pass with
NO upper distance limit (35 m floor, CC-region, away from enemies). The
existing cutoff logic classifies beyond-band targets as collect mode
(`herdKill = startDist > herdCutoff`): killed in place, carcass collected
by the cavalry itself. `herdingDone` only fires when no animals remain in
the region at all. The cav's time is free (exempt from the shares), so
the long walks cost the economy nothing and the meat (rate 5.0) is a
straight bonus to the food stream.

Verified: steppe seeds 1/3/5 — no premature HERDDONE/STARVED, hunting
continues to the 18 m cap (targets at 207/243 m, collect mode), zero JS
errors. Temperate impact: 5-seed batch — hunts +36% (45/54/68/59/72 vs
33/39/42/47/60), city/pop300 14.4/14.9, 14.7/14.4, 14.1/13.4, 13.6/14.1,
14.1/13.3 (baseline 14.9/15.0, 14.8/14.5, 14.4/13.9, 12.7/14.1,
14.2/13.3). Fresh seeds 11-20 paired: city -0.02 ± 0.19, pop300 -0.14 ±
0.26 (7/10 improved or equal; seed 11 pop300 15.0→14.7), no bar breaks,
zero JS errors, seed-5 rerun hash identical. Run tags: `idlebug-s1/5`
(instrumented), `idlefix-s1/3/5` (steppe), `idlefix-seed1..5` +
`idlefix-seed5-rerun`, `idlefix-fresh-11..20`.

## 2026-08-22 — Herder kill-shot accuracy + micro-pause fixes (Louis's reports, SHIPPED)

Two fixes, both diagnosed from engine source + instrumented runs
(`[DRIFT]` telemetry, seed 5: 697 stops in 18 min before).

- **Kill shot missed (spread vs distance).** The gaul cavalry javelin has
  MaxRange 30 and Projectile/Spread 4 — deviation grows linearly with
  distance, and the wound-then-steer standoff kept the herder 12 m behind
  the animal, so the kill shot fired from ~12 m and often missed (a miss =
  1.5 s re-aim while the animal keeps fleeing). Fix: the steer and wound
  standoffs are 6 m, and the kill branch first approaches to ~2 m on the
  far side and only attacks from within 5 m — the animal keeps fleeing
  TOWARD the dropsite during the approach, so the kill still lands served.
  Cost: wound→kill interval grows ~0.1-0.2 min/deer; batch-neutral.
- **Micro-pauses on the walk back to a carcass — TWO mechanisms.**
  1. The herder carries a stale turn-0 "food" assignment (assignGatherers
     runs before manageHerding picks the cavalry), and the food-pool change
     extended the drift stop from fruit to meat — so the drift stop
     `stopMoving()`ed the herder EVERY block while it collected carcasses
     beyond 45 m of every dropsite (74 stops on seed 5; each stop wipes the
     gather order and the unit re-accelerates). Fix: exempt the active
     herder from the drift stop + clear the stale assignment when the
     herder is picked.
  2. Civilians looped too (533 stops on seed 5, spikes t=13-17): the engine
     autocontinue drifts pickers to the nearest same-type supply, and
     `findSupply`'s generic path could RETURN an unserved fruit/meat
     supply (fruit had a 40 m-from-unit escape hatch; meat had no serving
     rule at all) — the drift stop then killed the assignment on the next
     block: stop → reassign → drift → stop, every second. Fix: the generic
     path now returns fruit/meat only when within 45 m of a food dropsite
     (fields exempt — farmstead chaining serves them). After: 81 stops,
     max 4 per unit, no loops (the leftovers are the intended one-shot
     stops of patch-edge drifters).

Verification: seed 5 drift stops 697 → 81, herder stops 74 → 0. 5-seed
batch vs baseline: city +0.10, pop300 +0.12 (mean, noise-level), all
≤ 15.0. Fresh seeds 11-20 paired: city +0.06 ± 0.25, pop300 +0.15 ± 0.41,
no bar breaks, zero JS errors, seed-5 rerun hash identical. Engine facts
used: UnitAI gather states (walk-back = INDIVIDUAL.GATHER.APPROACHING —
contains "GATHER", so the bot's own gather re-issue was NOT the cause),
FLEEING distanceToFlee fixed at enter, cavalry meat rate 5.0 / capacity 20.

## 2026-08-22 — Building footprints differ per civilisation (documented in game_description/*/buildings/, SHIPPED)

Verified in the pinned 0.28.0 templates: **yes, building sizes vary across
civs** — nearly every structure type has per-civ `<Footprint>` overrides
(shape, width × depth, placement height), and the `Obstruction` (the
pathfinding/collision shape, a separate component) usually runs 1–2 m
smaller per side than the footprint. Findings:

- Extremes: civil_centre 28×28 (gaul) → 43×35 (han); wonder 28×58 (athen)
  → 62×62 (pers); temple 16×30.5 (maur) → 30×24 (germ); house 11×11 (maur)
  → 20×20 (germ). Same-type buildings can differ by a factor of ~2 in area.
- brit structures use **circular footprints** (Circle r 15 CC, r 17
  fortress, r 30 wonder, r 6 tower, r 6 house with the square disabled);
  iber's defense tower is a circle too (r 8). Walls/gates use square
  footprints but two side obstructions with a passable middle.
- The generic `template_structure_economic_farmstead` defines **no
  footprint shape at all** (only Height) — every civ supplies its own.
- Fields have `BlockMovement false` / `BlockPathfinding false` — units walk
  over them (only placement is blocked by the footprint).
- Wall segment footprints (wall_short/medium/long/tower/gate) differ per
  civ in width, depth and height; palisade segments (palisades_*) are
  shared across civs (han's own templates match the same sizes). Stone and
  palisade wallsets use different piece templates — palisades are not just
  a re-skin of stone walls.
- Bot implications: don't assume a building's footprint from its generic
  template when reasoning about placement clearance or passability; read
  the per-civ value. All values are now in
  `docs/game_description/*/buildings/*` ("Footprint"/"Obstruction" in Basic
  stats + per-civ override lines; stone wall segments in
  `wallset_stone.md`'s "Wall segment sizes" section).
- Tooling: footprint comparison scripts live in `tmp/footprint-compare.py`
  and `tmp/gen-sizes.py` (parent-chain resolution + per-civ diff); a
  verifier `tmp/verify-docs.py` cross-checks the docs against the game
  data (149 override lines, 0 mismatches). The `tools/` directory
  referenced by `docs/game_description/README.md` no longer exists in the
  repo.

## 2026-08-22 — Herding distance re-probed: 200 m band, herding beats collecting at every distance (SHIPPED)

Louis: extend the herdable distance again (v71's 200 m probe regressed
~0.2 min pre-food-pool) and find the herd-vs-collect compromise. Matrix:
herdMax ∈ {200, 240, 280} × herdCutoff ∈ {140, 160, 200, 240, 280} ×
herdPrefer {true, false}, seeds 1-5 + fresh 11-20. Verdicts:

- **v71 reversed — the food pool made the extension cheap.** Nearest-first
  at 200 m: paired fresh-seed deltas city -0.03 ± 0.28, pop300 +0.02 ± 0.42
  (n=10) — no measurable boom cost, big meat gains (seed 3: 30→38 hunt
  events at 200 m, seed 4: 24→54). 240/280 add more meat but the metrics go
  flat-to-worse (seed 3 city 14.1 / 14.3 / 14.6 at 200/240/280).
- **Herding wins at EVERY distance — the collect-far-skittish cutoff loses.**
  A chased skittish flees ~50 m FURTHER out before dying (kill at 235 m from
  a 201 m target, seed 5), and the cavalry's collection = capacity-20 trips
  (5 × 250 m round trips) while a steer walks the animal home in ~0.25 min
  with the kill in-territory → civilians. Seed 5: cutoff=200 processed ONE
  far deer vs SIX herded at 200-257 m — all six steered kills landed
  inTerr=true and fed the pool. Slow animals stay collect-mode (they crawl,
  the kill stays put).
- **herdPrefer (herdables over nearer collectables) loses.** It redirected
  the herder from 37 m chickens to 127 m deer and cost seed 5 city +0.5 min
  (14.2 vs 13.7) with pop300 only -0.1. Nearest-first stays.
- Seed 11 is the extension's outlier: 14.3/14.1 → 14.8/15.2 at 200 m (and
  14.9/15.2 at 240). Mechanism: ONE sheep at 182 m; the extra meat shifted
  the town bank to 5.9 m (vs 6.5), the trio drained wood to 98, the field
  branch starved (fields 4 vs 6 at t=8), grain collapsed (t=13 window
  -43%), pop300 15.2. Same hard-bank cascade class as the seed-4 pure-pool
  case; the 5-seed goal-7 batch is unaffected (seed 1-5 all ≤ 15.0).
- Cavalry gather facts: meat rate 5.0, capacity 20 (template_unit_cavalry)
  — 5 round trips per 100-meat carcass; this is why collection walks are
  the expensive half, not the kill.

## 2026-08-22 — Combined food pool: fruit + in-territory carcasses (Louis's rule, SHIPPED with herder carve-out)

Engine facts verified against the pinned 0.28.0 copy first:

- **Carcasses never rot.** Dead animals spawn a `resource|fauna_X` corpse
  entity (Health.js `CreateCorpse`: `Engine.AddEntity("resource|" + tpl)`),
  which MERGES the original `ResourceSupply` (the `special/filter/
  resource.xml` filter). No fauna template defines `<ResourceSupply><Change>`
  (no Rotting/Decay), so the meat amount never decreases on its own.
- **Same gather rate**: gaul `support_civilian` has `food.fruit=1` AND
  `food.meat=1` (`template_unit_support_female_citizen.xml`); grain is 0.5.
  Meat and fruit are genuinely interchangeable for civilians.
- Corollaries: the corpse has NO `Health` component, and because
  `isHuntable() = KillBeforeGather && (!Health || !Attack)`, carcasses are
  returned by BOTH `getResourceSupplies("food")` and `getHuntableSupplies()`.

Rule: `findSupply`'s two gated branches (served fruit only while
`fruitStock > 400`; in-territory carcasses only after the
`fruitStockSeenHigh` latch) are replaced by ONE ungated branch: nearest
supply of type fruit OR dead-meat-in-own-territory within 40 m of a food
dropsite wins; fields (grain) fall through. The latch state is deleted; the
autocontinue drift-stop now also covers meat gatherers.

**Pure pool first shot (discarded)**: as above with no exclusions. The
foodmix telemetry proved the pool works (meat delivered from the FIRST
window, alongside berries — seed 1 t=3m fruit=363/meat=383 vs baseline
585/280), but the 5-seed batch regressed: city 14.18→14.40 (+0.22),
pop300 14.24→14.38 (+0.14), seed 1 pop300 15.3 breaking the ≤ 15.0 bar,
seed 4 city 14.6 (the changed early food flow fired the town bank at 3.5m
vs 8.2m). Mechanism (seed 1, instrumented): the gap opens in the FIRST
window — 746 vs 865 food by t=3m. Civilians get pulled onto the herder's
served slow kills (~40 m out) that the cavalry collects anyway; the extra
walk (~38 m vs ~15 m to a berry, rate 1.0 both) costs ~25% of a worker's
cycle, and the gap compounds through the t=13-15 sprint (grain window
6216 vs 7660).

**Carve-out (shipped, Louis's pick)**: the carcass that is the herder's
current target stays the herder's — one condition in the meat check:
`!(s.id() === this.herdTarget && !this.herdingDone)`. Slow kills and
outside-territory fast kills (the only carcasses the herder collects)
leave the civilian pool; in-territory fast kills are dropped by the herder
the same block (herdTarget moves to the next animal), so they stay in the
pool. 5-seed batch vs baseline: 14.6/15.1, 14.5/14.4, 14.4/13.6, 13.3/13.6,
13.7/13.5 — mean city 14.18→14.10 (-0.08), pop300 14.24→14.04 (-0.20),
seed 1 pop300 15.1 (its city/pop300 have ranged 14.1-14.6/14.8-16.1 across
history — the noisiest seed). Statistical confirmation on 10 fresh seeds
(11-20, never iterated): city mean 14.17 vs the recorded 14.21 baseline
(-0.04), pop300 13.74 vs 13.82 (-0.08), zero JS errors, NO seed breaks
the ≤ 15.0 bar (worst city 14.5, worst pop300 14.1). Net: the rule ships
at no measurable cost on unseen seeds.

## 2026-08-21 — Sticky-builder re-tune (bank bootstrap gate + village house crews, SHIPPED)

Re-tune after the sticky builder fix regressed the boom. Instrumented with
per-block [BUILD] telemetry (claims by foundation class, fruitStock, wood)
and compared against the pre-fix v83 tree run side by side.

- **Seed 1 mechanism (pop300 16.0)**: the sticky crews complete the 3rd
  house by ~1.5m → `canResearch(town)` flips → the HARD BANK starts at
  1.5m and freezes construction BEFORE wicker (v83: 1.4m) and the 2
  bootstrap fields (v83: 1.8/2.1m) are ordered. Sticky wicker 3.4m, first
  field 3.9m — everything else cascades from there (pop 19 vs 29 at t=3m).
  v83's bank only started at 2.8m because its 2nd house (the 5th Village
  structure) was wood-starved until then — the churn was load-bearing.
- **Seed 3 mechanism (city 15.0)**: bootstrap nearly identical (berry-rich,
  bank at ~3.1m in both) — the regression is the TRIO: a storehouse flood
  (5 x 100w, 7.8-8.7m) pinned wood under the market's 300w → market 9.1m
  (v83 7.1m) → city 15.0.
- **FIX 1 (kept): bootstrap gate on the town bank** — hold the hard bank
  while COMPLETED bootstrap fields < 2 and fruitStock < 1500 (fallback
  t=5m). The fruit gate keeps berry-rich seeds on the houses-first path.
  Counting FOUNDATIONS (not completed fields) releases the hold ~0.4m
  early and wastes it.
- **FIX 2 (kept): village-phase houses take 2 builders, not 3** — the
  sticky crews otherwise hold 3 workers off gathering exactly while the
  wood for wicker/fields is accumulated (v83's churn left ~1-2 effective
  builders per house). 3 from town phase on: the sprint needs the house
  build rate (2 everywhere regressed seed 1 pop300 15.2 → 15.4).
- **P2 probe (storehouse floor += nextTrioWood), DISCARDED**: fixed seed
  3's trio (city 14.3) but cost seed 1 pop300 (16.9 alone, 15.2 in
  combos) — dropsite income outranks the trio wood; FIX 1's cadence shift
  alone repairs seed 3's city. Drop it.
- **X1 probe (fields branch before continuous dropsites), DISCARDED**:
  fields ramped 18 → 23 on seed 1 but the grain rate fell (farmstead chain
  can't keep up with unserved new fields) and seed 3 pop300 14.0 → 14.6.
  The current order (dropsites before fields) stays.
- **Final batch (5 seeds, zero JS errors, seed-1 rerun hash identical)**:
  city/pop300 14.1/14.9, 14.7/14.8, 14.3/14.0, 13.5/13.6, 14.3/13.9 —
  mean city 14.18 / pop300 14.24 vs v83 14.02/14.24. Goal 7 criteria all
  ≤ 15.0 restored; the sticky fix is kept with zero churn.

## 2026-08-21 — Builder ping-pong between foundations (sticky variant SHIPPED, re-tuned same day)

- Louis's report is real: the builder sweep re-issues `repair` to the
  nearest units for every under-staffed foundation EVERY block, and when
  two foundations stand close together the same units are the nearest to
  BOTH — the last order wins, so the workers oscillate between the sites.
  Verified in-game ([BUILD] telemetry: the same unit ordered to two
  foundations in the same block).
- **Every fix variant regresses the boom** (baseline seed1 14.5/14.7):
  persistent sticky claims (16.0), REPAIR-state exclusion (16.5),
  per-block exclusivity (15.4), 30-m-gated per-block exclusivity (14.8 +
  city +0.4, and 364 churn events remain — builders of a FULL foundation
  are still stealable). Root cause of the regressions: the claim-order
  details feed the wood/food cadence (fields-vs-houses bootstrap,
  fieldDemand/fruitStock gate) and ANY perturbation cascades — same
  chaotic sensitivity as the v79/v80 field-spread tip. The messy
  re-issuing is structurally load-bearing: it keeps the bootstrap crews
  overlapping so the first farmstead/storehouse/fields sequence lands in
  the right order.
- **Shipped anyway (Louis's call): the persistent sticky variant** —
  foundationID -> [unitIds] tracked in bot state, a claimed unit is never
  re-targeted until its foundation is gone; the herder is excluded (its
  hunt orders would override repair and make it a phantom builder). Zero
  churn. The herder exclusion changed nothing on any seed (batch hashes
  identical to the pre-exclusion batch). **New baseline (re-tune target):
  seed1 14.6/16.0, seed2 14.6/14.6, seed3 15.0/14.4, seed4 14.2/13.7,
  seed5 14.5/14.4, determinism OK, zero JS errors.** The re-tune session
  starts from here; the known lever is the sticky crews never returning to
  gathering between foundations (see the [FIELD] fruitStock ~1000
  bootstrap stall), plus the fields-vs-houses wood gate.

## 2026-08-21 — Extended herding range (probed, DISCARDED)

- Louis's design: herd anywhere not near enemies, priority chickens →
  close+mid herdables (<300 m) → close non-fleers (<160 m) → far herdables
  → far non-fleers; always steer herdables to the base; collect only
  accidental outside-territory kills. Mechanics verified: deer steered from
  392 m to the base (kills land 9-50 m from a dropsite) — but every
  measured variant REGRESSED vs v83 (baseline seed1 14.5/14.7, seed5
  13.6/13.6): women-collect (r1: 14.3/15.6), CC-targeted steer (r2:
  15.2/15.6 and 14.3/14.7), cav-collects-all (r3: 14.7/14.9, 14.1/13.9).
  Economics: each far deer costs the cav 1.4-2.2 min (steer is bounded by
  the animal's 6.3 m/s flee speed + building-ring stalls) for 100 meat
  (~0.5-0.8 f/s) — while women collecting the delivered carcasses at rate
  1.0 with 20-50 m walks ≈ 0.5 f/s displaces field work at 0.41 f/s with
  bursty disruption (seed 5 t=13m: grain 4565→2193, meat 286→827, total
  food -1831/2.5 min) → pop300 +1.1. Even with the cav collecting its own
  kills (women undisturbed), the long steers still lost (+0.2/+0.3). The
  35-160 m band + in-band steer (v83) stays. Far animals remain handled by
  the post-herding findSupply hunting.

## 2026-08-21 — Wound-then-steer herding (v83, Louis's idea)

- **FLEEING mechanics (UnitAI.js, 0.28.0), source-verified**: on the
  "Attacked" message an animal enters FLEEING with `distanceToFlee` =
  distance-to-attacker at wound time + `FleeDistance` (24), **fixed at
  enter**; the order finishes when the animal reaches that range (re-checked
  against the attacker's LIVE position). So: wound it once and FOLLOW within
  the flee distance → it flees forever, direction = directly away from the
  attacker's current position → the cav steers it by its own position. The
  kill shot (a deer is left at 7/25 HP by one 18-pierce javelin) is the
  last re-aim. Skittish animals have Vision 0 — a stopped animal will NOT
  flee again without a new wound, hence the follow must be close.
- **The attack order keeps firing on its own**: after the wound lands, the
  engine's attack continues (javelin RepeatTime 1.5 s) and kills the animal
  ~2 s later — before any steering. Must `stopMoving()` the cav in the
  FIRST block that sees `isHurt()` (and that block must bypass the command
  throttle, else the gate delays the cancel past the second shot). Without
  this the feature is a no-op (v83-w1 probe: wound→death in 0.6 s).
- **Result (v83): seeds 1-4 byte-identical to v82** (no deer in the herding
  band on those seeds), **seed 5 city 13.8→13.6, pop300 14.4→13.6** (-0.8).
  Steered deer die 16-35 m from the nearest dropsite (vs ~50 m before) and
  the meat lands in the territory where the women collect it: seed 5 meat
  by t=8m 694→1049. Kept. (Only seed 5 has deer within 35-160 m of the CC
  on mainland/temperate 192 — the band is mostly chicken/sheep on the other
  seeds.)

## 2026-08-21 — Hunting experiment (v81→v82, Louis's flee-speed strategy)

- **Tip 3 revisited (farmstead by in-territory carcass clumps): DISCARDED
  again, now with data.** Telemetry over the 5 seeds: the largest unserved
  in-territory clump ever seen is **200 food** (seed 5, two herded deer ~8 m
  apart, 38-53 m from the nearest dropsite); seed 2 has 146; everything else
  ≤ 100. So a 300-food threshold **never fires** (the original noop verdict
  was structurally right). A threshold that does fire (~120) was probed on
  the two seeds where it can: the farmstead (100 wood + 4 builders, ordered
  right in the t≈5-6m town-trio wood window) delayed the trio and pushed
  **city +0.3 (seed 2) and +0.7 (seed 5)** — the wood oscillation around the
  forge/market costs (100-200) makes 100 wood ≈ 1.5 min of trio delay —
  while pop300 only gained 0.1-0.2 (the walk savings are ~220 s of
  woman-time per 200-food clump). Gating it behind the trio (build only
  when done) makes it never fire: the clumps are gone by then. No profitable
  threshold exists on mainland/temperate 192; a map with big in-territory
  kills far from the base might change the arithmetic. Building on a unit
  deletes it, so placement must keep ≥15 m from every huntable (farmstead
  half-diagonal ~11.7 m).
- **A dead animal becomes a NEW corpse entity** (verified in-game): the
  attacked entity's id dies with it, so tracking the kill by id and issuing
  `gather` on it NEVER works — the pre-v82 "carcass" branch was dead code.
  To collect a kill, re-find the corpse by POSITION (nearest dead huntable
  within ~25 m of the animal's last seen position, which the bot must track
  each block). `isHuntable()` is true for corpses (no Health, no Attack).
- **fruitStock ≤ 400 is a false "berries gone" at game start**: the initial
  served-fruit scan can read ~200-400 while the first pickers are still
  walking out. Gating a meat/field fallback on it alone (v81) sent women to
  distant chicken carcasses instead of the berries, cost seed 1 ~2 min of
  training (pop 19 vs 29 at t=2.5m, pop300 15.6). Fix: a latch — only engage
  the fallback after the stock was ever > 400 (berries were demonstrably
  there, now they aren't).
- **Early town banking trap**: 5 Village-class structures (CC + farmstead +
  3 houses) trigger the town bank (~1.45m on seed 1 with v81's house-heavy
  opening) which floors training at 500 food and stalls the boom for ~2 min
  while the bank fills slowly — town gains <1 min, pop loses ~5 at t=5m.
  The baseline only avoids it by the usual field-before-house ordering.
- **v82 (kept): kill+collect split by stance.** Slow animals (passive:
  chicken/sheep/pig) are killed in place and collected by the cav one at a
  time; fast (skittish: deer/gazelle) are herded to the nearest food
  dropsite and collected by the cav only when killed outside territory;
  civilians take in-territory carcasses before fields once the fruit latch
  fires. Batch: city 14.30→14.06 (mean, -0.24), pop300 14.50→14.40
  (-0.10), 4/5 seeds improved on each criterion, zero JS errors, seed-1
  rerun hash identical. The naive v81 (no corpse adoption, no latch)
  regressed 15.6/15.0 — the two fixes ARE the feature.
- Unit facts verified (0.28.0 templates): women AND infantry gather meat at
  1.0 (women carry 10, have a dagger attack and Slaughter restricted to
  !Domestic); cav meat rate 5.0, carry 20. Flee speed = WalkSpeed × 1.67:
  chicken 1.6 m/s, sheep/goat/pig 4.7, deer/gazelle 6.3. Stance separates
  the classes: herd/domestic = passive, deer/gazelle = skittish.

## 2026-08-21 — Goal 7 (dropsites, gather-rate telemetry)

- **Measuring effective gather rate**: `ent.resourceCarrying()` (live
  `IID_ResourceGatherer` query) returns `[{type, amount, max}]`; a drop from
  >0 to 0 = a delivery. amount / time-between-deliveries = effective rate
  per full gather-walk-drop cycle. Theoretical = `BaseSpeed ×
  Rates[generic.specific]` (techs included via `ent.get`) × diminishing
  returns for fields (`(1-dr^n)/(1-dr)/n`, dr 0.9, n from the supply's
  `resourceSupplyNumGatherers()`). Skip partial loads (< 3): their cycle
  includes post-exhaustion idle time.
- **Dropsite placement that works**: react each block to workers whose
  target supply is > ~18 m (edge) from a serving dropsite; build at the
  clump around the WORST-served anchor (anchors within 25 m), not at the
  centroid of all underserved — a wide cutting front's centroid lands
  between clumps and serves none (13 storehouses, mean distance still 40+
  m). Count same-type foundations as serving sites (else re-order spam
  while the first builds), suppress within ~25-30 m, never fall back to a
  CC-centered search for dropsites (a farmstead dumped at the base serves
  nothing but counts against the cap).
- Walk economics (woman 9 m/s, carry 10): grain field at 5 gatherers = 0.41
  f/s effective → 85% efficiency needs ≤ ~19 m edge walk; wood (0.7/s) →
  75% needs ≤ ~21 m. Farmsteads cannot fit between grid fields (22 m
  footprint on 24 m pitch); they land just outside the cluster perimeter.
- A storehouse at the woodline pays its 100 wood back in ~10-30 s of
  gather-rate delta; gating dropsites behind trio/house wood reservations
  starves the income that pays for everything (v14: zero dropsites, wood
  rate 27%). Houses must instead leave 100 w while a dropsite is demanded.
- **Food is the boom's binding constraint**: pop300@15 ≈ 15500 food by
  t=15; training capacity (CC 10.3/min + 2/min/house) stops mattering once
  food income < demand (from ~t=8). Berry window (fruit rate 1.0, 1.5 with
  wicker) is ~750 f/2.5 min early; meat is the starting cav (~400 f first
  window); everything else is grain.
- The city bank (750s/750m) competes with metal boom techs (~800 metal
  pre-city): techs need a 300 stone/metal floor in town phase or the bank
  is short at deadline time.
- Fertility Festival timing: rushing it at t~1 (250 f + training/construction
  freeze) starves the bootstrap — pop behind all game (v32). ~t=5-8 is the
  window where trainers actually become food-supported. If banking for it,
  freeze construction AND floor training together (v23 paused training only;
  houses ate the wood and fertility stalled 8 min).

## 2026-08-20 — Goal 6 part 2 (placement, threats, command races)

- **`getEnemyEntities()` includes gaia** (gaia is a diplomatic enemy):
  every tree/ bush matches. Filter `ent.owner() === 0` out; keep gaia
  animals with an `Attack` component (they kill gatherers).
- **Sandbox Petra kills**: its units defend — 37 workers lost on seed 5
  gathering near its base. Exclude supplies/spots near enemy structures
  (100 m) and mobiles (60 m); a static 45 m unit snapshot is not enough
  (they chase).
- **Construct commands are rejected at processing time if unaffordable by
  then** (the AI resource snapshot predates command processing). Ordering
  a house at wood < 75 → rejection → and brennus blacklisted the spot
  permanently: 17 rejected orders burned the whole building ring on seed
  5 (no houses/fields for 15 min). Also: a research order + construct
  order in the same AI block overdraw (both see the same snapshot) — hold
  construction one block after any research order.
- **Territory**: gaul CC has root territory radius 140 m; markets 40 m
  non-root. Search building spots out to ~140 m around the CC — markets
  at opposite edges give 170–270 m trade routes (gain ∝ d²): income
  ~900 at 90 m routes → 1300–1900 at 170–270 m.
- **Women flood starves the trader fleet of food**: reserve one trader's
  food cost (150 floor) ahead of the woman stream while the fleet is
  incomplete; traders need only a small fixed metal buffer (230) — metal
  techs total 850.
- **Trader pop headroom must be capped** (6): an 18-slot reservation
  exceeds the early-town limit and froze woman training (pop stuck at 32
  from t=5 to t=15).
- **Village-phase research works from surplus only**: allow techs costing
  cost+500f/400w; never set techReserve in village; keeps the town bank
  and the goal-4 timeline intact (~6-7 min town) while 3-4 village techs
  complete early.
- Priority-building wood banking: houses require 375 w while the town
  trio or the market pair is pending; fields 450/250. Without it, the
  house stream eats every wood surplus and the 300 w market never fires.
- Stats JSON `unitsLost.total` can be 0 while the per-class breakdown is
  nonzero — read the breakdown.

## 2026-08-20 — Goal 6 API facts (trade/barter/research)

- **`getOwnStructures()` includes foundations** (they carry the built
  template's classes: a market foundation passes `hasClass("Market")`).
  Exclude with `ent.foundationProgress() === undefined` — a fresh
  foundation reports progress **0**, so the falsy `!ent.foundationProgress()`
  test lets it through (caused "Called train on non-training entity
  foundation|structures/gaul/market" errors). trainWorkers was only saved
  by its `queue &&` guard.
- AI-visible `playerData.statistics` = `GetBasicStatistics()` only
  (resourcesGathered, percentMapExplored). No tradeIncome/resourcesSold —
  the bot must count its own barter deals. Full stats only in end-of-game
  stdout JSON.
- Barter: `ent.barter(buyType, sellType, amount)` — amount must be exactly
  100 or 500 (Barter.js DEAL_AMOUNT/BATCH_SIZE); all resources have
  truePrice 100; 5×100 wood → ~400 stone (price drifts ~2%/deal). Requires
  a completed Barter-class building (market). Verified via stats
  `resourcesSold`/`resourcesBought`.
- Trade: `trader.tradeRoute(target, source)` (UnitAI.SetupTradeRoute).
  Gain = trader GainMultiplier (0.75) × TradeGainNormalization(mapSize in
  metres) × d²/(1+0.25d/mapSize) — **quadratic in route distance, tiny per
  trip** (~0.75 per 100 m on 768 m map). Place markets maximally apart
  (each market's territory influence extends buildable area for the next).
  Trader: `units/{civ}/support_trader`, 100f/80m, 15 s at market, visible
  class "Trader". Idle trader = unrouted (route persists) — no bookkeeping
  needed. Income in stats `tradeIncome`.
- Gaul economic tech tree (26 techs, full list in brennus.js `econTechs`):
  storehouse 4 chains×3 (lumbering/mining-stone/mining-metal/capacity,
  tiers village→town→city), farmstead wicker + plows→training→fertilizer +
  harvester (gaul-only), corral stockbreeding, house health + fertility +
  pop_house_01→02, market trader_health + trade_gain_01→02 (×1.15 each) +
  commercial_treaty. Techs append to the production queue (`ent.research`)
  — a house/market can research while training, queue ≤ 1.
- metadata.json playerStates: `phase` works ("city"), but
  `researchedTechs` is always `{}` — do not use it for tech verification;
  log tech counts from the bot instead.
- **Liquidity problem**: the woman stream consumes food income instantly,
  so 200-food techs are never affordable. Full-pause banking deadlocks
  (women paused waiting for traders, traders paused waiting for bank → pop
  froze at 32) or stalls the economy (fixed 500f/400w thresholds are
  permanent in village). Working approach: `techReserve` = cost of first
  unaffordable researchable tech; women train only above reserve.food+50,
  traders above reserve+100/+80; `manageResearch` runs FIRST in the 5-turn
  block. Village phase researches only Fertility Festival (goal-3 buffer
  logic) — village research banking destroyed the bootstrap (town slipped
  7.8 → 15 min).
- **Wood starvation trap**: fields (canAfford 130 w) pin the wood stock at
  ~130, so the 300 w market order never fires → town-trio stalls → city at
  ~22 min. Field affordability thresholds must stay above the cost of
  pending priority buildings (or fields must yield).
- Traders starve against women: 100 f trader never affordable while women
  eat all food; headroom mechanism (`traderHeadroom`, women cap at
  limit-headroom, house margin threshold 10+headroom) keeps pop slots and
  lets the fleet build.
- 6-run verification (2 waves × 3 parallel on 4 cores) takes ~1–2.5 min
  wall. The t=30m status log never prints (time-limit trigger fires first)
  — last visible HARNESS status is t=25m.

## 2026-08-20 — Goal 5 (city phase)

- **Foundations do not count** toward phase entity requirements:
  `TechnologyManager.classCounts` excludes them explicitly
  (`TechnologyManager.js`, "don't use foundations for the class counts").
  `canResearch("phase_city_generic")` only goes true once 3 Town
  structures are *completed*.
- Gaul Town-class buildings available in town phase: forge 200 wood/120 s,
  market 300 wood/150 s, temple 300 wood/200 s (gaul override; generic
  temple is 300 stone). Gaul barracks is Village class — useless for city.
- Building the three serially (one `pendingBuild` at a time, 2 builders
  per foundation) takes ~7 min after town phase: city at ~14.7–15.7 min
  across seeds 1–5. Wood dips to ~90 around t=9–11m while town buildings
  compete with houses.
- Statistics-JSON determinism hash: extract the block from the first line
  `{` to the first line `}` in stdout and sha256 it; lines after the JSON
  (replay path, profiler counters) differ between runs.

## 2026-08-20 — Goal 4 (town phase)

- `gameState.currentPhase()` returns a **number** (1=village, 2=town,
  3=city), not a tech-name string. A `=== "phase_village"` comparison in
  the goal-3 code silently never fired (Fertility Festival was never
  researched in the goal-3 runs — CC-only training still passed).
- Phase techs: town = 500f/500w, 30 s, requires 5 `Village`-class
  structures; city = 750 stone/750 metal, 60 s, requires 3 `Town`-class
  structures (houses/fields are Village; barracks/market/forge/temple…
  are Town). Researched at the CC; use the `_generic` tech name for gaul.
- With house training unlocked, food income is fully consumed by
  training — a fixed "research when affordable" threshold is never
  reached. Working pattern: pause ALL training once requirements are met,
  bank the cost, research, resume training as soon as research starts.
- End-of-game `metadata.json` playerStates carry `phase` and
  `researchedTechs` — usable to verify phase goals without parsing bot
  logs.

## 2026-08-20 — Goal 3 (population growth)

- **Passability grid bit semantics are inverted vs intuition**: bit SET =
  IMPASSABLE for that class (`IS_PASSABLE(item, mask) = (item & mask) == 0`,
  `CCmpPathfinder.cpp` / `helpers/Pathfinding.h:130`). An inverted check
  makes every building spot look blocked. Petra's `createObstructionMap`
  matches this convention.
- `passabilityClasses` masks are assigned **alphabetically** (std::map
  iteration), not in XML order: building-land=1, building-shore=2,
  default=4, default-terrain-only=8, … Always use
  `gameState.getPassabilityClassMask(name)`.
- `entity.construct(...)` (the AI helper) sends `autorepair: false`: the
  foundation is created instantly at command processing and **no builder is
  sent** — order `unit.repair(foundation)` separately the next cycle.
- Building placement check that works: footprint cells clear in the
  `building-land` passability grid + all covered territory tiles owned by
  the player. Ring search around the CC (32 angles × 3 m steps out to
  ~90 m) finds spots even in cluttered temperate forest; a narrow 18–45 m
  ring with 16 angles exhausted within minutes.
- Houses train women only after researching Fertility Festival
  (`unlock_civilians_house_generic`, 250f/100w/100m, 60 s, at any house).
- Key numbers (gaul): start = CC + 4 women + 4 infantry + 1 cav (pop 9/20);
  woman 50 food, 8 s at CC (30 s from houses); house 75 wood, +5 pop,
  11×11 m; field 100 wood, 22×22 m, infinite grain, 5 gatherers, dr 0.9.
- House demand scales late: CC + N houses training needs up to 2–3
  concurrent house foundations and counting in-progress houses as future
  +5 cap, else pop touches the cap transiently (seen at t=25m with 1-at-a-
  time building, margin trigger 8).

## 2026-08-20 — Goal 2 (gathering)

- `BaseAI.this.timeElapsed` is set once at `Init` and never updated — use
  `gameState.getTimeElapsed()` for the live sim time.
- `filters.byResource` (hence `gameState.getResourceSupplies("food")`)
  **excludes huntable animals**; use `getHuntableSupplies()` for meat.
  `isHuntable()` already excludes retaliating animals (lions/wolves) and the
  filter excludes sea creatures.
- Gaul start (mainland): CC + 4 women + 2 spearmen + 2 javelineers +
  1 cavalry javelineer. Cavalry gathers **only** `food.meat` (rate 5, great
  hunter); infantry gathers wood/stone/metal at ~0.5–0.75, fruit at 0.5;
  women are the best fruit gatherers (rate 1).
- With 9 starting workers at 3/2/2/2, 30 in-game minutes yield roughly
  food 2600–3500, wood 1600, stone 1300, metal 1250 (mainland 192).

## 2026-08-20 — Goal 1 verification

- `maps/scripts/NonVisualTrigger.js` override works: the engine registers it
  as a custom trigger script in every `-autostart-nonvisual` game, and the
  brennus copy (mounted after public) wins. Verified in-game.
- A no-op bot vs sandbox Petra never ends a `conquest_civic_centers` game on
  its own — a time-limit trigger calling
  `EndGameManager.MarkPlayersAsWon([1], ...)` ends it cleanly: engine exits 0,
  `metadata.json` + statistics JSON written.
- `StatisticsTracker.GetStatisticsJSON()` (the stdout per-player JSON) has NO
  `timeElapsed` field in 0.28.0; simulation time is in the replay's
  `metadata.json` (`timeElapsed`, ms).
- Statistics JSON on stdout is pretty-printed (`"playerState": "won"` with a
  space) — grep patterns must account for that.
- Turn rate with few entities (no-op bot vs sandbox Petra, mainland 192):
  ~375 turns/s (9000 turns in ~24 s wall), much faster than the ~113 t/s
  from the busier smoke-test match. Size wall timeouts accordingly.
- Trigger-script scheduling: `cmpTrigger.DoAfterDelay(ms, "MethodName", {})`
  calls `Trigger.prototype.MethodName`; simulation ms (200 ms/turn).


## 2026-08-21 — Goal 7 session (v34→v54, city 17.3→14.8, pop300 18.0→15.6)

- Gaul **tavern** (`structures/gaul/tavern.xml`): Town class, 100w+100s,
  BuildTime 200, **+10 pop**. Parent `template_structure_civic_house` so it
  keeps class House (trains women after Fertility Festival, researches
  pop_house techs). Cheapest Town-class structure — ideal third member of the
  3-Town-structures requirement for `phase_city_generic`.
- `phase_city_generic`: 750s/750m, needs 3 Town-class structures, 60 s.
- Tech costs (0.28.0): plows 200w/100m (village); farming_training 300w/200m
  (town); gaul harvester 200w/100m (gaul town); ironaxes 200w/100m (village);
  pop_house_01 300w/100s; capacity 200f/200w; fertilizer 400w/300m (city).
- `BatchTimeModifier` exists only on CC (0.8) and a few military/econ
  buildings — houses have none; batching house foundations gives no discount.
- Whole-forest union-find as "biggest woodline" spreads choppers over ~200 m
  (v36); a bounded hotspot (45 m zone around densest 30 m cell, 90 m
  neighbourhood score) actually concentrates them.
- Storehouse depletion: testing only THE nearest supply misfires on
  half-eaten trees (build/destroy loop, v36); must also skip when any
  gatherer works within 40 m (v37).
- Worker-assignment shares steer only IDLE units; existing assignments
  persist. Miners must be actively `stopMoving()`-ed when the city bank is
  spent, else ~25 mine uselessly through the sprint (v52/v53).
- Fixed mining shares seesaw city-vs-pop (v37–v40). Rate-matching miners to
  the bank deadline works, but no mining before t≈8 (early miners cost ~3×
  in un-trained women — v41/42), and re-mining after the bank is spent must
  be cut (v41).
- Grain/house-cap techs stall behind the 750-metal city reserve from
  trio-done on (v46: plows at 12.1) — they need a bank-floor exception +
  miners pre-filling + the city research waiting for them.
- First-dropsite placement must filter candidates to own territory + CC
  region and must not block the rest of construction on failure (v35:
  18 min total stall).
- Counting queued women at face value in the house-margin calc under-builds
  cap at the sprint (queue holds ~45 women food can't deliver; cap 260–278
  at t=15 in v48–51).
- Food volume is the pop300 blocker: ~12k food gathered by t=15 vs ~15k
  needed; untried levers = tavern as sprint cap building, trade income as
  food, fields-per-gatherer ratio, earlier farming_training.

## 2026-08-21 — Goal 7 round 2 (herding, berries→farm transition, v55–v71)

- **Vary probe seeds when iterating a goal** (Louis). Seeds differ a lot:
  seed 2 is berry-poor with a village pop-pin, seed 3 hits the pop-cap queue
  deadlock. Tuning on one seed overfits; both v68 and v69 "fixes" passed on
  one seed and regressed another.
- **Which animals flee, source-verified (UnitAI.js, 0.28.0)**: every alive
  huntable animal is stance `passive` (herd/domestic) or `skittish`
  (hunt_skittish); both have `respondFlee: true`, so ALL are ordered to flee
  on attack (`INDIVIDUAL."Attacked"` → `RespondToTargetedEntities`, no
  vision/range check), and the FLEEING state runs at WalkSpeed×1.67
  (RunMultiplier). Retaliators (boar/wolf/bear/lion/elephant/…) are
  defensive/passive-defensive and are excluded from `getHuntableSupplies`
  anyway (they have Attack). So "doesn't flee" = dies before it can move:
  maxHitpoints ≤ 20 dies to the first 18-pierce javelin (chicken/rabbit/
  peacock/piglet); slow domestics (sheep/goat/pig, mul 0.45 → ~4.7 m/s
  flee) crawl 10-40 m while dying. Deer/gazelle (25 HP, 6.3 m/s) truly
  flee. Temperate mainland: startingAnimal=chicken (~9 m from the CC),
  main=deer, secondary=sheep. Treating one-hit animals as non-fleeing
  (kill+collect in place) was probed in v74/v75 and REGRESSED both ways
  (seed 1 pop300 14.9→16.1; seed 2 unchanged) — the cav loses more herding
  time collecting far kills than the meat pays; the civilians' far-side
  dance also beats chasing crawl-fleers. Keep the 150-turn behavioral
  fallback as the only no-flee detector.
- The engine's gather **autocontinue** drifts pickers to the next supply
  without consulting the AI — pickers silently end up 100+ m from any
  dropsite. A periodic sweep that re-targets out-of-range gatherers is
  needed.
- **Never `stopMoving()` a loaded returner** (v58 collapse): re-target only
  units in GATHER state AND empty-handed; a stopped loaded unit drops its
  carried resources on reassignment.
- The bank/`fertPending` wood freezes block ALL construction orders from
  t≈2.5–5.5. Bootstrap fields (wood-only, no food) must be ordered BEFORE
  the freeze starts or explicitly exempted, else farming starts at t≈7.5
  (v61 deadlock).
- Emergency houses fire constantly in village phase on the queue-inflated
  margin and hold wood < 100, starving field foundations. The first 2
  bootstrap fields must outrank the house stream when fruit is nearly out
  (`fieldDemand` + fruitStock gate).
- **Pop-cap-pinned CC queue deadlocks phase research**: when pop == popLimit
  the trainer queue never drains, so a queued phase tech never starts.
  Cancel the training queue (`stopProduction(item.id)` per item) when
  phaseReady and pinned (seed 3).
- Replay `commands.txt` does not contain AI commands in a greppable form —
  don't bother mining it for bot debugging; use in-mod telemetry prints.

## 2026-08-21 — Louis's round-3 tips (audited one by one, kept only what paid)

Protocol: implement each tip alone on the re-derived baseline (v71 band
reverted, v70 kept: seed1 14.5/14.9, seed2 14.4/15.1, seed3 14.3/15.0,
seed4 13.7/13.6, seed5 13.7/14.7), probe seeds 1-2, full batch when good.
The session-start batch dirs were pre-v70, so their seed-3/5 numbers
(14.4/14.7, 13.9/14.2) are not comparable — always re-derive the baseline
from the current tree.

- **Tip 1 (no-flee kill+collect): DISCARDED.** Making the cav collect its
  in-place no-flee kills cost seed 1 pop300 14.9 → 16.1; the 150-turn
  fallback fires on far kills whose collection eats more herding time than
  the meat pays. Exempting one-hit animals (≤ 20 HP) from the civilians'
  far-side dance also regressed (14.9 → 15.7): those crawl-fleers are best
  herded like everything else. Keep the behavioral fallback as the only
  no-flee detector.
- **Tip 2 (cav collects its own kill before the next target): DISCARDED.**
  Seeds 1-2 byte-identical (all kills are outside territory, already
  collected), but seeds 3/5 pop300 +0.3/+0.5 — the lost herding time costs
  more than the meat pays.
- **Tip 3 (farmstead by a ≥300-food carcass clump in territory):
  DISCARDED.** The trigger never fired on any of the 5 seeds — on mainland
  temperate, starting chickens die at ~9 m from the CC (a food dropsite
  already serves them), and herded kills get collected. Keep an eye out if
  the map/biome changes.
- **Tip 4 (concentrate miners on ONE mine per resource): KEPT — goal 7
  now passes 5/5.** Pinned mine = nearest to the CC with supply, re-picked
  when depleted/lost; findSupply prefers it until isFull() (24 gatherers
  on large mines) spills to the nearest other. Effect: seed2 15.1→14.9,
  seed3 15.0→14.8, seed5 pop 14.7→14.3, seed1 14.7/14.9, seed4 same —
  city/pop300 all ≤ 15.0, determinism OK. The concentrated clump also
  makes the mine-storehouse logic build ONE well-placed storehouse.
- **Tip 5 (spread field workers to the least-crowded field): DISCARDED.**
  Global least-crowded: seed1 pop300 14.9 → 15.1 (fails the deadline),
  seeds 2/3 pop300 -0.3/-0.4 but goal NOT MET. A 25 m cluster-window
  version was worse (city +0.7 on both probes). The extra walk to a
  slightly emptier field costs more than the DR (0.9^n) gain; nearest-first
  stays. The engine's gather autocontinue may still pile workers onto one
  field after the AI's initial assignment — the fix, if any, belongs in
  the anti-drift sweep, not in findSupply.

## 2026-08-21 — Building orientation: align everything on the CC angle (Louis)

The bot placed every building at angle 0 while the CC sits at 135° — the
whole base looked twisted. Aligning costs nothing measurable and is kept.

Verified facts (engine, 0.28.0):

- `entity.angle()` (common-api `entity.js:602`) returns the CCmpPosition
  yaw in radians — exposed to the AI via `AIProxy.js:233`
  (`cmpPosition.GetRotation().y`). On mainland temperate the starting CC
  yaw is exactly 3π/4 (135.0° on all 5 seeds), NOT the rmgen
  `BUILDING_ORIENTATION` (-π/4); trust the runtime value.
- `construct(template, x, z, angle, metadata)` takes the yaw directly.
- A rotated footprint's corners reach past its axis-aligned box
  (11×11 house at 135°: AABB 15.6×15.6), so BOTH the placement prefilter
  AND the aligned plot grids must rotate with the angle: with all
  buildings sharing one angle, a rigid rotation of the whole plot set
  preserves every distance — rotating the grids keeps the 14/24 m pitches
  valid, while keeping axis-aligned rows would overlap rotated footprints
  at the corners (verified by geometry, and the 88-failure probe).
- Prefilter variants, probed on seed 1 (baseline city/pop300 14.1/14.9):
  - center-sampled exact rotated rect, no inflation: 88 `construct
    FAILED` lines (42 farmstead, 35 storehouse, 11 market) — tree cells
    whose centre sits just outside the footprint still overlap it, the
    engine rejects, each rejection burns 50 turns of blacklist latency.
  - rotated axis-aligned box (conservative, old code's semantics):
    0 failures, city 13.6, but pop300 NEVER reached (284 by the 18 min
    limit) — the box is up to 41% larger than the true footprint, pushes
    near-tree farmsteads/fields outward (grain dist 15-17 m vs 3-6 m in
    the baseline) and starves the house stream (38 houses at 15 min vs
    46).
  - KEPT: exact rotated rect inflated by half a navcell diagonal
    (0.75 m), cell-centre sampled — conservative yet footprint-tight.
    0 failures, city 14.4 / pop300 14.8 on seed 1.
- The passability map given to the AI has 1 m cells, the territory map
  4 m; the obstruction grid marks cells a footprint overlaps (boundary
  touch does NOT mark — the 2 m field lanes survive the inflation).

A/B (5 seeds + determinism, re-derived baseline first — reproduced the
recorded batch exactly):

| seed | baseline | aligned | delta city/pop300 |
|------|----------|---------|-------------------|
| 1 | 14.1/14.9 | 14.4/14.8 | +0.3/-0.1 |
| 2 | 14.7/14.8 | 14.5/14.6 | -0.2/-0.2 |
| 3 | 14.3/14.0 | 14.4/13.9 | +0.1/-0.1 |
| 4 | 13.5/13.6 | 13.8/13.4 | +0.3/-0.2 |
| 5 | 14.3/13.9 | 13.9/13.0 | -0.4/-0.9 |

Mean city 14.17 → 14.23 (+0.06 min), mean pop300 14.35 → 14.08 (-0.27
min): neutral on city phase, slightly positive on pop300, within the
seed-to-seed noise band. Zero JS errors, seed-1 rerun hash identical,
all 5 seeds ≤ 15.0 on both criteria.

Statistical confirmation (seeds 11-20, never iterated on; both commits
extracted from git; zero JS errors; per-variant seed-11 rerun hashes
identical): city paired delta -0.03 ± 0.27 min (t=-0.35, p=0.734),
pop300 -0.02 ± 0.37 min (t=-0.17, p=0.868) — the orientation change has
no measurable impact on the boom on unseen seeds, and both variants hold
the goal-7 ≤ 15.0 criteria on all 10. The alignment is free; ship it.
