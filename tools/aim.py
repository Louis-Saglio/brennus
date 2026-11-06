#!/usr/bin/env python3
"""Where is a player's colour on the minimap? -> screen coordinates to click.

The minimap draws every unit and building in its owner's colour, so the
player's base is simply the densest cluster of that colour. That is robust to
everything that makes a computed mapping fragile: the click->world transform in
CMiniMap::GetMouseWorldCoordinates rotates with the camera angle, and the
minimap rect depends on the resolution.

Usage:
  tools/aim.py <shot.png> --screen 2560x1440 [--scale 0.5] [--player 1] [--list]

Prints "X Y" in *screen* coordinates (multiplied back by 1/scale) — feed it to
`xdotool mousemove X Y click 1`. --list prints up to three candidate clusters
per player (largest first) for debugging.
"""
import argparse
import sys

from PIL import Image

# gui/session/session.xml: bottom bar 1024 px wide, centred; minimap panel 200
# wide, 204 high at its left end. gui/session/minimap/MiniMap.xml: the minimap
# object is inset by 8 px left/right and 10 px top/bottom -> 184x184.
def minimap_rect(screen_w, screen_h):
    w = 200 - 16
    h = 204 - 20
    x0 = screen_w / 2 - 512 + 8
    y0 = screen_h - 204 + 10
    return x0, y0, w, h


def colour_mask(im, player):
    """Boolean mask of minimap pixels in that player's colour."""
    px = im.load()
    w, h = im.size
    mask = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if player == 1:   # (10,10,190): strongly blue
                mask[y][x] = b > 110 and b > r + 45 and b > g + 45
            else:             # (230,10,10): strongly red
                mask[y][x] = r > 110 and r > b + 45 and r > g + 45
    return mask


def clusters(mask, cell=10):
    """Coarse grid histograms, refined to the mean of each winning cell."""
    h = len(mask)
    w = len(mask[0]) if h else 0
    hist = {}
    for y in range(h):
        row = mask[y]
        for x in range(w):
            if row[x]:
                hist.setdefault((x // cell, y // cell), []).append((x, y))
    out = []
    for pts in sorted(hist.values(), key=len, reverse=True)[:3]:
        if len(pts) < 3:
            continue
        mx = sum(p[0] for p in pts) / len(pts)
        my = sum(p[1] for p in pts) / len(pts)
        out.append((len(pts), mx, my))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shot")
    ap.add_argument("--screen", required=True, help="WxH of the game window")
    ap.add_argument("--scale", type=float, default=1.0,
                    help="screenshot scale relative to the screen (grim -s)")
    ap.add_argument("--player", type=int, default=1)
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()

    try:
        sw, sh = (int(v) for v in a.screen.lower().split("x"))
    except ValueError:
        sys.exit("aim.py: --screen expects WxH, e.g. 2560x1440")

    x0, y0, w, h = minimap_rect(sw, sh)
    # to screenshot pixels
    box = (int(round(x0 * a.scale)), int(round(y0 * a.scale)),
           int(round((x0 + w) * a.scale)), int(round((y0 + h) * a.scale)))
    with Image.open(a.shot) as im:
        crop = im.convert("RGB").crop(box)
    mask = colour_mask(crop, a.player)
    found = clusters(mask)
    if not found:
        sys.exit(f"aim.py: player {a.player} colour not found on the minimap "
                 f"(crop {box}, {crop.size[0]}x{crop.size[1]})")
    if a.list:
        for n, mx, my in found:
            print(f"  {n:4d} px at minimap ({mx:.0f},{my:.0f}) -> screen "
                  f"({x0 + mx / a.scale:.0f},{y0 + my / a.scale:.0f})", file=sys.stderr)
    n, mx, my = found[0]
    # Back to screen coordinates.
    print(f"{x0 + mx / a.scale:.0f} {y0 + my / a.scale:.0f}")


if __name__ == "__main__":
    main()
