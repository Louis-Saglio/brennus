# fix11 — Fix B + demob-walk-home (Fix F)

Variant: demobilized soldiers walk to the CC before being reassigned to
gathering, so they gather home-side and the recall converges in seconds.

Result: bust. 140/215 still capped (the walk home did not keep them home —
assignGatherers reassigns by proximity and they drift back out; far fields
still pull). Worse: 162 defeat 40.8m, 356/230 capped — the home-gathering
disrupted the boom. Only 372/373 hold.

Conclusion: Fix F discarded. The massacre soldiers being 113m out is real,
but leashing them home costs the boom without delivering the recall benefit.
