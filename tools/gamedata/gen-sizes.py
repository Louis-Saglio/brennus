#!/usr/bin/env python3
"""Emit doc-ready footprint lines per building (resolved through parent chain)."""
import re

from templates import find, fmt, load, resolve

templates = load()


def shape_of(block):
    """Return (kind, w, d) for Square or (kind, r) for Circle, or None."""
    sq = re.search(r"<Square([^/]*)/>", block)
    if sq:
        attrs = sq.group(1)
        if 'disable=' in attrs:
            sq = None
        else:
            w = re.search(r'width="([\d.]+)"', attrs)
            d = re.search(r'depth="([\d.]+)"', attrs)
            if w and d:
                return ("square", fmt(w.group(1)), fmt(d.group(1)))
    for c in re.finditer(r"<Circle([^/]*)/>", block):
        attrs = c.group(1)
        if 'disable=' in attrs:
            continue
        r = re.search(r'radius="([\d.]+)"', attrs)
        if r:
            return ("circle", fmt(r.group(1)), None)
    return None


def height_of(block):
    h = re.search(r"<Height>([\d.]+)</Height>", block)
    return fmt(h.group(1)) if h else None


def fp_desc(rel):
    """Doc line for footprint: e.g. 'Square 22 m × 22 m (height 5 m)'."""
    block = resolve(templates, rel, 0)
    s = shape_of(block)
    if not s:
        return None
    h = height_of(block)
    if s[0] == "circle":
        txt = f"Circle r {s[1]} m"
    else:
        txt = f"Square {s[1]} m × {s[2]} m"
    if h:
        txt += f" (height {h} m)"
    return txt


def ob_desc(rel):
    block = resolve(templates, rel, 1)
    if not block:
        return None
    sq = re.search(r"<Static([^/]*)/>", block)
    if sq:
        w = re.search(r'width="([\d.]+)"', sq.group(1))
        d = re.search(r'depth="([\d.]+)"', sq.group(1))
        if w and d:
            return f"Static {fmt(w.group(1))} m × {fmt(d.group(1))} m"
    return re.sub(r"\s+", " ", block).strip()[:70]


BUILDINGS = {
    "arsenal": "template_structure_military_arsenal",
    "barracks": "template_structure_military_barracks",
    "civil_centre": "template_structure_civic_civil_centre",
    "corral": "template_structure_resource_corral",
    "defense_tower": "template_structure_defensive_tower_stone",
    "dock": "template_structure_military_dock",
    "elephant_stable": "template_structure_military_elephant_stable",
    "farmstead": "template_structure_economic_farmstead",
    "field": "template_structure_resource_field",
    "forge": "template_structure_military_forge",
    "fortress": "template_structure_military_fortress",
    "house": "template_structure_civic_house",
    "market": "template_structure_economic_market",
    "military_colony": "template_structure_civic_civil_centre_military_colony",
    "outpost": "template_structure_defensive_outpost",
    "sentry_tower": "template_structure_defensive_tower_sentry",
    "stable": "template_structure_military_stable",
    "storehouse": "template_structure_economic_storehouse",
    "temple": "template_structure_civic_temple",
    "theater": "template_structure_special_theater",
    "wonder": "template_structure_wonder",
}

CIVS = ["athen", "brit", "cart", "gaul", "germ", "han", "iber", "kush", "mace", "maur", "pers", "ptol", "rome", "sele", "spart"]

print("=========== REGULAR BUILDINGS ===========")
for building, generic_tpl in sorted(BUILDINGS.items()):
    gf = fp_desc(generic_tpl)
    go = ob_desc(generic_tpl)
    print(f"\n### {building}")
    print(f"GENERIC FP: {gf}")
    print(f"GENERIC OB: {go}")
    for civ in CIVS:
        rel = f"structures/{civ}/{building}"
        if find(templates, rel) is None:
            continue
        f = fp_desc(rel)
        if f and f != gf:
            print(f"  {civ}: footprint {f}")
        elif f is None:
            print(f"  {civ}: footprint NONE (no shape)")
        else:
            print(f"  {civ}: = generic")

print("\n=========== STONE WALL PIECES (per civ) ===========")
for civ in CIVS:
    segs = {}
    for seg in ["wall_short", "wall_medium", "wall_long", "wall_tower", "wall_gate"]:
        rel = f"structures/{civ}/{seg}"
        f = fp_desc(rel)
        segs[seg] = f
    print(f"{civ}: short {segs['wall_short']} | medium {segs['wall_medium']} | long {segs['wall_long']} | tower {segs['wall_tower']} | gate {segs['wall_gate']}")

print("\n=========== PALISADE PIECES ===========")
for seg in ["palisades_short", "palisades_medium", "palisades_long", "palisades_tower", "palisades_gate"]:
    print(f"{seg}: FP {fp_desc('structures/' + seg)} OB {ob_desc('structures/' + seg)}")
for seg in ["palisades_short", "palisades_medium", "palisades_long", "palisades_tower", "palisades_gate"]:
    print(f"han/{seg}: FP {fp_desc('structures/han/' + seg)} OB {ob_desc('structures/han/' + seg)}")

print("\n=========== ROMAN SIEGE WALL PIECES ===========")
for seg in ["siege_wall_short", "siege_wall_medium", "siege_wall_long", "siege_wall_tower", "siege_wall_gate"]:
    rel = f"structures/rome/{seg}"
    print(f"{seg}: FP {fp_desc(rel)} OB {ob_desc(rel)}")
