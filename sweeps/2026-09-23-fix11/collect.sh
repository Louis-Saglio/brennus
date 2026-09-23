#!/bin/bash
# Emit results.tsv (seed result game_min js_errors kind) from jobs.tsv.
# WIN requires: no "time limit reached" AND Petra CCs destroyed (or Petra
# playerState=defeated — the enemyBuildingsDestroyed counter can miss the
# credited kill, fix7-s140).
cd "$(dirname "$0")"
printf 'seed\tresult\tgame_min\tjs_errors\tkind\n' > results.tsv
tail -n +2 jobs.tsv | while read -r seed batch job kind; do
  rj="/var/lib/kiln/results/kimi-agent/$batch/$job/result.json"
  art="artifacts/s$seed"
  mkdir -p "$art"
  [ -f "$art/stats.json" ] || sudo tar xzf "/var/lib/kiln/results/kimi-agent/$batch/$job/artifacts.tar.gz" -C "$art" 2>/dev/null
  mins=$(sudo jq -r '(.turn_count // 0) / 300 * 10 | round / 10' "$rj" 2>/dev/null)
  js=$(grep -cE "JavaScript error|uncaught|error:" "$art/stdout.log" 2>/dev/null | head -1)
  tl=$(grep -c "time limit reached" "$art/stdout.log" 2>/dev/null | head -1)
  if [ "${tl:-0}" -ge 1 ]; then
    res=timeout
  elif [ -f "$art/stats.json" ]; then
    cc=$(jq '[.[0].statistics.enemyBuildingsDestroyed.CivCentre // 0, .[1].statistics.buildingsLost.CivCentre // 0] | max' "$art/stats.json" 2>/dev/null)
    p2=$(jq -r '.[1].playerState // empty' "$art/stats.json" 2>/dev/null)
    if [ "${cc:-0}" -ge 1 ] || [ "$p2" = "defeated" ]; then res=win; else res=defeat; fi
  else
    res=missing
  fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$seed" "$res" "$mins" "${js:-?}" "$kind" >> results.tsv
done
cat results.tsv
