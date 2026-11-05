#!/usr/bin/env python3
"""Summarize a batch of headless matches produced by tools/run.sh.

One row per tag directory under <outdir> (default: every subdirectory
holding a stdout.log, in natural order):

- result: player 1's playerState from the end-of-game statistics (won ->
  win, defeated -> loss), overridden to `timeout` when the mod's time-limit
  trigger fired (it marks player 1 won at the cap regardless); `none` when
  no statistics were printed (crash or wall-clock kill);
- game_min: in-game minutes, turns / 300 (one turn = 200 ms);
- errors: lines with ERROR or "script exception" in stdout.log;
  failed_ai: "Failed to create AI player" (a wrong AI name plays an idle
  player and still exits 0); harness: 0 when the bot's [HARNESS] telemetry
  never printed — any of the three invalidates the game;
- host, exit code, wall seconds, turns/s: from result.json;
- city / pop300: city-phase and population=300 milestones (minutes);
  wood10: wood gathered at the 10-minute telemetry print;
- hash: short sha256 of every player's statistics JSON, in print order —
  equal hashes mean identical games (determinism checks).

Usage:
  analyze.py [--tsv FILE] [--det A,B] [--harness] <outdir> [tag...]

--tsv also writes the table as TSV (e.g. a sweep's results.tsv); --det
compares two tags' hashes; --harness prints each tag's [HARNESS] lines.
"""
import argparse
import hashlib
import json
import os
import re

MILESTONE = re.compile(r"\[HARNESS\] t=([0-9.]+)m (phase=\w+.*|population=300)")
WOOD10 = re.compile(r"\[HARNESS\] t=10\.0m gathered wood=(\d+)")
COLUMNS = ["tag", "result", "game_min", "errors", "failed_ai", "harness", "host",
           "exit", "wall_s", "turns_s", "city", "pop300", "wood10", "hash"]


def player_blocks(stdout):
    """Yield raw JSON blocks (lines from a column-0 '{' to a column-0 '}')."""
    block, inside = [], False
    for line in stdout.splitlines(keepends=True):
        if not inside and line.startswith("{"):
            inside = True
            block = [line]
        elif inside:
            block.append(line)
            if line.rstrip("\n") == "}":
                yield "".join(block)
                inside = False


def analyze(outdir, tag):
    d = os.path.join(outdir, tag)
    path = os.path.join(d, "stdout.log")
    if not os.path.exists(path):
        return None
    out = open(path, errors="replace").read()
    run = {}
    if os.path.exists(os.path.join(d, "result.json")):
        run = json.load(open(os.path.join(d, "result.json")))

    state, raws = None, []
    for block in player_blocks(out):
        try:
            obj = json.loads(block)
        except json.JSONDecodeError:
            continue
        if "playerID" in obj and "statistics" in obj:
            raws.append(block)
            if obj["playerID"] == 1:
                state = obj.get("playerState")
    if state is None:
        result = "none"
    elif "time limit reached" in out:
        result = "timeout"
    else:
        result = {"won": "win", "defeated": "loss"}.get(state, state)

    city = pop300 = None
    for m in MILESTONE.finditer(out):
        if "phase_city" in m.group(2):
            city = float(m.group(1))
        elif m.group(2) == "population=300":
            pop300 = float(m.group(1))
    wood10 = WOOD10.search(out)
    turns, wall = run.get("turns", 0), run.get("wall_seconds", 0)
    return {
        "tag": tag,
        "result": result,
        "game_min": f"{turns / 300:.1f}" if turns else "-",
        "errors": len(re.findall(r"ERROR|script exception", out)),
        "failed_ai": int("Failed to create AI player" in out),
        "harness": int("[HARNESS]" in out),
        "host": run.get("host", "-"),
        "exit": run.get("exit_code", "-"),
        "wall_s": wall or "-",
        "turns_s": f"{turns / wall:.0f}" if turns and wall else "-",
        "city": f"{city:.1f}" if city is not None else "-",
        "pop300": f"{pop300:.1f}" if pop300 is not None else "-",
        "wood10": wood10.group(1) if wood10 else "-",
        "hash": hashlib.sha256("".join(raws).encode()).hexdigest()[:12] if raws else "-",
        "lines": [l.strip() for l in out.splitlines() if l.startswith("[HARNESS]")],
    }


def natural(tag):
    return [int(p) if p.isdigit() else p for p in re.split(r"(\d+)", tag)]


def main():
    ap = argparse.ArgumentParser(description="Summarize a tools/run.sh batch.")
    ap.add_argument("outdir")
    ap.add_argument("tags", nargs="*", help="tag directories (default: all)")
    ap.add_argument("--tsv", help="also write the table to this TSV file")
    ap.add_argument("--det", help="comma pair of tags whose hashes must match")
    ap.add_argument("--harness", action="store_true", help="print [HARNESS] lines")
    args = ap.parse_args()
    tags = args.tags or sorted(
        (t for t in os.listdir(args.outdir)
         if os.path.exists(os.path.join(args.outdir, t, "stdout.log"))), key=natural)
    rows = [r for r in (analyze(args.outdir, t) for t in tags) if r]

    widths = {c: max(len(c), *(len(str(r[c])) for r in rows)) for c in COLUMNS} if rows else {}
    print("  ".join(c.ljust(widths[c]) for c in COLUMNS))
    for r in rows:
        print("  ".join(str(r[c]).ljust(widths[c]) for c in COLUMNS))
        if args.harness:
            for line in r["lines"]:
                print(f"    {line}")
    count = lambda pred: sum(1 for r in rows if pred(r))
    print(f"{len(rows)} games: {count(lambda r: r['result'] == 'win')} win / "
          f"{count(lambda r: r['result'] == 'timeout')} timeout / "
          f"{count(lambda r: r['result'] == 'loss')} loss / "
          f"{count(lambda r: r['result'] == 'none')} none; "
          f"{count(lambda r: r['errors'])} with JS errors, "
          f"{count(lambda r: r['failed_ai'])} failed-AI, "
          f"{count(lambda r: not r['harness'])} missing HARNESS, "
          f"{count(lambda r: r['exit'] not in (0, '-'))} nonzero exit")
    if args.tsv:
        with open(args.tsv, "w") as f:
            f.write("\t".join(COLUMNS) + "\n")
            for r in rows:
                f.write("\t".join(str(r[c]) for c in COLUMNS) + "\n")
    if args.det:
        a, b = args.det.split(",")
        hashes = {r["tag"]: r["hash"] for r in rows}
        ok = a in hashes and hashes[a] != "-" and hashes.get(a) == hashes.get(b)
        print(f"determinism({a} vs {b}): {'OK' if ok else 'MISMATCH'}")


if __name__ == "__main__":
    main()
