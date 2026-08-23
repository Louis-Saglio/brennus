#!/bin/bash
# Headless match runner for Brennus experiments.
#
# Usage: run.sh [options] <moddir> <outdir> <tag=seed>...
#
# Each pair runs one match: brennus (from a fresh copy of <moddir>) vs a
# sandbox Petra, isolated HOME under <outdir>/<tag>, stdout+stderr to
# <outdir>/<tag>/stdout.log. Engine logs and the end-of-game statistics
# JSON land inside <outdir>/<tag>/home/.local/state/0ad/.
#
# Options:
#   -t SEC   wall-clock timeout per match (default 300)
#   -p N     parallel matches (default: number of CPU cores)
#   -m MAP   autostart map (default random/mainland)
#   -b BIOME autostart biome (default generic/temperate)
#   -l MIN   override the mod's time-limit trigger minutes
#            (sed on maps/scripts/NonVisualTrigger.js in the copied mod)
#
# Examples:
#   run.sh bot tmp/goal9 seed1=1 seed2=2 ... seed5=5 seed1-rerun=1
#   run.sh -t 60 bot tmp/goal9 probe=1
#   run.sh -b generic/steppe -l 30 bot tmp/steppe s1=1 s2=2
set -u

TIMEOUT=300
JOBS=${JOBS:-$(nproc)}
MAP=random/mainland
BIOME=generic/temperate
LIMIT=""

while getopts "t:p:m:b:l:" opt; do
	case $opt in
		t) TIMEOUT=$OPTARG ;;
		p) JOBS=$OPTARG ;;
		m) MAP=$OPTARG ;;
		b) BIOME=$OPTARG ;;
		l) LIMIT=$OPTARG ;;
		*) exit 2 ;;
	esac
done
shift $((OPTIND - 1))
[ $# -ge 3 ] || { echo "usage: run.sh [options] <moddir> <outdir> <tag=seed>..." >&2; exit 2; }

MODDIR=$1
OUTDIR=$2
shift 2
PAIRS=("$@")
mkdir -p "$OUTDIR"

run_one() {
	local pair=$1
	local tag=${pair%%=*} seed=${pair##*=}
	local home="$OUTDIR/$tag/home"
	rm -rf "$OUTDIR/$tag"
	mkdir -p "$home/.local/share/0ad/mods"
	cp -r "$MODDIR" "$home/.local/share/0ad/mods/brennus"
	if [ -n "$LIMIT" ] && [ -f "$home/.local/share/0ad/mods/brennus/maps/scripts/NonVisualTrigger.js" ]; then
		sed -i "s/cmpTrigger.timeLimitMinutes = [0-9]*;/cmpTrigger.timeLimitMinutes = $LIMIT;/" \
			"$home/.local/share/0ad/mods/brennus/maps/scripts/NonVisualTrigger.js"
	fi
	HOME=$home timeout "$TIMEOUT" /usr/games/pyrogenesis \
		-autostart="$MAP" -autostart-seed="$seed" \
		-autostart-biome="$BIOME" -autostart-placement=circle \
		-autostart-nonvisual -autostart-players=2 -autostart-size=192 \
		-autostart-victory=conquest_civic_centers \
		-autostart-ai=1:brennus -autostart-ai=2:petra -autostart-aidiff=2:0 \
		-autostart-civ=1:gaul -autostart-civ=2:rome -autostart-player=-1 \
		-unique-logs -nosound -mod=public -mod=brennus \
		> "$OUTDIR/$tag/stdout.log" 2>&1
	echo "tag=$tag seed=$seed exit=$?"
}
export -f run_one
export TIMEOUT OUTDIR MODDIR MAP BIOME LIMIT
printf '%s\n' "${PAIRS[@]}" | xargs -P "$JOBS" -I{} bash -c 'run_one "$1"' _ {}
