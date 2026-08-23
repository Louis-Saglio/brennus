#!/usr/bin/env python3
"""Cross-check the footprint lines written into docs against the game data.

Exits 1 on any mismatch. Docs root defaults to docs/game_description;
override with the ZEROAD_DOCS environment variable.
"""
import os
import re
import sys

from templates import find, fmt, load, resolve

templates = load()
DOCS = os.environ.get("ZEROAD_DOCS", "/home/ubuntu/brennus/docs/game_description")


def shape_of(block):
    if block is None:
        return None
    sq = re.search(r"<Square([^/]*)/>", block)
    if sq and 'disable=' not in sq.group(1):
        w = re.search(r'width="([\d.]+)"', sq.group(1))
        d = re.search(r'depth="([\d.]+)"', sq.group(1))
        if w and d:
            return ("square", fmt(w.group(1)), fmt(d.group(1)))
    for c in re.finditer(r"<Circle([^/]*)/>", block):
        if 'disable=' in c.group(1):
            continue
        r = re.search(r'radius="([\d.]+)"', c.group(1))
        if r:
            return ("circle", fmt(r.group(1)), None)
    return None


def height_of(block):
    h = re.search(r"<Height>([\d.]+)</Height>", block or "")
    return fmt(h.group(1)) if h else None


def line_for(rel, generic_height):
    block = resolve(templates, rel, 0)
    s = shape_of(block)
    if not s:
        return None
    h = height_of(block)
    if s[0] == "circle":
        txt = f"footprint Circle r {s[1]} m"
    else:
        txt = f"footprint Square {s[1]} m × {s[2]} m"
    if h and h != generic_height:
        txt += f" (height {h} m)"
    return txt


BUILDINGS = {
    "arsenal": "template_structure_military_arsenal",
    "barracks": "template_structure_military_barracks",
    "civil_centre": "template_structure_civic_civil_centre",
    "corral": "template_structure_resource_corral",
    "defense_tower": "template_structure_defensive_tower_stone",
    "dock": "template_structure_military_dock",
    "farmstead": "template_structure_economic_farmstead",
    "field": "template_structure_resource_field",
    "forge": "template_structure_military_forge",
    "fortress": "template_structure_military_fortress",
    "house": "template_structure_civic_house",
    "market": "template_structure_economic_market",
    "military_colony": "template_structure_civic_civil_centre_military_colony",
    "stable": "template_structure_military_stable",
    "storehouse": "template_structure_economic_storehouse",
    "temple": "template_structure_civic_temple",
    "wonder": "template_structure_wonder",
}
CIVS = ["athen", "brit", "cart", "gaul", "germ", "han", "iber", "kush", "mace", "maur", "pers", "ptol", "rome", "sele", "spart"]

errors = 0
checked = 0
for building, tpl in sorted(BUILDINGS.items()):
    path = f"{DOCS}/generic/buildings/{building}.md"
    if not os.path.exists(path):
        continue
    gh = height_of(resolve(templates, tpl, 0))
    generic_line = line_for(tpl, gh)
    # parse md: map civ -> documented footprint line
    doc = open(path, encoding="utf-8").read()
    doc_lines = {}
    current_civ = None
    for line in doc.splitlines():
        m = re.match(r"^- \*\*(\w+)\*\* — `structures/", line)
        if m:
            current_civ = m.group(1)
        m = re.match(r"^  - (footprint .*)$", line)
        if m and current_civ:
            doc_lines[current_civ] = m.group(1).replace(" (square footprint disabled)", "")
    for civ in CIVS:
        rel = f"structures/{civ}/{building}"
        if find(templates, rel) is None:
            continue
        expected = line_for(rel, gh)
        if expected == generic_line:
            expected = None  # not an override -> docs list nothing
        got = doc_lines.get(civ)
        if expected is None:
            if got is not None:
                print(f"MISMATCH {building}/{civ}: doc has '{got}' but data has no override")
                errors += 1
        elif got != expected:
            print(f"MISMATCH {building}/{civ}:\n  doc  : {got}\n  data : {expected}")
            errors += 1
        else:
            checked += 1

print(f"\nchecked {checked} footprint override lines, {errors} mismatches")
sys.exit(1 if errors else 0)
