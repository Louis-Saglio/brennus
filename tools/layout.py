#!/usr/bin/env python3
"""Base-layout clutter metrics and pictures from the mod's layout snapshots.

The mod (bot/maps/scripts/ConquestCivicCentres.js) prints every 2 min of sim
time every structure's true obstruction rectangle:

    [HARNESS] layout {"t": <sec>, "1": [[name,x,z,angle,w,d,blocks], ...], "2": [...]}

This tool rasterizes one player's blocking obstructions around their home
civic centre on a 1 m grid (the engine's navcell size) and measures how
much the buildings get in the way of movement — the problems the block
layout exists to solve:

  egress_inf / egress_ram   mean detour (path / straight line) from base
                            cells out to the base rim, infantry clearance
                            0.8 m and ram clearance 3.0 m (pathfinder.xml
                            "default" / "large")
  trapped_ram               share of ram-passable base cells with no ram
                            path out to the rim
  cc_detour                 mean detour from base cells to the civic
                            centre's apron (sheltering / sortie)
  cc_ram_detour/_unreach    the same with ram clearance, and the share of
                            ram-passable base cells rams cannot reach from
                            the civic centre
  enclosed                  blocking buildings with no side reachable from
                            the rim (units cannot get in or out)
  ars_ram                   arsenals whose rams can reach the rim
  density                   blocking footprint m² per m² of the 25-90 m
                            annulus (how much land the layout eats)

Terrain (trees, cliffs, water) is NOT in the snapshots: the metrics isolate
what the bot's own placement does. Clearance uses the engine's rasterizer
rule (a cell is blocked when it lies within clearance + 0.5 m of a shape).

Usage:
  tools/layout.py <stdout.log | tag dir | batch dir>... [--at MIN[,MIN]]
                  [--player 1] [--radius 120] [--png DIR] [--tsv FILE]
"""
import argparse
import heapq
import json
import math
import os
import sys

import numpy as np

TAG = "[HARNESS] layout "
EXT = 0.5          # Pathfinding::CLEARANCE_EXTENSION_RADIUS
CLEAR_INF = 0.8    # pathfinder.xml <default>
CLEAR_RAM = 3.0    # pathfinder.xml <large> (siege)


def load(path):
    snaps = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            i = line.find(TAG)
            if i < 0:
                continue
            try:
                snaps.append(json.loads(line[i + len(TAG):].strip()))
            except json.JSONDecodeError:
                pass
    return snaps


def logs_of(arg):
    if os.path.isfile(arg):
        return [(os.path.basename(os.path.dirname(arg)) or arg, arg)]
    p = os.path.join(arg, "stdout.log")
    if os.path.isfile(p):
        return [(os.path.basename(arg.rstrip("/")), p)]
    out = []
    for d in sorted(os.listdir(arg)):
        p = os.path.join(arg, d, "stdout.log")
        if os.path.isfile(p):
            out.append((d, p))
    return out


def home_cc(snaps, player):
    for s in snaps:
        for b in s.get(player, []):
            if b[0] == "civil_centre":
                return b
    return None


def rect_dist(gx, gz, b):
    """Distance from grid points to building b's rectangle (0 inside)."""
    _n, x, z, a, w, d, _bl = b[:7]
    # Engine convention: u = (sin a, cos a) is the depth axis, v ⟂.
    s, c = math.sin(a), math.cos(a)
    dx, dz = gx - x, gz - z
    pu = dx * c - dz * s          # along width
    pv = dx * s + dz * c          # along depth
    ou = np.maximum(np.abs(pu) - w / 2, 0)
    ov = np.maximum(np.abs(pv) - d / 2, 0)
    return np.hypot(ou, ov)


