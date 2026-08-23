# Goal 2 — Gather resources (2026-08-20)

**PASSED** on 5 seeds in a row.

## Setup

- Bot now assigns every gatherer unit to the resource with the largest
  unmet need (targets: food 3, wood 2, stone 2, metal 2) and reassigns
  idle units every 5 turns. Nearest accessible non-full supply with a
  non-zero gather rate; huntables considered for food.
- Opponent: Petra sandbox (difficulty 0), rome. 30 in-game-minute time
  limit (harness trigger from goal 1).

## Command

Same as goal 1 (`docs/goals/goal-01/experiment.md`), runner script
`tmp/goal2/run.sh` (scratch).

## Results

Resources gathered by player 1 (brennus) over 30 in-game minutes, from the
end-of-game statistics JSON:

| seed | exit | JS errors | food | wood | stone | metal | stats sha256 (16) |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 2560 | 1580 | 1274 | 1224 | f69f6e9d2708a4fa |
| 2 | 0 | 0 | 2760 | 1627 | 1306 | 1218 | 67c19eec87689b9a |
| 3 | 0 | 0 | 3077 | 1600 | 1340 | 1225 | 56941da2722702d7 |
| 4 | 0 | 0 | 2795 | 1610 | 1298 | 1286 | 58c3d4dba311237e |
| 5 | 0 | 0 | 3485 | 1629 | 1331 | 1436 | 2eb4cf7f6eca86e9 |

- Positive income of all four resources on every seed; stockpiles grow
  roughly linearly (nothing is spent yet).
- Bot status line every 5 in-game minutes shows `idle=0` with the 3/2/2/2
  gatherer split on every seed.
- Determinism: seed 1 rerun byte-identical (sha f69f6e9d2708a4fa).
