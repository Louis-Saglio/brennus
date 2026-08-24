#!/bin/sh
# fetch-kiln-artifacts <batch_id> <job_id> <destdir>
set -e
dest="$3"
mkdir -p "$dest"
sudo tar xzf "/var/lib/kiln/results/kimi-agent/$1/$2/artifacts.tar.gz" -C "$dest"
exec grep -E "HARNESS|DEFENSE|ERROR" "$dest/stdout.log"
