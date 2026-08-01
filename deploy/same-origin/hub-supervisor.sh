#!/usr/bin/env bash
# Hub L2 supervisor: Next :3000 + API :8081 + Caddy :9080
# TB UI is built SPA under backend/internal/web/dist (no Vite required).
set -u
ROOT="/Users/tinker/src/fuye/TokenBazaar"
PA="/Users/tinker/src/fuye/PriceAI"
DATA_DIR="${DATA_DIR:-$ROOT/deploy/data}"
LOGDIR="${HOME}/Library/Logs/tokenbazaar-hub"
CADDYFILE="$ROOT/deploy/same-origin/Caddyfile.local"
DIST="$ROOT/backend/internal/web/dist"
NODE="${NODE_BIN:-/opt/homebrew/bin/node}"
CADDY_BIN="${CADDY_BIN:-/opt/homebrew/bin/caddy}"
LOCK="$LOGDIR/supervisor.lock"
mkdir -p "$LOGDIR"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date '+%F %T') another supervisor holds lock; exit" >>"$LOGDIR/supervisor.log"
  exit 0
fi

up() { curl -sf --max-time 1 -o /dev/null "$1"; }
listening() { lsof -tiTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

ensure_dist() {
  if [[ -f "$DIST/index.html" && -f "$DIST/logo.svg" ]]; then
    return 0
  fi
  echo "$(date '+%F %T') building frontend dist" >>"$LOGDIR/supervisor.log"
  (
    cd "$ROOT/frontend"
    # vite-only build is enough for hub verify (typecheck optional)
    nohup "$NODE" node_modules/vite/bin/vite.js build >>"$LOGDIR/build.out.log" 2>>"$LOGDIR/build.err.log"
  )
}

start_api() {
  if up "http://127.0.0.1:8081/api/v1/settings/public" || listening 8081; then return 0; fi
  echo "$(date '+%F %T') start api" >>"$LOGDIR/supervisor.log"
  (
    cd "$ROOT/backend"
    export DATA_DIR
    nohup ./bin/server >>"$LOGDIR/api.out.log" 2>>"$LOGDIR/api.err.log" &
    echo $! >"$LOGDIR/api.pid"
  )
}

start_next() {
  if up "http://127.0.0.1:3000/" || listening 3000; then return 0; fi
  echo "$(date '+%F %T') start next" >>"$LOGDIR/supervisor.log"
  (
    cd "$PA"
    nohup "$NODE" node_modules/next/dist/bin/next dev --webpack -H 0.0.0.0 -p 3000 \
      >>"$LOGDIR/next.out.log" 2>>"$LOGDIR/next.err.log" &
    echo $! >"$LOGDIR/next.pid"
  )
}

start_caddy() {
  if listening 9080; then return 0; fi
  echo "$(date '+%F %T') start caddy" >>"$LOGDIR/supervisor.log"
  nohup "$CADDY_BIN" run --config "$CADDYFILE" >>"$LOGDIR/caddy.out.log" 2>>"$LOGDIR/caddy.err.log" &
  echo $! >"$LOGDIR/caddy.pid"
}

reload_caddy_if_needed() {
  # If caddy running but config file newer than process start — kick soft reload via admin
  # Best-effort: admin load
  if ! listening 9080; then return 0; fi
  if ! listening 2019; then return 0; fi
  # no-op default; hub-up will restart caddy when switching modes
  return 0
}

echo "$(date '+%F %T') supervisor L2 start pid=$$" >>"$LOGDIR/supervisor.log"
ensure_dist
start_api
start_next
for _ in $(seq 1 20); do
  up "http://127.0.0.1:3000/" && up "http://127.0.0.1:8081/api/v1/settings/public" && break
  sleep 1
done
start_caddy

while true; do
  ensure_dist
  start_api
  start_next
  start_caddy
  sleep 5
done
