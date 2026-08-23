# Goal 1 — Function without errors (2026-08-20)

**PASSED** on 5 seeds in a row.

## Setup

- Bot: no-op skeleton (`brennus.js` issues no commands) + new harness
  override `bot/maps/scripts/NonVisualTrigger.js` (prints end-of-game
  statistics like public, plus a 30 in-game-minute time limit that marks
  player 1 as won so headless runs exit cleanly).
- Opponent: Petra, difficulty 0 (sandbox), rome, player 2.
- Commit: see git history (trigger added in the goal-1 commit).

## Command (per seed)

```sh
HOME=$PWD/tmp/goal1/<tag>/home timeout 300 /usr/games/pyrogenesis \
  -autostart=random/mainland -autostart-seed=<seed> \
  -autostart-biome=generic/temperate -autostart-placement=circle \
  -autostart-nonvisual -autostart-players=2 -autostart-size=192 \
  -autostart-victory=conquest_civic_centers \
  -autostart-ai=1:brennus -autostart-ai=2:petra -autostart-aidiff=2:0 \
  -autostart-civ=1:gaul -autostart-civ=2:rome -autostart-player=-1 \
  -unique-logs -nosound -mod=public -mod=brennus
```

Runner script: `tmp/goal1/run.sh` (scratch, not committed).

## Results

| seed | exit | JS errors | turns | timeElapsed | player 1 | stats sha256 (16) |
|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 9000 | 1800000 ms | won | 2b2562bcf21097e2 |
| 2 | 0 | 0 | 9000 | 1800000 ms | won | 7d3d23c6a00f2bd3 |
| 3 | 0 | 0 | 9000 | 1800000 ms | won | 48262d0f8fdf7f9a |
| 4 | 0 | 0 | 9000 | 1800000 ms | won | 0f014a9d376eb91d |
| 5 | 0 | 0 | 9000 | 1800000 ms | won | 22575f651772ab77 |

- Determinism: seed 1 rerun produced byte-identical statistics JSON
  (sha256 matches: 2b2562bcf21097e2).
- All runs exited on the victory condition (engine `IsGameFinished`),
  `metadata.json` written in every replay dir.
- Wall time ≈ 22–26 s per run (~375 turns/s at this entity count).
- Stats hash = sha256 of the two pretty-printed per-player statistics JSON
  blocks extracted from stdout (`awk '/^\{$/{f=1} f{print} /^\}$/{f=0}'`).
