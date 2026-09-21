#!/usr/bin/env python3
"""Collect the kiln sweep into results.tsv.

Usage: collect.py <jobs.tsv>
Extracts artifacts under artifacts/s<seed>/ and writes results.tsv next to
this script.

Verdict rules (docs/kiln.md + 2026-09-11 lessons): stats.json playerState
for player 1, overridden to `timeout` when stdout.log contains
"time limit reached" (kiln marks player 1 won at the cap regardless).
"game_min" = the last t=<num>m print; timeouts are flat 45.0.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent


def main(jobs_tsv):
    rows = []
    for line in Path(jobs_tsv).read_text().splitlines():
        if not line.strip():
            continue
        seed, batch, job = line.split()
        src = Path(f"/var/lib/kiln/results/kimi-agent/{batch}/{job}")
        out = HERE / "artifacts" / f"s{seed}"
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
        tlast = max([float(x) for x in re.findall(r"(?:^|[\s\[])t=([0-9.]+)m", log)] or [0.0])
        game_min = 45.0 if verdict == "timeout" else tlast
        rows.append([seed, verdict, f"{game_min:.1f}", errs, failed_ai, harness])
    with open(HERE / "results.tsv", "w") as f:
        f.write("seed\tresult\tgame_min\tjs_errors\tfailed_ai\tharness\n")
        for r in sorted(rows, key=lambda r: int(r[0])):
            f.write("\t".join(str(x) for x in r) + "\n")
    w = sum(1 for r in rows if r[1] == "win")
    t = sum(1 for r in rows if r[1] == "timeout")
    l = sum(1 for r in rows if r[1] == "loss")
    e = sum(1 for r in rows if r[3])
    fa = sum(1 for r in rows if r[4])
    nh = sum(1 for r in rows if not r[5])
    print(f"{len(rows)} games: {w} win / {t} timeout / {l} loss, "
          f"{e} with JS errors, {fa} failed-AI, {nh} missing HARNESS")


if __name__ == "__main__":
    main(sys.argv[1])
