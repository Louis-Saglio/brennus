# GOALS.md — Brennus

Progressively harder goals for the bot, in the order they should be achieved.
Do not work on goal *n+1* before goal *n* passes — each goal assumes the
previous ones keep working (no regressions).

## Verification

Every goal is verified by headless matches (`AGENTS.md` smoke-test command,
adapted): fixed map `random/mainland` size 192, biome `generic/temperate`,
placement `circle`, victory `conquest_civic_centers`, bot plays **gaul** as
player 1, opponent(s) play **rome** with Petra at the stated difficulty
(0 sandbox … 5 very hard). Unless a goal says otherwise, the default
opponent is a single Petra bot.

A goal passes when it is achieved on **5 distinct seeds** in a row, with:

- zero JS errors in the interesting log,
- the same seed always producing an identical result (determinism),
- the bot's per-player statistics JSON (printed at game end) showing the
  required outcome.

In-game time below means the statistics `timeElapsed` (simulation time), not
wall time.

## Tier 1 — Economy foundations (opponent: sandbox)

1. **Function without errors**: complete a full match with zero JS errors.
   *(Skeleton already passes — the canary for all future work.)*
2. **Gather resources**: all starting workers gathering continuously; no
   idle units; steady positive income of food, wood, stone, metal.
3. **Grow population**: train workers without interruption and build houses
   ahead of the cap; population grows roughly exponentially and never sits
   capped with resources stockpiled.
4. **Reach Town Phase** in under 12 in-game minutes while maintaining
   population growth.
5. **Reach City Phase** in under 20 in-game minutes while maintaining
   population growth.
6. **Master the economy**: by 30 in-game minutes, have all of:
   - 300 population,
   - all economic technologies researched,
   - City Phase reached,
   - at least ten traders,
   - at least 1000 resources earned from trading with traders,
   - at least 300 wood exchanged against stone at the market.

## Tier 2 — Basic military (single opponent)

7. **Defeat a sandbox Petra** (difficulty 0) in under 40 in-game minutes.
8. **Survive 60 in-game minutes** against a very easy Petra (difficulty 1)
   without losing the civic center.
9. **Defeat a very easy Petra** in under 60 in-game minutes.
10. **Defeat a very easy Petra** in under 30 in-game minutes.

## Tier 3 — Escalating difficulty (single opponent)

11. **Survive 60 in-game minutes** against an easy Petra (difficulty 2).
12. **Defeat an easy Petra** in under 60, then under 30 in-game minutes.
13. **Survive 60 in-game minutes** against a medium Petra (difficulty 3).
14. **Defeat a medium Petra** in under 60, then under 30 in-game minutes.
15. **Survive 60 in-game minutes** against a hard Petra (difficulty 4).
16. **Defeat a hard Petra** in under 60, then under 30 in-game minutes.
17. **Survive 60 in-game minutes** against a very hard Petra (difficulty 5).
18. **Defeat a very hard Petra** in under 60 in-game minutes.
19. **Defeat a very hard Petra** in under 30 in-game minutes.

## Tier 4 — Outnumbered (allied opponents)

Opponents are Petra bots on the same team (`-autostart-team=2:2` …), all at
the stated difficulty, all rome.

20. **Defeat two allied medium Petra bots** (1v2) in under 60 in-game minutes.
21. **Defeat two allied very hard Petra bots** (1v2) in under 90 in-game
    minutes.
22. **Defeat three allied very hard Petra bots** (1v3).

## Notes

- "Defeat" = the bot wins under `conquest_civic_centers` (all enemy civic
  centers destroyed or captured), per the statistics `playerState`.
- Time-box goals are about *bot speed*, not just winning eventually: a win
  past the limit does not pass the goal.
- When a goal passes, record the run (command line, seeds, statistics) in
  the experiment log so regressions can be detected later.
