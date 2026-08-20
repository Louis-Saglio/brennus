# Goal 4 — Reach Town Phase in under 12 in-game minutes (2026-08-20)

**PASSED** on 5 seeds in a row.

## Setup

- New: `managePhaseUp()` — once the phase requirements are met and
  t > 3 min, all training pauses (`wantsPhaseUp`) until the tech cost +
  buffer is banked, then the CC researches `phase_town_generic`
  (500 food / 500 wood, 30 s, requires 5 Village-class structures).
  Training resumes as soon as the research starts.
- Also in this change: idle gatherers now try resources in deficit order
  and take the first with an available supply (spillover instead of
  idling), and a bug fix: `currentPhase()` returns a number — the goal-3
  Fertility Festival condition compared it to a string and never fired,
  so houses now actually train women (pop reaches the 300 popMax).
- Opponent: Petra sandbox, rome. 30 in-game-minute time limit.
- Command as in `experiments/goal-01.md`; runner `tmp/goal4/run.sh`.

## Results

| seed | exit | JS errors | town phase at | stats sha256 (16) |
|---|---|---|---|---|
| 1 | 0 | 0 | 7.2 min | edeedc2d7669084f |
| 2 | 0 | 0 | 6.5 min | ab85cae7e66757f7 |
| 3 | 0 | 0 | 6.9 min | 158821bf0da51734 |
| 4 | 0 | 0 | 6.8 min | de6e10df9f5b5033 |
| 5 | 0 | 0 | 7.3 min | 2afbaee7750f1e76 |

All well under the 12-minute limit. Population keeps growing through and
after the phase-up (33 at t=5m during the saving pause, ~90 at t=10m,
~180 at t=15m, 300 = popMax by ~t=22–25m).

- No regressions on goals 1–3: resources gathered (player 1, 30 min):
  food 21.3k–23.6k, wood 18.1k–21.3k, stone 5.8k–6.6k, metal 5.8k–7.2k;
  pop never caps below popMax at any 5-min sample.
- Determinism: seed 1 rerun byte-identical (sha edeedc2d7669084f).
- Known blemish: seed 1 shows idle=13 at t=25m (pop maxed, nearby food
  saturated); other seeds idle ≤ 3. Not blocking any goal criterion.
