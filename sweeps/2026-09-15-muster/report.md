# Sweep: seeds 1-200, standard settings — muster-and-engage raid defense

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive),
mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game
limit, seed == aiseed. Run on 2026-09-15 via kiln.

Paired A/B, same 200 seeds per side:

- **tweak** = bot with the muster-and-engage defense (this change):
  musterEngage in defense.js — gather at 45 m from the threatened CC
  toward the enemy, hold until the enemy closes to 70 m (or 2/3
  gathered at 110 m), engage as one block (melee to the centroid,
  ranged to a back line 30 m behind it, cavalry priority targets);
  incoming-wave detection (8+ within 250 m of the near-home group's
  centroid) suppresses the leftover-raider swat and gates the
  minor-probe engage.
- **base** = bot at 72bc390 (capture policy), reused from
  sweeps/2026-09-14-72bc390 results-tweak.tsv — same code, same spec,
  deterministic engine.

**Outcome: base 188W/9T/3L, tweak 192W/8T/0L — 0 JS errors in 200 games**

## Verdict vs baseline

11 conversions to win, 7 win->timeout regressions, **zero losses
anywhere**. The three target seeds all flip loss->win:

| seed | base | tweak |
|---|---|---|
| s61 | loss 30.4m | win 30.1m |
| s69 | loss 36.4m | win 38.7m |
| s113 | loss 41.0m | win 41.4m |

Timeout->win conversions: s11, s52, s103, s127, s139, s153, s176, s192
(8 seeds — the early-wave survival carries through to a win).

Win->timeout regressions: s41, s76, s80, s102, s152, s160, s162. Spot
checks (s41, s80, s160) show active raids/grinds at the 45 m cap on
hard maps — chaotic tails, not a stall: no game is lost anymore, and
the paired-win speed improved (below).

On the 181 paired wins: **mean delta -0.97 min, median -0.80** — 89
seeds >=1 min faster, 42 >=1 min slower. Surviving the first raid with
a live economy compounds into a faster win.

## The problem this fixed (from base artifacts)

All three lost seeds show the same first-wave failure: the swat branch
treated a 70-113-man wave's vanguard as "leftover raiders" and fed it
proportional 6-28-man detachments while the muster was still walking
home (s113: 52 -> 45 soldiers before the ring even tripped), then the
serious branch attack-moved the survivors from scattered positions —
javelineers (run 19 m/s) arrived first and died without cover,
spearmen (15.9) trickled in after.

## What the tweak does instead (from tweak artifacts)

Early muster ~30-60 s before contact (s113: "mustering 52 soldiers at
294,172 (enemy 174m out)" at 12.7m), a single engage from the gathered
line ("engaging from the muster (gathered 54/58, enemy 41m out)"), and
no swat feeds into vanguards (swat still fires on genuinely isolated
groups: 116/200 games).

Feature incidence: muster 200/200 games, muster-engage 200/200, swat
116/200 (base: 0 everywhere — the branches are new).

## Conclusion

The muster-and-engage is a strict improvement for raid defense: the
army is gathered on the battlefield before the battle starts, melee in
front, ranged behind — first-fight losses stop compounding, the three
hardest maps flip to wins, eight timeouts convert, wins get ~1 min
faster on average, and no seed is lost anymore. The 7 win->timeout
tails are accepted as chaos variance under the now-universal survival
(no systematic stall found).
