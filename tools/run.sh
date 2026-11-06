#!/bin/bash
# Headless match runner: the standard Brennus match (AGENTS.md) through the
# documented pyrogenesis command line (docs/pyrogenesis_cli.md §3).
#
# Usage: tools/run.sh [options] <outdir> <seed | tag=seed>...
#
# Each argument runs one match; a bare seed N is tagged seedN. Default
# match: brennus (gaul, diff 3, aggressive, team 1) vs petra (rome, diff 3,
# aggressive, team 2), random/mainland 192, generic/temperate, circle,
# conquest_civic_centers, observer, aiseed = seed. The mod's own
# maps/scripts/NonVisualTrigger.js ends the game at 45 in-game minutes.
#
# The mod directory is snapshotted once into <outdir>/mod/ (provenance in
# <outdir>/batch.txt), so editing bot/ while a batch runs cannot leak into
# it. Matches run under nice/ionice in isolated HOMEs, locally (-j) and
# optionally on other hosts over ssh (-H; a host needs the same 0ad and
# 0ad-data packages and mains power, else it is skipped). Per match:
#   <outdir>/<tag>/stdout.log    engine stdout+stderr: telemetry, stats JSON
#   <outdir>/<tag>/result.json   host, exit code, wall seconds, turns
#   <outdir>/<tag>/home/         engine logs + replay (engine cache dropped)
# then tools/analyze.py summarizes the batch.
#
# Options:
#   -m DIR     mod directory to test (default: this repo's bot/)
#   -j N       local parallel matches (default 12)
#   -H HOST:N  also run up to N matches on HOST over ssh (repeatable)
#   -t SEC     wall-clock cap per match (default 1800)
#   -l MIN     in-game time limit in minutes (default: the mod's, 45)
#   -a AI      AI of player 1 (default brennus)
#   -d DIFF    opponent Petra difficulty 0-5 (default 3)
#   -v BEHAV   opponent Petra behavior (default aggressive)
#   -c CIV     opponent civ (default rome)
#   -M MAP     map (default random/mainland)
#   -b BIOME   biome (default generic/temperate)
#   -s SPEED   record the match with -autostart-speed=SPEED (default: unset, i.e.
#              the engine's 1x). No effect on a headless sim — it only lands in
#              the replay's init attributes, so the recorded match plays back at
#              that speed under `-replay-visual` (tools/viz.sh). 20 is the max.
#
# Examples:
#   tools/run.sh tmp/probe 7 23 51                  # 3-seed probe, 12 local slots
#   tools/run.sh -H thinkpad:4 tmp/val 1 2 3 4 5    # + 4 slots on the thinkpad
#   tools/run.sh -m tmp/ab/bot tmp/ab/tweak 1 2 3   # A/B: run a modified copy
set -u

REPO=$(cd "$(dirname "$0")/.." && pwd)
MODDIR=$REPO/bot
JOBS=12
HOSTS=()
WALL=1800
LIMIT=""
AI=brennus
DIFF=3
BEHAV=aggressive
CIV=rome
MAP=random/mainland
BIOME=generic/temperate
SPEED=""

usage() { sed -n '2,/^set -u/{/^set -u/d;s/^# \{0,1\}//;p}' "$0" >&2; exit 2; }

while getopts "m:j:H:t:l:a:d:v:c:M:b:s:h" opt; do
	case $opt in
		m) MODDIR=$OPTARG ;;
		j) JOBS=$OPTARG ;;
		H) HOSTS+=("$OPTARG") ;;
		t) WALL=$OPTARG ;;
		l) LIMIT=$OPTARG ;;
		a) AI=$OPTARG ;;
		d) DIFF=$OPTARG ;;
		v) BEHAV=$OPTARG ;;
		c) CIV=$OPTARG ;;
		M) MAP=$OPTARG ;;
		b) BIOME=$OPTARG ;;
		s) SPEED=$OPTARG ;;
		*) usage ;;
	esac
