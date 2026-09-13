#!/bin/bash
# Wait until every job in jobs.tsv has a result.json on this host.
cd "$(dirname "$0")"
total=$(wc -l < jobs.tsv)
for i in $(seq 1 360); do
  n=0
  while read -r seed batch job; do
    [ -n "$job" ] && sudo test -f "/var/lib/kiln/results/kimi-agent/$batch/$job/result.json" && n=$((n+1))
  done < jobs.tsv
  echo "$(date +%H:%M:%S) $n/$total done"
  [ "$n" -eq "$total" ] && exit 0
  sleep 30
done
exit 1
