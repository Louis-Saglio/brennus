#!/usr/bin/env python3
"""Build the century-sweep report from kiln results.

Reads jobs.tsv (seed, batch_id, job_id), extracts each job's artifacts to
artifacts/s<seed>/, classifies the game, and writes report.md + results.tsv.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path("/home/ubuntu/brennus/sweeps/2026-09-06-8ac30f0")
KILN = Path("/var/lib/kiln/results/kimi-agent")
LIMIT_TURNS = 13500  # 45 in-game minutes at 200 ms/turn


def sudo_read(path):
    return subprocess.run(["sudo", "cat", str(path)], capture_output=True, check=True).stdout


def classify(seed, batch, job):
    jobdir = KILN / batch / job
    out = ROOT / "artifacts" / f"s{seed}"
    out.mkdir(parents=True, exist_ok=True)
    if not subprocess.run(["sudo", "test", "-f", str(jobdir / "result.json")]).returncode == 0:
        return {"seed": seed, "result": "missing", "minutes": "", "errors": "", "path": ""}
    subprocess.run(["sudo", "tar", "xzf", str(jobdir / "artifacts.tar.gz"), "-C", str(out)], check=True)
    subprocess.run(["sudo", "chown", "-R", "ubuntu:ubuntu", str(out)], check=True)

    res = json.loads(sudo_read(jobdir / "result.json"))
    stdout = (out / "stdout.log").read_text(errors="replace")
    n_errors = sum(1 for line in stdout.splitlines()
                   if "ERROR" in line or "script exception" in line.lower()
                   or "Failed to create AI player" in line)
    row = {
        "seed": seed,
        "minutes": round(res.get("turn_count", 0) / 300, 1),
        "errors": n_errors or "",
        "path": str(out),
        "batch": batch,
        "job": job,
    }
    if res.get("state") != "done" or res.get("exit_code") != 0:
        row["result"] = "failed"
    elif "time limit" in stdout.lower():
        row["result"] = "timeout"
    else:
        state = next((p.get("playerState") for p in res.get("stats", []) if p.get("playerID") == 1), "?")
        row["result"] = {"won": "win", "defeated": "loss"}.get(state, f"unknown({state})")
    return row


def main():
    rows = []
    for line in (ROOT / "jobs.tsv").read_text().splitlines():
        seed, batch, job = line.split("\t")
        rows.append(classify(int(seed), batch, job))
        print(f"s{seed}: {rows[-1]['result']}", flush=True)

    with (ROOT / "results.tsv").open("w") as f:
        f.write("seed\tresult\tminutes\terrors\tbatch\tjob\tartifacts\n")
        for r in rows:
            f.write(f"{r['seed']}\t{r['result']}\t{r['minutes']}\t{r['errors']}\t"
                    f"{r.get('batch', '')}\t{r.get('job', '')}\t{r['path']}\n")

    tally = {}
    for r in rows:
        tally[r["result"]] = tally.get(r["result"], 0) + 1
    summary = ", ".join(f"{v} {k}" for k, v in sorted(tally.items()))

    with (ROOT / "report.md").open("w") as f:
        f.write("# Century sweep: seeds 1-100, standard settings\n\n")
        f.write("Brennus (gaul, diff 3, aggressive) vs Petra (rome, diff 3, aggressive), "
                "mainland 192, temperate, circle, conquest_civic_centers, "
                "45 min in-game limit, seed == aiseed. Run on 2026-09-06 via kiln, bot at commit 8ac30f0 (expansion-ring placement fallback).\n\n")
        f.write(f"**Outcome: {summary}**\n\n")
        f.write("Verdict rules: `timeout` = 45-min in-game limit reached "
                "(kiln marks player 1 won regardless); `win`/`loss` = game ended before the limit; "
                "`errors` = ERROR/script-exception lines in stdout.log (a win with JS errors does not count).\n\n")
        f.write("| seed | result | game min | JS errors | artifacts |\n")
        f.write("|---|---|---|---|---|\n")
        for r in rows:
            f.write(f"| {r['seed']} | {r['result']} | {r['minutes']} | {r['errors']} | `{r['path']}` |\n")
    print("REPORT WRITTEN:", summary)


if __name__ == "__main__":
    sys.exit(main())
