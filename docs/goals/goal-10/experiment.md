# Goal 10 — Defeat medium aggressive Petra (started 2026-08-24)

**Status: PASSED (agg12, 2026-08-24). Five seeds in a row (1-5) won by
conquest under 45 in-game minutes, zero JS errors, no harness-trigger
wins: 38.1 / 31.8 / 35.1 / 26.6 / 29.8 min.**

All runs on kiln (MCP) — the full matches are too heavy for this VPS.
Spec: `random/mainland` 192, temperate, circle, `conquest_civic_centers`,
bot = `brennus_gaul_generic_land_map` gaul vs Petra diff 3 **aggressive**
rome, `in_game_limit_min=45`, `wall_budget_s=1800`. Teams pinned 1 vs 2.

## Baseline (goal-9 def17 copy, last-CC rule removed) — seeds 1-5

All 5 seeds **defeated at 26-33 min** (turns 7817-9851). The bot trained
0-45 infantry total; Petra killed 208-419 civilians per game. Root cause:
the whole defense (roster, training, buildings) is gated on
`expansionOn()` = city + 300 pop (~15 min), but aggressive Petra's army is
43 at 10 min, 86 at 15 and camps the base from ~16 min. The muster also
froze on its 300f/400w floors — the boom never leaves such stockpiles.

## Iterations (probes on seeds 1-3)

- **agg1** (defenseOn at town phase; roster/buildings/training from town;
  2 barracks + 1 temple + 3 towers pre-boom; pre-boom floors 250/250):
  zero infantry trained — the boom spends the flow to near zero every
  block, so any floor ≥ batch cost never fires. Barracks landed 9.1/9.5m.
- **agg2** (manageDefense moved FIRST in the 5-turn block): still zero
  infantry on s1 — priority order doesn't raise the stock level; the house
  stream drains food at 50 before the barracks' 75/250 floors.
- **agg3** (pre-boom batches of 1 at flow-level floors): infantry trains
  (22/31/110), army peaks at 34 by 16.4m — but Petra's first wave is ~106
  units at 16m; attack-moving into the blob melted the army; died 26-33m.
- **agg4** (warOn() = city researched, no pop-300 gate; army target 40→100
  at city; worker cap 175 post-city; stand-ground at the CC when
  outnumbered instead of attack-move): muster still starved (8-16 infantry
  on s1/s2) — the war fund didn't exist yet and the boom out-spent the
  barracks; died 26.5-34.4m.
- **agg5** (war fund: 300 wood phaseReserve while defense buildings
  missing; worker cap 100 pre-war; target 60; 3 barracks by 8.4m; army 60
  at 16m ✓): two new failures — (1) the pre-city sortie donated the whole
  army to Petra's 75-106 camp at 16.2m; (2) city phase never researched:
  the fund + muster starved the boom techs (plows at 16.4m) and houses
  (pop cap stalled at 120). Died ~25m.
- **agg6** (sortie gated on warOn; city tech-hold removed — city
  researched as soon as 750s/750m are banked; war fund 150; worker cap
  130): **all 3 seeds survived to the cap** — s2 **won by conquest at
  44.4m** (3 CCs razed), s1/s3 trigger-ended with 0 CCs razed. City still
  late (18.5-20.2m — 130 workers grind 750s/750m slowly); arsenal landed
  ~10 min after city (temples/forge first) so the first real raid was at
  33.7m; the 20.2m raid went in with 0 rams (arsenalBuilt exception) and
  donated the army twice.
- **agg7** (raids always need ≥ 2 rams; rams 4→6; arsenal ordered before
  temples/forge post-city; pre-war worker cap 150): probing seeds 1-3.
- **agg8** (defense first in the 5-turn block; pre-war target 60 at
  50f/50w flow floors; post-war target 100 batch-5 at 300f/400-or-300w
  floors; serious threat: garrison the threatened CC when outnumbered
  (+1 arrow per soldier, 1 hp/s heal), eject and fight when superior;
  raids abort if rams hit 0 or older than 600 turns): **all 3 seeds
  failed.** s1 trigger-ended at 45.0m — razed the first CC at 40.8m but
  the 2-min raid age cap abort/relaunched in a loop against the second
  (army walked home and back twice, never attacked). s2 trigger-ended
  with 0 CCs razed — two sorties donated ~50 soldiers (the camp grows
  while the army marches: 60-vs-32 became 60-vs-83 mid-field) and the
  first ram trained at 31.4m, 11 min after the arsenals were ordered —
  phase-3 shares mine 1% stone/metal, so metal sat at ~40 forever. s3
  defeated at 34.7m — the 16.9m wave (105 units) melted the 60-strong
  army to 24 by 18m, then the food economy was farmed (grain 92%→10%)
  and the army never rebuilt (10 at 33m).
- **agg9** (raid age cap 600→1800 turns — the far-CC walk alone is ~2
  min; war-stage phase-3 mining shares: stone 0.06 below 400 banked,
  metal 0.12 below 800 banked; sortie gate tightened to army ≥ 100 AND
  ≥ 1.5x camp): probing seeds 1-3.
