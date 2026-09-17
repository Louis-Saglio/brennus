#!/bin/sh
# Waits until all jobs in jobs.tsv have a local result.json. Exit 0 = all landed, 1 = timeout.
dir=$(dirname "$0")
total=$(wc -l < "$dir/jobs.tsv")
for i in $(seq 1 720); do
  n=0
  while read -r seed batch job; do
    sudo test -f "/var/lib/kiln/results/kimi-agent/$batch/$job/result.json" && n=$((n+1))
  done < "$dir/jobs.tsv"
  [ "$n" -ge "$total" ] && exit 0
  sleep 15
done
exit 1
