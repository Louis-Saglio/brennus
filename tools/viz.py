#!/usr/bin/env python3
"""Watch a recorded Brennus match: replay it visually and capture frames.

The batch stays the source of truth (tools/run.sh); this only *looks* at a
match that already exists, through its own replay (`-replay-visual`, observer,
the exact recorded game — the 45-minute trigger included).

The camera is driven from inside the game by the brennus-viz GUI mod
(tools/vizmod/): no synthetic input, no window focus. The mod reads a plan,
sets the playback speed (any recording plays at --speed), and every --every
seconds of game time pauses the simulation, points the camera at each target
in turn and prints `[VIZ] shot {...}` once the frame is rendered; this script
then grabs the window with grim. All frames of one group show the same game
instant, and frames.jsonl records exactly where the camera looked.

By default the game runs on a private Hyprland headless output (a virtual
monitor far off the desktop layout): nothing appears on the screen, the
pointer cannot reach it, and it is removed afterwards. --show puts the window
on the current workspace instead, to watch it live.

Usage:
  tools/viz.py <match dir | commands.txt> [options]

A match dir is <outdir>/<tag> from a batch (its replay is under
home/.local/share/0ad/replays/, the batch's mod snapshot <outdir>/mod is
mounted) or any directory holding commands.txt.

Targets (comma-separated, one frame each per group):
  overview      whole map, top-down
  base:P        player P's civic centre
  army:P        P's densest cluster of soldiers/siege that are not working
  fight         densest cluster of units in a combat state
  ent:ID        an entity (ids as printed by the [HARNESS] map telemetry)
  xy:X,Z        a fixed point, in metres
Explicit one-off shots: --shot MIN:TARGET (repeatable, MIN in game minutes).

Examples:
  tools/viz.py tmp/probe/seed7                       # default plan, hidden
  tools/viz.py tmp/probe/seed7 --every 10 --from 8 --to 14 -T fight,army:1
  tools/viz.py tmp/probe/seed7 --every 0 --shot 12.5:ent:4242 --shot 13:xy:300,420
  tools/viz.py tmp/probe/seed7 --show --hud --every 60   # watch it live
Then: tools/frames.py <out dir>   (contact sheets, one row per instant)
"""
import argparse
import glob
import json
import os
import shlex
import shutil
import subprocess
import sys
import time
from typing import NoReturn

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIZMOD = os.path.join(REPO, "tools", "vizmod")
OUTPUT = "BRENNUS-VIZ"   # headless output name (stable: Omarchy remembers it once)


def die(msg) -> NoReturn:
    sys.exit(f"viz.py: {msg}")


def find_replay(path):
    path = os.path.abspath(path)
    if os.path.isfile(path):
        return path, os.path.dirname(path)
    if not os.path.isdir(path):
        die(f"no such path: {path}")
    cands = glob.glob(os.path.join(path, "home/.local/share/0ad/replays/*/*/commands.txt"))
    cands += glob.glob(os.path.join(path, "commands.txt"))
    if not cands:
        die(f"no commands.txt under {path}")
    return max(cands, key=os.path.getmtime), path


def find_mod(match, explicit):
    if explicit:
        mod = os.path.abspath(explicit)
    else:
        mod = next((os.path.abspath(c) for c in (os.path.join(match, "..", "mod"), os.path.join(match, "mod"))
                    if os.path.isfile(os.path.join(c, "mod.json"))), os.path.join(REPO, "bot"))
    if not os.path.isfile(os.path.join(mod, "mod.json")):
        die(f"no mod.json in {mod}")
    return mod


# --- Hyprland -------------------------------------------------------------

def hypr_env():
    run = os.environ.get("XDG_RUNTIME_DIR") or f"/run/user/{os.getuid()}"
    hypr = os.path.join(run, "hypr")
    sigs = [d for d in os.listdir(hypr) if os.path.exists(os.path.join(hypr, d, ".socket.sock"))] \
        if os.path.isdir(hypr) else []
    if not sigs:
        die(f"no running Hyprland under {hypr}")
    sig = max(sigs, key=lambda d: os.path.getmtime(os.path.join(hypr, d)))
    env = dict(os.environ, XDG_RUNTIME_DIR=run, HYPRLAND_INSTANCE_SIGNATURE=sig)
    if "WAYLAND_DISPLAY" not in env:
        socks = sorted(f for f in os.listdir(run) if f.startswith("wayland-") and not f.endswith(".lock"))
        if socks:
            env["WAYLAND_DISPLAY"] = socks[0]
    return env


