# fix1 — engage/garrison churn fix, probe (2026-09-22)

Bot: 29bfb48 + telemetry + fix1:
- engage only at `army >= nearThreat * 1.15` and `waveSize <= army`
  (250 m bulk veto),
- musterEngage charges only gathered (2/3 at muster) or emergency <40 m
  (was <70 m regardless of gathering),
- eject-merge: freshly ejected garrison soldiers join the charge
  (ejectArmyGarrisons returns ids).

Seeds: 11 bad + won controls 3/25/1 + canaries 2/76/140/263/356/373.
Results: 7/11 bad seeds flip to wins (66 162 172 230 267 285 316);
41/152/170/215 stay capped. Controls 3/3 hold; canaries 2/263/356/373
win, 76/140 capped (s140 hit a rare non-fatal unload-position crash —
fixed by the position guard before shipping).
