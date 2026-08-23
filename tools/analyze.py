#!/usr/bin/env python3
"""Analyze a batch of headless match runs produced by tools/run.sh.

For each tag directory under <outdir>: counts JS errors from the engine's
interesting log, extracts the boom milestones from [HARNESS] lines (city
phase, population=300), reads the per-player statistics JSON for player 1,
and hashes that JSON so two runs of the same seed can be compared
byte-for-byte (determinism check).

Usage:
  analyze.py [--det A,B] [--harness] <outdir> [tag...]

Default tags: seed1..seed5 + seed1-rerun; default determinism pair
seed1 vs seed1-rerun.
"""
import argparse
import glob
import hashlib
import json
import os
import re

MILESTONE = re.compile(r"\[HARNESS\] t=([0-9.]+)m (phase=\w+.*|population=300)")


def player_blocks(stdout):
    """Yield raw JSON blocks (lines from a column-0 '{' to a column-0 '}')."""
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


def analyze(outdir, tag):
    d = os.path.join(outdir, tag)
    path = os.path.join(d, "stdout.log")
    if not os.path.exists(path):
        return None
    out = open(path, errors="replace").read()
    errors = 0
    for log in glob.glob(os.path.join(d, "home/.local/state/0ad/log/interestinglog_*.html")):
        errors += len(re.findall(r"^ERROR", open(log, errors="replace").read(), re.M))
    city = pop300 = None
    for line in out.splitlines():
        m = MILESTONE.search(line)
        if m:
            t, what = float(m.group(1)), m.group(2)
            if "phase_city" in what:
                city = t
            elif what == "population=300":
                pop300 = t
    harness = [l.strip() for l in out.splitlines()
               if "[HARNESS]" in l and "loaded" not in l]
    stats = raw = None
    for block in player_blocks(out):
        try:
            obj = json.loads(block)
        except json.JSONDecodeError:
            continue
        if obj.get("playerID") == 1:
            stats = obj["statistics"]
            raw = block
    return {
        "tag": tag, "errors": errors, "city": city, "pop300": pop300,
        "harness": harness, "stats": stats or {},
        "hash": hashlib.sha256(raw.encode()).hexdigest()[:12] if raw else None,
    }


def fmt(t):
    return f"{t:.1f}" if t is not None else "never"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("outdir")
    ap.add_argument("tags", nargs="*",
                    help="tag directories; default seed1..seed5 + seed1-rerun")
    ap.add_argument("--det", default="seed1,seed1-rerun",
                    help="comma pair of tags to compare for determinism")
    ap.add_argument("--harness", action="store_true",
                    help="also print [HARNESS] lines per tag")
    args = ap.parse_args()
    tags = args.tags or ["seed1", "seed2", "seed3", "seed4", "seed5", "seed1-rerun"]
    results = [r for r in (analyze(args.outdir, t) for t in tags) if r]
    for r in results:
        s = r["stats"]
        print(f"== {r['tag']}: errors={r['errors']} city={fmt(r['city'])}m "
              f"pop300={fmt(r['pop300'])}m pop={s.get('populationCount')} "
              f"tradeIncome={s.get('tradeIncome')} "
              f"soldWood={s.get('resourcesSold', {}).get('wood')} "
              f"boughtStone={s.get('resourcesBought', {}).get('stone')} "
              f"hash={r['hash']}")
        if args.harness:
            for line in r["harness"]:
                print(f"   {line}")
    det = args.det.split(",")
    if len(det) == 2:
        hashes = {r["tag"]: r["hash"] for r in results}
        if det[0] in hashes and det[1] in hashes:
            ok = hashes[det[0]] == hashes[det[1]] and hashes[det[0]] is not None
            print(f"determinism({det[0]} vs {det[1]}): {'OK' if ok else 'MISMATCH'}")


if __name__ == "__main__":
    main()
