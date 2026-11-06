#!/usr/bin/env python3
"""Contact sheet (and optional clip) from the frames tools/viz.sh captured.

Reads <viz dir>/frames/*.png plus the frames.jsonl metadata written next to
them (frame -> wall seconds, turn, in-game minute, label) and renders one image
grid, labelled, so a whole match can be read at a glance. Optionally encodes the
frames as an mp4 with ffmpeg.

Usage:
  tools/frames.py <viz dir> [-o sheet.png] [--cols N] [--thumb W]
                  [--video out.mp4] [--fps N] [--from SEC] [--to SEC]

Default output: <viz dir>/contact.png. Frames are downscaled to --thumb px wide
(default 480, i.e. 8 columns of 480 = 3840 px wide).
"""
import argparse
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont


def load_meta(vizdir):
    meta = {}
    path = os.path.join(vizdir, "frames.jsonl")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            meta[rec.get("frame", "")] = rec
    return meta


def frames(vizdir, lo=None, hi=None):
    fdir = os.path.join(vizdir, "frames")
    names = sorted(n for n in os.listdir(fdir) if n.endswith(".png"))
    if lo is not None:
        names = [n for n in names if n >= lo]
    if hi is not None:
        names = [n for n in names if n <= hi]
    return fdir, names


def label_for(name, meta):
    rec = meta.get(name)
    if not rec:
        return name
    if rec.get("label") and not rec["label"].startswith("t"):
        return f"{rec['label']}  {rec.get('game_min', 0):5.1f} min"
    return f"{rec.get('game_min', 0):5.1f} min"


def contact_sheet(vizdir, out, cols, thumb, lo=None, hi=None):
    fdir, names = frames(vizdir, lo, hi)
    if not names:
        sys.exit(f"frames.py: no frames in {fdir}")
    meta = load_meta(vizdir)
    with Image.open(os.path.join(fdir, names[0])) as im0:
        aspect = im0.height / im0.width
    th = int(round(thumb * aspect))
    rows = (len(names) + cols - 1) // cols
    pad, bar = 6, 22
    W = cols * thumb + (cols + 1) * pad
    H = rows * (th + bar) + (rows + 1) * pad
    sheet = Image.new("RGB", (W, H), (18, 18, 20))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 15)
    except OSError:
        font = ImageFont.load_default()
    for i, name in enumerate(names):
        r, c = divmod(i, cols)
        x = pad + c * (thumb + pad)
        y = pad + r * (th + bar + pad)
        with Image.open(os.path.join(fdir, name)) as im:
            sheet.paste(im.convert("RGB").resize((thumb, th), Image.Resampling.LANCZOS), (x, y + bar))
        draw.text((x + 2, y + 2), label_for(name, meta), fill=(220, 220, 220), font=font)
    sheet.save(out, quality=90)
    return out, len(names), sheet.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vizdir")
    ap.add_argument("-o", "--out")
    ap.add_argument("--cols", type=int, default=8)
    ap.add_argument("--thumb", type=int, default=480)
    ap.add_argument("--video")
    ap.add_argument("--fps", type=int, default=6)
    ap.add_argument("--from", dest="lo")
    ap.add_argument("--to", dest="hi")
    a = ap.parse_args()

    vizdir = os.path.abspath(a.vizdir)
    out = a.out or os.path.join(vizdir, "contact.png")
    out, n, size = contact_sheet(vizdir, out, a.cols, a.thumb, a.lo, a.hi)
    print(f"frames.py: {n} frames -> {out} ({size[0]}x{size[1]})")

    if a.video:
        fdir, names = frames(vizdir, a.lo, a.hi)
        lst = os.path.join(vizdir, "frames.txt")
        with open(lst, "w", encoding="utf-8") as fh:
            for n_ in names:
                fh.write(f"file '{os.path.join(fdir, n_)}'\nduration {1/a.fps:.4f}\n")
        subprocess.run(
            ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "concat",
             "-safe", "0", "-i", lst, "-vf", "scale=1280:-2,fps=%d" % a.fps,
             "-pix_fmt", "yuv420p", a.video],
            check=True,
        )
        os.unlink(lst)
        print(f"frames.py: clip -> {a.video} ({len(names) / a.fps:.0f}s at {a.fps} fps)")


if __name__ == "__main__":
    main()
