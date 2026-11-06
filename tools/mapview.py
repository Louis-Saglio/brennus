#!/usr/bin/env python3
"""Top-down map view of a match from the mod's [HARNESS] map snapshots.

The mod (bot/maps/scripts/ConquestCivicCentres.js) prints one JSON line every
30 s of sim time:

    [HARNESS] map {"t": <sec>, "1": [[id,kind,state,x,z], ...], "2": [...]}

kind: 1 worker, 2 soldier, 3 cavalry, 4 siege, 5 building, 6 civic centre
state: 0 idle, 1 gathering, 2 attacking, 3 moving/other
x, z: metres (map is 192 tiles * 4 m = 768 m across)

Renders a contact sheet of snapshots (default: all of them, at most --max) and,
with --tracks, one image showing how the military units moved over the whole
game. This is the batch-scalable complement to tools/viz.sh: exact positions,
no GPU, one picture per match, works on 12 parallel games.

Usage:
  tools/mapview.py <stdout.log> [-o out.png] [--cols N] [--px 220]
                   [--max N] [--from MIN] [--to MIN] [--tracks tracks.png]
                   [--video clip.mp4] [--fps N]
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

TAG = "[HARNESS] map "
MAP_M = 768.0  # metres across (192 tiles * 4)
KIND_LABEL = {1: "worker", 2: "soldier", 3: "cavalry", 4: "siege", 5: "building", 6: "cc"}
COLOR = {"1": (80, 150, 240), "2": (235, 90, 80)}
BG = (22, 24, 22)
GRID = (40, 44, 40)


def load(path):
    snaps = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            i = line.find(TAG)
            if i < 0:
                continue
            try:
                rec = json.loads(line[i + len(TAG):].strip())
            except json.JSONDecodeError:
                continue
            snaps.append(rec)
    return snaps


def panel(rec, px, title=None):
    im = Image.new("RGB", (px, px), BG)
    dr = ImageDraw.Draw(im)
    for g in range(1, 4):
        v = px * g // 4
        dr.line([(v, 0), (v, px)], fill=GRID)
        dr.line([(0, v), (px, v)], fill=GRID)
    s = px / MAP_M
    for pl, ents in (("1", rec.get("1", [])), ("2", rec.get("2", []))):
        col = COLOR[pl]
        for e in ents:
            if len(e) < 5:
                continue
            _eid, kind, state, x, z = e[:5]
            cx, cy = x * s, z * s
            r = {1: 1.2, 2: 2.2, 3: 3.0, 4: 3.6, 5: 3.4, 6: 5.5}[kind] * (px / 220.0)
            if kind >= 5:
                dr.rectangle([cx - r, cy - r, cx + r, cy + r], fill=col,
                             outline=(255, 255, 255) if kind == 6 else None)
            elif kind == 1:
                dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
            elif kind == 3:
                dr.polygon([(cx, cy - r * 1.6), (cx - r * 1.3, cy + r), (cx + r * 1.3, cy + r)],
                           fill=col, outline=(255, 255, 255) if state == 2 else None)
            else:
                dr.rectangle([cx - r, cy - r, cx + r, cy + r], fill=col,
                             outline=(255, 255, 255) if state == 2 else None)
    if title:
        try:
            font = ImageFont.truetype("DejaVuSans.ttf", max(11, px // 16))
        except OSError:
            font = ImageFont.load_default()
        dr.text((5, 3), title, fill=(225, 225, 225), font=font)
    return im


def sheet(snaps, out, cols, px, max_n):
    if max_n and len(snaps) > max_n:
        step = len(snaps) / max_n
        snaps = [snaps[min(len(snaps) - 1, int(i * step))] for i in range(max_n)]
    rows = (len(snaps) + cols - 1) // cols
    pad = 4
    W = cols * px + (cols + 1) * pad
    H = rows * px + (rows + 1) * pad
    img = Image.new("RGB", (W, H), (12, 12, 12))
    for i, rec in enumerate(snaps):
        r, c = divmod(i, cols)
        t = rec.get("t", 0) / 60.0
        img.paste(panel(rec, px, f"{t:5.1f} min"), (pad + c * (px + pad), pad + r * (px + pad)))
    img.save(out)
    return out, len(snaps), img.size


def tracks(snaps, out, px):
    """Military movement over the whole match: per-unit polylines."""
    im = Image.new("RGB", (px, px), BG)
    dr = ImageDraw.Draw(im)
    for g in range(1, 4):
        v = px * g // 4
        dr.line([(v, 0), (v, px)], fill=GRID)
        dr.line([(0, v), (px, v)], fill=GRID)
    s = px / MAP_M
    last = {}
    for rec in snaps:
        for pl, ents in (("1", rec.get("1", [])), ("2", rec.get("2", []))):
            col = COLOR[pl]
            for e in ents:
                if len(e) < 5:
                    continue
                eid, kind, state, x, z = e[:5]
                if kind < 2 or kind > 4:
                    continue
                key = (pl, eid)
                prev = last.get(key)
                if prev:
                    dr.line([prev[0] * s, prev[1] * s, x * s, z * s], fill=col, width=1)
                last[key] = (x, z)
    # Final density of buildings for orientation.
    for rec in snaps[-1:]:
        for pl, ents in (("1", rec.get("1", [])), ("2", rec.get("2", []))):
            for e in ents:
                if len(e) >= 5 and e[1] >= 5:
                    _i, kind, _st, x, z = e[:5]
                    r = 4 if kind == 6 else 2.5
                    dr.rectangle([x * s - r, z * s - r, x * s + r, z * s + r], fill=COLOR[pl])
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", max(12, px // 24))
    except OSError:
        font = ImageFont.load_default()
    dr.text((6, 4), "military tracks over the match (blue = p1, red = p2)", fill=(225, 225, 225), font=font)
    im.save(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("stdout_log")
    ap.add_argument("-o", "--out")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--px", type=int, default=220)
    ap.add_argument("--max", type=int, default=36)
    ap.add_argument("--tracks")
    ap.add_argument("--video")
    ap.add_argument("--fps", type=int, default=4)
    a = ap.parse_args()

    snaps = load(a.stdout_log)
    if not snaps:
        sys.exit(f"mapview.py: no '{TAG.strip()}' lines in {a.stdout_log}")
    out = a.out or os.path.join(os.path.dirname(os.path.abspath(a.stdout_log)), "mapview.png")
    out, n, size = sheet(snaps, out, a.cols, a.px, a.max)
    print(f"mapview.py: {len(snaps)} snapshots ({snaps[0]['t']/60:.1f}-{snaps[-1]['t']/60:.1f} min), "
          f"{n} drawn -> {out} ({size[0]}x{size[1]})")
    if a.tracks:
        print(f"mapview.py: tracks -> {tracks(snaps, a.tracks, max(600, a.px * 3))}")
    if a.video:
        tmp = os.path.join(os.path.dirname(os.path.abspath(out)), ".mapframes")
        os.makedirs(tmp, exist_ok=True)
        for i, rec in enumerate(snaps):
            panel(rec, 512, f"{rec.get('t', 0)/60:5.1f} min").save(os.path.join(tmp, f"{i:04d}.png"))
        subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-framerate", str(a.fps),
                        "-i", os.path.join(tmp, "%04d.png"), "-pix_fmt", "yuv420p", a.video], check=True)
        for f in os.listdir(tmp):
            os.unlink(os.path.join(tmp, f))
        os.rmdir(tmp)
        print(f"mapview.py: clip -> {a.video}")


if __name__ == "__main__":
    main()
