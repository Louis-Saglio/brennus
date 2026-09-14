#!/bin/sh
# Wait until every job in jobs-base.tsv + jobs-tweak.tsv has a result.json.
# Exits 0 when all landed, 1 on timeout (the enclosing task has one).
cd "$(dirname "$0")"
while :; do
    n=0
    for f in jobs-base.tsv jobs-tweak.tsv; do
        while read -r seed batch job; do
            [ -n "$seed" ] && sudo test -f "/var/lib/kiln/results/kimi-agent/$batch/$job/result.json" && n=$((n+1))
        done < "$f"
    done
    [ "$n" -ge 400 ] && { echo "all 400 results landed"; exit 0; }
    sleep 60
done
