# tools/

Reusable toolset for Brennus experiments: running headless matches,
analyzing and comparing their results, installing the bot into the local
game, and keeping `docs/game_description` consistent with the pinned
0 A.D. data.

## Match harness

### run.sh — run headless matches

```sh
tools/run.sh [options] <outdir> <seed | tag=seed>...
```

Runs the standard match (`AGENTS.md`) through the documented `pyrogenesis`
command line (`docs/pyrogenesis_cli.md` §3), one isolated HOME per match,
under `nice -n 10` / `ionice -c 3`. A bare seed `N` is tagged `seedN`;
`seed = aiseed`. The mod directory is snapshotted once into `<outdir>/mod/`
(provenance — commit, dirty flag, content hash, settings, slots — in
`<outdir>/batch.txt`), so editing `bot/` during a batch cannot leak into it.
The mod's `maps/scripts/NonVisualTrigger.js` ends each game at 45 in-game
minutes.

Slots: 12 local matches by default (`-j`), plus `-H host:N` for N matches on
another machine over ssh (repeatable). A remote host must run the same
`0ad`/`0ad-data` packages and be on mains power, else it is skipped with a
warning. Each match takes the first free slot, local first. Games are
bit-identical across hosts (verified 2026-11-05, `docs/LESSONS_LEARNED.md`).

Per match, in `<outdir>/<tag>/`: `stdout.log` (engine stdout+stderr: bot
telemetry, end-of-game statistics JSON), `result.json` (host, exit code,
wall seconds, turns) and `home/` (engine logs under
`.local/state/0ad/log/`, the replay under `.local/share/0ad/replays/`; the
engine cache and the mod copy are dropped). The batch ends with an
`analyze.py` summary.

Options: `-m DIR` mod to test (default `bot/`), `-j N` local slots,
`-H HOST:N` remote slots, `-t SEC` wall cap per match (default 1800),
`-l MIN` in-game limit (patched into the snapshot only), `-a AI` player-1
AI (default `brennus`), `-d DIFF` / `-v BEHAV` / `-c CIV` opponent Petra
difficulty (3), behavior (`aggressive`) and civ (`rome`), `-M MAP`
(`random/mainland`), `-b BIOME` (`generic/temperate`).

```sh
# probe 3 seeds (rotate them while iterating)
tools/run.sh tmp/probe 7 23 51

# validation batch with 4 extra slots on the thinkpad
tools/run.sh -H thinkpad:4 tmp/val $(seq 1 20)

# determinism: same seed twice
tools/run.sh tmp/det seed1=1 seed1-rerun=1
tools/analyze.py --det seed1,seed1-rerun tmp/det

# A/B: a modified copy of the bot against the same seeds
cp -r bot tmp/ab-bot    # then edit tmp/ab-bot
tools/run.sh tmp/ab/base 1 2 3 4 5
tools/run.sh -m tmp/ab-bot tmp/ab/tweak 1 2 3 4 5
tools/compare.py tmp/ab/base tmp/ab/tweak 1 2 3 4 5
```

Throughput with 12 matches in parallel on boobynator (16 threads): about
40-50 turns/s per match — each engine also runs worker threads, load ~32 —
so a game that reaches the 45-min cap (13,500 turns) takes ~5 wall
minutes. The thinkpad's 4 slots run at ~25 turns/s.

Run batches as background jobs with a completion notification; never poll.
Syntax-check first — a broken JS file wastes every slot:

```sh
for f in bot/simulation/ai/brennus/*.js; do node --input-type=module --check < "$f"; done
```

### analyze.py — batch summary

```sh
tools/analyze.py [--tsv FILE] [--det A,B] [--harness] <outdir> [tag...]
```

One row per tag (default: every subdirectory with a `stdout.log`):
`result` (win / loss / timeout / none — player 1's `playerState`, a "won"
at the 45-min cap counted as timeout, `none` when no statistics printed),
`game_min` (turns / 300), JS errors, failed AI creation, missing
`[HARNESS]` telemetry, host, exit code, wall seconds, turns/s, city-phase
and population=300 times, wood gathered at 10 min, and a short hash of all
players' statistics JSON (equal hashes = identical games). `--tsv` writes
the table for a sweep record; `--det` checks that two tags' hashes match.
It also reads the archived kiln artifacts (`sweeps/*/artifacts`, tags
`s<N>`).

