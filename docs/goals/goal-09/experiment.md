# Goal 9 — Defend, boom and expand (started 2026-08-23)

**Status: bot created as a goal-8 copy and smoke-verified. First full match
shows the starting gap: the bot is defeated by medium defensive Petra at
~31 in-game minutes. No defend logic written yet.**

## Setup

- Opponent: Petra, difficulty 3 (medium), behaviour `defensive` (pinned on
  the command line: `-autostart-aidiff=2:3
  -autostart-aibehavior=2:defensive`). Runner: `tools/run.sh -a
  brennus_gaul_defend_boom_and_expand_generic_land_map -d 3 -v defensive`.
- Time limit: in-mod trigger now 45 in-game minutes (was 30 for goal 8).
  Goal-8 reruns must pass `-l 30`.

## Bot creation (this commit)

`brennus_gaul_defend_boom_and_expand_generic_land_map` is a byte-for-byte
copy of the goal-8 bot (only the header comment, `data.json` name and the
filename changed). The expansion shares are still tuned for the 30-minute
deadline (`expansionsShares`, deplete-by-t=30 sizing).

## Verification runs

### Probe (10-minute canary, seed 1)

Clean: `[HARNESS] brennus: loaded`, zero JS errors, time-limit trigger
fired at 10 min, engine exit 0.

### Full match (45-minute limit, seed 1, tag `full-s1`)

**The bot lost**: Petra conquered at turn 9270 ≈ **30.9 in-game minutes**
(45-min trigger never fired), engine exit 0 (game finished via
`conquest_civic_centers`).

| | player 1 (bot) | player 2 (Petra) |
|---|---|---|
| result | defeated | won |
| city phase | 14.3 min | — |
| pop 300 | 14.8 min | — |
| peak map % | 23 | 74 |
| units lost | 1069 (1068 workers) | 50 |
| units killed | 50 | 1069 |
| buildings lost | 83 (29 houses, 28 econ, 1 CC) | 0 |
| resources at end | food 21 / wood 31613 / stone 862 / metal 620 | — |

Readings:

- The boom bars hold (city 14.3, pop300 14.8 — both ≤ 15). The goal-8
  economy is intact right up to the collapse.
- Petra at medium difficulty **defensive** still attacks: it killed 1068
  workers and destroyed every expansion CC. "Defensive" restrains its
  tempo, not its willingness to kill an undefended economy.
- Territory peaked at 23% (goal 8 reached 77-94% against a sandbox): the
  expansion filter ("away from enemies") and Petra's own territory
  contest every CC placement from the start.
- Sim rate with a medium Petra opponent: ~32 turns/s (9270 turns in
  ~5:10 wall incl. startup) vs ~113 with a sandbox — plan goal-9 batches
  accordingly (a full 45-min match ≈ 7 wall minutes serial).

## Next

- Defend logic is the goal: something must notice the Petra army and
  either contest it or wall/tower the expansion before the CCs fall.
- Re-tune expansion shares from the 30- to the 45-minute deadline.