def hyprctl(env, *args) -> str:
    return subprocess.run(["hyprctl"] + list(args), env=env, capture_output=True, text=True,
                          timeout=10).stdout.strip()


def hyprctl_json(env, *args) -> list:
    return json.loads(hyprctl(env, "-j", *args))


def lua_str(s):
    return "[==[" + s + "]==]"


def create_output(env, w, h):
    if not any(m["name"] == OUTPUT for m in hyprctl_json(env, "monitors")):
        r = hyprctl(env, "output", "create", "headless", OUTPUT)
        if r != "ok":
            die(f"cannot create headless output: {r}")
    # Far from the real monitors so the pointer can never wander onto it.
    hyprctl(env, "eval", f'hl.monitor({{ output = "{OUTPUT}", mode = "{w}x{h}@60", '
                         f'position = "-20000x-20000", scale = 1 }})')
    for _ in range(50):
        mon = next((m for m in hyprctl_json(env, "monitors") if m["name"] == OUTPUT), None)
        if mon and (mon["width"], mon["height"]) == (w, h):
            return mon
        time.sleep(0.1)
    die(f"headless output {OUTPUT} did not come up at {w}x{h}")


def remove_output(env):
    hyprctl(env, "output", "remove", OUTPUT)


def find_window(env, pid):
    for c in hyprctl_json(env, "clients"):
        if c.get("pid") == pid and c.get("mapped"):
            return c
    return None


# --- main -----------------------------------------------------------------

