#!/bin/bash
# Visual replay of a recorded Brennus match: launch the game on the desktop as
# an observer, drive the camera, capture frames, and summarize what happened.
#
# The batch stays the source of truth (tools/run.sh); this only *looks* at a
# match that already exists. Record the match with `tools/run.sh -s 20` so the
# replay plays back at 20x with no interaction (gameSpeed travels in the
# replay's init attributes; nonvisual sims ignore it).
#
# Usage: tools/viz.sh [options] <match dir | commands.txt>
#
# A "match dir" is either <outdir>/<tag> from a batch (its replay is found under
# home/.local/share/0ad/replays/ and the batch's mod snapshot <outdir>/mod is
# mounted) or any directory holding commands.txt.
#
# Options:
#   -o DIR     output dir for frames + frames.jsonl (default: <match dir>/viz)
#   -t SEC     capture for SEC wall seconds (default 150; stops early if the
#              replay ends)
#   -f FPS     frames per wall second (default 1; 0 = plan shots only)
#   -B         switch to bird's-eye view (orthographic top-down) once loaded
#   -z N       zoom-out steps after loading (each = one Minus key press)
#   -a U,V     centre the camera on map fraction U,V (0..1, both axes) via a
#              minimap click; repeatable, applied in order with a shot each
#   -A         aim at each player's base: find that player's colour on the
#              minimap in a live frame (tools/aim.py) and click it. Robust to
#              the camera-angle rotation in the engine's click->world mapping.
#   -p SEC     pause after each camera click for SEC seconds (default 2)
#   -m DIR     mod snapshot to mount (default: the batch's mod/ if the match dir
#              looks like one, else this repo's bot/)
#   -k         keep the game running after the plan (print the window id and
#              exit; you then drive it with xdotool yourself)
#
# The engine runs as an XWayland client (SDL_VIDEODRIVER=x11) because that is
# the only way to get reliable synthetic input; frames are grabbed from the
# compositor with grim, which sees XWayland fine. Display variables are derived
# from /run/user/$UID (a Hermes shell has none).
#
# Examples:
#   tools/run.sh -s 20 tmp/viz/seed7 7          # record for 20x playback
#   tools/viz.sh tmp/viz/seed7/seed7 -B -z 12 -a 0.75,0.75 -a 0.25,0.25
#   tools/viz.sh tmp/viz/seed7/seed7 -f 0 -a 0.5,0.5 -t 600   # long watch
set -u

REPO=$(cd "$(dirname "$0")/.." && pwd)
OUT=""
WALL=150
FPS=1
BIRDSEYE=""
ZOOM=0
AT=()
PAUSE=2
MODDIR=""
KEEP=""
AUTO=""

usage() { sed -n '2,/^set -u/{/^set -u/d;s/^# \{0,1\}//;p}' "$0" >&2; exit 2; }

# Flags may come before or after the match path.
ARGS=()
while [ $# -gt 0 ]; do
	case $1 in
		-o) OUT=$2; shift 2 ;;
		-t) WALL=$2; shift 2 ;;
		-f) FPS=$2; shift 2 ;;
		-B) BIRDSEYE=1; shift ;;
		-z) ZOOM=$2; shift 2 ;;
		-a) AT+=("$2"); shift 2 ;;
		-A) AUTO=1; shift ;;
		-p) PAUSE=$2; shift 2 ;;
		-m) MODDIR=$2; shift 2 ;;
		-k) KEEP=1; shift ;;
		-h) usage ;;
		-*) echo "viz.sh: unknown option $1" >&2; usage ;;
		*) ARGS+=("$1"); shift ;;
	esac
