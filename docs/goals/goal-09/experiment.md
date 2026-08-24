# Goal 9 — Defend, boom and expand (started 2026-08-23)

**Status: bot created as a goal-8 copy and smoke-verified. First full match
shows the starting gap: the bot is defeated by medium defensive Petra at
~31 in-game minutes. No defend logic written yet.**

## Setup

- Opponent: Petra, difficulty 3 (medium), behaviour `defensive` (pinned on
  the command line: `-autostart-aidiff=2:3
  -autostart-aibehavior=2:defensive`). Runner: `tools/run.sh -a
  brennus_gaul_defend_boom_and_expand_generic_land_map -d 3 -v defensive`.
- Time limit: in-mod trigger now 45 in-game minutes (was 30 for goal 8).
  Goal-8 reruns must pass `-l 30`.

## Bot creation (this commit)

`brennus_gaul_defend_boom_and_expand_generic_land_map` is a byte-for-byte
copy of the goal-8 bot (only the header comment, `data.json` name and the
filename changed). The expansion shares are still tuned for the 30-minute
deadline (`expansionsShares`, deplete-by-t=30 sizing).

## Verification runs

### Probe (10-minute canary, seed 1)

Clean: `[HARNESS] brennus: loaded`, zero JS errors, time-limit trigger
fired at 10 min, engine exit 0.

### Full match (45-minute limit, seed 1, tag `full-s1`)

**The bot lost**: Petra conquered at turn 9270 ≈ **30.9 in-game minutes**
(45-min trigger never fired), engine exit 0 (game finished via
`conquest_civic_centers`).

| | player 1 (bot) | player 2 (Petra) |
|---|---|---|
| result | defeated | won |
| city phase | 14.3 min | — |
| pop 300 | 14.8 min | — |
| peak map % | 23 | 74 |
| units lost | 1069 (1068 workers) | 50 |
| units killed | 50 | 1069 |
| buildings lost | 83 (29 houses, 28 econ, 1 CC) | 0 |
| resources at end | food 21 / wood 31613 / stone 862 / metal 620 | — |

Readings:

- The boom bars hold (city 14.3, pop300 14.8 — both ≤ 15). The goal-8
  economy is intact right up to the collapse.
- Petra at medium difficulty **defensive** still attacks: it killed 1068
  workers and destroyed every expansion CC. "Defensive" restrains its
  tempo, not its willingness to kill an undefended economy.
- Territory peaked at 23% (goal 8 reached 77-94% against a sandbox): the
  expansion filter ("away from enemies") and Petra's own territory
  contest every CC placement from the start.
- Sim rate with a medium Petra opponent: ~32 turns/s (9270 turns in
  ~5:10 wall incl. startup) vs ~113 with a sandbox — plan goal-9 batches
  accordingly (a full 45-min match ≈ 7 wall minutes serial).

## 2026-08-24 — fresh kiln baseline (seeds 1-3, 45-min no cap reached)

Runs moved to kiln (MCP). Note: the kiln harness mod mounts its own
`NonVisualTrigger.js` last, so the mod's 45-minute trigger is inert on kiln —
the per-run limit comes from the job spec's `in_game_limit_min`.

| seed | outcome | turn | peak map% | units lost (civ) | enemy killed | Petra trained |
|---|---|---|---|---|---|---|
| 1 | defeated | 8461 ≈ 28.2m | 38 | 928 (923) | 48 | 312 (212 inf, 44 cav, 18 champ, 8 siege) |
| 2 | defeated | 8673 ≈ 28.9m | 23 | 1207 (1202) | 32 | 309 (211 inf, 44 cav, 27 champ, 6 siege) |
| 3 | defeated | 8827 ≈ 29.4m | 43 | 1151 (1146) | 48 | 329 (229 inf, 55 cav, 33 champ) |

Threat telemetry (seed 1, enemy totals everywhere on the map): 49 soldiers
at 10 min, 97 at 15, 149 at 20, first siege at ~23 min when the army
reaches the base (88 m from the home CC), 213 + 8 siege at 28 min (defeat).
Petra builds 2 fortresses and mass-produces infantry; the bot's only kills
come from CC arrows and workers fighting back.

## Defense v1 (this iteration)

Post-boom only (boom logic untouched): roster of every Soldier (minus the
herder), 2 barracks + 1 temple near the home CC, alternating
spearman/javelineer batches + fanatics up to 80 pop of army, women
dismissed for pop room, the civilian stream paused at cap-5 while the army
musters, workers garrison the nearest garrisonable structure when an enemy
soldier/siege is within 60 m (eject after 20 turns clear of 100 m), and the
army blob attack-moves to whichever own CC has enemies within 120 m
(nearest-to-home wins), rallying at the home CC otherwise.

## Next

- Defend logic is the goal: something must notice the Petra army and
  either contest it or wall/tower the expansion before the CCs fall.
- Re-tune expansion shares from the 30- to the 45-minute deadline.

## 2026-08-24 — defense iterations (kiln probes, 30-min cap, seeds rotated)

All probes: `random/mainland` 192, temperate, circle, conquest_civic_centers,
Petra medium defensive rome, `in_game_limit_min=30`.

- **def1** (defense v1 as above): seeds 1-2 survived to the cap but map
  control stuck at 23%, zero expansion CCs. Bugs found: barracks spam
  (foundation `templateName()` is `foundation|…` — the "already have it"
  count missed them, 7 barracks ordered); CC/corral orders randomly failed
  because `placeOrder` picks the nearest own unit — often an army soldier
  whose construct order the rally/attack-move code cancels next block.
