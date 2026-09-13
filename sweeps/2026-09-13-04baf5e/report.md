# Sweep: seeds 1-200, standard settings — gaul cavalry (stable + sword-cav contingent)

Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), mainland 192, temperate, circle, conquest_civic_centers, 45 min in-game limit, seed == aiseed. Run on 2026-09-13 via kiln, bot at commit 04baf5e.

Experiment (Louis): brennus never trained cavalry. Now: a war-stage stable
trains a 24-strong sword-cavalry contingent inside the 120-pop army target
(first-class reserve + training slot before the infantry loop — the
trainer-loop variant trained nothing in smoke), the stable researches
Horse Racing + Horse Breeding, and cavalry picks its own targets (siege
first — rams are 7 hack / 35 pierce armor — then the ranged back line) in
the defense threat branch and the raid contest loop. Economy guards: cav
never demobilizes to meat, only the javelineer herds. Military building
placement scans out to 200 m (25x25 stable found no hole in crowded rings
on 4/10 validation seeds pre-fix). Cavalry change at 04baf5e; baseline is
the 65dc63c sweep same day (code-identical parent 3dd2f21).

**Outcome: 3 losses, 10 timeouts, 187 win — 0 JS errors in 200 games**

Verdict vs baseline: **187W/10T/3L — identical tally, with the whole
distribution shifted ~3 min faster.**

- Paired wins (182): mean delta **−3.03 min**, median −2.30; 120 seeds
  ≥1 min faster, 32 slower. Win-time distribution: mean 32.6 → 29.4,
  median 32.4 → 28.1.
- Churn (11 flips): converted to win 87, 88, 102, 182 (timeouts) and 199
  (loss); churned out of win 11, 52, 103, 139, 192 (all to timeouts);
  69 timeout→loss. The five win→timeout flips are documented shapes —
  near-cap coin flips (base ends 43.9/44.2) and defense-pinned standoffs
  (army ground down engaging home waves, never reaching the 75+2 raid
  gate; e.g. s103: 39→25→21→4, s192: 45→6). No cavalry-specific
  mechanism found in any of them.
- War-machine features "collapse" (wonder 53→0, tier3 166→105, will
  3→0) is the faster kill clock, not a regression: all 53 baseline
  wonder-order games are WINS in the cav sweep, mean end 35.2 → 28.3 min
  — the game is over before the wonder stage exists.
- K/D: 1.178 → **1.271** (+8%). Infantry trained 62643 → 49469 (−21%),
  replaced by 5262 cavalry (~26/game). Food gathered −20% (games end
  sooner).

Feature reliability over 200 games:

- Stable built: 196/200; cav batches: 194/200; cav techs: 139/200 (the
  techs queue behind the forge line and short games never reach them).
- The 4 no-stable games are the known-bad bucket, not placement
  regressions: s61 (war stage 26.9m, dead by 30.4m — chronic hard loss),
  s113 (never reached city — chronic loss), s127 (never reached city in
  45 min — chronic stall in BOTH builds), s176 (war stage 31.0m, enemy
  camped in placement range — proximity, not crowding).
- Placement: zero "no placement" lines except s176 (3, enemy proximity).
  The 200 m military radius fixed the crowded-rings failure class seen
  in validation (4/10 seeds).

Conclusion: **keep.** Tally-neutral at 187W with wins landing ~3 min
faster across the board, fight efficiency up (K/D +8%), no identified
harmful mechanism in the churned seeds, and the feature fires reliably
(98% of games field cavalry). Cavalry acts as a kill-clock accelerator:
the infantry/ram core decides the game as before, the mounted contingent
shortens the deciding fights.
