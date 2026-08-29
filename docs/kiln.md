# Running matches on kiln

Kiln is the remote 0 A.D. match-running farm. Full matches are too
heavy for this VPS (Louis's rule: **never run test games here — always
use kiln**), and kiln runners are faster anyway: `pc` benchmarks at
~210 turns/s with 14 slots, `vps` at ~142 turns/s with 2 slots. A 45-min
match takes 2-4 wall minutes on `pc`.

## The MCP tools

- `list_runners` — runners with state, slot count, benchmark turns/s,
  canary status. Check first if jobs sit queued: an `active` runner with
  `canary_ok: true` is healthy; `0ad_version` confirms the pinned engine
  (0.28.0).
- `submit_batch` — pack a mod directory, submit a job spec. Returns a
  batch id and one job id. Submit one batch per seed for multi-seed runs
  (they run in parallel on free runner slots).
- `get_batch_status` — per-job state (`queued` → `running` →
  `done`/`failed`); once finished, a job embeds its full result: exit
  code, wall seconds, turn count, turns/s and the per-player end-of-game
  statistics.
- `get_result` — same result for a single job id.

## Submitting

```jsonc
// mcp__kiln__submit_batch
{
  "batch_name": "tel-s1",                 // optional; name it <label>-<iteration>-s<seed>
  "mod_dir": "/home/ubuntu/brennus/bot",  // ABSOLUTE path; packaged as-is
  "spec": {
    "map": "random/mainland",
    "seed": 1,
    "aiseed": 1,
    "biome": "generic/temperate",
    "placement": "circle",
    "size": 192,
    "victory": ["conquest_civic_centers"],
    "players": [
      { "ai": "brennus", "civ": "gaul", "diff": 3, "behavior": "aggressive", "team": 1 },
      { "ai": "petra", "civ": "rome", "diff": 3, "behavior": "aggressive", "team": 2 }
    ],
    "player": -1,               // observer
    "in_game_limit_min": 45,    // kiln ends the game at this mark (see below)
    "wall_budget_s": 1800       // hard wall-clock cap per job
  }
}
```

Field reference (validation is strict — unknown values are rejected
instead of silently ignored by the engine):

- `map`: `random/<name>` (also skirmish/scenario maps) from the pinned
  0.28.0 allowlist.
- `players[].ai`: the AI directory name, i.e. a `simulation/ai/<name>/`
  with a `data.json` — `petra` or one of the bot's AI ids. **A wrong AI
  name does not fail the job**: the game runs with an idle player and
  `exit_code` stays 0. Detect it by checking the artifacts' `stdout.log`
  for `Failed to create AI player` and by confirming your bot's
  `[HARNESS]` line printed and its stats are non-zero.
- `players[].diff`: 0..=5. `players[].behavior`: `random`, `balanced`,
  `defensive` or `aggressive`. **Every** player needs `ai`, `diff`,
  `behavior`, `civ` and `team` — including your own bot.
- `players[].team`: `-1` (no team) or 1-based `1..=N` — **not** 0-based.
- `size`: 64..=1024. Max 8 players.
- `player`: local player slot, `-1` = observer (use that for bot matches).
- `seed`/`aiseed`: map and AI seeds. Pin both (same value is fine), plus
  explicit `biome` and `placement` — the gamesetup defaults resolve
  randomly otherwise (verified: resubmitting the same spec yields
  identical turn counts and statistics; only wall-clock timings differ).
- `in_game_limit_min`: the kiln harness (a mod that mounts last and
  overrides `maps/scripts/NonVisualTrigger.js`) ends the game after this
  many in-game minutes by marking player 1 `won` and the rest `defeated`,
  so a capped run still exits cleanly and prints statistics. Always set
  it; 15 in-game minutes = 4499 turns. `playerState` in the stats only
  reflects a real victory when the game ended before the limit.
- `wall_budget_s`: hard wall-clock kill enforced by the runner (server
  cap: 7200). Size it generously above the expected run time — a killed
  job is `failed` and loses the clean end-of-game output.
- `collect_replay`: also uploads the `commands.txt` replay.
- `mod_dir`: an absolute path the server process can read (on this VPS,
  `/home/ubuntu/brennus/bot` just works — it is packaged as-is, not
  interpreted). Its basename becomes the mod folder the runner installs
  and mounts (`-mod=<basename>`). Omit entirely for petra-only games.
  Bundles are content-addressed (sha256) and cached server-side, so
  resubmitting an unchanged mod costs nothing. A submit that fails with
  "not a directory" on a real directory means the server process cannot
  traverse that path (wrong host or permissions).

Practical habits:

- **One batch per seed.** Batches are the unit of naming and waiting; a
  named batch beats a 5-job anonymous batch when you grep results later.
- **Syntax-check the mod before submitting** — a broken JS file wastes a
  full match slot before you see the error:
  `node --experimental-default-type=module --check bot/simulation/ai/<bot>/<bot>.js`
- **Probe before validating.** Iterate on 1-3 seeds (rotate which ones —
  single-seed tuning overfits to one map), then run the full 5-seed
  validation only when the probes look good.

## Reading results

Results land locally as soon as a job finishes:

```
/var/lib/kiln/results/kimi-agent/<batch_id>/<job_id>/
├── result.json         # exit_code, turn_count, turns_per_sec, wall_seconds
└── artifacts.tar.gz    # stdout.log, interestinglog.html, metadata.json, ...
```

Readable via sudo; `tools/fetch-kiln-artifacts.sh <batch> <job> <dir>`
extracts and greps the interesting lines in one go. The tarball contains:

- `stdout.log` / `stderr.log` — full engine output; this is where
  `print()` lines (e.g. `[HARNESS]`) and JS errors land. **Always grep it
  for `ERROR`** before trusting a result.
- `stats.json` — the per-player statistics also embedded in the MCP
  result.
- `result.json` — exit code, wall seconds, turn count, turns/s.
- `metadata.json`, `mainlog.html`, `interestinglog.html` — engine logs.
- `replay/` — only when `collect_replay: true`.

Quick verdict recipe:

- `turn_count / 300` = in-game minutes (200 ms per turn).
- In `stdout.log`, grep `playerState` (player 1 is the bot under test)
  and **`time limit reached`** — the in-game limit trigger marks player
  1 won *regardless*, so a "won" at the cap is not a win. In kiln runs
  the line prints with a `[KILN]` tag. A genuine win has no such line
  and shows Petra `defeated` with her CCs destroyed
  (`enemyBuildingsDestroyed.CivCentre` on player 1's stats).
- Grep for `ERROR` / `script exception` — a win with JS errors does not
  count.
- The bot's own telemetry is in the same log (`[HARNESS]`, `[DEFENSE]`
  tags); the per-snapshot `army=` / `enemyArmy=` / `enemyNear=` fields
  are the fastest way to see *why* a game went the way it did.

## Waiting without polling

`submit_batch` does not notify on completion and `get_batch_status` is a
pull API. Instead of polling, start a background watcher on the local
results dir — it fires a completion notification when all jobs land:

```sh
for i in $(seq 1 120); do
  n=0
  for pair in "<batch1>/<job1>" "<batch2>/<job2>"; do
    sudo test -f "/var/lib/kiln/results/kimi-agent/$pair/result.json" && n=$((n+1))
  done
  [ "$n" -eq 2 ] && exit 0
  sleep 15
done
exit 1
```

(run with a generous timeout; ~30 min covers a 45-min match plus queue
time).
