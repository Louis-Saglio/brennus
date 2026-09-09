#!/bin/bash
# Wait until all jobs in jobs.tsv have a local result.json
cd "$(dirname "$0")"
total=$(wc -l < jobs.tsv)
for i in $(seq 1 480); do
  n=0
  while IFS=$'\t' read -r seed variant batch job; do
    sudo test -f "/var/lib/kiln/results/kimi-agent/$batch/$job/result.json" && n=$((n+1))
  done < jobs.tsv
  echo "$(date +%H:%M:%S) $n/$total done"
  [ "$n" -eq "$total" ] && exit 0
  sleep 15
done
exit 1