### compare.py — paired A/B comparison

```sh
tools/compare.py <base_dir> <aligned_dir> <seed>...
```

Paired per-seed comparison of two batches (each `<dir>` holds `seed<N>`
tags), on city-phase and pop300 times, plus a paired t-test on the deltas
(pure-python Student t CDF, no dependencies).

### golden.py — behavior-preservation gate

```sh
tools/run.sh tmp/golden 1 2 3 4 5   # fresh runs into tmp/golden/seed<N>/
tools/golden.py check 1 2 3 4 5     # exit 1 + unified diff on any mismatch
```

A golden timeline (`tools/golden/seed<N>.timeline`, gitignored) holds every
tagged bot/harness line (`[HARNESS] [DEFENSE] [HUNT] [THREAT] [HERDDONE]
[WARNING]`), any `ERROR` lines, and a sha256 of each player's raw
statistics block, in order. A behavior-preserving refactor must reproduce
all five timelines bit-for-bit. `update <seed>` writes a golden — only for
creating the baseline, never to silence an unexplained diff.

### hunt-analyze.py — hunting telemetry

```sh
tools/hunt-analyze.py <stdout.log>
```

Parses `[HUNT]` lines: per huntable animal, template, mode, wound/kill/carcass
dropDist, inTerr, and whether the carcass is within civilian pickup range.

## Seeing a match

Two complementary ways to look at what the bot did. Neither replaces a batch:
`tools/run.sh` stays the source of truth (determinism, parallelism, scale).

### viz.py — watch a recorded match

```sh
tools/viz.py tmp/probe/seed7                    # default plan, whole match
tools/viz.py tmp/probe/seed7 --every 10 --from 8 --to 14 -T fight,army:1
tools/viz.py tmp/probe/seed7 --every 0 --shot 12.5:ent:4242@20 --shot 13:area:300,420,60
tools/viz.py tmp/probe/seed7 --from 17 --to 18 --every 10 -T overview,fight,fight@35
tools/viz.py tmp/probe/seed7 --show --hud --every 60   # watch it live
```

