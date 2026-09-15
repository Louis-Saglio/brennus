#!/usr/bin/env python3
"""Submit one kiln batch per seed per side over the MCP HTTP endpoint.

Usage: submit.py <base|tweak> <seed...>
Appends "<seed> <batch_id> <job_id>" to jobs-<side>.tsv in the script's
directory. Skips seeds already present there (resumable). The bearer token
is read from the kiln entry of ~/.kimi-code/mcp.json (env TOKEN overrides)
so no credential lands in the repo.

Sides: tweak = the muster-and-engage change (bot/ working tree). The base
column is sweeps/2026-09-14-72bc390/results-tweak.tsv (same code, same spec).
"""
import os
import sys
import json
import urllib.request
from pathlib import Path

URL = "http://127.0.0.1:8322/mcp"
if "TOKEN" in os.environ:
    TOKEN = os.environ["TOKEN"]
else:
    _auth = json.load(open(os.path.expanduser("~/.kimi-code/mcp.json")))["mcpServers"]["kiln"]["headers"]["Authorization"]
    TOKEN = _auth.split(None, 1)[1]

SIDES = {
    "tweak": ("/home/ubuntu/brennus/bot", "musT-s"),
}

SPEC = {
    "map": "random/mainland",
    "biome": "generic/temperate",
    "placement": "circle",
    "size": 192,
    "victory": ["conquest_civic_centers"],
    "players": [
        {"ai": "brennus", "civ": "gaul", "diff": 3, "behavior": "aggressive", "team": 1},
        {"ai": "petra", "civ": "rome", "diff": 3, "behavior": "aggressive", "team": 2},
    ],
    "player": -1,
    "in_game_limit_min": 45,
    "wall_budget_s": 1800,
}


def call(method, params, req_id=1):
    body = json.dumps({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    })
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.loads(resp.read())
    if "error" in payload:
        raise RuntimeError(payload["error"])
    return payload["result"]


def main():
    side = sys.argv[1]
    mod_dir, prefix = SIDES[side]
    jobs_path = Path(__file__).parent / f"jobs-{side}.tsv"
    done = set()
    if jobs_path.exists():
        done = {line.split()[0] for line in jobs_path.read_text().splitlines() if line.strip()}
    out = jobs_path.open("a")
    for seed in sys.argv[2:]:
        if seed in done:
            continue
        spec = dict(SPEC, seed=int(seed), aiseed=int(seed))
        result = call("tools/call", {
            "name": "submit_batch",
            "arguments": {
                "batch_name": f"{prefix}{seed}",
                "mod_dir": mod_dir,
                "spec": spec,
            },
        })
        text = result["content"][0]["text"] if isinstance(result, dict) and "content" in result else str(result)
        tokens = text.replace("\n", " ").split()
        batch_id = tokens[tokens.index("batch") + 1]
        job_id = tokens[tokens.index("job") + 1]
        out.write(f"{seed}\t{batch_id}\t{job_id}\n")
        out.flush()
        print(f"{side} seed {seed}: batch {batch_id} job {job_id}", flush=True)


if __name__ == "__main__":
    main()
