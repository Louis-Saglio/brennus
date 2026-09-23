#!/bin/bash
# Exit 0 when all jobs in jobs.tsv have a result.json; exit 1 on timeout (~5.5h).
# Prints progress on every change so the wait is visible, not silent.
cd "$(dirname "$0")"
total=$(grep -c . jobs.tsv)
last=-1
for i in $(seq 1 1320); do
  n=0
  while read -r seed batch job kind; do
    [ -n "$batch" ] && sudo test -f "/var/lib/kiln/results/kimi-agent/$batch/$job/result.json" && n=$((n+1))
  done < jobs.tsv
  if [ "$n" != "$last" ]; then
    echo "[watch] $n/$total results landed ($(date +%H:%M:%S))"
    last=$n
  fi
  if [ "$n" -ge "$total" ]; then echo "all $total results landed"; exit 0; fi
  sleep 15
done
echo "timeout waiting for results"; exit 1