- **agg9** (raid age cap 600→1800 turns; war-stage phase-3 mining shares
  stone 0.06/metal 0.12 until 400s/800m banked; sortie gate army ≥ 100
  AND ≥ 1.5x camp): **s1 won by conquest at 37.9m** (CC razed 34.2m),
  **s2 won by conquest at 27.0m** (CC razed 23.3m). s3 still defeated at
  34.9m, same shape as agg8: the 16.9m wave melts the 59-strong army
  (59→39 in 18s) because the superiority check uses threat.n — enemies
  already within 120m of the CC — which read 8 while the other ~90 were
  still marching in. The army attack-moves into the open and dies.
- **agg10** (superiority check counts enemies within 150m of the threat
  centroid, floored at threat.n — garrison the CC instead of engaging
  when the incoming wave outnumbers the army): probing seeds 1-3.
- **agg10** (superiority check vs enemies within 150m of the threat
  centroid): **s1 won 34.2m, s2 won 30.5m**; s3 still defeated at 32.4m.
  s3's wave (~119 units, camped at 41-79m from the CC from 17m on, never
  dipping below 82) is simply bigger than the 59-strong army; even after
  garrisoning, the ~39 soldiers who don't fit in the CC (cap 20) stand
  outside and are slaughtered, then the economy is farmed. On s1/s2 the
  enemy army visibly dips after each wave (108→10, 95→13) — on s3 it
  never does, so the first clash decides the game. Tower facts from the
  pinned templates: stone defense tower = 4 default arrows, +1 per
  garrisoned Infantry, holds 5; CC = 6 default + 1/soldier.
- **agg11** (5 home towers from the town phase instead of 3 — they are
  garrison platforms, not just shooters; the outnumbered branch now
  garrisons the threatened CC first then overflows into built towers
  within 120m, sheltering 45 soldiers behind ~70 arrows; the eject
  branch unloads towers too): probing seeds 1-3.
- **agg11** (5 pre-war home towers + garrison overflow into towers):
  **s1 won 38.9m, s2 won 33.7m**; s3 **survived to the 45-min cap**
  (previously always defeated 32-35m) — the tower garrisons hold the
  119-unit wave. But survival is not a win: s3 razed its first CC only at
  37.3m. Chain: city 19.6m → first ram 26.3m → raids at 29.5/34.2 spent
  (army 62-63 vs 19-37 defenders + CC arrows; the winning raid had 6 rams
  and razed in 0.9m). The army sat at ~60 because the 175-worker war cap
  pop-blocked growth until dismissal kicked in at 35.2m, 15 min after
  city — with a 14k food surplus banked.
- **agg12** (war army target 100→120, war worker cap 175→150, dismissal
  floor 170→145 — pop math: 150+10 healers+18 ram-pop+120 = 298; raid
  launch gate 60→75): probing seeds 1-3.
- **agg12** (war army target 120; war worker cap 150; dismissal floor
  145; raid launch gate 75): **GOAL PASSED.** Seeds 1-3 probes: s1 won
  38.1m, s2 won 31.8m, s3 won 35.1m (first real win on the hard seed —
  2 CCs razed, 420 kills). Validation seeds: s4 won 26.6m, s5 won 29.8m.
  All five are genuine conquest wins (no time-limit trigger line in any
  log, `playerState` won for player 1 / defeated for Petra, 2 enemy CCs
  razed each), zero JS errors. Win-time spread 26.6-38.1m leaves ≥ 7 min
  of margin under the 45-min cap.

## Conclusion

The winning recipe, in order of leverage:

1. **Rams are the whole offense.** Basic infantry cannot raze a
   garrisoned CC before Petra reinforces; every ramless or 2-ram raid
   donated the army. 6 rams + a 75+ escort razes a CC in ~1 min.
2. **Metal flow gates the kill clock**, not buildings: the arsenal was
   ordered ~1 min after city from agg7 on, but phase-3's 1% mining
   shares starved metal so the first ram trained 11 min later (agg8).
   War-stage mining shares (0.06 stone / 0.12 metal until 400s/800m
   banked) cut the city→first-ram lag to ~7 min and keep 6 rams
   streaming.
3. **The first wave is survivable only under arrows.** 60 basics in the
   open melt to a 105-119-unit wave in ~90 s. Garrisoning the CC (cap
   20) plus overflow into 5 stone towers (5 infantry each, +1 arrow per
   garrisoned infantry) shelters 45 soldiers behind ~70 arrows; the wave
   bleeds out against the buildings.
4. **Don't sortie without real superiority.** The camp grows while the
   army marches (60-vs-32 became 60-vs-83 mid-field); sortie gate is now
   army ≥ 100 and ≥ 1.5x the camp, and the engage/garrison decision
   counts enemies within 150m of the threat centroid, not just those
   already at the CC.
5. **Pop is the late-war constraint.** With the 300 cap shared, holding
   175 workers pop-blocked the army at ~60 for 15 min while 14k food sat
   banked; 150 workers (dismissal floor 145) leaves room for the full
   120-strong army + 10 healers + 6 rams (298).
