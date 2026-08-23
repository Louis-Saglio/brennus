# LESSONS_COMPILED.md — Brennus bot-development lessons, structured by topic

A thematic re-compile of the lessons learned while developing the bot. The
**source of truth remains `docs/LESSONS_LEARNED.md`** (chronological log,
newest first — new lessons still get written THERE, not here). This file
regroups the same content by topic for reading and lookup, merging duplicate
findings and keeping per-bullet provenance. **Reference material is not here**:
game mechanics live in `docs/game_description/mechanics/`, entity data in
`docs/game_description/{generic,gauls,romans}/`, and the engine API / scripting
facts in `docs/ai_engine_api.md` (all extracted 2026-08-22). This file keeps
only bot-development lessons. If files disagree, `LESSONS_LEARNED.md` wins.

All dates are 2026-08; bullets are tagged `[08-2X]` (day only). "SHIPPED" /
"DISCARDED" verdicts are the final state at compile time.

Compiled from: `docs/LESSONS_LEARNED.md` (26 entries, 08-20 → 08-22),
the goal experiments (`docs/goals/*/experiment.md`).
Compile date: 2026-08-22.

## Contents

1. [Methodology & verification](#1-methodology--verification)
2. [Harness, telemetry & tooling](#2-harness-telemetry--tooling)
3. [The food economy](#3-the-food-economy)
4. [Hunting & herding](#4-hunting--herding)
5. [Construction & placement](#5-construction--placement)
6. [Phases, population & research](#6-phases-population--research)
7. [Trade & market economy](#7-trade--market-economy)
8. [Boom sensitivity & tuning discipline](#8-boom-sensitivity--tuning-discipline)
9. [Performance](#9-performance)
10. [Appendix A — provenance map](#appendix-a--provenance-map)

---

## 1. Methodology & verification

- **Determinism is verified per batch**: a seed rerun must produce
  byte-identical statistics JSON (sha256 of the pretty-printed per-player
  blocks from stdout). Seed-1 reruns are the standing check. `[08-20]`
- **Hash extraction recipe**: extract the block from the first `{` line to
  the first `}` line of stdout and sha256 it; lines after the JSON (replay
  path, profiler counters) differ between runs. `[08-20]`
- **Always re-derive the baseline from the current tree** before an A/B
  session. Session-start batch dirs can be from an older commit (Louis's
  round-3 session: the pre-v70 dirs made seed-3/5 numbers incomparable).
  `[08-21]`
- **Vary the probe seed while iterating** (Louis). Seeds differ a lot: seed 2
  is berry-poor with a village pop-pin, seed 3 hits the pop-cap queue
  deadlock, seed 1 is the noisiest (city/pop300 ranged 14.1–14.6 / 14.8–16.1
  across history). Both v68 and v69 "fixes" passed on one seed and regressed
  another. `[08-21]`
- **Statistical confirmation on fresh seeds**: 10 never-iterated seeds
  (11–20), paired per seed, reported as mean ± stdev (t-test with t and p
  when settling a verdict). Noise band is roughly ±0.2–0.4 min; deltas inside
  it are "no measurable impact", not wins. `[08-21]`, `[08-22]`
- **The 5-seed goal-7 bar**: all of seeds 1–5 must hold city AND pop300
  ≤ 15.0 min; one seed breaking the bar kills the change, regardless of the
  mean. `[08-21]`
- **Steppe metric (Louis)**: minimize `Max(pop300, city)`, NOT both
  independently — delaying pop300 to pull city in is explicitly acceptable
  when city is the slower one. Steppe needs a 30-min time cap (the 18-min
  cap is too short: seed 5 never reached city within it). `[08-22]`
- **Parallel verification**: pyrogenesis is mostly single-threaded, so run
  one match per core, each with its own isolated HOME. A 6-run verification
  (2 waves × 3 parallel on 4 cores) takes ~1–2.5 min wall. `[08-20]`
- **Time limits**: an undecided game never exits on its own; the in-mod
  time-limit trigger (marks a player won) ends the match cleanly with
  `metadata.json` + statistics JSON, while a wall-clock SIGTERM skips both.
  Size wall `timeout` from the in-game budget (turns = ms/200; wall ≈
  turns / turn-rate). `[08-20]`

## 2. Harness, telemetry & tooling

- **Replay `commands.txt` does not contain AI commands** in a greppable form
  — don't mine it for bot debugging; use in-mod telemetry prints. `[08-21]`
- **Telemetry pattern**: tagged `print()` lines (`[HARNESS]`, `[BUILD]`,
  `[DRIFT]`, `[HERDDONE]`, `[STARVED]`, `[HUNT]`). Log coarsely (init, phase
  changes, end-of-game summaries); printing every turn or in hot `OnUpdate`
  paths slows the simulation measurably — measure the turn rate with and
  without. `[08-21]`, `[08-22]`
- **The t=30m status log never prints** when the time-limit trigger fires
  first — the last visible HARNESS status is t=25m. `[08-20]`
- **Footprint tooling**: `tmp/footprint-compare.py` and `tmp/gen-sizes.py`
  (parent-chain resolution + per-civ diff); `tmp/verify-docs.py` cross-checks
  the docs against game data (149 override lines, 0 mismatches). The
  `tools/` directory referenced by `docs/game_description/README.md` no
  longer exists in the repo. `[08-22]`

## 3. The food economy

- **Gaul start (mainland)**: CC + 4 women + 2 spearmen + 2 javelineers +
  1 cavalry javelineer (pop 9/20). `[08-20]`
- **Starting-economy reference**: with 9 starting workers at 3/2/2/2,
  30 in-game minutes yield roughly food 2600–3500, wood 1600, stone 1300,
  metal 1250 (mainland 192). `[08-20]`
- **Walk economics** (woman 9 m/s, carry 10): a grain field at 5 gatherers
  = 0.41 f/s effective → 85% efficiency needs ≤ ~19 m edge walk; wood
  (0.7/s) → 75% needs ≤ ~21 m. The walk is paid twice per delivery
  (unit → supply, supply → dropsite). Farmsteads cannot fit between grid
  fields (22 m footprint on a 24 m pitch) — they land just outside the
  cluster perimeter. `[08-21]`, `[08-22]`
- **A dead animal becomes a NEW corpse entity** — the attacked entity's id
  dies with it, so tracking the kill by id and issuing `gather` on it NEVER
  works (the pre-v82 "carcass" branch was dead code). To collect a kill,
  re-find the corpse by position (nearest dead huntable within ~25 m of the
  animal's last seen position, tracked each block). `[08-21]`
- **`fruitStock ≤ 400` is a false "berries gone" at game start**: the
  initial served-fruit scan reads ~200–400 while the first pickers are still
  walking out. Gating a meat/field fallback on it alone (v81) sent women to
  distant chicken carcasses and cost seed 1 ~2 min of training. Fix: a latch
  — only engage the fallback after the stock was ever > 400. `[08-21]`
- **Combined food pool (SHIPPED, Louis's rule)**: `findSupply`'s two gated
  branches are replaced by ONE ungated branch — nearest supply of type fruit
  OR dead-meat-in-own-territory within 40 m of a food dropsite wins; fields
  (grain) fall through. **Herder carve-out (shipped, Louis's pick)**: the
  carcass that is the herder's current target stays the herder's
  (`!(s.id() === this.herdTarget && !this.herdingDone)`); slow kills and
  outside-territory fast kills leave the civilian pool. Batch: mean city
  14.18→14.10 (-0.08), pop300 14.24→14.04 (-0.20); 10 fresh seeds: city
  14.17 vs 14.21 baseline, pop300 13.74 vs 13.82, no bar break (worst city
  14.5, worst pop300 14.1). `[08-22]`
- **Pure pool first shot (DISCARDED)**: the pool without exclusions
  regressed (city +0.22, pop300 +0.14, seed 1 pop300 15.3 breaking the bar,
  seed 4 city 14.6) — the gap opens in the FIRST window (746 vs 865 food by
  t=3m): civilians get pulled onto the herder's served slow kills (~40 m
  out) that the cavalry collects anyway; the extra walk costs ~25% of a
  worker's cycle and compounds through the t=13–15 sprint (grain 6216 vs
  7660). `[08-22]`
- **Civilian carcass serving beyond 40 m regresses** (all three forms probed
  and reverted): radius-80 everywhere (s5 15.7); a fresh-kill map (civilian
  crossing the base exactly when the next horse is steered through it —
  s5 15.3); the map gated to > 60 m (s1 15.5 — the gain had come from the
  40–60 m band). The 40 m ring stays. `[08-22]`
- **Food is the boom's binding constraint**: pop300@15 ≈ 15500 food by
  t=15; training capacity (CC 10.3/min + 2/min/house) stops mattering once
  food income < demand (from ~t=8). The berry window (rate 1.0, 1.5 with
  wicker) is ~750 f/2.5 min early; meat is the starting cav (~400 f first
  window); everything else is grain. At t=15 the bot gathered ~12k vs ~15k
  needed — that gap is the pop300 blocker. `[08-21]`
- **Engine gather autocontinue drifts pickers** to the next supply without
  consulting the AI — pickers silently end up 100+ m from any dropsite. A
  periodic sweep that re-targets out-of-range gatherers is needed. `[08-21]`
- **Never `stopMoving()` a loaded returner** (v58 collapse): re-target only
  units in GATHER state AND empty-handed; a stopped loaded unit drops its
  carried resources on reassignment. `[08-21]`
- **Worker-assignment shares steer only IDLE units**; existing assignments
  persist. Miners must be actively `stopMoving()`-ed when the city bank is
  spent, else ~25 mine uselessly through the sprint (v52/v53). `[08-21]`
- **Pop-cap-pinned CC queue deadlocks phase research**: when pop ==
  popLimit the trainer queue never drains, so a queued phase tech never
  starts. Cancel the training queue (`stopProduction(item.id)` per item)
  when phaseReady and pinned (seed 3). `[08-21]`
- **Micro-pause loops (two mechanisms, both fixed)**: (1) the herder
  carried a stale turn-0 "food" assignment and the food-pool change extended
  the drift stop from fruit to meat — the drift stop `stopMoving()`ed the
  herder EVERY block while it collected carcasses beyond 45 m of every
  dropsite (74 stops on seed 5). Fix: exempt the active herder from the
  drift stop + clear the stale assignment when the herder is picked. (2)
  civilians looped (533 stops on seed 5, spikes t=13–17): the generic
  `findSupply` path could RETURN an unserved fruit/meat supply, and the
  drift stop killed the assignment next block — stop → reassign → drift →
  stop every second. Fix: the generic path returns fruit/meat only within
  45 m of a food dropsite (fields exempt — farmstead chaining serves them).
  After: 81 stops total, max 4 per unit. Engine fact used: the walk-back
  state is `INDIVIDUAL.GATHER.APPROACHING` — it contains "GATHER", so the
  bot's own gather re-issue was NOT the cause. `[08-22]`

## 4. Hunting & herding

- **Steer discipline (SHIPPED)**: a wounded animal flees away from the
  attacker's live position, so the steer works by keeping the herder BEYOND
  the animal on the line from the dropsite. Both the wound shot and the kill
  shot must only fire from the far side (reposition first, woodPoor
  included) — a near-side attack pushes the animal away from the base. The
  stall `!fleeing` kill fires ~2 s after each flee stop, then the attack
  pursuit carries the animal toward the dropsite at its flee speed — that
  pursuit leg is why kills land ~15–25 m from the dropsite no matter where
  the kill trigger fires. `[08-22]`
- **Pin the dropsite at wound time**: an unpinned `nearestFoodDropsite`
  recomputed every block flipped when the animal crossed the midpoint
  between two dropsites, the far-side point jumped across the animal, and
  the chase pushed it away from the base (s5: a horse went 135 → 187 m and
  died out of territory). `[08-22]`
- **The old no-progress fallback was broken**: it compared the
  dropsite-distance against the CC-distance (mismatched) and `herdBestDist`
  only decreases, so after any progress it could never fire again — a
  pushed-away animal steered on indefinitely. Compare the current distance
  against the pinned wound-time distance instead. `[08-22]`
- **A failed steer is the most expensive kill failure**: the carcass lands
  300+ m out, the cavalry collects it alone (rate 5.0, cap 20 → 10 round
  trips ≈ 5 min at 331 m), and no horse gets herded meanwhile — worth ~1.4
  min of pop300 (s5 14.3 → 15.7 in the civilian-radius probes). The flee-away
  fix removed it (s5 15.1 → 14.3, steppe mean max 14.70 → 14.54). `[08-22]`
- **`herdKillDist` 40 is a wash** (s1 pop300 15.4→15.1 but s5 14.3→14.6 with
  a new 167 m orphan): the kill-distance threshold is not the lever — the
  steer discipline is. 25 stays. `[08-22]`
- **Kill-shot accuracy (fixed)**: the standoff kept the herder 12 m behind
  the animal, so kills often missed (a miss = 1.5 s re-aim while the animal
  flees). Fix: steer and wound standoffs at 6 m, the kill branch approaches
  to ~2 m on the far side and only attacks from within 5 m — the animal
  keeps fleeing TOWARD the dropsite during the approach. Cost: wound→kill
  interval grows ~0.1–0.2 min/deer; batch-neutral. `[08-22]`
- **Herding distance re-probe (SHIPPED)**: matrix herdMax ∈ {200, 240, 280}
  × herdCutoff ∈ {140…280} × herdPrefer {true, false}. Verdict: nearest-first
  at 200 m — v71's 200 m regression was reversed by the food pool (fresh
  paired deltas city -0.03 ± 0.28, pop300 +0.02 ± 0.42, n=10); meat gains
  are large (seed 3: 30→38 hunts, seed 4: 24→54); 240/280 add meat but
  metrics go flat-to-worse (seed 3 city 14.1/14.3/14.6 at 200/240/280).
  `[08-22]`
- **Herding beats collecting at EVERY distance**: a chased skittish flees
  ~50 m FURTHER out before dying (kill at 235 m from a 201 m target, seed 5),
  and the cavalry's collection = capacity-20 trips (5 × 250 m round trips)
  while a steer walks the animal home in ~0.25 min with the kill
  in-territory → civilians. Seed 5: cutoff=200 processed ONE far deer vs SIX
  herded at 200–257 m, all six inTerr=true. Slow animals stay collect-mode
  (they crawl, the kill stays put). `[08-22]`
- **`herdPrefer` loses**: redirecting the herder from 37 m chickens to
  127 m deer cost seed 5 city +0.5 min (14.2 vs 13.7) with pop300 only
  -0.1. Nearest-first stays. `[08-22]`
- **Seed 11 outlier mechanism**: ONE sheep at 182 m; the extra meat shifted
  the town bank to 5.9 m (vs 6.5), the trio drained wood to 98, the field
  branch starved (fields 4 vs 6 at t=8), grain collapsed (t=13 window -43%),
  pop300 15.2 — the same hard-bank cascade class as the seed-4 pure-pool
  case. `[08-22]`
- **Cavalry idle after the hunt (fixed)**: when the 200 m band ran dry,
  `herdingDone` sent the cavalry back to the economy, but its ONLY gather
  rate is `food.meat`, so `canGather` failed everywhere and `findSupply`
  could only offer served meat — with no carcass left the shares assigned
  NOTHING and it idled forever (steppe seed 1: HERDDONE 6.92m, STARVED
  7.29m) while horses roamed beyond the band. Fix: when the in-band pick
  fails, keep hunting — a third pass with NO upper distance limit (35 m
  floor, CC-region, away from enemies); beyond-band targets are collect mode
  (killed in place, collected by the cavalry itself); `herdingDone` only
  fires when no animals remain in the region at all. Temperate: hunts +36%,
  fresh 11–20 paired city -0.02 ± 0.19, pop300 -0.14 ± 0.26 (7/10 improved
  or equal), no bar breaks. `[08-22]`
- **Extended herding range (DISCARDED)**: every variant regressed vs v83
  (women-collect, CC-targeted steer, cav-collects-all). Economics: each far
  deer costs the cav 1.4–2.2 min (the steer is bounded by the animal's flee
  speed + building-ring stalls) for 100 meat (~0.5–0.8 f/s), while women
  collecting delivered carcasses at rate 1.0 with 20–50 m walks ≈ 0.5 f/s
  displaces field work (0.41 f/s) with bursty disruption (seed 5 t=13m:
  grain 4565→2193, meat 286→827, total food -1831/2.5 min → pop300 +1.1).
  The 35–160 m band + in-band steer stays; far animals remain handled by the
  post-herding findSupply hunting. `[08-21]`
- **No-flee kill+collect (DISCARDED, Louis's tip 1)**: making the cav
  collect its in-place no-flee kills cost seed 1 pop300 14.9 → 16.1;
  exempting one-hit animals (≤ 20 HP) from the civilians' far-side dance
  also regressed (14.9 → 15.7) — those crawl-fleers are best herded like
  everything else. Keep the 150-turn behavioral fallback as the only no-flee
  detector. `[08-21]`
- **Cav collects its own kill before the next target (DISCARDED, tip 2)**:
  seeds 1–2 byte-identical, seeds 3/5 pop300 +0.3/+0.5 — the lost herding
  time costs more than the meat pays. `[08-21]`
- **Farmstead by a ≥300-food carcass clump (DISCARDED, tip 3)**: the
  largest unserved in-territory clump ever seen is 200 food (seed 5, two
  herded deer ~8 m apart, 38–53 m from the nearest dropsite); seed 2 has
  146; everything else ≤ 100. A threshold that does fire (~120) delayed the
  town trio and pushed city +0.3/+0.7 (100 wood ≈ 1.5 min of trio delay)
  while pop300 only gained 0.1–0.2. No profitable threshold exists on
  mainland/temperate 192. Placement must keep ≥ 15 m from every huntable
  (farmstead half-diagonal ~11.7 m — building on a unit deletes it).
  `[08-21]`
- **Wound-then-steer (v83, KEPT)**: seeds 1–4 byte-identical to v82 (no
  deer in the band there), seed 5 city 13.8→13.6, pop300 14.4→13.6 (-0.8);
  steered deer die 16–35 m from the nearest dropsite (vs ~50 m) and the meat
  lands in territory where the women collect it (seed 5 meat by t=8m
  694→1049). Only seed 5 has deer within 35–160 m of the CC on
  mainland/temperate 192. `[08-21]`
- **Kill+collect split by stance (v82, KEPT)**: slow animals (chicken/
  sheep/pig) are killed in place and collected by the cav one at a time;
  fast (deer/gazelle) are herded to the nearest food dropsite and collected
  by the cav only when killed outside territory; civilians take
  in-territory carcasses before fields once the fruit latch fires. Batch:
  city 14.30→14.06, pop300 14.50→14.40. The naive v81 (no corpse adoption,
  no latch) regressed 15.6/15.0 — the two fixes ARE the feature. `[08-21]`

## 5. Construction & placement

- **Building footprints differ per civilisation** (documented per-civ in
  `docs/game_description/*/buildings/`): don't assume a footprint from the
  generic template when reasoning about placement clearance or passability —
  read the per-civ value. `[08-22]`
- **Building orientation (SHIPPED)**: align everything on the CC angle —
  free (statistically confirmed: city -0.03 ± 0.27 min, pop300 -0.02 ± 0.37
  on seeds 11–20, t=-0.35/t=-0.17, p=0.734/0.868, both variants hold the
  ≤ 15.0 bar on all 10). Mainland temperate starting CC yaw is exactly 3π/4
  (135.0° on all 5 seeds) — trust the runtime value, not rmgen's
  `BUILDING_ORIENTATION`. A rotated footprint's corners reach past its
  axis-aligned box (11×11 house at 135° → AABB 15.6×15.6), so BOTH the
  placement prefilter AND the plot grids must rotate with the angle — a
  rigid rotation of the whole plot set preserves every distance. `[08-21]`
- **Footprint prefilter that works (KEPT)**: exact rotated rect inflated by
  half a navcell diagonal (0.75 m), cell-centre sampled — conservative yet
  footprint-tight (0 failures). The center-sampled exact rect without
  inflation got 88 `construct FAILED` lines (tree cells whose centre sits
  just outside the footprint still overlap it — each rejection burns 50
  turns of blacklist latency); the rotated axis-aligned box (up to 41%
  larger) got 0 failures but pop300 was NEVER reached (284 by the 18-min
  limit — it pushes near-tree farmsteads/fields outward, grain dist 15–17 m
  vs 3–6 m, starves the house stream). `[08-21]`
- **The greedy territory simulator is conservative** (skips all Petra-owned
  tiles, counts only neutral gains): seed 1 sim 58% → real 88%; seed 3 sim
  55% → real 57%. Plan to ~72% sim for the 70% bar, and hex-pack candidates
  at ≥ 210 m (the 200 m rule) or the greedy deadlocks on mutual exclusion.
  `[08-22]`
- **Construct rejected = silent**: ordering a house at wood < 75 (the AI
  resource snapshot predates command processing) → rejection → and the spot
  got blacklisted permanently — 17 rejected orders burned the whole building
  ring on seed 5 (no houses/fields for 15 min). A research order + construct
  order in the same AI block overdraw (both see the same snapshot) — hold
  construction one block after any research order. `[08-20]`
- **Foundation commit blocked by unit traffic (fixed)**: an uncommitted
  foundation blocks NO movement, but `Commit()` fails while units stand on
  the footprint and each failed commit orders the blockers off (4 m) — on a
  busy woodline another chopper is already crossing, so the commit can be
  starved indefinitely; builders themselves don't block. **Rush-build fix
  (SHIPPED)**: wood-branch storehouse REBUILDS are marked `rushBuilds`;
  once the foundation exists, the builder sweep drafts up to 8 wood-assigned
  choppers as its crew (markers die with the built structure or after 200
  turns). Do NOT rush the initial storehouse: probed, regressed temperate s1
  pop300 14.6 → 15.0 (at t=0 there is no traffic to unblock, and drafting
  every chopper delays the bootstrap). Rebuilds only. The bot's 50-turn
  construct timeout measures builder arrival/commit, not foundation
  creation. `[08-22]`
- **Builder ping-pong (Louis's report, real)**: the builder sweep re-issues
  `repair` to the nearest units for every under-staffed foundation EVERY
  block, and with two close foundations the same units are nearest to BOTH —
  the last order wins, workers oscillate (verified in-game via [BUILD]
  telemetry). Every fix variant regressed the boom (sticky 16.0,
  REPAIR-state exclusion 16.5, per-block exclusivity 15.4, 30-m-gated 14.8
  + city +0.4 with 364 churn events remaining): the claim-order details feed
  the wood/food cadence and ANY perturbation cascades — the messy
  re-issuing is structurally load-bearing (it keeps the bootstrap crews
  overlapping in the right order). Shipped anyway (Louis's call): the
  persistent sticky variant — foundationID → [unitIds] in bot state, a
  claimed unit is never re-targeted until its foundation is gone; the herder
  is excluded (its hunt orders would override repair → phantom builder).
  Zero churn. Excluding the herder changed nothing (batch hashes identical).
  `[08-21]`
- **Sticky-builder re-tune (SHIPPED)**: seed 1 mechanism (pop300 16.0) — the
  sticky crews completed the 3rd house by ~1.5m → `canResearch(town)` flips
  → the HARD BANK starts at 1.5m and freezes construction BEFORE wicker
  (1.4m) and the 2 bootstrap fields (1.8/2.1m) are ordered; v83's bank only
  started at 2.8m because its 2nd house was wood-starved — **the churn was
  load-bearing**. FIX 1 (kept): bootstrap gate on the town bank — hold the
  hard bank while COMPLETED bootstrap fields < 2 and fruitStock < 1500
  (fallback t=5m); counting FOUNDATIONS releases the hold ~0.4m early and
  wastes it. FIX 2 (kept): village-phase houses take 2 builders, not 3 (3
  from town on — 2 everywhere regressed seed 1 pop300 15.2→15.4). P2 probe
  (storehouse floor += nextTrioWood) DISCARDED — fixed seed 3's trio (city
  14.3) but cost seed 1 pop300 16.9: dropsite income outranks the trio wood.
  X1 probe (fields before continuous dropsites) DISCARDED — fields ramped
  18→23 but the grain rate fell (farmstead chain can't keep up with unserved
  new fields), seed 3 pop300 14.0→14.6. Final batch: mean city 14.18 /
  pop300 14.24 vs v83 14.02/14.24, all ≤ 15.0. `[08-21]`
- **Dropsite placement that works**: react each block to workers whose
  target supply is > ~18 m (edge) from a serving dropsite; build at the
  clump around the WORST-served anchor (anchors within 25 m), not at the
  centroid of all underserved — a wide cutting front's centroid lands
  between clumps and serves none (13 storehouses, mean distance still
  40+ m). Count same-type foundations as serving sites (else re-order spam
  while the first builds), suppress within ~25–30 m, never fall back to a
  CC-centered search for dropsites (a farmstead dumped at the base serves
  nothing but counts against the cap). `[08-21]`
- **A storehouse at the woodline pays its 100 wood back in ~10–30 s** of
  gather-rate delta; gating dropsites behind trio/house wood reservations
  starves the income that pays for everything (v14: zero dropsites, wood
  rate 27%). Houses must instead leave 100 w while a dropsite is demanded.
  `[08-21]`
- **Storehouse rules 1/2/3 (SHIPPED)**: exhaust served rings before
  building; one storehouse between close stone/metal mines; median
  placement. Steppe mean max(pop300, city) 16.80 → 14.84 (tuned seeds) and
  17.56 → 14.54 (fresh 11–15); temperate bar holds. `[08-22]`
- **The steppe woodline never existed before this fix**: the woodline cell
  scan filtered supplies with `amount > 100`; steppe bushes hold exactly
  100 wood (bush mixin, 4 gatherers), so every bush was excluded, `woodline`
  stayed null on steppe, choppers used the generic nearest-supply path and
  spread over the map. That spread is the whole reason steppe storehouse
  churn was 10–24 builds / 7–16 destroys per game. The `>= 20` floor
  restores the woodline on steppe (nothing measurable on temperate:
  s2/s4 hashes byte-identical). `[08-22]`
- **A gate counting only FULL supplies (≥ 100) never binds on steppe**: a
  bush drops below 100 the moment a chopper touches it, so every served ring
  looked empty. Ring/gate floors must be low (20 = scrap threshold) to count
  half-gathered supplies. `[08-22]`
- **Re-order spam fix**: the wood/mine storehouse branches re-ordered the
  same spot every block while no foundation appeared (the planned check only
  sees foundations); an engine-rejected spot (e.g. territory edge, where the
  AI's territory map can be a few turns staler than the engine's construct
  validation) got one order per block, each burning 100 w of the block's
  budget, until the 50-turn blacklist fired (11 `construct FAILED` at one
  steppe spot). Fix: in-flight orders (`pendingBuilds` within 30 m) count as
  planned in all three branches — one wasted order per spot, then the
  blacklist moves it. `[08-22]`
- **Late-game steppe churn (t > 15 m) is post-metric only**: at 300 pop the
  wood force spreads to ~40 choppers that eat a bush clump faster than a
  storehouse can be built. Not the boom. `[08-22]`
- **The pair-branch can burn several orders at the territory edge**
  (temperate s4: 5 orders in 0.5 min, 4 engine-rejected): the reject zone is
  smooth over > 12 m, so wider failedSpots boxes don't help (a 12 m box
  probe changed NOTHING on all 15 seeds — hashes identical — reverted), and
  the pending-suppression limits the damage to one order per spot per
  blacklist cycle. It self-heals once the territory expands; the metric
  impact was nil (s4 city 12.9). `[08-22]`
- **Storehouse remarks 4/5/6 (SHIPPED)**: rebuild on the receding woodline
  (composes out of rules 1+3+the destroy rule — verified on temperate s1:
  rebuild at 373, 605, old storehouse destroyed at 62 m); chopper assignment
  by full walk cycle; destroy everything > 60 m from the nearest supply.
  Steppe mean max stays ~14.9 tuned / ~14.6 fresh. `[08-22]`
- **Pure nearest-to-dropoff assignment regressed hard** (f12 pop300
  14.5 → 16.2): it ignores the unit's position — after a storehouse destroy,
  the zone's nearest dropoff was the far pair storehouse and every chopper
  trekked to that side of the zone. The rule that works minimizes the FULL
  cycle: dist(unit → tree) + dist(tree → nearest dropoff). Same idea as the
  gather-rate telemetry: the walk is paid twice per delivery. `[08-22]`
- **A near-cell preference in the picker regressed steppe s1** (pop300
  15.1 → 16.8): steppe clumps are small, so "near the dropsite" kept winning
  over "biggest clump" and the bot rebuilt storehouses every minute.
  "Rebuild on the remains" must come from the ring-exhaustion cycle, not
  from a proximity bonus. `[08-22]`
- **The storehouse flood (goal 8)**: each expansion branch (woodline
  reactive, mine reactive, mine proactive) can order one storehouse PER
  BLOCK, and the "nearest supply > 60 m" destroy rule frees the cap slot for
  an instant rebuild — 117 storehouse orders (=11.7k wood) on seed 1. Fixes:
  per-branch cooldowns (40–150 blocks), planned-radius gates at 45–60 m, and
  skipping store-ring woodlines (they already have their dropsite). `[08-22]`
- **Placement search that works**: footprint cells clear in the
  `building-land` passability grid + all covered territory tiles owned by
  the player. Ring search around the CC (32 angles × 3 m steps out to
  ~90 m) finds spots even in cluttered temperate forest; a narrow 18–45 m
  ring with 16 angles exhausted within minutes. `[08-20]`
- **Woodline selection**: a whole-forest union-find as "biggest woodline"
  spreads choppers over ~200 m (v36); a bounded hotspot (45 m zone around
  the densest 30 m cell, 90 m neighbourhood score) actually concentrates
  them. `[08-21]`
- **Storehouse depletion test**: testing only THE nearest supply misfires on
  half-eaten trees (build/destroy loop, v36); must also skip when any
  gatherer works within 40 m (v37). `[08-21]`
- **First-dropsite placement** must filter candidates to own territory + CC
  region and must not block the rest of construction on failure (v35: 18 min
  total stall). `[08-21]`
- **Wonder placement (goal 8)**: own-territory only (the bot's stale
  territory grid rejected 8 border orders on seed 1) — search rings ≤ 95 m
  around the base CC or ≤ 60 m around a far CC; the construct floor must
  cover the cost (an 800 floor vs a 1500 cost orders on credit and the
  engine rejects on cost every block). `[08-22]`

## 6. Phases, population & research

- **Use the tavern as the cheap third Town-class structure** for the city
  phase: it is the cheapest Town-class building and constructible via a
  direct construct command (not offered by any builder) — see
  `docs/game_description/gauls/buildings/tavern.md`. `[08-21]`
- **House demand scales late**: CC + N houses training needs up to 2–3
  concurrent house foundations, and in-progress houses must count as future
  +5 cap, else pop touches the cap transiently (seen at t=25m with
  1-at-a-time building, margin trigger 8). `[08-20]`
- **Training eats all food**: with house training unlocked, food income is
  fully consumed by training — a fixed "research when affordable" threshold
  is never reached. Working pattern: pause ALL training once requirements
  are met, bank the cost, research, resume training as soon as research
  starts. `[08-20]`
- **Fertility Festival timing**: rushing it at t~1 (250 f +
  training/construction freeze) starves the bootstrap — pop behind all game
  (v32); ~t=5–8 is the window where trainers actually become food-supported.
  If banking for it, freeze construction AND floor training together (v23
  paused training only; houses ate the wood and fertility stalled 8 min).
  `[08-21]`
- **Early town banking trap**: 5 Village-class structures (CC + farmstead +
  3 houses) trigger the town bank (~1.45m on seed 1 with a house-heavy
  opening) which floors training at 500 food and stalls the boom for ~2 min
  — town gains < 1 min, pop loses ~5 at t=5m. The baseline avoids it by the
  usual field-before-house ordering. `[08-21]`
- **The city bank (750s/750m) competes with metal boom techs** (~800 metal
  pre-city): techs need a 300 stone/metal floor in town phase or the bank is
  short at deadline time. `[08-21]`
- **Village-phase research works from surplus only**: allow techs costing
  cost+500f/400w; never set `techReserve` in village — this keeps the town
  bank and the goal-4 timeline intact (~6–7 min town) while 3–4 village
  techs complete early. `[08-20]`
- **`manageResearch` control flow (two traps, both fixed)**: (1) it returns
  after every boom-list iteration, so tech lists appended after the loop
  NEVER run — goal-8 seed 2: zero mining techs by t=28, mining at 0.35 base
  rate. (2) a `return false` on the first unfindable facility
  (stockbreeding: no corral) blocks every later tech forever. Walk the
  expansion list with `continue` semantics, call it at the TOP of
  `manageResearch`, and never latch a "done" flag while techs remain
  unaffordable (the first-block affordability failure froze the list on
  seeds 1/3). `[08-22]`
- **Research concurrency**: the 16-tech list serializes to ~20 min; up to 3
  in flight (the storehouse, farmstead, market, house, CC and wonder
  research independently) lands it in ~7. `[08-22]`
- **Liquidity problem**: the woman stream consumes food income instantly, so
  200-food techs are never affordable. Full-pause banking deadlocks (women
  paused waiting for traders, traders paused waiting for the bank → pop
  froze at 32) or stalls the economy (fixed 500f/400w thresholds are
  permanent in village). Working approach: `techReserve` = cost of the first
  unaffordable researchable tech; women train only above reserve.food+50,
  traders above reserve+100/+80; `manageResearch` runs FIRST in the 5-turn
  block. `[08-20]`
- **Wood starvation trap**: fields (canAfford 130 w) pin the wood stock at
  ~130, so the 300 w market order never fires → town-trio stalls → city at
  ~22 min. Field affordability thresholds must stay above the cost of
  pending priority buildings (or fields must yield). `[08-20]`
- **Priority-building wood banking**: houses require 375 w while the town
  trio or the market pair is pending; fields 450/250. Without it, the house
  stream eats every wood surplus and the 300 w market never fires. `[08-20]`
- **Grain/house-cap techs stall behind the 750-metal city reserve** from
  trio-done on (v46: plows at 12.1) — they need a bank-floor exception +
  miners pre-filling + the city research waiting for them. `[08-21]`
- **Counting queued women at face value** in the house-margin calc
  under-builds cap at the sprint (the queue holds ~45 women that food can't
  deliver; cap 260–278 at t=15 in v48–51). `[08-21]`
- **Fixed mining shares seesaw city-vs-pop** (v37–40). Rate-matching miners
  to the bank deadline works, but no mining before t≈8 (early miners cost
  ~3× in un-trained women — v41/42), and re-mining after the bank is spent
  must be cut (v41). `[08-21]`
- **Concentrate miners on ONE mine per resource (KEPT, tip 4)**: pinned
  mine = nearest to the CC with supply, re-picked when depleted/lost;
  `findSupply` prefers it until `isFull()` (24 gatherers on large mines)
  spills to the nearest other. Goal 7 now passes 5/5; the concentrated clump
  also makes the mine-storehouse logic build ONE well-placed storehouse.
  `[08-21]`
- **Spread field workers to the least-crowded field (DISCARDED, tip 5)**:
  global least-crowded cost seed 1 pop300 14.9 → 15.1 and did not meet the
  goal on 2/3; a 25 m cluster-window version was worse (city +0.7 on both
  probes). The extra walk to a slightly emptier field costs more than the DR
  (0.9^n) gain; nearest-first stays. If autocontinue piles workers onto one
  field, the fix belongs in the anti-drift sweep, not `findSupply`. `[08-21]`
- **Emergency houses fire constantly in village** on the queue-inflated
  margin and hold wood < 100, starving field foundations. The first 2
  bootstrap fields must outrank the house stream when fruit is nearly out
  (`fieldDemand` + fruitStock gate). `[08-21]`
- **Bank/`fertPending` wood freezes block ALL construction orders** from
  t≈2.5–5.5. Bootstrap fields (wood-only, no food) must be ordered BEFORE
  the freeze starts or explicitly exempted, else farming starts at t≈7.5
  (v61 deadlock). `[08-21]`

## 7. Trade & market economy

- **Trade is tiny and not a mass-income mechanic**: ~0.05–0.15/s per trader
  (goal 6 measured ~100 per trader per 30 min). Goal 8 measured: 42 traders
  + 3 markets (base + 2 at the farthest COMPLETED CCs — anchoring on planned
  far spots stalls until the last CCs go up) → tradeIncome 1960–2760 over
  the last ~7 min (~0.1/s per trader). Idle-civilian dismissal for pop works
  (`destroy()` on idle women) but the fleet eats 100 food/trader — the food
  bar must have headroom first. `[08-20]`, `[08-22]`
- **Place markets maximally apart**: markets at opposite edges give
  170–270 m trade routes (gain ∝ d²): income ~900 at 90 m routes →
  1300–1900 at 170–270 m. Search building spots out to ~140 m around the CC.
  `[08-20]`
- **Trader pop headroom must be capped** (6): an 18-slot reservation
  exceeded the early-town limit and froze woman training (pop stuck at 32
  from t=5 to t=15). `[08-20]`
- **The woman flood starves the trader fleet of food**: reserve one
  trader's food cost (150 floor) ahead of the woman stream while the fleet
  is incomplete; traders need only a small fixed metal buffer (230) — metal
  techs total 850. `[08-20]`
- **Traders starve against women**: a 100 f trader is never affordable while
  women eat all food; the headroom mechanism (`traderHeadroom`, women cap at
  limit-headroom, house margin threshold 10+headroom) keeps pop slots and
  lets the fleet build. `[08-20]`
- **The food/wood frontier (goal 8 round 2)**: with the mining share capped
  at 26% (the stone/metal bars are unreachable — map-bound), the fields
  (95% eff) and the woodline (44–57% eff, walk-bound) trade ±2–5k per seed;
  food 43–74k and wood 47–56k oscillate around the 50k bar and seed variance
  dominates the remaining knobs. `[08-22]`

## 8. Boom sensitivity & tuning discipline

- **The boom is chaotically sensitive**: the claim-order details feed the
  wood/food cadence (fields-vs-houses bootstrap, `fieldDemand`/`fruitStock`
  gate) and ANY perturbation cascades — the same sensitivity as the v79/v80
  field-spread tip. Two direct corollaries: the messy builder re-issuing was
  structurally load-bearing, and "obviously harmless" changes (herder
  exclusion, box-size probes) must still be batch-verified — several came
  out byte-identical or regressed. `[08-21]`
- **Load-bearing churn**: v83's bank only started at 2.8m because its 2nd
  house (the 5th Village structure) was wood-starved until then — removing
  the churn made the bank start at 1.5m and regressed pop300 to 16.0.
  `[08-21]`
- **Wood oscillation around the forge/market costs (100–200) makes 100 wood
  ≈ 1.5 min of trio delay** — the currency in which probe costs are paid.
  `[08-21]`
- **Dropsite income outranks the trio wood**: fixing a seed-3 trio by
  raising the storehouse floor cost seed 1 pop300 16.9 alone / 15.2 in
  combos; the cadence shift (bootstrap gate) alone repairs seed 3's city.
  Drop the wood-side fix. `[08-21]`
- **Hard-bank cascade (recurrent failure class)**: extra early meat shifted
  the town bank to 5.9 vs 6.5m → the trio drained wood to 98 → the field
  branch starved (fields 4 vs 6 at t=8) → grain collapsed (t=13 window
  -43%) → pop300 15.2. Same class as the seed-4 pure-pool case and the seed
  11 herding-extension outlier. `[08-22]`
- **Orientation change is free**: statistical confirmation on seeds 11–20 —
  city -0.03 ± 0.27 (t=-0.35, p=0.734), pop300 -0.02 ± 0.37 (t=-0.17,
  p=0.868); both variants hold the ≤ 15.0 criteria on all 10. The alignment
  is free; ship it. `[08-21]`
- **Exempting the herder from the drift stop changed nothing** on any seed
  (batch hashes identical to the pre-exclusion batch) — the exclusion is
  insurance, not a lever. `[08-21]`
- **Goal-7 final state (reference)**: 5-seed batch mean city 14.18 /
  pop300 14.24 (after sticky re-tune), all seeds ≤ 15.0 on both criteria.
  Rush-build batch (sh10): temperate all ≤ 15.0 (mean 14.24/14.08), steppe
  tuned mean max 14.72, fresh 14.68. Storehouse rules: steppe mean max
  14.84 tuned / 14.54 fresh. `[08-21]`, `[08-22]`

## 9. Performance

- **Turn rates**: ~375 turns/s with few entities (no-op bot vs sandbox
  Petra, mainland 192: 9000 turns in ~24 s wall) vs ~113 turns/s in the
  busier smoke-test match. Size wall `timeout`s accordingly (turns =
  in-game ms / 200; wall ≈ turns / turn-rate). `[08-20]`
- **Logging has a cost**: printing every turn or in hot `OnUpdate` paths
  slows the simulation measurably. Log sparingly and coarsely (init, phase
  changes, end-of-game summaries), and when in doubt measure the turn rate
  with and without the logging enabled. `[08-21]`
- **No full-map scans per tick**: prefer cached entity collections and
  shared resource maps. `[08-22]`
- **Steppe runs need a 30-min cap** (the 18-min cap is too short to measure
  the steppe boom — seed 5 never reached city within it); temperate probes
  stay at 18. `[08-22]`

## Appendix A — provenance map

Where each dated entry of `LESSONS_LEARNED.md` landed in this compile
(§ numbers). Every entry is covered; nothing was dropped.

| Date | Entry | Sections |
|------|-------|----------|
| 08-22 | Goal 8: expansion mechanics and the resource ceiling | §1, §5, §6, §7, §8 |
| 08-22 | Goal 8, round 2: Louis's levers, measured | §3, §5, §6, §7, §8 |
| 08-22 | Herd steer discipline (pinned dropsite, far-side-only) | §3, §4 |
| 08-22 | Foundation commit blocked by unit traffic; rush-build | §5, §8 |
| 08-22 | Storehouse remarks 4/5/6 | §5 |
| 08-22 | Storehouse rules 1/2/3 | §5, §8 |
| 08-22 | Cavalry idle after the hunt | §4 |
| 08-22 | Herder kill-shot accuracy + micro-pause fixes | §3, §4 |
| 08-22 | Building footprints differ per civilisation | §2, §5 |
| 08-22 | Herding distance re-probed (200 m band) | §4, §8 |
| 08-22 | Combined food pool (fruit + carcasses) | §3 |
| 08-21 | Sticky-builder re-tune | §5, §8 |
| 08-21 | Builder ping-pong between foundations | §5, §8 |
| 08-21 | Extended herding range (DISCARDED) | §4 |
| 08-21 | Wound-then-steer herding (v83) | §4 |
| 08-21 | Hunting experiment (v81→v82) | §3, §4, §6, §8 |
| 08-21 | Goal 7 (dropsites, gather-rate telemetry) | §3, §5, §6, §8 |
| 08-20 | Goal 6 part 2 (placement, threats, command races) | §2, §5, §6, §7 |
| 08-20 | Goal 6 API facts (trade/barter/research) | §2, §6, §7 |
| 08-20 | Goal 5 (city phase) | §1, §6 |
| 08-20 | Goal 4 (town phase) | §6 |
| 08-20 | Goal 3 (population growth) | §5, §6 |
| 08-20 | Goal 2 (gathering) | §3 |
| 08-20 | Goal 1 verification | §1, §2, §9 |
| 08-21 | Goal 7 session (v34→v54) | §3, §5, §6, §8 |
| 08-21 | Goal 7 round 2 (herding, berries→farm transition, v55–v71) | §1, §3, §4, §6 |
| 08-21 | Louis's round-3 tips (audited one by one) | §1, §4, §6 |
| 08-21 | Building orientation: align everything on the CC angle | §5, §8 |

Facts folded in from the experiments: steppe metric
(`docs/goals/goal-07-steppe/experiment.md`) → §1, §8. Extracted from this
file on 2026-08-22:
game mechanics → `docs/game_description/mechanics/` (new
`animals_and_hunting.md`; additions to `territory.md`, `construction.md`),
entity data → `docs/game_description/gauls/buildings/tavern.md` and the biome
files, and the engine API / scripting facts → `docs/ai_engine_api.md`
(§11 Scripting pitfalls, §12 Trigger scripts and end-of-game output).
