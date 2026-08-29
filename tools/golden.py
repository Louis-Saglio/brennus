#!/usr/bin/env python3
"""Golden telemetry timelines for the brennus bot refactor.

A golden file is the canonical event timeline of one validation seed:
every tagged bot/harness line ([HARNESS], [DEFENSE], [HUNT], [THREAT],
[HERDDONE], [KILN]) in order, any ERROR lines, and a sha256 of each
player's raw end-of-game statistics JSON block. A behavior-preserving
change must reproduce the golden file bit-for-bit.

Matches run on kiln only (never locally — docs/kiln.md). Workflow:

  # 1. submit one batch per seed with the spec in tools/README.md
  #    (validation seeds 1-5, goal-10/11 settings) via the kiln MCP
  # 2. fetch artifacts once the jobs land:
  tools/golden.py fetch <seed> <batch_id> <job_id>     # -> tmp/golden/seed<N>/
  # 3. create (baseline only!) or check the golden:
  tools/golden.py update <seed>                        # writes tools/golden/seed<N>.timeline
  tools/golden.py check  <seed>                        # diffs fresh vs golden, exit 1 on diff
  tools/golden.py check  1 2 3 4 5                     # several seeds at once

`update` exists ONLY to create the initial baseline (and never to silence
an unexplained diff — see the refactor guardrails).
"""
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GOLDEN_DIR = os.path.join(REPO, "tools", "golden")
RUNS_DIR = os.path.join(REPO, "tmp", "golden")
RESULTS = "/var/lib/kiln/results/kimi-agent"

TAGGED = re.compile(r"^\[(HARNESS|DEFENSE|HUNT|THREAT|HERDDONE|KILN|WARNING)\]")
ERROR = re.compile(r"^ERROR")


def player_blocks(stdout):
    """Yield raw JSON blocks (column-0 '{' to column-0 '}')."""
    block, inside = [], False
    for line in stdout.splitlines(keepends=True):
        if not inside and line.startswith("{"):
            inside = True
            block = [line]
        elif inside:
            block.append(line)
            if line.rstrip("\n") == "}":
                yield "".join(block)
                inside = False


def extract(stdout_path):
    """Canonical timeline for one run's stdout.log, as a list of lines."""
    out = open(stdout_path, errors="replace").read()
    timeline = [l.rstrip("\n") for l in out.splitlines()
                if TAGGED.match(l) or ERROR.match(l)]
    for block in player_blocks(out):
        try:
            obj = json.loads(block)
        except json.JSONDecodeError:
            continue
        if "playerID" in obj and "statistics" in obj:
            h = hashlib.sha256(block.encode()).hexdigest()
            timeline.append(f"STATS player={obj['playerID']} sha256={h}")
    return timeline


def golden_path(seed):
    return os.path.join(GOLDEN_DIR, f"seed{seed}.timeline")


def run_stdout(seed):
    return os.path.join(RUNS_DIR, f"seed{seed}", "stdout.log")


def cmd_fetch(seed, batch, job):
    dest = os.path.join(RUNS_DIR, f"seed{seed}")
    os.makedirs(dest, exist_ok=True)
    src = os.path.join(RESULTS, batch, job, "artifacts.tar.gz")
    subprocess.run(["sudo", "tar", "xzf", src, "-C", dest], check=True)
    subprocess.run(["sudo", "chown", "-R", str(os.getuid()), dest], check=True)
    print(f"fetched {batch}/{job} -> {dest}")


def cmd_update(seeds):
    os.makedirs(GOLDEN_DIR, exist_ok=True)
    for seed in seeds:
        timeline = extract(run_stdout(seed))
        with open(golden_path(seed), "w") as f:
            f.write("\n".join(timeline) + "\n")
        print(f"seed{seed}: {len(timeline)} lines -> {golden_path(seed)}")


def cmd_check(seeds):
    failed = False
    for seed in seeds:
        fresh = extract(run_stdout(seed))
        with open(golden_path(seed)) as f:
            golden = f.read().splitlines()
        if fresh == golden:
            print(f"seed{seed}: IDENTICAL ({len(fresh)} lines)")
            continue
        failed = True
        print(f"seed{seed}: DIFF vs {golden_path(seed)}")
        for line in difflib.unified_diff(golden, fresh, "golden", "fresh",
                                         lineterm="", n=2):
            print(line)
    sys.exit(1 if failed else 0)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "fetch":
        cmd_fetch(args[0], args[1], args[2])
    elif cmd == "extract":
        print("\n".join(extract(args[0])))
    elif cmd == "update":
        cmd_update(args)
    elif cmd == "check":
        cmd_check(args)
    else:
        print(f"unknown command: {cmd}")
        sys.exit(2)


if __name__ == "__main__":
    main()
