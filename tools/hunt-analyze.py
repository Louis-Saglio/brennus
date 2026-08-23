#!/usr/bin/env python3
"""Parse [HUNT]/[HERDDONE] telemetry from a stdout log.

Prints, per huntable animal: template, mode, wound dropDist, kill dropDist,
carcass dropDist, inTerr, steer time (wound->carcass), and whether the
carcass is served (<= 40 m from a dropsite: the civilians' pickup radius).

Usage: hunt-analyze.py <stdout.log>
"""
import re
import sys

t_re = re.compile(r"t=([\d.]+)m (target|wounded|kill|adopted carcass|carcass) (\S+) at (\d+),(\d+)(?: mode=(\S+))?(?: inTerr=(\S+))?(?: dropDist=([\d.]+))?(?: fleeing=(\S+))?")
herddone_re = re.compile(r"\[HERDDONE\] t=([\d.]+)m")

def main(path):
    rows = []
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        m = t_re.search(line)
        if m and "HUNT" in line:
            t = float(m.group(1))
            kind = m.group(2)
            tpl = m.group(3)
            x, z = int(m.group(4)), int(m.group(5))
            mode = m.group(6) or ""
            interr = m.group(7) or ""
            dropdist = float(m.group(8)) if m.group(8) else None
            fleeing = m.group(9) or ""
            rows.append(dict(t=t, kind=kind, tpl=tpl, x=x, z=z, mode=mode,
                             interr=interr, dropdist=dropdist, fleeing=fleeing))
    print(f"# {path}: {len(rows)} HUNT lines")
    # Pair events per animal: target -> wounded -> (kill) -> carcass
    for r in rows:
        dd = f"dropDist={r['dropdist']:.0f}" if r['dropdist'] is not None else "dropDist=-"
        it = f"inTerr={r['interr']}" if r['interr'] else ""
        fl = f"fleeing={r['fleeing']}" if r['fleeing'] else ""
        extra = " ".join(x for x in [r['mode'], it, fl] if x)
        print(f"{r['t']:7.2f} {r['kind']:16s} {r['tpl']:36s} {r['x']:4d},{r['z']:4d} {dd} {extra}")

if __name__ == "__main__":
    main(sys.argv[1])
