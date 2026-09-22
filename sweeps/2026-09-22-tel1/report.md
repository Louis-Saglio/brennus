# tel1 — telemetry probes (2026-09-22)

Bot: 29bfb48 + telemetry only ([THREATDEC] engage/garrison decisions,
[BATTLE] per-wave exchange ledger, siege-camp standoff and eco-stall
warnings, training-queue counters in [HARNESS]).

Seeds: 6 bad (162 170 152 267 230 316) + 3 won controls (3 25 1), all
standard settings, 45-min cap.

Finding that drove the fix: all 11 bad seeds share the garrison->engage
churn — the parity (`army >= nearThreat`) superiority check flips as the
wave floods the ring, ejecting the hidden army into piecemeal fights
(s152: 4 flips in 30 s; s170: 6 flips in 80 s, army 62->37->22). Each
cycle donates 20-70 soldiers; the retrain queue eats the food flow and
the pop gap never closes. Won seeds break the first wave with a gathered
army and snowball; the standoff itself happens in won seeds too.