- **def2** (foundation-aware counts, `placeOrder` excludes army): seeds
  2-3 won, seed 1 died at 29.9 min. Muster stalled at 4 soldiers from 15
  to 21 min: training required stock ≥ 1000 food/wood (the post-boom
  economy sits far below that), and pop hovered at 299/300 so the
  `pop >= limit` dismissal never fired (trainWorkers stops at limit-5).
  Once it fired it never stopped: 145-384 women dismissed per game,
  gutting the food economy. Expansion blocked: CC spots went stale
  (nearEnemy / enemy CC within 200 m) and were skipped forever, and a
  lone builder walking to a contested spot died (50-turn pendingBuilds
  timeout then poisoned the spot via failedSpots).
- **def3** (training floor 300/300, one batch per trainer per call,
  dismissal throttled to 1/3 turns with a 200-worker floor and trigger
  pop > limit-6, 3 barracks): all 3 seeds won. s3 reached 55% with 2
  CCs. Seed 2 showed the sequential plan flaw: one permanently-contested
  spot blocked all later spots.
- **def4** (stale spots rotate to the back of the queue with a retry cap,
  CC afford floor lowered to 400w/400s/300m, CC orders get a 4-worker
  party, pending CC timeout 150 turns, army rallies at the pending CC as
  escort): all won, but s4's 2 expansion CCs were razed — the army
  returns home after construction and 80 basics cannot hold a frontier
  against the 150-200-unit waves.
- **def5/def6** (forge + soldier attack/resistance techs, towers with the
  engine's 60 m Tower-to-Tower BuildRestrictions enforced in placement —
  the generic placer ignored it and every tower order failed silently;
  shelter no longer garrisons workers in `INDIVIDUAL.REPAIR.*` states,
  which was cancelling CC builders): all won, 38-45% map, one expansion
  CC standing at 30 min on every seed, losses way down (30-121 civ).
  Expansion is now rate-limited by Petra's territory: their CCs claim
  most planned spots before we get there (Petra peak 50-66%).
- **def7** (offense: with no home threat and army ≥ 70, raid the
  least-defended enemy CC, retreat below 45; stale spots now fully
  rotate/retry since razing clears nearCC): the s1 raid (army 71 vs 20
  defenders) was spent in 80 seconds — basic infantry cannot raze a
  garrisoned CC before reinforcements arrive; s2/s4 never reached army
  70 under churn.

## Defense v2 (current)

v1 plus: 3 barracks + temple + forge + arsenal at home, 3 towers at home
+ 2 per expansion CC (60-m spacing enforced), forge attack/armor techs
cheapest-first, worker dismissal throttled with a 200-worker floor,
builder parties of 4 for CCs, army escort of pending CC foundations,
stale-spot rotation, and the raid: army ≥ 70 + no home threat → raze the
least-defended enemy CC with 3 rams (300w/150m each, trained once the
army hits 60) while the infantry screens; retreat at 45.

## 2026-08-24 — v2 probes and the 45-minute picture (kiln, seeds rotated)

- **def8** (rams, 30-min cap, seeds 1/2/4): all won, s1 hit 62% map with a
  wonder; s2 regressed to 23% with zero CCs — Petra's army camps at
  100-270 m from our CC and sends 1-5-unit probes, so `threat` (any enemy
  within 120 m) was active almost permanently and the raid never fired.
  Simultaneously Petra raided our woodlines and razed ~10 storehouses.
- **def9** (threat split: only 8+ units or siege near a CC is "serious" and
  blocks/cancels a raid; sortie against siege camps ≥ 15 within 220 m when
  army ≥ 60% of camp; raid at army ≥ 60 with ≥ 2 rams; 4 rams from army
  40; army target 100; 4 barracks): all 3 seeds WON militarily — sorties
  under tower cover break Petra's waves, raids follow. But map only
  30-44%: the sequential CC plan placed 2 orders in 30 min. Food stock
  collapses to ~0-11k (army churn: 500-1000 units lost per game).
- **def10** (45-min cap, seeds 1/2/4; 2 concurrent CC projects, parties of
  6, spots no longer staled by lone stragglers once `enemyArmy ≤ 40`,
  never raze the LAST enemy CC — under conquest_civic_centers eliminating
  Petra ends the match immediately, before the 45-minute bars are due):
  s1 won 45%/49k wood, s2 won 44%, **s4 defeated at 43.6m** — Petra,
  kept alive by the last-CC rule, rebuilds a fully-teched 250+ late army
  (cav + champions + rams) that our basic-infantry army cannot stop;
  once the army broke (army=0 at 38m) the base was rolled. Food at 45m:
  2-4k on the wins. Two structural gaps: (1) army quality/churn — basics
  trade terribly late, every retrain is food; (2) map% needs far more
  than 2-3 CCs.
- **def11** (survivability package: 3 temples, 6 healers trailing the army
  — healers auto-heal at 12 m and cost only food+metal, towers 4 home /
  3 per expansion CC since stone is abundant, healers persisted in
  Serialize): running.

Harness semantics learned (kiln `NonVisualTrigger.js`): at
`in_game_limit_min` the trigger marks player 1 won and stats print; but if
Petra loses ALL civic centres earlier, conquest fires and the game ends
early — hence the last-CC rule.