def build_plan(a):
    plan = {}
    if a.plan:
        with open(a.plan, encoding="utf-8") as fh:
            plan.update(json.load(fh))
    for key in ("speed", "every", "hud", "holdMs"):
        val = getattr(a, key)
        if val is not None:
            plan[key] = val
    if a.targets is not None:
        plan["targets"] = [t for t in a.targets.split(",") if t]
    if a.start is not None:
        plan["start"] = a.start * 60
    if a.end is not None:
        plan["end"] = a.end * 60
    if a.shot:
        shots = plan.get("shots", [])
        for s in a.shot:
            minute, _, target = s.partition(":")
            try:
                shots.append({"t": float(minute) * 60, "target": target})
            except ValueError:
                die(f"--shot expects MIN:TARGET, got {s}")
        plan["shots"] = shots
    if a.keep:
        plan["exit"] = False
    if a.show:
        plan.setdefault("cursor", True)
    return plan


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("match")
    ap.add_argument("-o", "--out", help="output dir (default <match>/viz)")
    ap.add_argument("-m", "--mod", help="mod snapshot to mount as brennus (default: the batch's mod/, else bot/)")
    ap.add_argument("-T", "--targets", help="comma-separated targets per group "
                    "(default overview,base:1,base:2,army:1,army:2,fight)")
    ap.add_argument("--every", type=float, help="game seconds between groups (default 30; 0 = --shot only)")
    ap.add_argument("--from", dest="start", type=float, help="first group, game minutes (default 0)")
    ap.add_argument("--to", dest="end", type=float, help="last group, game minutes (default: match end)")
    ap.add_argument("--shot", action="append", help="MIN:TARGET one-off shot (repeatable)")
    ap.add_argument("--plan", help="JSON plan merged under the flags (see tools/vizmod director.js DEFAULTS)")
    ap.add_argument("--speed", type=float, help="playback sim rate (default 20)")
    ap.add_argument("--hud", action="store_true", default=None, help="keep the game HUD in the frames")
    ap.add_argument("--hold", dest="holdMs", type=int, help="ms the camera holds still per frame (default 300)")
    ap.add_argument("--size", default="1600x900", help="render size WxH (default 1600x900)")
    ap.add_argument("--show", action="store_true", help="window on the current workspace instead of hidden")
    ap.add_argument("--keep", action="store_true", help="do not quit the game after the last group (with --show)")
    ap.add_argument("--x11", action="store_true", help="run through XWayland instead of native Wayland")
    ap.add_argument("-t", "--timeout", type=int, default=1200, help="wall-clock cap in seconds (default 1200)")
    a = ap.parse_args()

    try:
        W, H = (int(v) for v in a.size.lower().split("x"))
    except ValueError:
        die("--size expects WxH")
    replay, match = find_replay(a.match)
    mod = find_mod(match, a.mod)
    for tool in ("pyrogenesis", "grim", "hyprctl"):
        if not shutil.which(tool):
            die(f"{tool} not in PATH")
    if subprocess.run(["pgrep", "-x", "pyrogenesis"], capture_output=True).returncode == 0 and not a.show:
        print("viz.py: note: other pyrogenesis processes are running (a batch?); "
              "the replay will compete with them for CPU", file=sys.stderr)

    out = os.path.abspath(a.out or os.path.join(match, "viz"))
    home = os.path.join(out, "home")
    shutil.rmtree(out, ignore_errors=True)
    mods = os.path.join(home, ".local/share/0ad/mods")
    for d in (mods, os.path.join(home, ".local/state"), os.path.join(home, ".cache"),
              os.path.join(home, ".config/0ad/config"), os.path.join(out, "frames")):
        os.makedirs(d, exist_ok=True)
    shutil.copytree(mod, os.path.join(mods, "brennus"))
    shutil.copytree(VIZMOD, os.path.join(mods, "brennus-viz"))
    plan = build_plan(a)
    with open(os.path.join(mods, "brennus-viz/gui/session/brennus_viz/plan.json"), "w", encoding="utf-8") as fh:
        json.dump(plan, fh, indent=1)
    cfg = [
        "windowed = true", f"xres = {W}", f"yres = {H}", "pauseonfocusloss = false",
        "gui.scale = 1", "shadows = false", "postproc = false", "silhouettes = false",
        "fog = false",   # distance fog whitens anything seen from a few hundred metres up
        "splashscreenenable = false",
    ]
    if not a.show:
        cfg.append("view.scroll.mouse.detectdistance = 0")   # no edge-scroll from a stray pointer
    with open(os.path.join(home, ".config/0ad/config/user.cfg"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(cfg) + "\n")

    env = hypr_env()
    log = os.path.join(out, "viz.log")
    pidfile = os.path.join(out, "pid")
    xdg = {"HOME": home, "XDG_DATA_HOME": f"{home}/.local/share", "XDG_CONFIG_HOME": f"{home}/.config",
           "XDG_CACHE_HOME": f"{home}/.cache", "XDG_STATE_HOME": f"{home}/.local/state",
           "SDL_VIDEODRIVER": "x11" if a.x11 else "wayland"}
    launch = os.path.join(out, "launch.sh")
    with open(launch, "w", encoding="utf-8") as fh:
        fh.write("#!/bin/sh\n# written by tools/viz.py: started by Hyprland so window rules apply\n")
        fh.write(f"echo $$ > {shlex.quote(pidfile)}\n")
        for k, v in xdg.items():
            fh.write(f"export {k}={shlex.quote(v)}\n")
        fh.write(f"cd {shlex.quote(out)} || exit 1   # -replay skips InitVfs: profile/crash files land in CWD\n")
        fh.write("exec nice -n 10 ionice -c 3 pyrogenesis -mod=public -mod=brennus -mod=brennus-viz "
                 f"-replay-visual={shlex.quote(replay)} -nosound > {shlex.quote(log)} 2>&1\n")
    os.chmod(launch, 0o755)

    print(f"viz.py: replay {replay}")
    print(f"viz.py: mod {mod} -> {out}")
    pid = None
    t0 = time.time()
    try:
        # A floating window of exactly WxH; on the headless output it is centred
        # in a margin, clear of the shell bar.
        rules = "float = true, size = '%d %d', center = true" % (W, H)
        if a.show:
            rules = "{ %s }" % rules
        else:
            mon = create_output(env, W + 200, H + 200)
            rules = "{ workspace = '%d silent', %s }" % (mon["activeWorkspace"]["id"], rules)
        r = hyprctl(env, "eval", f"hl.exec_cmd({lua_str(launch)}, {rules})")
        if r and r != "ok":
            die(f"hyprctl exec failed: {r}")
        for _ in range(100):
            if os.path.exists(pidfile) and open(pidfile).read().strip():
                pid = int(open(pidfile).read())
                break
            time.sleep(0.1)
        if not pid:
            die("the game did not start (no pid file)")
        pid = follow(env, pid, out, log, plan, a.timeout, t0)
    finally:
        if pid and alive(pid):
            os.kill(pid, 15)
            for _ in range(50):
                if not alive(pid):
                    break
                time.sleep(0.1)
            if alive(pid):
                os.kill(pid, 9)
        if not a.show:
            remove_output(env)
    summary(out, log, t0)


def alive(pid):
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    # A zombie is not a game; the launcher's parent is Hyprland, it reaps.
    try:
        with open(f"/proc/{pid}/stat") as fh:
            return fh.read().split(")")[-1].split()[0] != "Z"
    except OSError:
        return False


def follow(env, pid, out, log, plan, timeout, t0):
    """Tail viz.log; grab a frame for every [VIZ] shot. Returns the pid if still alive."""
    geom = None
    grab = []
    meta = open(os.path.join(out, "frames.jsonl"), "w", encoding="utf-8")
    hold = plan.get("holdMs", 300) / 1000
    pos = 0
    buf = ""
    slow = 0
    while True:
        if time.time() - t0 > timeout:
            print(f"viz.py: wall-clock cap {timeout}s reached", file=sys.stderr)
            return pid
        if not os.path.exists(log):
            time.sleep(0.2)
            continue
        with open(log, encoding="utf-8", errors="replace") as fh:
            fh.seek(pos)
            chunk = fh.read()
            pos = fh.tell()
        if not chunk:
            if not alive(pid):
                print("viz.py: the game exited")
                return None
            time.sleep(0.05)
            continue
        buf += chunk
        *lines, buf = buf.split("\n")
        for line in lines:
            if not line.startswith("[VIZ] "):
                continue
            kind, _, payload = line[6:].partition(" ")
            try:
                data = json.loads(payload)
            except json.JSONDecodeError:
                continue
            if kind == "ready":
                win = None
                for _ in range(50):
                    win = find_window(env, pid)
                    if win:
                        break
                    time.sleep(0.1)
                if not win:
                    die("game window not found")
                geom = f'{win["at"][0]},{win["at"][1]} {win["size"][0]}x{win["size"][1]}'
                # Grab the window itself (foreign-toplevel capture): no pointer,
                # no shell layers, no neighbours — only the game's own pixels.
                # Hyprland draws the real pointer on every output, the headless
                # one included, so a region grab would show it.
                grab = ["-T", str(win["stableId"])] if win.get("stableId") else ["-g", geom]
                players = ", ".join(f'{p["id"]}:{p["name"]}({p["civ"]})' for p in data["players"][1:])
                print(f"viz.py: ready after {time.time() - t0:.0f}s — window {geom} on {win['monitor']}, "
                      f"engine screen {data['screen']}, map {data['mapSize']} m, speed {data['speed']}x, "
                      f"{data['plan']} plan; players {players}")
            elif kind == "shot":
                name = f'{data["n"]:05d}_{data["t"] // 1000:05d}s_{data["label"]}.png'
                g0 = time.time()
                r = subprocess.run(["grim", "-l", "1", *grab, os.path.join(out, "frames", name)],
                                   env=env, capture_output=True, text=True)
                dt = time.time() - g0
                if r.returncode:
                    print(f"viz.py: grim failed: {r.stderr.strip()}", file=sys.stderr)
                    continue
                if dt > hold:
                    slow += 1
                rec = {"frame": name, "wall": round(time.time() - t0, 1), "game_min": round(data["t"] / 60000, 2),
                       "grab_s": round(dt, 2)}
                rec.update({k: data[k] for k in ("t", "target", "label", "x", "y", "z", "zoom", "pitch", "yaw", "info")})
                meta.write(json.dumps(rec) + "\n")
                meta.flush()
                if data["n"] % 25 == 0:
                    print(f"viz.py: frame {data['n']} at {rec['game_min']:.1f} game-min ({rec['wall']:.0f}s wall)")
            elif kind == "skip":
                pass
            elif kind == "error":
                print(f"viz.py: director error: {data}", file=sys.stderr)
            elif kind == "end":
                print(f"viz.py: last group at {data['t'] / 60000:.1f} game-min, {data['frames']} frames")
                if slow:
                    print(f"viz.py: warning: {slow} grabs took longer than the {hold:.1f}s hold "
                          "(raise --hold)", file=sys.stderr)
                if not plan.get("exit", True):
                    return None
                for _ in range(100):
                    if not alive(pid):
                        return None
                    time.sleep(0.1)
                return pid


def summary(out, log, t0):
    frames = len(glob.glob(os.path.join(out, "frames", "*.png")))
    print(f"viz.py: {frames} frames in {out}/frames ({time.time() - t0:.0f}s wall)")
    errs = 0
    if os.path.exists(log):
        with open(log, encoding="utf-8", errors="replace") as fh:
            errs = sum(1 for line in fh if "ERROR" in line or "JavaScript error" in line)
    for ml in glob.glob(os.path.join(out, "home/.local/state/0ad/log/mainlog.html")):
        with open(ml, encoding="utf-8", errors="replace") as fh:
            tail = fh.read()[-400:]
        if "error(s)" in tail:
            print("viz.py: mainlog: " + tail[tail.rfind("with "):].split("<")[0].strip())
    if errs:
        print(f"viz.py: {errs} error lines in {log}", file=sys.stderr)
    print(f"viz.py: contact sheets -> tools/frames.py {out}")


if __name__ == "__main__":
    main()
