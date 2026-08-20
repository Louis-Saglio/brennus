# LESSONS_LEARNED.md

Things learned while developing the bot, so they are not investigated again
and mistakes are not repeated. Short, dated, factual entries — newest first.

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

