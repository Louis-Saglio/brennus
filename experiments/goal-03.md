# Goal 3 — Grow population (2026-08-20)

**PASSED** on 5 seeds in a row.

## Setup

- Bot now (on top of goal-2 gathering, with proportional gatherer shares
  food 50% / wood 30% / stone 10% / metal 10%):
  - trains women without interruption at the civil centre, and at houses
    once Fertility Festival (`unlock_civilians_house_generic`) is researched
    (researched at the first house once the economy can absorb it);
  - builds houses ahead of the population cap (trigger when margin < 10,
    up to 2–3 concurrent house foundations, in-progress houses counted as
    the +5 cap they will provide);
  - builds fields (up to 4) when berry bushes near the CC run low or the
    food workforce grows past 5;
  - placement: ring search around the CC (32 angles, 3 m steps, out to
    90 m) requiring the whole footprint clear in the `building-land`
    passability grid (**bit set = impassable**) and in own territory.
- Opponent: Petra sandbox, rome. 30 in-game-minute time limit.
- Command as in `experiments/goal-01.md`; runner `tmp/goal3/run.sh`.

## Results

| seed | exit | JS errors | units trained | buildings | pop curve (5-min marks) | stats sha256 (16) |
|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 223 | 49 | 9 → 46 → 83 → 121 → 158 → 196 | eed7af0b9709c0db |
| 2 | 0 | 0 | 224 | 48 | 9 → 47 → 84 → 122 → 154 → 191 | 573d74aed690e40d |
| 3 | 0 | 0 | 224 | 48 | 9 → 47 → 84 → 122 → 159 → 197 | 3e6fe1b1e1fcbb5b |
| 4 | 0 | 0 | 224 | 47 | 9 → 46 → 84 → 121 → 159 → 196 | d8f6d02afadba728 |
| 5 | 0 | 0 | 224 | 49 | 9 → 47 → 84 → 122 → 159 → 197 | 545b672767099246 |

- Population roughly doubles every 5 minutes early on, never touches the
  cap at any 5-minute sample (margin ≥ 8 everywhere).
- Resources gathered (all seeds, player 1): food 20.7k–22.9k,
  wood 14.2k–17.0k, stone 4.8k–5.6k, metal 5.2k–5.7k — goal 2 keeps
  passing (no regression).
- Idle workers ≤ 2 at every sample (transient between jobs).
- Determinism: seed 1 rerun byte-identical (sha eed7af0b9709c0db).
