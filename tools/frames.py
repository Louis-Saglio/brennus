#!/usr/bin/env python3
"""Contact sheets (and optional clips) from the frames tools/viz.py captured.

Reads <viz dir>/frames/*.png and frames.jsonl (one record per frame: game
time, target, camera point, info). Frames of one shot group show the same
game instant, so the sheet is a table: one row per instant, one column per
target (overview, base:1, base:2, army:1, ...), an empty cell where a target
was skipped (no army, no fight). Long matches are split into pages of --rows
rows: contact_01.png, contact_02.png, ...

Usage:
  tools/frames.py <viz dir> [--rows N] [--thumb W] [--from MIN] [--to MIN]
                  [--targets overview,fight] [--video out.mp4 --target T] [--fps N]

--video encodes one target's frames as a time-lapse (default target: the
first column, usually overview).
"""
import argparse
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont


def load(vizdir):
    path = os.path.join(vizdir, "frames.jsonl")
    if not os.path.exists(path):
        sys.exit(f"frames.py: no {path}")
    recs = []
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line:
            try:
                recs.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    recs = [r for r in recs if os.path.exists(os.path.join(vizdir, "frames", r["frame"]))]
    if not recs:
        sys.exit(f"frames.py: no frames listed in {path}")
    return recs


def caption(rec):
    info = rec.get("info") or {}
    bits = [rec["target"]]
    if "units" in info:
        bits.append(f'{info["units"]} units')
    if "byPlayer" in info:
        bits.append(" v ".join(f"p{p}:{n}" for p, n in sorted(info["byPlayer"].items())))
    if info.get("civCentres") == 0:
        bits.append("no CC")
    bits.append(f'@{rec["x"]},{rec["z"]}')
    return "  ".join(bits)


def font(size):
    try:
        return ImageFont.truetype("DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default()


def sheets(vizdir, recs, rows_per_page, thumb, prefix):
    cols = []
    for r in recs:
        if r["target"] not in cols:
            cols.append(r["target"])
    instants = sorted({r["t"] for r in recs})
    cell = {(r["t"], r["target"]): r for r in recs}
    with Image.open(os.path.join(vizdir, "frames", recs[0]["frame"])) as im0:
        th = int(round(thumb * im0.height / im0.width))
    pad, bar, left = 4, 18, 64
    f_small, f_big = font(12), font(16)
    out = []
    for page in range(0, len(instants), rows_per_page):
        rows = instants[page:page + rows_per_page]
        W = left + len(cols) * (thumb + pad) + pad
        H = bar + len(rows) * (th + bar + pad) + pad
        sheet = Image.new("RGB", (W, H), (18, 18, 20))
        d = ImageDraw.Draw(sheet)
        for c, target in enumerate(cols):
            d.text((left + c * (thumb + pad) + 2, 1), target, fill=(240, 200, 120), font=f_big)
        for r, t in enumerate(rows):
            y = bar + r * (th + bar + pad)
            d.text((4, y + bar + th // 2 - 8), f"{t / 60000:.1f}'", fill=(240, 200, 120), font=f_big)
            for c, target in enumerate(cols):
                x = left + c * (thumb + pad)
                rec = cell.get((t, target))
                if not rec:
                    d.rectangle((x, y + bar, x + thumb - 1, y + bar + th - 1), outline=(50, 50, 55))
                    continue
                with Image.open(os.path.join(vizdir, "frames", rec["frame"])) as im:
                    sheet.paste(im.convert("RGB").resize((thumb, th), Image.Resampling.LANCZOS), (x, y + bar))
                d.text((x + 2, y + 2), caption(rec), fill=(220, 220, 220), font=f_small)
        name = os.path.join(vizdir, f"{prefix}_{page // rows_per_page + 1:02d}.png")
        sheet.save(name)
        out.append((name, len(rows), sheet.size))
    return cols, out


def video(vizdir, recs, target, path, fps):
    sel = [r for r in recs if r["target"] == target]
    if not sel:
        sys.exit(f"frames.py: no frames for target {target}")
    lst = os.path.join(vizdir, "frames.txt")
    with open(lst, "w", encoding="utf-8") as fh:
        for r in sel:
            fh.write(f"file '{os.path.join(vizdir, 'frames', r['frame'])}'\nduration {1 / fps:.4f}\n")
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                    "-vf", f"scale=1280:-2,fps={fps}", "-pix_fmt", "yuv420p", path], check=True)
    os.unlink(lst)
    print(f"frames.py: {target} time-lapse -> {path} ({len(sel)} frames, {len(sel) / fps:.0f}s at {fps} fps)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vizdir")
    ap.add_argument("--rows", type=int, default=10, help="instants per sheet (default 10)")
    ap.add_argument("--thumb", type=int, default=400, help="cell width in px (default 400)")
    ap.add_argument("--from", dest="lo", type=float, help="first game minute")
    ap.add_argument("--to", dest="hi", type=float, help="last game minute")
    ap.add_argument("--targets", help="comma-separated columns to keep (default: all)")
    ap.add_argument("--prefix", default="contact")
    ap.add_argument("--video")
    ap.add_argument("--target", help="target of the --video time-lapse (default: first column)")
    ap.add_argument("--fps", type=int, default=4)
    a = ap.parse_args()

    vizdir = os.path.abspath(a.vizdir)
    recs = load(vizdir)
    if a.lo is not None:
        recs = [r for r in recs if r["game_min"] >= a.lo]
    if a.hi is not None:
        recs = [r for r in recs if r["game_min"] <= a.hi]
    if a.targets:
        keep = a.targets.split(",")
        recs = [r for r in recs if r["target"] in keep]
    if not recs:
        sys.exit("frames.py: no frames in that selection")
    cols, out = sheets(vizdir, recs, a.rows, a.thumb, a.prefix)
    for name, n, size in out:
        print(f"frames.py: {n} instants x {len(cols)} targets -> {name} ({size[0]}x{size[1]})")
    if a.video:
        video(vizdir, recs, a.target or cols[0], os.path.abspath(a.video), a.fps)


if __name__ == "__main__":
    main()
