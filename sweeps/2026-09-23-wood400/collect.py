#!/usr/bin/env python3
"""Collect the kiln sweep into results.tsv (all 401 seeds, 0-400).

Usage: collect.py [jobs.tsv]
Extracts artifacts under artifacts/s<seed>/ for every job in jobs.tsv and
writes results.tsv next to this script sorted by seed.

Verdict rules (docs/kiln.md): stats.json playerState for player 1,
overridden to `timeout` when stdout.log contains "time limit reached"
(kiln marks player 1 won at the cap regardless). "game_min" = the last
t=<num>m print; timeouts are flat 45.0. wood10 = the one-shot
`t=10.0m gathered wood=` telemetry; wood_total = end-game stats.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent


def rows_from_jobs(jobs_tsv):
    rows = []
    missing = []
    for line in Path(jobs_tsv).read_text().splitlines():
        if not line.strip():
            continue
        seed, batch, job = line.split()
        src = Path(f"/var/lib/kiln/results/kimi-agent/{batch}/{job}")
        if not (src / "artifacts.tar.gz").exists():
            missing.append(seed)
            continue
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
        m = re.search(r"t=10\.0m gathered wood=(\d+)", log)
        wood10 = int(m.group(1)) if m else -1
        wood_total = p1["statistics"]["resourcesGathered"]["wood"]
        rows.append([seed, verdict, f"{game_min:.1f}", wood10, wood_total, errs, failed_ai, harness])
    return rows, missing


def main(jobs_tsv):
    rows, missing = rows_from_jobs(jobs_tsv)
    if missing:
        print(f"WARNING: {len(missing)} jobs without artifacts: {','.join(missing)}")
    rows.sort(key=lambda r: int(r[0]))
    with open(HERE / "results.tsv", "w") as f:
        f.write("seed\tresult\tgame_min\twood10\twood_total\tjs_errors\tfailed_ai\tharness\n")
        for r in rows:
            f.write("\t".join(str(x) for x in r) + "\n")
    w = sum(1 for r in rows if r[1] == "win")
    t = sum(1 for r in rows if r[1] == "timeout")
    l = sum(1 for r in rows if r[1] == "loss")
    e = sum(1 for r in rows if int(r[5]))
    fa = sum(1 for r in rows if int(r[6]))
    nh = sum(1 for r in rows if not int(r[7]))
    w10 = [r[3] for r in rows if r[3] >= 0]
    print(f"{len(rows)} games: {w} win / {t} timeout / {l} loss, "
          f"{e} with JS errors, {fa} failed-AI, {nh} missing HARNESS")
    if w10:
        w10s = sorted(w10)
        print(f"wood@10min: mean {sum(w10)/len(w10):.0f}, median {w10s[len(w10)//2]}, "
              f"min {w10s[0]}, max {w10s[-1]}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else HERE / "jobs.tsv")
