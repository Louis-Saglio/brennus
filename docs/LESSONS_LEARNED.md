# LESSONS_LEARNED.md

Things learned while developing the bot, so they are not investigated again
and mistakes are not repeated. Short, dated, factual entries — newest first.

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