done
shift $((OPTIND - 1))
[ $# -ge 2 ] || usage
[ -f "$MODDIR/mod.json" ] || { echo "run.sh: no mod.json in $MODDIR" >&2; exit 2; }
command -v pyrogenesis >/dev/null || { echo "run.sh: pyrogenesis not in PATH" >&2; exit 2; }

mkdir -p "$1"
OUTDIR=$(cd "$1" && pwd)
shift
PAIRS=("$@")

# Snapshot the mod; the in-game limit override only touches the snapshot.
rm -rf "$OUTDIR/mod"
cp -r "$MODDIR" "$OUTDIR/mod"
if [ -n "$LIMIT" ]; then
	sed -i "s/cmpTrigger.timeLimitMinutes = [0-9]*;/cmpTrigger.timeLimitMinutes = $LIMIT;/" \
		"$OUTDIR/mod/maps/scripts/NonVisualTrigger.js"
fi

# Slots: local first, then every usable remote host.
BUILD=$(pacman -Q 0ad 0ad-data 2>/dev/null | tr '\n' ' ')
SLOTS=""
for i in $(seq 1 "$JOBS"); do SLOTS+="local:$i "; done
for h in "${HOSTS[@]}"; do
	name=${h%%:*} n=${h#*:}
	probe=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$name" \
		'pacman -Q 0ad 0ad-data 2>/dev/null | tr "\n" " "; echo; cat /sys/class/power_supply/A*/online 2>/dev/null | sort -r | head -1' 2>/dev/null)
	rbuild=$(sed -n 1p <<<"$probe") ac=$(sed -n 2p <<<"$probe")
	if [ -z "$probe" ]; then
		echo "run.sh: WARNING $name unreachable, skipped" >&2
	elif [ "$rbuild" != "$BUILD" ]; then
		echo "run.sh: WARNING $name runs '$rbuild', not '$BUILD', skipped" >&2
	elif [ "$ac" = 0 ]; then
		echo "run.sh: WARNING $name is on battery, skipped" >&2
	else
		for i in $(seq 1 "$n"); do SLOTS+="$name:$i "; done
	fi
done
NSLOTS=$(wc -w <<<"$SLOTS")
mkdir -p "$OUTDIR/.slots"

{
	echo "date: $(date -Iseconds)"
	echo "moddir: $MODDIR"
	if git -C "$MODDIR" rev-parse --git-dir >/dev/null 2>&1; then
		dirty=$(git -C "$MODDIR" status --porcelain -- . | head -1)
		echo "commit: $(git -C "$MODDIR" rev-parse HEAD)${dirty:+ (dirty)}"
	fi
	echo "content: $(cd "$OUTDIR/mod" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-16)"
	echo "build: $BUILD"
	echo "match: $MAP $BIOME 192 circle conquest_civic_centers | $AI gaul 3 aggressive vs petra $CIV $DIFF $BEHAV | limit ${LIMIT:-mod default} | wall ${WALL}s | record-speed ${SPEED:-1}"
	echo "slots: $SLOTS"
} > "$OUTDIR/batch.txt"

# The remote half of a match: mod tarball on stdin, artifacts tarball on
# stdout. Shipped base64-encoded so no quoting has to survive the remote
# login shell.
REMOTE=$(base64 -w0 <<'EOF'
wall=$1; shift
d=$(mktemp -d /tmp/brennus-run.XXXXXX) || exit 1
trap 'rm -rf "$d"' EXIT
mkdir -p "$d/home/.local/share/0ad/mods/brennus"
tar -xf - -C "$d/home/.local/share/0ad/mods/brennus"
cd "$d" || exit 1
HOME=$d/home XDG_DATA_HOME=$d/home/.local/share XDG_CONFIG_HOME=$d/home/.config \
XDG_CACHE_HOME=$d/home/.cache XDG_STATE_HOME=$d/home/.local/state \
	timeout --signal=TERM --kill-after=30 "$wall" nice -n 10 ionice -c 3 \
	pyrogenesis "$@" < /dev/null > stdout.log 2>&1
echo $? > exit_code
rm -rf home/.cache home/.local/share/0ad/mods
tar -cf - stdout.log exit_code home
EOF
)

run_match() {
	local host=$1 tag=$2 seed=$3
	local dir=$OUTDIR/$tag start=$SECONDS rc turns
	local args=(
		-autostart="$MAP" -autostart-seed="$seed" -autostart-aiseed="$seed"
		-autostart-biome="$BIOME" -autostart-placement=circle
		-autostart-nonvisual -autostart-players=2 -autostart-size=192
		-autostart-victory=conquest_civic_centers
		-autostart-ai=1:"$AI" -autostart-aidiff=1:3 -autostart-aibehavior=1:aggressive
		-autostart-civ=1:gaul -autostart-team=1:1
		-autostart-ai=2:petra -autostart-aidiff=2:"$DIFF" -autostart-aibehavior=2:"$BEHAV"
		-autostart-civ=2:"$CIV" -autostart-team=2:2
		-autostart-player=-1 -unique-logs -nosound -mod=public -mod=brennus
	)
	# Viz recordings: gameSpeed only lands in the replay's init attributes
	# (nonvisual sims ignore it), so the recorded match can be replayed
	# visually at that speed.
	[ -n "$SPEED" ] && args+=(-autostart-speed="$SPEED")
	rm -rf "$dir"
	mkdir -p "$dir"
	if [ "$host" = local ]; then
		mkdir -p "$dir/home/.local/share/0ad/mods"
		cp -r "$OUTDIR/mod" "$dir/home/.local/share/0ad/mods/brennus"
		(cd "$dir" && HOME=$dir/home XDG_DATA_HOME=$dir/home/.local/share \
			XDG_CONFIG_HOME=$dir/home/.config XDG_CACHE_HOME=$dir/home/.cache \
			XDG_STATE_HOME=$dir/home/.local/state \
			timeout --signal=TERM --kill-after=30 "$WALL" nice -n 10 ionice -c 3 \
			pyrogenesis "${args[@]}" < /dev/null > "$dir/stdout.log" 2>&1)
		rc=$?
		rm -rf "$dir/home/.cache" "$dir/home/.local/share/0ad/mods"
	else
		tar -C "$OUTDIR/mod" -cf - . |
			ssh -o BatchMode=yes -o ConnectTimeout=10 "$host" \
				"bash -c \"\$(echo $REMOTE | base64 -d)\" _ $WALL ${args[*]}" |
			tar -xf - -C "$dir"
		rc=$(cat "$dir/exit_code" 2>/dev/null || echo 255)
		rm -f "$dir/exit_code"
	fi
	turns=$(grep -a '^Turn ' "$dir/stdout.log" 2>/dev/null | tail -1 | cut -d' ' -f2)
	printf '{"tag": "%s", "seed": %s, "host": "%s", "exit_code": %s, "wall_seconds": %s, "turns": %s}\n' \
		"$tag" "$seed" "$host" "$rc" "$((SECONDS - start))" "${turns:-0}" > "$dir/result.json"
	echo "$tag seed=$seed host=$host exit=$rc wall=$((SECONDS - start))s turns=${turns:-0}"
}

# One xargs worker per slot; each match takes the first free slot.
run_one() {
	local pair=$1 tag seed slot fd
	case $pair in
		*=*) tag=${pair%%=*} seed=${pair##*=} ;;
		*) tag=seed$pair seed=$pair ;;
	esac
	for slot in $SLOTS; do
		exec {fd}>"$OUTDIR/.slots/$slot"
		if flock -n "$fd"; then
			run_match "${slot%%:*}" "$tag" "$seed"
			exec {fd}>&-
			return
		fi
		exec {fd}>&-
	done
	echo "$tag seed=$seed: no free slot" >&2
}
export -f run_match run_one
export OUTDIR SLOTS REMOTE WALL AI DIFF BEHAV CIV MAP BIOME SPEED

echo "run.sh: ${#PAIRS[@]} matches on $NSLOTS slots -> $OUTDIR"
printf '%s\n' "${PAIRS[@]}" | xargs -P "$NSLOTS" -I{} bash -c 'run_one "$1"' _ {}
rm -rf "$OUTDIR/.slots"
tags=()
for p in "${PAIRS[@]}"; do
	case $p in *=*) tags+=("${p%%=*}") ;; *) tags+=("seed$p") ;; esac
done
python3 "$REPO/tools/analyze.py" "$OUTDIR" "${tags[@]}"