class Grid:
    def __init__(self, cx, cz, radius):
        self.r = radius
        self.x0 = math.floor(cx - radius)
        self.z0 = math.floor(cz - radius)
        self.n = int(2 * radius) + 1
        ii = np.arange(self.n)
        self.gx = (self.x0 + ii + 0.5)[None, :].repeat(self.n, 0)
        self.gz = (self.z0 + ii + 0.5)[:, None].repeat(self.n, 1)
        self.rad = np.hypot(self.gx - cx, self.gz - cz)
        self.dist = np.full((self.n, self.n), 1e9)
        self.owner = np.full((self.n, self.n), -1, dtype=np.int32)

    def add(self, k, b):
        _n, x, z, _a, w, d, _bl = b[:7]
        reach = math.hypot(w, d) / 2 + CLEAR_RAM + EXT + 2
        i0 = max(0, int(x - reach - self.x0)); i1 = min(self.n, int(x + reach - self.x0) + 1)
        j0 = max(0, int(z - reach - self.z0)); j1 = min(self.n, int(z + reach - self.z0) + 1)
        if i0 >= i1 or j0 >= j1:
            return
        sub = rect_dist(self.gx[j0:j1, i0:i1], self.gz[j0:j1, i0:i1], b)
        cur = self.dist[j0:j1, i0:i1]
        closer = sub < cur
        cur[closer] = sub[closer]
        self.owner[j0:j1, i0:i1][sub == 0] = k


def dijkstra(free, sources):
    """8-connected path lengths (m) over `free` from boolean `sources`."""
    n = free.shape[0]
    dist = np.full(free.shape, np.inf)
    heap = []
    for j, i in zip(*np.nonzero(sources & free)):
        dist[j, i] = 0.0
        heap.append((0.0, int(j), int(i)))
    heapq.heapify(heap)
    steps = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
             (-1, -1, 1.4142), (-1, 1, 1.4142), (1, -1, 1.4142), (1, 1, 1.4142)]
    fl = free.tolist()
    dl = dist.tolist()
    while heap:
        d0, j, i = heapq.heappop(heap)
        if d0 > dl[j][i]:
            continue
        for dj, di, c in steps:
            jj, ii = j + dj, i + di
            if 0 <= jj < n and 0 <= ii < n and fl[jj][ii]:
                if dj and di and not (fl[j][ii] and fl[jj][i]):
                    continue
                nd = d0 + c
                if nd < dl[jj][ii]:
                    dl[jj][ii] = nd
                    heapq.heappush(heap, (nd, jj, ii))
    return np.array(dl)


