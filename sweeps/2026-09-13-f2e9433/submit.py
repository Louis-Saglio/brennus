#!/usr/bin/env python3
"""Submit one kiln batch per seed over the MCP HTTP endpoint.

Usage: submit.py <seed...> — appends "<seed> <batch_id> <job_id>" to jobs.tsv
in the script's directory. Skips seeds already present there (resumable).
"""
import json
import sys
import urllib.request
from pathlib import Path

URL = "http://127.0.0.1:8322/mcp"
TOKEN = "8c04cf9a7188b7db4a9ca18869e486cd789f3b414bb53be750541ca4e5f56a6a"
MOD_DIR = "/home/ubuntu/brennus/bot"
BATCH_PREFIX = "ord3-s"

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
    jobs_path = Path(__file__).parent / "jobs.tsv"
    done = set()
    if jobs_path.exists():
        done = {line.split()[0] for line in jobs_path.read_text().splitlines() if line.strip()}
    out = jobs_path.open("a")
    for seed in sys.argv[1:]:
        if seed in done:
            continue
        spec = dict(SPEC, seed=int(seed), aiseed=int(seed))
        result = call("tools/call", {
            "name": "submit_batch",
            "arguments": {
                "batch_name": f"{BATCH_PREFIX}{seed}",
                "mod_dir": MOD_DIR,
                "spec": spec,
            },
        })
        text = result["content"][0]["text"] if isinstance(result, dict) and "content" in result else str(result)
        # "batch <id> submitted: 1 job(s)\n  job <id>"
        tokens = text.replace("\n", " ").split()
        batch_id = tokens[tokens.index("batch") + 1]
        job_id = tokens[tokens.index("job") + 1]
        out.write(f"{seed}\t{batch_id}\t{job_id}\n")
        out.flush()
        print(f"seed {seed}: batch {batch_id} job {job_id}", flush=True)


if __name__ == "__main__":
    main()