done
[ ${#ARGS[@]} -eq 1 ] || usage
set -- "${ARGS[0]}"

MATCH=$(cd "$1" 2>/dev/null && pwd) || { echo "viz.sh: no such path: $1" >&2; exit 2; }
if [ -d "$MATCH" ]; then
	REPLAY=$(ls -t "$MATCH"/home/.local/share/0ad/replays/*/*/commands.txt 2>/dev/null | head -1)
	[ -n "$REPLAY" ] || REPLAY=$(ls -t "$MATCH"/commands.txt 2>/dev/null | head -1)
	[ -n "$REPLAY" ] || { echo "viz.sh: no commands.txt under $MATCH" >&2; exit 2; }
else
	REPLAY=$MATCH
	MATCH=$(dirname "$REPLAY")
fi
[ -f "$REPLAY" ] || { echo "viz.sh: no such replay: $REPLAY" >&2; exit 2; }

# Mod: prefer the batch's own snapshot so the render matches the analysis.
if [ -z "$MODDIR" ]; then
	for cand in "$MATCH/../mod" "$MATCH/mod"; do
		[ -f "$cand/mod.json" ] && { MODDIR=$(cd "$cand" && pwd); break; }
	done
fi
[ -n "$MODDIR" ] || MODDIR=$REPO/bot
[ -f "$MODDIR/mod.json" ] || { echo "viz.sh: no mod.json in $MODDIR" >&2; exit 2; }

command -v pyrogenesis >/dev/null || { echo "viz.sh: pyrogenesis not in PATH" >&2; exit 2; }
command -v grim >/dev/null || { echo "viz.sh: grim not installed (pacman -S grim)" >&2; exit 2; }
command -v xdotool >/dev/null || { echo "viz.sh: xdotool not installed (pacman -S xdotool)" >&2; exit 2; }

# --- display -------------------------------------------------------------
RUNTIME=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
SIG=$(ls "$RUNTIME"/hypr 2>/dev/null | grep -v '\.lock$' | head -1)
[ -n "$SIG" ] || { echo "viz.sh: no Hyprland instance under $RUNTIME/hypr (is the session running?)" >&2; exit 2; }
export XDG_RUNTIME_DIR=$RUNTIME WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-wayland-1}
export HYPRLAND_INSTANCE_SIGNATURE=$SIG
export DISPLAY=${DISPLAY:-:0} XAUTHORITY=$RUNTIME/hypr/$SIG
export SDL_VIDEODRIVER=x11

MON=$(hyprctl monitors -j | python3 -c 'import json,sys; m=json.load(sys.stdin)[0]; print(m["width"],m["height"])')
SW=${MON% *} SH=${MON#* }

# --- isolated HOME with the mod + engine config --------------------------
OUT=${OUT:-$MATCH/viz}
rm -rf "$OUT/frames" && mkdir -p "$OUT/frames" "$OUT/home/.local/share/0ad/mods" \
	"$OUT/home/.local/state" "$OUT/home/.cache" "$OUT/home/.config/0ad/config"
cp -r "$MODDIR" "$OUT/home/.local/share/0ad/mods/brennus"
cat > "$OUT/home/.config/0ad/config/user.cfg" <<EOF
windowed = false
borderless.fullscreen = false
window.mousegrabinfullscreen = false
pauseonfocusloss = false
shadows = false
postproc = false
xres = $SW
yres = $SH
EOF
export HOME=$OUT/home XDG_DATA_HOME=$OUT/home/.local/share XDG_CONFIG_HOME=$OUT/home/.config
export XDG_CACHE_HOME=$OUT/home/.cache XDG_STATE_HOME=$OUT/home/.local/state

cd "$OUT" || exit 1   # -replay skips InitVfs: profile/crash files land in CWD
: > frames.jsonl

# --- launch --------------------------------------------------------------
nice -n 10 ionice -c 3 pyrogenesis -mod=public -mod=brennus \
	-replay-visual="$REPLAY" -nosound > "$OUT/viz.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null' EXIT

win=""
for i in $(seq 1 90); do
	sleep 1
	win=$(xdotool search --name "0 A.D." 2>/dev/null | head -1)
	[ -n "$win" ] && break
	kill -0 $PID 2>/dev/null || { echo "viz.sh: engine exited during load:" >&2; tail -5 "$OUT/viz.log" >&2; exit 1; }
done
[ -n "$win" ] || { echo "viz.sh: no game window after 90s" >&2; exit 1; }
xdotool windowfocus "$win" 2>/dev/null
# Wait for the session to start (the first turn) before touching the camera.
for i in $(seq 1 60); do
	grep -q 'Executing turn' "$OUT/viz.log" && break
	sleep 1
done
echo "viz.sh: window $win on ${SW}x${SH}, replay $REPLAY"

shot() { # $1 = label
	local f
	f=$(printf '%s/frames/%05d_%s.png' "$OUT" "$(ls "$OUT/frames" | wc -l)" "$1")
	grim -s 0.5 -l 3 -g "0,0 ${SW}x${SH}" "$f" 2>/dev/null || { echo "viz.sh: grim failed" >&2; return 1; }
	local turn
	turn=$(grep -c 'Executing turn' "$OUT/viz.log")
	printf '{"frame": "%s", "wall": %d, "turn": %d, "game_min": %.2f, "label": "%s"}\n' \
		"$(basename "$f")" "$SECONDS" "$turn" "$(python3 -c "print($turn*0.2/60)")" "$1" >> "$OUT/frames.jsonl"
}

# --- camera plan ---------------------------------------------------------
if [ -n "$BIRDSEYE" ]; then
	xdotool key --clearmodifiers shift+Tab; sleep 0.7
fi
for i in $(seq 1 "$ZOOM"); do xdotool key --clearmodifiers minus; sleep 0.03; done
[ "$ZOOM" -gt 0 ] && sleep 1.5

click_map() { # $1 = u, $2 = v in 0..1
	local x y
	read -r x y < <(python3 - "$1" "$2" "$SW" "$SH" <<'PY'
import sys
u, v, W, H = map(float, sys.argv[1:5])
W, H = int(W), int(H)
# gui/session/session.xml: bottom bar 1024 px wide, minimap panel 200x204 at its
# left end; gui/session/minimap/MiniMap.xml insets the map object by 8,10.
x0, y0, s = W / 2 - 504, H - 194, 184
print(f"{x0 + s*u:.0f} {y0 + s*v:.0f}")
PY
)
	xdotool mousemove "$x" "$y"; sleep 0.2; xdotool click 1
}

n=0
if [ -n "$AUTO" ]; then
	# Aim at each player's base by finding that player's colour on the minimap
	# (tools/aim.py): the click->world transform rotates with the camera angle,
	# so clicking "the right fraction" is unreliable, clicking the base's own
	# minimap pixels is not.
	for pl in 1 2; do
		grim -s 0.5 -l 3 -g "0,0 ${SW}x${SH}" "$OUT/aim.png" 2>/dev/null || continue
		if xy=$(python3 "$REPO/tools/aim.py" "$OUT/aim.png" --screen "${SW}x${SH}" \
			--scale 0.5 --player "$pl" 2>"$OUT/aim.err"); then
			xdotool mousemove $xy; sleep 0.2; xdotool click 1
			n=$((n + 1))
			sleep "$PAUSE"
			shot "at_p${pl}"
			echo "viz.sh: camera -> player $pl base ($xy)"
		else
			echo "viz.sh: cannot find player $pl on the minimap:" >&2
			cat "$OUT/aim.err" >&2
		fi
	done
	rm -f "$OUT/aim.png" "$OUT/aim.err"
fi

for a in "${AT[@]:-}"; do
	[ -n "$a" ] || continue
	u=${a%%,*} v=${a##*,}
	click_map "$u" "$v"
	n=$((n + 1))
	sleep "$PAUSE"
	shot "at_${u}_${v}"
	echo "viz.sh: camera -> map ($u,$v), frame $n"
done

# --- capture -------------------------------------------------------------
if [ -n "$KEEP" ]; then
	echo "viz.sh: window $win left running (focus it, then xdotool key ...); kill $PID to stop"
	trap - EXIT
	exit 0
fi

start=$(date +%s)
while [ $(( $(date +%s) - start )) -lt "$WALL" ]; do
	elapsed=$(( $(date +%s) - start ))
	kill -0 $PID 2>/dev/null || { echo "viz.sh: replay finished after ${elapsed}s"; break; }
	if [ "$FPS" -gt 0 ]; then
		t0=$(date +%s%N)
		shot "t$(printf '%04d' "$elapsed")"
		# grim costs what it costs (0.2-1.5 s at 2560x1440); keep the cadence.
		wait_ns=$(( 1000000000 / FPS - ($(date +%s%N) - t0) ))
		[ "$wait_ns" -gt 20000000 ] && sleep "$(python3 -c "print($wait_ns/1e9)")"
	else
		sleep 1
	fi
done

kill $PID 2>/dev/null
trap - EXIT

# --- summary -------------------------------------------------------------
turns=$(grep -c 'Executing turn' "$OUT/viz.log")
total=$(sed -n 's/.*Executing turn [0-9]* of \([0-9]*\).*/\1/p' "$OUT/viz.log" | tail -1)
wall=$(( $(date +%s) - start ))
rate=$(python3 -c "t=$turns; w=max($wall,1); print(f'{t*0.2/60:.1f} game-min in {w}s = {t/w*0.2:.1f}x real time')")
echo "viz.sh: $turns${total:+/$total} turns — $rate"
echo "viz.sh: $(ls "$OUT/frames" | wc -l) frames in $OUT/frames"
log=$OUT/home/.local/state/0ad/log/mainlog.html
[ -f "$log" ] && grep -o 'with [0-9]* message(s).*' "$log" | tail -1
grep -c ERROR "$OUT/viz.log" | xargs -I{} echo "viz.sh: {} ERROR lines in viz.log"
echo "viz.sh: contact sheet -> tools/frames.py $OUT"
