# house1 — from-scratch house system, first full batch (2026-09-23)

Bot: house placement + demand rewritten from first principles (district
annulus 24-50 m per CC, nearest-first; spill levels into lattice/wild
rings feed the relief-expansion signal; spawn-rate projection demand
model). This batch ran the UNtuned geometry (houseOuterR=50,
houseFarmDiscR=40).

21 val1 seeds, standard spec. Results: 18W/2D(259 320)/1T(340), zero JS
errors. Houses lost: zero on 18 seeds; 259:21, 320:7, 340:22, 70:5,
52:1.

Diagnosis: s340's district (~15-20 spots after the 40 m farmstead discs)
filled by ~10 min, then 34 of 70 orders landed at 80-120 m in the
enemy's roam path — 22 lost, rebuilt into the same kill zone (val1 won
s340 at 41.9m with 2 lost). s259/s320 are military overruns, not
placement. Fix: houseOuterR 50->56, houseFarmDiscR 40->30 (validated in
house2).
