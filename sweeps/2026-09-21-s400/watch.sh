#!/bin/bash
# Exit 0 when all jobs in jobs.tsv have a result.json; exit 1 on timeout (~5.5h).
cd "$(dirname "$0")"
total=$(wc -l < jobs.tsv)
for i in $(seq 1 1320); do
  n=0
  while read -r seed batch job; do
    [ -n "$batch" ] && sudo test -f "/var/lib/kiln/results/kimi-agent/$batch/$job/result.json" && n=$((n+1))
  done < jobs.tsv
  if [ "$n" -ge "$total" ]; then echo "all $total results landed"; exit 0; fi
  sleep 15
done
echo "timeout waiting for results"; exit 1
