# Running matches on kiln

Kiln is the remote 0 A.D. match-running farm. Full goal matches are too
heavy for this VPS (Louis's rule: **never run test games here — always
use kiln**), and kiln runners are faster anyway: `pc` benchmarks at
~210 turns/s with 14 slots, `vps` at ~142 turns/s with 2 slots. A 45-min
goal-10 match takes 2-4 wall minutes on `pc`.

## The MCP tools

- `list_runners` — runners with state, slot count, benchmark turns/s,
  canary status. Check first if jobs sit queued: an `active` runner with
  `canary_ok: true` is healthy; `0ad_version` confirms the pinned engine
  (0.28.0).
- `submit_batch` — pack a local mod directory, upload it, queue jobs.
  Returns a batch id and one job id per spec.
- `get_batch_status` — per-job state (`queued` / `running` / `done`)
  plus, once finished, the full result: exit code, wall seconds, turn
  count, turns/s and the per-player end-of-game statistics.
- `get_result` — same result for a single job id.

## Submitting

```jsonc
// mcp__kiln__submit_batch
{
  "batch_name": "goal10-agg12-s3",        // optional, but name it: <goal>-<iteration>-s<seed>
  "mod_dir": "/home/ubuntu/brennus/bot",  // ABSOLUTE path; packaged as-is
  "spec": {
    "map": "random/mainland",
    "seed": 3,
    "aiseed": 3,
    "biome": "generic/temperate",
    "placement": "circle",
    "size": 192,
    "victory": ["conquest_civic_centers"],
    "players": [
      { "ai": "brennus_gaul_generic_land_map", "civ": "gaul", "diff": 3, "behavior": "aggressive", "team": 1 },
      { "ai": "petra", "civ": "rome", "diff": 3, "behavior": "aggressive", "team": 2 }
    ],
    "player": -1,               // observer
    "in_game_limit_min": 45,    // kiln ends the game at this mark (see below)
    "wall_budget_s": 1800       // hard wall-clock cap per job
  }
}
```

Every field matters: each player needs `ai`, `diff`, `behavior`, `civ`
and `team`, and determinism needs `seed` **and** `aiseed` pinned (same
value is fine), plus explicit `biome` and `placement` — the gamesetup
defaults resolve randomly otherwise.

Practical habits from the goal-10 campaign:

- **One batch per seed.** Batches are the unit of naming and waiting;
  `goal10-agg12-s3` beats a 5-job anonymous batch when you grep results
  later. Submit one `submit_batch` call per seed, in parallel.
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
extracts and greps the interesting lines in one go. The local
`result.json` is a summary only — the per-player statistics are in the
end-of-game JSON blocks inside `stdout.log` (or via `get_result`).

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
  sleep 30
done
exit 1
```

(run with a generous timeout; ~30 min covers a 45-min match plus queue
time).
