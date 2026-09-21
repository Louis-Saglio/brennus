#!/usr/bin/env python3
"""Submit one kiln batch per seed over the MCP HTTP endpoint.

Usage: submit.py [seed...]   (default: 1-400 minus REUSED)
Appends "<seed> <batch_id> <job_id>" to jobs.tsv in the script's
directory. Skips seeds already present there (resumable). The bearer token
is read from the kiln entry of ~/.kimi-code/mcp.json (env TOKEN overrides)
so no credential lands in the repo.

REUSED: seeds already run at HEAD 29bfb48 in sweeps/2026-09-21-wavrec
(26 seeds; report there argues wavrec1's 4 are bit-identical).
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

MOD_DIR = "/home/ubuntu/brennus/bot"
PREFIX = "w400-s"

REUSED = {206, 215, 221, 230, 234, 243, 244, 245, 246, 262, 263, 264, 265,
          266, 267, 268, 279, 316, 320, 327, 340, 352, 353, 356, 357, 361}

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
    seeds = [int(s) for s in sys.argv[1:]] or [s for s in range(1, 401) if s not in REUSED]
    jobs_path = Path(__file__).parent / "jobs.tsv"
    done = set()
    if jobs_path.exists():
        done = {int(line.split()[0]) for line in jobs_path.read_text().splitlines() if line.strip()}
    out = jobs_path.open("a")
    for seed in seeds:
        if seed in done:
            continue
        spec = dict(SPEC, seed=seed, aiseed=seed)
        result = call("tools/call", {
            "name": "submit_batch",
            "arguments": {
                "batch_name": f"{PREFIX}{seed}",
                "mod_dir": MOD_DIR,
                "spec": spec,
            },
        })
        text = result["content"][0]["text"] if isinstance(result, dict) and "content" in result else str(result)
        tokens = text.replace("\n", " ").split()
        batch_id = tokens[tokens.index("batch") + 1]
        job_id = tokens[tokens.index("job") + 1]
        out.write(f"{seed}\t{batch_id}\t{job_id}\n")
        out.flush()
        print(f"seed {seed}: batch {batch_id} job {job_id}", flush=True)


if __name__ == "__main__":
    main()
