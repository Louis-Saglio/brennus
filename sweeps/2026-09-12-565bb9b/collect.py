#!/usr/bin/env python3
"""Collect a kiln sweep into results.tsv with war-machine feature columns.

Usage: collect.py <jobs.tsv> <outdir>
jobs.tsv lines: <seed> <batch_id> <job_id>. Extracts artifacts under
<outdir>/s<seed>/ and writes <outdir>/results.tsv.

Verdict rules (docs/kiln.md + 2026-09-11 lessons): stats.json playerState
for player 1, overridden to `timeout` when stdout.log contains
"time limit reached" (kiln marks player 1 won at the cap regardless).
"game min" = the last t=<num>m print; timeouts are flat 45.0.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

FEATURES = [
    ("will", r"research attack_soldiers_will"),
    ("wonderord", r"wonder order at"),
    ("poptech", r"research wonder_population_cap"),
    ("fortress", r"defense building fortress"),
    ("assembly", r"defense building assembly"),
    ("carnyx", r"training a carnyx"),
    ("focus", r"rams focusing"),
    ("razed", r"razing dead storehouse"),
    ("level", r"bank leveling"),
    ("warbuy", r"\(war machine\)"),
    ("corral", r"corral at"),
]

def main(jobs_tsv, outdir):
    rows = []
    for line in Path(jobs_tsv).read_text().splitlines():
        if not line.strip():
            continue
        seed, batch, job = line.split()
        src = Path(f"/var/lib/kiln/results/kimi-agent/{batch}/{job}")
        out = Path(outdir) / f"s{seed}"
        out.mkdir(parents=True, exist_ok=True)
        if not (out / "stdout.log").exists():
            subprocess.run(["sudo", "tar", "-xzf", str(src / "artifacts.tar.gz"), "-C", str(out)], check=False)
        log = (out / "stdout.log").read_text(errors="replace")
        stats = json.loads((out / "stats.json").read_text())
        p1 = next(p for p in stats if p["playerID"] == 1)
        verdict = p1["playerState"]
        if "time limit reached" in log:
            verdict = "timeout"
        verdict = {"won": "win", "defeated": "loss"}.get(verdict, verdict)
        errs = len(re.findall(r"ERROR|script exception", log))
        failed_ai = int("Failed to create AI player" in log)
        harness = int("[HARNESS]" in log)
        # "nearest=400m" contains "t=400m" — the t= must start a token.
        tlast = max([float(x) for x in re.findall(r"(?:^|[\s\[])t=([0-9.]+)m", log)] or [0.0])
        end_min = 45.0 if verdict == "timeout" else tlast
        counts = [len(re.findall(pat, log)) for _, pat in FEATURES]
        ut = p1["statistics"]["unitsTrained"]
        counts += [ut.get("Hero", 0), ut.get("Champion", 0)]
        pop_limit = 0
        m = re.findall(r"pop=\d+/(\d+)", log)
        if m:
            pop_limit = int(m[-1])
        rows.append([seed, verdict, f"{end_min:.1f}", errs, failed_ai, harness, pop_limit] + counts)
    hdr = ["seed", "verdict", "end_min", "js_errors", "failed_ai", "harness", "pop_limit"] + [n for n, _ in FEATURES] + ["hero", "champ"]
    with open(Path(outdir) / "results.tsv", "w") as f:
        f.write("\t".join(hdr) + "\n")
        for r in sorted(rows, key=lambda r: int(r[0])):
            f.write("\t".join(str(x) for x in r) + "\n")
    w = sum(1 for r in rows if r[1] == "win")
    t = sum(1 for r in rows if r[1] == "timeout")
    l = sum(1 for r in rows if r[1] == "loss")
    e = sum(1 for r in rows if r[3])
    print(f"{len(rows)} games: {w} win / {t} timeout / {l} loss, {e} with JS errors")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
