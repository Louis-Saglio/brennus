#!/bin/sh
# Waits until every job in jobs.tsv has a result.json on the local kiln results dir.
cd "$(dirname "$0")"
total=$(wc -l < jobs.tsv)
for i in $(seq 1 720); do
  n=0
  while read -r seed batch job; do
    sudo test -f "/var/lib/kiln/results/kimi-agent/$batch/$job/result.json" && n=$((n+1))
  done < jobs.tsv
  echo "$(date +%H:%M:%S) $n/$total done"
  [ "$n" -eq "$total" ] && exit 0
  sleep 15
done
exit 1
