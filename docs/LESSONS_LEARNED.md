# LESSONS_LEARNED.md

Things learned while developing the bot, so they are not investigated again
and mistakes are not repeated. Short, dated, factual entries — newest first.

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
