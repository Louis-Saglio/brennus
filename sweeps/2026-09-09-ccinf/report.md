# ccinf A/B: CC war-stage infantry trainer + storehouse-anchored arsenal fallback

Standard settings (Brennus gaul vs Petra rome, both diff 3 aggressive, mainland 192,
temperate, circle, conquest_civic_centers, 45-min in-game limit, seed == aiseed), kiln,
seeds 1-5 per variant.

Variants: `base` = HEAD dea4463 (exported pre-change, `tmp/ccinf-base/bot`);
`patched` (v1) = CC joins the war-stage infantry rotation; `v5` = v1 + war-stage
arsenal placement fallbacks (ignore mobile enemies at the home ring, 45° rotated
retry, woodline-storehouse anchors) + placement-failure diagnostics in the
no-placement warning. (v2 = +enemy relaxation: bit-identical to v1. v3 = +rotation:
bit-identical to v1. v4 = +storehouse anchors with a `gameState` scoping bug:
invalid, 5683 JS errors. All kept under artifacts/.)

| seed | base | v1 | v5 | arsenal base/v1/v5 | first raid base/v1/v5 |
|---|---|---|---|---|---|
| 1 | timeout | timeout | timeout | -/-/- (war stage never reached) | - |
| 2 | win 26.6 | win 36.7 | **win 26.2** | 20.7/31.2/19.3 | 23.1/33.2/22.8 |
| 3 | win 31.6 | win 34.2 | **win 26.0** | 22.2/25.4/17.4 | 25.7/29.5/20.4 |
| 4 | win 34.4 | timeout | timeout | 21.0/25.0/18.1 | 24.3/36.1/21.6 |
| 5 | win 35.7 | win 36.5 | **win 25.8** | 23.5/24.9/17.7 | 31.3/32.7/19.8 |

Zero JS errors in all counted runs.

Mechanism: v1's only systematic harm was the arsenal landing 3-10 min late (rams
late, raid gate opens late); the muster itself was not slowed (army ≈125 by ~23 min
in both variants). Diagnosis via the new counters: ~97% of arsenal candidates fail
static passability (trees/buildings), not enemies/territory. The storehouse-anchor
fallback places the arsenal at war-on on every war-stage seed.

Kept: v5. s4 remains a timeout (raid starts earlier than base but at the 2-ram
floor; first raid's rams died under a 23-defender CC, then a 15-min grind against
a 236-strong Petra). s1 timeout is pre-existing at HEAD (patch never activates
there: war stage unreached).
