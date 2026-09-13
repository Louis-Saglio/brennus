#!/usr/bin/env python3
"""Compare two sweep results.tsv files: verdict flips, mean win-time delta
on paired genuine wins, and feature-incidence deltas.

Usage: compare_sweeps.py <base_results.tsv> <new_results.tsv>
"""
import sys
from pathlib import Path


def load(path):
    rows = {}
    lines = Path(path).read_text().splitlines()
    hdr = lines[0].split("\t")
    for line in lines[1:]:
        cols = line.split("\t")
        row = dict(zip(hdr, cols))
        rows[int(row["seed"])] = row
    return hdr, rows


def main(base_path, new_path):
    bh, base = load(base_path)
    nh, new = load(new_path)
    common = sorted(set(base) & set(new))
    flips = []
    deltas = []
    for s in common:
        b, n = base[s], new[s]
        if b["verdict"] != n["verdict"]:
            flips.append((s, b["verdict"], n["verdict"]))
        if b["verdict"] == "win" and n["verdict"] == "win":
            deltas.append((float(n["end_min"]) - float(b["end_min"]), s))
    bv = [base[s]["verdict"] for s in common]
    nv = [new[s]["verdict"] for s in common]
    tally = lambda v: f"{v.count('win')}W/{v.count('timeout')}T/{v.count('loss')}L"
    print(f"{len(common)} paired seeds: base {tally(bv)}  new {tally(nv)}")
    gained = [f for f in flips if f[1] != "win" and f[2] == "win"]
    lost = [f for f in flips if f[1] == "win" and f[2] != "win"]
    print(f"converted to win: {[f'{s}({b}->{n})' for s, b, n in gained]}")
    print(f"lost from win:    {[f'{s}({b}->{n})' for s, b, n in lost]}")
    other = [f for f in flips if f not in gained and f not in lost]
    if other:
        print(f"other flips:      {[f'{s}({b}->{n})' for s, b, n in other]}")
    if deltas:
        mean = sum(d for d, _ in deltas) / len(deltas)
        deltas.sort()
        med = deltas[len(deltas) // 2][0]
        faster = [s for d, s in deltas if d <= -1.0]
        slower = [s for d, s in deltas if d >= 1.0]
        print(f"paired wins {len(deltas)}: mean delta {mean:+.2f} min, median {med:+.2f}, "
              f">=1min faster {len(faster)} {faster[:12]}, >=1min slower {len(slower)} {slower[:12]}")
    feats = [f for f in nh if f not in bh and f != "tier3"] + ["will", "wonderord", "poptech", "tier3"]
    feats = [f for f in dict.fromkeys(feats) if f in bh or f in nh]
    print("feature incidence (games with count>0):")
    for f in feats:
        b = sum(1 for s in common if int(base[s].get(f, 0)) > 0)
        n = sum(1 for s in common if int(new[s].get(f, 0)) > 0)
        print(f"  {f:10s} base {b:3d}  new {n:3d}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
