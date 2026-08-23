"""Load 0 A.D. 0.28.0 entity templates (XML) and resolve Footprint /
Obstruction blocks through the parent chain.

Shared by the gamedata tools. The data root defaults to the pinned
0ad-reference checkout; override with the ZEROAD_REF environment variable.
"""
import os
import re

DEFAULT_ROOT = "/home/ubuntu/0ad-reference/public/simulation/templates"


def load(root=None):
    """Return {relpath: (parent, [footprint blocks], [obstruction blocks])}."""
    root = root or os.environ.get("ZEROAD_REF") or DEFAULT_ROOT
    templates = {}
    for dirpath, _, files in os.walk(root):
        for fn in files:
            if not fn.endswith(".xml") or fn.endswith(".cached.xmb"):
                continue
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, root).replace(os.sep, "/")
            with open(path, encoding="utf-8") as f:
                content = f.read()
            m = re.search(r'<Entity[^>]*parent="([^"]+)"', content)
            templates[rel] = (
                m.group(1) if m else None,
                re.findall(r"<Footprint[^>]*>(.*?)</Footprint>", content, re.S),
                re.findall(r"<Obstruction[^>]*>(.*?)</Obstruction>", content, re.S),
            )
    return templates


def find(templates, name):
    """Map a name, with or without .xml extension, to a template key or None."""
    if name in templates:
        return name
    if name + ".xml" in templates:
        return name + ".xml"
    return None


def resolve(templates, rel, kind=0, seen=None):
    """Resolve footprint (kind=0) or obstruction (kind=1) through the parent
    chain. Returns the raw inner XML of the last-overriding block, or None."""
    seen = seen or set()
    if rel in seen:
        return None
    seen.add(rel)
    t = templates.get(rel)
    if t is None:
        full = find(templates, rel)
        t = templates.get(full) if full else None
    if not t:
        return None
    parent, fps, obs = t
    blocks = fps if kind == 0 else obs
    if blocks:
        return blocks[-1]
    if parent:
        p = find(templates, parent)
        if p:
            return resolve(templates, p, kind, seen)
    return None


def fmt(s):
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s