def analyze(snap, player, cc, radius):
    blds = [b for b in snap.get(player, [])]
    cx, cz = cc[1], cc[2]
    g = Grid(cx, cz, radius)
    blocking = [b for b in blds if b[6] and math.hypot(b[1] - cx, b[2] - cz) < radius + 40]
    for k, b in enumerate(blocking):
        g.add(k, b)
    inside = g.rad <= radius
    rim = (g.rad > radius - 2) & inside
    free_inf = (g.dist > CLEAR_INF + EXT) & inside
    free_ram = (g.dist > CLEAR_RAM + EXT) & inside
    out_inf = dijkstra(free_inf, rim)
    out_ram = dijkstra(free_ram, rim)

    # CC apron: cells within 4 m of the home CC's rectangle that infantry can use.
    ccd = rect_dist(g.gx, g.gz, cc)
    apron = (ccd > CLEAR_INF + EXT) & (ccd < CLEAR_INF + EXT + 3) & free_inf
    to_cc = dijkstra(free_inf, apron)
    apron_r = (ccd > CLEAR_RAM + EXT) & (ccd < CLEAR_RAM + EXT + 3) & free_ram
    to_cc_ram = dijkstra(free_ram, apron_r)

    band = inside & (g.rad >= 25) & (g.rad <= radius - 15)
    straight_out = np.maximum(radius - g.rad, 1.0)

    def detour(dmap, free, straight):
        m = band & free & np.isfinite(dmap)
        if not m.any():
            return float("nan")
        return float(np.mean(dmap[m] / straight[m]))

    egress_inf = detour(out_inf, free_inf, straight_out)
    egress_ram = detour(out_ram, free_ram, straight_out)
    rb = band & free_ram
    trapped_ram = float(np.mean(~np.isfinite(out_ram[rb]))) if rb.any() else float("nan")
    cc_straight = np.maximum(ccd - (CLEAR_INF + EXT + 1.5), 1.0)
    cc_detour = detour(to_cc, free_inf, cc_straight)
    cc_unreach = float(np.mean(~np.isfinite(to_cc[band & free_inf])))
    cc_straight_r = np.maximum(ccd - (CLEAR_RAM + EXT + 1.5), 1.0)
    cc_ram_detour = detour(to_cc_ram, free_ram, cc_straight_r)
    cc_ram_unreach = float(np.mean(~np.isfinite(to_cc_ram[band & free_ram]))) if (band & free_ram).any() else float("nan")

    # Enclosed buildings: no ring cell 1-3 m outside the footprint reachable from the rim.
    reach_inf = np.isfinite(out_inf)
    enclosed = 0
    nb = 0
    ars_total = ars_ok = 0
    for b in blocking:
        if math.hypot(b[1] - cx, b[2] - cz) > radius - 10 or b[0].startswith("civil_centre"):
            continue
        nb += 1
        _n, x, z, _a, w, d, _bl = b[:7]
        reach = math.hypot(w, d) / 2 + 6
        i0 = max(0, int(x - reach - g.x0)); i1 = min(g.n, int(x + reach - g.x0) + 1)
        j0 = max(0, int(z - reach - g.z0)); j1 = min(g.n, int(z + reach - g.z0) + 1)
        sub = rect_dist(g.gx[j0:j1, i0:i1], g.gz[j0:j1, i0:i1], b)
        ring = (sub > 1.0) & (sub < CLEAR_INF + EXT + 3.0)
        if not (ring & reach_inf[j0:j1, i0:i1]).any():
            enclosed += 1
        if b[0].startswith("arsenal") and not b[0].endswith("*"):
            ars_total += 1
            ring_r = (sub > CLEAR_RAM + EXT) & (sub < CLEAR_RAM + EXT + 4)
            if (ring_r & np.isfinite(out_ram[j0:j1, i0:i1])).any():
                ars_ok += 1

    ann = inside & (g.rad >= 25) & (g.rad <= 90)
    foot = (g.dist == 0) & ann
    density = float(foot.sum() / max(ann.sum(), 1))
    nfields = sum(1 for b in blds if not b[6] and math.hypot(b[1] - cx, b[2] - cz) < radius)
    return {
        "t": snap["t"] / 60, "nb": nb, "fields": nfields, "enclosed": enclosed,
        "egress_inf": egress_inf, "egress_ram": egress_ram, "trapped_ram": trapped_ram,
        "cc_detour": cc_detour, "cc_unreach": cc_unreach,
        "cc_ram_detour": cc_ram_detour, "cc_ram_unreach": cc_ram_unreach,
        "ars": f"{ars_ok}/{ars_total}", "density": density,
        "_grid": g, "_free_inf": free_inf, "_free_ram": free_ram,
        "_out_ram": out_ram, "_out_inf": out_inf, "_blds": blds, "_cc": cc,
    }


COLORS = {
    "house": (205, 160, 90), "civil_centre": (240, 240, 240), "field": (120, 170, 60),
    "storehouse": (140, 110, 80), "farmstead": (170, 140, 60), "barracks": (200, 70, 60),
    "defense_tower": (230, 230, 120), "temple": (130, 130, 230), "market": (230, 140, 200),
    "arsenal": (255, 60, 30), "stable": (210, 110, 60), "forge": (120, 120, 120),
    "fortress": (160, 40, 40), "tavern": (190, 150, 210), "assembly": (90, 190, 200),
    "wonder": (255, 215, 0),
}


