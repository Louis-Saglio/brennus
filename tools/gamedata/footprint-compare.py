#!/usr/bin/env python3
"""Resolve and compare building footprints (and obstructions) across civs, 0.28.0 data."""
import re
from collections import defaultdict

from templates import find, load, resolve

templates = load()


def describe(block):
    """Summarise a footprint/obstruction block into a short string."""
    if block is None:
        return None
    parts = []
    sq = re.search(r"<Square([^/]*)/>", block)
    if sq:
        attrs = sq.group(1)
        if 'disable=""' in attrs or "disable=''" in attrs:
            parts.append("Square(disabled)")
        else:
            w = re.search(r'width="([\d.]+)"', attrs)
            d = re.search(r'depth="([\d.]+)"', attrs)
            if w and d:
                parts.append(f"Square {w.group(1)}×{d.group(1)}")
            else:
                parts.append("Square" + attrs.replace('"', ''))
    for c in re.finditer(r"<Circle([^/]*)/>", block):
        attrs = c.group(1)
        if 'disable=""' in attrs or "disable=''" in attrs:
            parts.append("Circle(disabled)")
        else:
            r = re.search(r'radius="([\d.]+)"', attrs)
            parts.append(f"Circle r={r.group(1)}" if r else "Circle" + attrs.replace('"', ''))
    h = re.search(r"<Height>([\d.]+)</Height>", block)
    height = f"h={h.group(1)}" if h else None
    if not parts:
        parts.append(re.sub(r"\s+", " ", block).strip()[:80])
    s = " + ".join(parts)
    return s + (f" ({height})" if height else "")


# Generic structure templates
generic = {}
for name in templates:
    if name.startswith("template_structure_"):
        generic[name[len("template_structure_"):-4]] = name

# Per-civ structure templates
groups = defaultdict(dict)  # building -> {civ: relpath}
for name in templates:
    if name.startswith("structures/") and name.count("/") == 2:
        civ, building = name.split("/")[1:]
        groups[building[:-4]][civ] = name

print("=== GENERIC TEMPLATE FOOTPRINTS (shape (h=height)) ===")
for building in sorted(generic):
    fp = resolve(templates, generic[building], 0)
    ob = resolve(templates, generic[building], 1)
    print(f"{building:34s} FP: {str(fp and describe(fp)):44s} OB: {ob and describe(ob)}")

print()
print("=== PER-CIV COMPARISON (only where civs differ) ===")
for building in sorted(groups):
    per_civ = {}
    for civ, name in sorted(groups[building].items()):
        fp = describe(resolve(templates, name, 0))
        ob = describe(resolve(templates, name, 1))
        per_civ[civ] = (fp, ob)
    distinct = defaultdict(list)
    for civ, v in per_civ.items():
        distinct[v].append(civ)
    if len(distinct) > 1:
        print(f"\n--- {building} ({len(per_civ)} civs, {len(distinct)} distinct FP/OB pairs) ---")
        for (fp, ob), civs in sorted(distinct.items(), key=lambda kv: str(kv[0])):
            print(f"  FP={fp}; OB={ob}: {', '.join(civs)}")
    else:
        # single distinct pair, but show what it is for reference
        fp, ob = next(iter(per_civ.values()))
        print(f"{building:34s} all {len(per_civ)} civs: FP={fp}; OB={ob}")
