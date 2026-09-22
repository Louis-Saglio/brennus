# val1 — fix1 (shipping) won-seed regression sample (2026-09-22)

Bot: fix1 + unload position guard (fix2's behavioral changes reverted).
21 previously-won seeds spanning fast/medium/slow/race wins.

Results: 18/21 wins (52 70 320 capped; 70/320 were always 44m+ wins and
cap under every variant; 340/352 win again on fix1). Combined with the
fix1 probe: 7/11 bad seeds won, 3/3 won controls, 4/6 canaries won,
zero JS errors on the shipping code.
