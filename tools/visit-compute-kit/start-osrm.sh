#!/usr/bin/env bash
# Operator-owned host only. Docker must already be installed and accessible.
set -euo pipefail
if [[ $# != 4 ]]; then
  echo 'Usage: bash start-osrm.sh IMAGE_AT_SHA256 DATA_DIRECTORY GRAPH_BASENAME PORT' >&2; exit 2
fi
image="$1"; directory="$2"; base="$3"; port="$4"
[[ "$image" =~ ^ghcr\.io/project-osrm/osrm-backend@sha256:[a-f0-9]{64}$ ]] || { echo PINNED_OFFICIAL_IMAGE_REQUIRED >&2; exit 2; }
[[ "$base" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,60}$ ]] || { echo GRAPH_BASENAME_INVALID >&2; exit 2; }
[[ "$port" =~ ^[0-9]{4,5}$ ]] && ((10#$port >= 1024 && 10#$port <= 65535)) || { echo PORT_INVALID >&2; exit 2; }
directory="$(cd -- "$directory" && pwd -P)"
[[ "$directory" != *','* ]] || { echo DATA_PATH_COMMA_DENIED >&2; exit 2; }
for extension in partition cells cell_metrics; do
  [[ -f "$directory/$base.osrm.$extension" ]] || { echo MLD_GRAPH_INCOMPLETE >&2; exit 2; }
done
# No implicit image pull and no public listener. Foreground stop releases only this container.
docker image inspect "$image" >/dev/null
exec docker run --rm --pull=never --name "nyales-osrm-$port" \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --publish "127.0.0.1:$port:5000" \
  --mount "type=bind,source=$directory,target=/data,readonly" \
  "$image" osrm-routed --algorithm mld "/data/$base.osrm"
