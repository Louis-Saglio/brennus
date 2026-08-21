# LESSONS_LEARNED.md

Things learned while developing the bot, so they are not investigated again
and mistakes are not repeated. Short, dated, factual entries — newest first.

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