def render(res, path, title, px=4):
    from PIL import Image, ImageDraw
    g = res["_grid"]
    n = g.n
    img = np.zeros((n, n, 3), dtype=np.uint8)
    img[:] = (25, 28, 25)
    inside = g.rad <= g.r
    img[inside] = (45, 52, 45)
    ram_only_block = res["_free_inf"] & ~res["_free_ram"]
    img[ram_only_block] = (70, 60, 40)                    # infantry yes, ram no
    trapped = res["_free_ram"] & ~np.isfinite(res["_out_ram"])
    img[trapped] = (110, 40, 110)                         # ram-passable, no way out
    inf_trapped = res["_free_inf"] & ~np.isfinite(res["_out_inf"])
    img[inf_trapped] = (150, 30, 30)                      # infantry pocket
    im = Image.fromarray(img[::-1]).resize((n * px, n * px), Image.Resampling.NEAREST)
    dr = ImageDraw.Draw(im)
    for b in res["_blds"]:
        name, x, z, a, w, d, bl = b[:7]
        base = name.rstrip("*")
        col = COLORS.get(base, (180, 180, 180))
        s, c = math.sin(a), math.cos(a)
        pts = []
        for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            pu, pv = su * w / 2, sv * d / 2
            wx = x + pu * c + pv * s
            wz = z - pu * s + pv * c
            pts.append(((wx - g.x0) * px, (g.n - (wz - g.z0)) * px))
        if bl:
            dr.polygon(pts, fill=col if not name.endswith("*") else None, outline=col)
        else:
            dr.polygon(pts, outline=col)
    dr.text((6, 6), title, fill=(255, 255, 255))
    im.save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--at", default="16,24", help="game minutes, comma-separated (nearest earlier snapshot)")
    ap.add_argument("--player", default="1")
    ap.add_argument("--radius", type=float, default=120)
    ap.add_argument("--png", help="write one picture per game and time into DIR")
    ap.add_argument("--tsv")
    args = ap.parse_args()
    times = [float(t) for t in args.at.split(",")]
    cols = ["t", "nb", "fields", "enclosed", "egress_inf", "egress_ram", "trapped_ram",
            "cc_detour", "cc_unreach", "cc_ram_detour", "cc_ram_unreach", "ars", "density"]
    rows = []
    for arg in args.paths:
        for tag, log in logs_of(arg):
            snaps = load(log)
            cc = home_cc(snaps, args.player)
            if not cc:
                continue
            for t in times:
                cands = [s for s in snaps if s["t"] / 60 <= t + 0.01]
                if not cands:
                    continue
                snap = cands[-1]
                if abs(snap["t"] / 60 - t) > 2.5:
                    continue      # game ended before t
                # Home CC still standing at that time?
                if not any(b[0] == "civil_centre" and abs(b[1] - cc[1]) < 1 and abs(b[2] - cc[2]) < 1
                           for b in snap.get(args.player, [])):
                    continue
                res = analyze(snap, args.player, cc, args.radius)
                res["tag"] = os.path.basename(os.path.dirname(os.path.dirname(log))) + "/" + tag \
                    if len(args.paths) > 1 else tag
                rows.append(res)
                if args.png:
                    os.makedirs(args.png, exist_ok=True)
                    name = res["tag"].replace("/", "_")
                    render(res, os.path.join(args.png, f"{name}_t{int(t):02d}.png"),
                           f"{res['tag']} t={res['t']:.0f}m egress_ram={res['egress_ram']:.2f} "
                           f"trapped_ram={res['trapped_ram']:.2f} enclosed={res['enclosed']}")
    fmt = lambda v: f"{v:.3f}" if isinstance(v, float) else str(v)
    hdr = ["tag"] + cols
    print("\t".join(hdr))
    for r in rows:
        print("\t".join([r["tag"]] + [fmt(r[c]) for c in cols]))
    # Means per time.
    for t in times:
        rs = [r for r in rows if abs(r["t"] - t) <= 2.5]
        if not rs:
            continue
        line = [f"mean@{t:g}"]
        for c in cols:
            vals = [r[c] for r in rs if isinstance(r[c], (int, float)) and not (isinstance(r[c], float) and math.isnan(r[c]))]
            if c == "ars":
                ok = sum(int(r[c].split("/")[0]) for r in rs)
                tot = sum(int(r[c].split("/")[1]) for r in rs)
                line.append(f"{ok}/{tot}")
            else:
                line.append(fmt(float(np.mean(vals))) if vals else "-")
        print("\t".join(line) + f"\t(n={len(rs)})")
    if args.tsv:
        with open(args.tsv, "w") as fh:
            fh.write("\t".join(hdr) + "\n")
            for r in rows:
                fh.write("\t".join([r["tag"]] + [fmt(r[c]) for c in cols]) + "\n")


if __name__ == "__main__":
    main()
