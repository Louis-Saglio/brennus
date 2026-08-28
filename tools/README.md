# tools/

Reusable toolset for Brennus experiments: running headless matches,
analyzing and comparing their results, and keeping `docs/game_description`
consistent with the pinned 0 A.D. data. Extracted and generalized from the
scratch scripts in `tmp/`.

## Remote matches: kiln

`run.sh` runs matches on this machine. For anything heavy (full goal
matches), use the kiln runner farm instead — see **`docs/kiln.md`** for the
MCP tools, the job-spec format, how to read results
(`/var/lib/kiln/results/...`, `fetch-kiln-artifacts.sh`) and how to wait
without polling.

## Golden timelines (behavior-preservation gate)

`golden.py` manages the canonical per-seed event timelines under
`tools/golden/seed<N>.timeline` — every tagged bot/harness line
(`[HARNESS] [DEFENSE] [HUNT] [THREAT] [HERDDONE] [KILN]`), any `ERROR`
lines, and a sha256 of each player's raw statistics block, in order.
A behavior-preserving refactor must reproduce all five timelines
bit-for-bit.

Validation set: seeds 1-5 (the goal-10/goal-11 validation batch), spec
`random/mainland` 192, `generic/temperate`, `circle`,
`conquest_civic_centers`, `brennus_gaul_generic_land_map` gaul vs Petra
diff 3 aggressive rome, teams 1/2, `in_game_limit_min=45`,
`wall_budget_s=1800`, seed=aiseed. Submit one batch per seed via the
kiln MCP (docs/kiln.md), then:

```sh
# fetch each landed job, then diff fresh output against the goldens
tools/golden.py fetch <seed> <batch_id> <job_id>
tools/golden.py check 1 2 3 4 5     # exit 1 + unified diff on any mismatch
```

`update <seed>` rewrites a golden file — only for creating the initial
baseline, never to silence an unexplained diff.

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
