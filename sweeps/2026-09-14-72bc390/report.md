# Sweep: seeds 1-200, standard settings — capture policy (72bc390)

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive),
mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game
limit, seed == aiseed. Run on 2026-09-14 via kiln.

Paired A/B, same 200 seeds per side:

- **tweak** = bot at 72bc390: capture-or-raze verdict on raid/purge/
  clearance structure attacks, no ram-loss raid abort while capture can
  finish, hold-or-delete sweep for fresh captures, deny-capture scorch of
  own military structures at 50-70% own cp share.
- **base** = bot at c9d0df8 (pre-change HEAD), staged at
  tmp/capture-ab/bot-base.

**Outcome: base 187W/10T/3L, tweak 188W/9T/3L — 0 JS errors in 400 games**

## Verdict vs baseline

One conversion, zero regressions: **s47 timeout -> win** (base razed 1 CC
and stalled at the cap; tweak captured the last CC at 43.5m and won at
44.7m — the exact scenario the change was built for). Losses are the same
three hard maps on both sides (s61, s69, s113); s113 survived 8 min longer
under the tweak (41.0 vs 33.0) while scorching 6 towers Petra was
capturing. Shared timeouts: s11, s52, s103, s127, s139, s153, s170, s176.

On the 187 paired wins: mean delta +0.01 min, median +0.00, 5 seeds >=1
min faster, 7 >=1 min slower — chaos-level noise. **The change is
win-time-neutral; it converts games that stall, not speed up games that
win.**

## Capture feature incidence (tweak; base is all-zero — it never captured)

| feature | games | total | meaning |
|---|---|---|---|
| capflip | 39 | 41 | enemy structures flipped to us |
| capCC | 36 | 38 | civic centers captured (stats side) |
| capwaive | 6 | 6 | rams lost mid-raid, CC finished by capture |
| caphold | 36 | 38 | captures kept (self-holding or in our territory) |
| capdel | 3 | 3 | captures deleted before drifting back (s134, s150, s190) |
| caplost | 0 | 0 | captures that drifted back to Petra |
| capscorch | 1 | 6 | own towers deleted past the denial point (s113) |

Accounting closes: 41 flips = 38 held + 3 deleted, 0 lost. Every captured
structure was either kept or denied; nothing was gifted back.

enemyBuildingsDestroyed.CivCentre drops 367 -> 318 because 38 CCs were
captured instead of razed (total eliminations 367 vs 356, one more win).

All 6 ram-waiver games (s7, s9, s95, s116, s121, s197) ended in wins —
raids that base would have aborted outright. Win time on games with a
capture event averages 31.3 min vs 29.1 without: selection effect
(captures happen in hard games where rams die), not a slowdown — the
paired delta is zero.

## Conclusion

The capture policy is a strict improvement: same win speed, +1 net win
from the timeout pool, 38 CCs taken intact instead of razed, perfect
hold/deny accounting on captures, and a scorched-earth denial that
extended one losing game's survival by 8 min. Keep.

Artifacts: artifacts/<side>/s<seed>/ (gitignored); jobs-base.tsv /
jobs-tweak.tsv map seeds to kiln batch/job ids; collect.py regenerates
results-<side>.tsv; compare_sweeps.py is the paired comparison.
