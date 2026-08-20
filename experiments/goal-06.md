# Goal 6 — Master the economy by 30 in-game minutes (2026-08-20)

**PASSED** on 5 seeds in a row.

Criteria (all by t=30m, end-of-game statistics JSON unless noted): 300
population, all 26 economic technologies researched, City Phase, ≥10
traders, ≥1000 tradeIncome, ≥300 wood sold against stone at the market.

## Setup

- Opponent: Petra sandbox, rome. 30 in-game-minute time limit.
- Command as in `experiments/goal-01.md`; runner `tmp/goal6/run.sh`
  (5 seeds + seed-1 determinism rerun, 2 parallel waves of 3).
- New bot behavior (see brennus.js comments for the full story):
  - `manageResearch`: all 26 gaul econ techs; village tier from surplus
    only (never eating the 500f/500w town bank), town+ with the
    `techReserve` liquidity throttle (women/traders spend only surplus
    above the pending tech's food cost).
  - `manageConstruction` priority order from town phase: markets/trio →
    houses → econ buildings → fields; wood banking guards so houses and
    fields never starve the 300-wood market orders.
  - Markets placed at the buildable spot farthest from the previous one
    (CC root territory radius is 140 m): routes of 169–267 m.
  - `manageTrade`: 14-trader target, trader food reserved ahead of the
    woman stream, fixed metal buffer (230) instead of the tech reserve.
  - `manageBarter`: 5×100 wood→stone once wood > 1000.
  - Threat avoidance: supplies and building spots near enemy structures
    (100 m) / mobiles (60 m) / aggressive gaia animals are excluded.
  - Construct orders are only sent with resources in hand, and
    construction is held one block after a research order (the engine
    rejects unaffordable constructs at processing time; a rejected order
    used to blacklist the spot forever).
- Verification analysis: `tmp/goal6/analyze.py`.

## Results

| seed | errors | town | city | techs 26/26 at | traders | tradeIncome | wood→stone | pop | stats sha256 (12) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 7.0 | 13.9 | 27.1 | 17 | 1554 | 500/363 | 300 | 80026a339818 |
| 2 | 0 | 6.0 | 15.0 | 27.6 | 15 | 1921 | 500/393 | 300 | 0e3a0401c3af |
| 3 | 0 | 7.0 | 15.2 | 28.9 | 15 | 1365 | 500/387 | 300 | 3a08ae05ec14 |
| 4 | 0 | 6.6 | 16.3 | 27.4 | 16 | 1358 | 500/382 | 300 | dbde06aec26f |
| 5 | 0 | 8.4 | 14.3 | 27.3 | 14 | 1679 | 500/356 | 300 | 9889172fa49a |

- No regressions: town < 12 min and city < 20 min on all seeds
  (goals 4/5), zero JS errors, zero construct failures, workers lost 0–1.
- Determinism: seed 1 rerun byte-identical statistics JSON
  (sha 80026a339818).

## Hard bugs found on the way

- Uncapped trader headroom (18 pop slots) exceeded the early-town
  population limit and froze woman training (pop stuck at 32) — capped
  at 6.
- `getEnemyEntities()` includes gaia (diplomatic enemy): filtering
  supplies/spots "near enemies" blacklisted every tree on the map and
  paralyzed the bot. Gaia is now filtered to aggressive animals only.
- Sandbox Petra is not harmless: its defensive units killed 37 workers
  gathering near its base on seed 5.
- Houses ordered without an affordability check were rejected by the
  engine at processing time; each rejection permanently blacklisted the
  spot, burning the whole building ring on forested maps (seed 5: no
  houses/fields for 15 min).
