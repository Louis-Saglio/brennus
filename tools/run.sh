#!/bin/bash
# Headless match runner for Brennus experiments.
#
# Usage: run.sh [options] <moddir> <outdir> <tag=seed>...
#
# Each pair runs one match: the selected AI (from a fresh copy of <moddir>,
# installed as the "brennus" mod) vs a sandbox Petra, isolated HOME under
# <outdir>/<tag>, stdout+stderr to <outdir>/<tag>/stdout.log. Engine logs
# and the end-of-game statistics JSON land inside
# <outdir>/<tag>/home/.local/state/0ad/.
#
# Options:
#   -a AI    AI script to play (default brennus)
#   -t SEC   wall-clock timeout per match (default 300)
#   -p N     parallel matches (default: number of CPU cores)
#   -m MAP   autostart map (default random/mainland)
#   -b BIOME autostart biome (default generic/temperate)
#   -l MIN   override the mod's time-limit trigger minutes
#            (sed on maps/scripts/NonVisualTrigger.js in the copied mod)
#   -d DIFF  opponent Petra difficulty 0-5 (default 0 = sandbox)
#   -v BEHAV opponent Petra behaviour, e.g. defensive (default: engine
#            autostart default "balanced"; flag omitted)
#
# Examples:
#   run.sh bot tmp/run seed1=1 seed2=2 ... seed5=5 seed1-rerun=1
#   run.sh -a brennus -t 60 bot tmp/run probe=1
#   run.sh -b generic/steppe -l 30 bot tmp/steppe s1=1 s2=2
#   run.sh -a brennus \
#     -d 3 -v defensive bot tmp/run s1=1
set -u

AI=brennus
TIMEOUT=300
JOBS=${JOBS:-$(nproc)}
MAP=random/mainland
BIOME=generic/temperate
LIMIT=""
DIFF=0
BEHAV=""

while getopts "a:t:p:m:b:l:d:v:" opt; do
	case $opt in
		a) AI=$OPTARG ;;
		t) TIMEOUT=$OPTARG ;;
		p) JOBS=$OPTARG ;;
		m) MAP=$OPTARG ;;
		b) BIOME=$OPTARG ;;
		l) LIMIT=$OPTARG ;;
		d) DIFF=$OPTARG ;;
		v) BEHAV=$OPTARG ;;
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
		-autostart-ai=1:"$AI" -autostart-ai=2:petra -autostart-aidiff=2:"$DIFF" ${BEHAV:+-autostart-aibehavior=2:"$BEHAV"} \
		-autostart-civ=1:gaul -autostart-civ=2:rome -autostart-player=-1 \
		-unique-logs -nosound -mod=public -mod=brennus \
		> "$OUTDIR/$tag/stdout.log" 2>&1
	echo "tag=$tag seed=$seed exit=$?"
}
export -f run_one
export TIMEOUT OUTDIR MODDIR MAP BIOME LIMIT AI DIFF BEHAV
printf '%s\n' "${PAIRS[@]}" | xargs -P "$JOBS" -I{} bash -c 'run_one "$1"' _ {}
