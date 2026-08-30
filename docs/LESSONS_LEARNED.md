# Lessons learned

Cleared 2026-08-29. Reference knowledge was migrated into
`docs/game_description/`, `docs/ai_engine_api.md` and `docs/pyrogenesis_cli.md`.

## 2026-08-30 (border purge: the army clears forward enemy structures)

- New `managePurge` in the defense chain (after the raid and the
  minor-threat swat, before the sortie/rally): war-stage only, army >= 60,
  1.5x local superiority, abort at army < 40 or 3 min. Targets enemy
  `Tower`/`Fortress`/`ArmyCamp` (any build state) and `CivCentre`
  foundations within 150 m of an own structure or 130 m of a planned
  expansion spot. Infantry attacks with `allowCapture=true` (its damage
  bounces off structure armor: stone tower hack 29); rams tag along but are
  not required. Pre-war, forward towers still get no army response.
- Class facts from the pinned templates: all towers (sentry/stone/bolt/
  artillery) inherit the `Tower` class; wall towers do NOT (`WallTower`
  under the wall parent). Rome's army_camp is class `ArmyCamp` (not
  `Fortress`), builds in neutral/enemy territory and does not decay there
  (`TerritoryDecay disable`) — it is the structure that farms our border.
- A captured purge target flips owner to us mid-purge; `owner() === self`
  must count as success or the army keeps attacking its own new structure.
- Validated on 8 seeds (probes 9/11/13, validation 2/4/6/8/10): 58 purges
  started, 0 aborted, 6 genuine wins, 2 timeouts, no JS errors, turn rate
  unchanged (65-123 t/s). Petra rebuilds forward towers on the razed spot;
  the purge re-razes them every time (s9: the same tower 5x). s9's timeout
  is the known arsenal-footprint failure (0 rams all game, no raids), not
  the purge.

## 2026-08-29 (siege-only threat centroid fix)

- Fixed the threat-centroid bug from the findloss review below: `manageDefense`
  now accumulates a siege centroid (gsx/gsz within 160 m) and uses it when
  `n == 0`, instead of `sx/Math.max(n,1)` = (0,0). Smoke match (mainland s7)
  ran clean: exit 0, no JS errors, all `[DEFENSE]` centroids on real CC
  positions.

## 2026-08-29 (findloss 112-seed review)

- The Gaul arsenal footprint is 29x29 (barracks 20x20, temple 22.5). Once the
  home-CC ring is crowded (~50 houses + fields + towers), `tryConstruct`
  finds no spot and `manageDefenseBuildings` fails silently: no log, no
  spend, the wants loop returns on the first missing type. 12 of 24 timeout
  seeds never built an arsenal, so no rams, so zero raids in 45 min.
- Rams have 35 pierce armor: garrison arrows (CC/towers) do ~2.5% damage to
  them. Garrisoning the army when outnumbered while enemy rams attack the CC
  loses the CC. Rams die to melee (hack armor 7).
- Threat centroid bug in `manageDefense`: a siege-only threat (n=0) computes
  centroid (0,0), so the superiority branch attack-moves the whole army to
  the map corner. Fired in 13+ games of the 112 (s77: 10 times).
- The storehouse self-raze rule (destroy when nearest supply > 60 m) throws
  away wood coverage mid-war; all 6 wood-collapse losses show self-razes
  right before the wood distance jumps to 100+ m for 10-25 min.
- Enemy towers are invisible to threat/shelter/gathering after the initial
  woodline scan: workers keep chopping under a new enemy tower until dead
  (s111), and the army never attacks lone forward towers (s109).
- No barter path buys wood: food mountains of 25-59k sat unspent while wood
  income was ~0 (s7 46k, s38 40k, s109 25k food at defeat).

## 2026-08-29 (woodline removal, woodrx batches)

- The woodline system (ring rule + hotspot scan + keep thresholds + fast/slow
  storehouse paths) was replaced by three per-gatherer rules: entry tree =
  min walk cycle among the 20 nearest trees (slot cap
  `treeMaxGatherers`=4 via `resourceSupplyNumGatherers()`); pull-back of
  empty-handed choppers whose tree is >`woodServeDist`=30 m from every wood
  dropsite; storehouse at the clump of choppers the pull-back could not
  serve, gated on the tree holding >=`storehouseMinTreeWood`=100.
  `woodPoor`, the stranded-storehouse self-raze, and the proactive first
  storehouse are gone.
- Validated on 6 mainland seeds vs the pre-rewrite baseline: all 6 won
  (baseline lost s1); wood gather rate 54-70% everywhere late (baseline
  dipped to 33%); mean lumberjack-dropsite distance 17-40 m late (baseline
  80-140 m on three seeds); no JS errors; turn rate unchanged.
- The reactive rule builds many more storehouses (16-39 wood storehouses per
  game vs 11-21 total before): each frontier advance of ~30 m spawns one.
  Affordable on wood-rich maps (stocks still reached 15-35k) but watch it on
  shrub maps now that `woodPoor` is gone.
- The old baseline over-built too in a different way (s3: 45 total) while
  still leaving choppers at 122 m mean distance — coverage gates and
  placement were decoupled from where choppers actually worked.