Replays the match's own `commands.txt` with `-replay-visual` (observer, the
exact recorded game, 45-minute trigger included): any recording works, no
special flag at record time. The camera is driven from inside the game by the
**brennus-viz** GUI mod (`tools/vizmod/`, mounted only here): no synthetic
input, no window focus. Every `--every` game seconds (30) the director pauses
the simulation, frames each target in turn, and prints `[VIZ] shot {...}` once
the frame is rendered; `viz.py` then grabs the window with `grim -T` (the
window's own pixels, no pointer, no shell). So every frame of a group shows the
same game instant, and `frames.jsonl` records the game time, the target, where
the camera looked (metres) and what it found.

Targets (`-T`, comma-separated; default `overview,base:1,base:2,army:1,army:2,fight`):
`overview` (whole map, top-down), `base:P` (P's civic centre, else its
structures), `army:P` (densest cluster of P's soldiers/siege not at work),
`fight` (densest cluster of units attacking another player's entity),
`ent:ID` (an id from the `[HARNESS] map` telemetry), `xy:X,Z` (metres),
`area:X,Z,R` (top-down view of the ground within R metres of X,Z). A target
that is absent at that instant is skipped.

Zoom: any target takes a camera suffix `@R[/PITCH[/YAW]]` — frame about R
metres around it (smaller = closer; R is the half-height of the view),
PITCH in degrees below the horizon (89 = top-down), YAW in degrees:
`fight@35`, `base:1@300/89`, `ent:4242@20/35`. Coordinates are world metres,
the same as the telemetry and `mapview.py`, and `frames.py` draws them as a
grid on top-down frames: read a spot off a gridded overview, then rerun with
`--shot MIN:area:X,Z,R` to look at it closely. Other options: `--from` /
`--to` game minutes, `--shot MIN:TARGET` one-off shots, `--speed` (20),
`--size` (1600x900), `--hud`, `--plan FILE` (any key of `DEFAULTS` in
`tools/vizmod/gui/session/brennus_viz/director.js`: zoom, pitch, cluster
sizes...), `-m DIR` mod snapshot (default: the batch's `mod/`).

By default the game runs on a private Hyprland headless output, a virtual
monitor far off the desktop layout: nothing shows on the screen, the pointer
cannot reach it, and it is removed afterwards. `--show` opens the window on the
current workspace instead (`--keep` leaves it running after the plan).
A whole match at the default plan takes about 10 s of wall time per game
minute (seed 1: 35 game-minutes, 298 frames, 6 minutes).

### frames.py — contact sheets and time-lapse

```sh
tools/frames.py <viz dir> [--rows 10] [--thumb 400] [--from MIN] [--to MIN]
tools/frames.py <viz dir> --targets overview --video overview.mp4
```

One table per page (`contact_01.png`, ...): a row per instant, a column per
target, each cell captioned with what the director found (units, players,
position, view radius). Top-down frames get a world-coordinate grid (metres),
fitted from screen→ground samples the director records with every frame;
full-size gridded copies go to `<viz>/grid/` (`--no-grid` to skip).
`--video` encodes one target's frames as a time-lapse.

### mapview.py — top-down map from the telemetry

```sh
tools/mapview.py <stdout.log> [-o mapview.png] [--tracks tracks.png] [--video clip.mp4]
```

The mod prints a `[HARNESS] map` line every 30 s of sim time — every unit and
building of both players as `[id,kind,state,x,z]` in metres. `mapview.py`
renders those snapshots as a grid (and optionally per-unit movement tracks),
which is exact, needs no GPU, and scales to a whole batch: 12 games in one
picture, or one game per seed compared side by side.

### layout.py — base clutter metrics from the telemetry

```sh
tools/layout.py <stdout.log | tag dir | batch dir>... [--at 16,24] [--radius 120] [--png DIR] [--tsv FILE]
```

The mod also prints a `[HARNESS] layout` line every 2 min of sim time:
every structure of both players with its true obstruction rectangle
(`[name,x,z,angle,w,d,blocks]`, foundations named `name*`, `blocks` 0 for
walkable fields). `layout.py` rasterizes player 1's blocking footprints
around the home CC on the engine's 1 m navcell grid and measures how much
they get in the way of movement, at the given game minutes:
`egress_inf/_ram` (detour out to the base rim, infantry clearance 0.8 m /
ram clearance 3.0 m), `trapped_ram` (ram-passable cells with no way out),
`cc_detour` / `cc_ram_detour` / `cc_ram_unreach` (paths to the civic
centre), `enclosed` (buildings with no side reachable from outside),
`ars` (arsenals whose rams can get out) and `density` (footprint share of
the 25-90 m annulus). Terrain is not in the snapshots, so the metrics
isolate the bot's own placement. `--png` draws each base with the
ram-blocked (brown), ram-trapped (purple) and infantry-trapped (red) cells.

## Local install

```sh
tools/install-local.sh [<commit>]   # default HEAD
```

Installs that commit's `bot/` into the local 0 A.D. as the `brennus` mod
(`~/.local/share/0ad/mods/brennus`, a copy — never a link to the working
tree; the commit is recorded in `.installed-commit`) and enables it in
`~/.config/0ad/config/user.cfg`, so Brennus shows up in the game setup's AI
list. Refuses while the game is running. Run it after each non pure doc
commit.

## Code helpers

- `strip_comments.py <in.js> <out.js>` — strip JS comments, preserving code
  exactly (string-literal-aware state machine; collapses comment-only lines
  to single blanks).

## Game data ↔ docs

`tools/gamedata/` works against the 0 A.D. source reference (`AGENTS.md`;
default `~/Work/0ad`; override the templates root with `ZEROAD_REF`, the
docs root with `ZEROAD_DOCS`). The shared loader lives in `templates.py` (walks the
entity templates, resolves Footprint/Obstruction through the parent chain).

- `footprint-compare.py` — footprint/obstruction survey across civs.
- `gen-sizes.py` — doc-ready footprint lines per building.
- `verify-docs.py` — cross-check the footprint lines written in
  `docs/game_description` against the game data; exits 1 on any mismatch.
