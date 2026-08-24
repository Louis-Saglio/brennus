# tools/

Reusable toolset for Brennus experiments: running headless matches,
analyzing and comparing their results, and keeping `docs/game_description`
consistent with the pinned 0 A.D. data. Extracted and generalized from the
scratch scripts in `tmp/`.

## Match harness

### run.sh — run headless matches

```sh
tools/run.sh [options] <moddir> <outdir> <tag=seed>...
```

Each `tag=seed` pair runs one match: a fresh copy of `<moddir>` installed as
the `brennus` mod with the selected AI vs a Petra opponent, isolated HOME
under `<outdir>/<tag>`, stdout to `<outdir>/<tag>/stdout.log`. Pairs run in
parallel, one per CPU core (override with `JOBS=` or `-p`).

Options: `-a AI` bot to play (default
`brennus_gaul_boom_and_expand_generic_land_map`), `-t SEC` wall timeout
(default 300), `-m MAP` (default `random/mainland`), `-b BIOME` (default
`generic/temperate`), `-l MIN` override the mod's time-limit trigger
minutes, `-d DIFF` opponent Petra difficulty 0-5 (default 0 = sandbox),
`-v BEHAV` opponent Petra behaviour (e.g. `defensive`; omitted by default,
so the engine autostart default `balanced` applies).

```sh
# standard goal check: 5 seeds + seed-1 determinism rerun
tools/run.sh bot tmp/goalN seed1=1 seed2=2 seed3=3 seed4=4 seed5=5 seed1-rerun=1

# quick single probe on seed 1, boom bot
tools/run.sh -a brennus_gaul_boom_generic_land_map -t 60 bot tmp/goalN probe=1

# A/B: same seeds under two mods, then compare with compare.py
tools/run.sh bot         tmp/ab base-seed1=1 ... base-seed5=5
tools/run.sh bot-tweaked tmp/ab tweak-seed1=1 ... tweak-seed5=5

# steppe biome with a 30-minute time limit
tools/run.sh -b generic/steppe -l 30 bot tmp/steppe s1=1 s2=2

# goal 9: defend bot vs medium defensive Petra
tools/run.sh -a brennus_gaul_defend_boom_and_expand_generic_land_map \
    -d 3 -v defensive bot tmp/goal9 s1=1
```

### analyze.py — per-run report

```sh
tools/analyze.py [--harness] [--det A,B] <outdir> [tag...]
```

Per tag: JS-error count from the engine interesting log, boom milestones
(city phase, population=300) from `[HARNESS]` lines, key end-of-game
statistics for player 1, and a SHA-256 of that statistics JSON. Default
tags `seed1..seed5 seed1-rerun`, default determinism pair
`seed1 vs seed1-rerun`; `--harness` also dumps the `[HARNESS]` lines.

```sh
tools/analyze.py tmp/goalN
tools/analyze.py tmp/goalN seed2 seed3
```

### compare.py — paired A/B comparison

```sh
tools/compare.py <base_dir> <aligned_dir> <seed>...
```

Paired per-seed comparison of two batches (each `<dir>` holds `seed<N>`
tags), on city-phase and pop300 times, plus a paired t-test on the deltas
(pure-python Student t CDF, no dependencies).

```sh
tools/compare.py tmp/ab/base-batch tmp/ab/tweak-batch 1 2 3 4 5
```

### hunt-analyze.py — hunting telemetry

```sh
tools/hunt-analyze.py <stdout.log>
```

Parses `[HUNT]` lines: per huntable animal, template, mode, wound/kill/carcass
dropDist, inTerr, and whether the carcass is within civilian pickup range.

## Kiln — remote headless runs

kiln runs 0 A.D. headless on a pool of runners (one on this VPS, one on
Louis's PC) instead of locally. Use it via the `mcp__kiln__*` tools; full
docs in `~/kiln/docs/USER_GUIDE.md`.

### Launching

`mcp__kiln__submit_batch {batch_name?, mod_dir?, spec}` → batch id + job id.
Runner choice is automatic.

- `mod_dir`: the mod to pack. The server runs as the `kiln` user, which
  cannot traverse `/home/ubuntu` (mode 750) — the submit fails with "not a
  directory" on a real dir. Stage first:
  `sudo cp -r bot /var/lib/kiln/staging/bot && sudo chown -R kiln:kiln /var/lib/kiln/staging/bot`,
  then pass the staged path.
- `spec`: map / `seed` / `aiseed` / biome / placement / size, `players` in
  slot order (`ai` = script name, `diff` 0–5, `behavior`
  balanced|defensive|aggressive, `civ`, `team: -1` = no team), `victory`
  array, `player: -1` (observer), `in_game_limit_min` (clean game end →
  statistics get printed; without it a wall-kill records no stats),
  `wall_budget_s`, `collect_replay`.

Goal-9 reference spec:

```json
{"map":"random/mainland","seed":1,"aiseed":0,"biome":"generic/temperate",
 "placement":"circle","size":192,
 "players":[
   {"ai":"brennus_gaul_defend_boom_and_expand_generic_land_map","diff":3,"behavior":"balanced","civ":"gaul","team":-1},
   {"ai":"petra","diff":3,"behavior":"defensive","civ":"rome","team":-1}],
 "victory":["conquest_civic_centers"],"player":-1,
 "in_game_limit_min":45,"wall_budget_s":1800,"collect_replay":false}
```

Notes:

- The kiln harness mod mounts last and replaces the bot's
  `NonVisualTrigger.js`; with `in_game_limit_min` set it marks player 1 won
  at the limit — same semantics as the mod's own trigger, so goal limits
  work unchanged.
- The `pc` runner is ~6× faster than the VPS on medium-Petra matches (~190
  vs ~32 turns/s): a full 45-min game is ~1 wall minute there, ~7 on the VPS.
- No push notification: poll `mcp__kiln__get_batch_status`, or run a
  watcher loop that exits on a terminal state (see `tmp/watch-goal9-s1.py`
  for a working one).

### Reading results

- `mcp__kiln__get_batch_status {batch_id}` — per-job state
  (queued/running/done/failed).
- `mcp__kiln__get_result {job_id}` — exit code, `turn_count`
  (× 200 ms = in-game time), `turns_per_sec`, per-player `stats` (same
  fields as the end-of-game statistics JSON: boom bars, map %, resources).
- Artifacts per job at
  `/var/lib/kiln/results/<client>/<batch>/<job>/` — `artifacts.tar.gz` plus
  the extracted copy: `stdout.log` (full engine output incl.
  `[HARNESS]`/`[DEF]` telemetry), `stderr.log` (empty = no JS errors),
  `stats.json`, `result.json`, `metadata.json`, `mainlog.html`,
  `interestinglog.html`.

## Code helpers

- `strip_comments.py <in.js> <out.js>` — strip JS comments, preserving code
  exactly (string-literal-aware state machine; collapses comment-only lines
  to single blanks).

## Game data ↔ docs

`tools/gamedata/` works against the pinned 0 A.D. 0.28.0 checkout
(`~/0ad-reference`; override with `ZEROAD_REF`, docs root with `ZEROAD_DOCS`).
The shared loader lives in `templates.py` (walks the entity templates,
resolves Footprint/Obstruction through the parent chain).

- `footprint-compare.py` — footprint/obstruction survey across civs.
- `gen-sizes.py` — doc-ready footprint lines per building.
- `verify-docs.py` — cross-check the footprint lines written in
  `docs/game_description` against the game data; exits 1 on any mismatch.
