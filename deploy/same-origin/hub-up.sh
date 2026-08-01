#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOGDIR="${HOME}/Library/Logs/tokenbazaar-hub"
PLIST="${HOME}/Library/LaunchAgents/com.tokenbazaar.hub-supervisor.plist"
LABEL="gui/$(id -u)/com.tokenbazaar.hub-supervisor"
HUB="http://127.0.0.1:9080"
DIST="$ROOT/backend/internal/web/dist"
CADDYFILE="$ROOT/deploy/same-origin/Caddyfile.local"
NODE="${NODE_BIN:-/opt/homebrew/bin/node}"
mkdir -p "$LOGDIR"

echo "== hub-up (L2: Next + API + built SPA + Caddy) =="

# 1) Ensure SPA dist
if [[ ! -f "$DIST/index.html" || ! -f "$DIST/logo.svg" ]]; then
  echo "-- building frontend dist --"
  (cd "$ROOT/frontend" && "$NODE" node_modules/vite/bin/vite.js build) | tail -20
fi
if [[ ! -f "$DIST/index.html" ]]; then
  echo "ERROR: missing $DIST/index.html — run: make hub-build"
  exit 1
fi
echo "  ok  dist $(ls -la "$DIST/index.html" | awk '{print $5,$6,$7,$8,$9}')"

# 2) Ensure API + Next quickly (even before supervisor)
if ! curl -sf --max-time 1 -o /dev/null http://127.0.0.1:8081/api/v1/settings/public; then
  echo "-- start api --"
  (cd "$ROOT/backend" && DATA_DIR="${DATA_DIR:-$ROOT/deploy/data}" nohup ./bin/server >>"$LOGDIR/api.out.log" 2>>"$LOGDIR/api.err.log" & echo $! >"$LOGDIR/api.pid")
fi
if ! curl -sf --max-time 1 -o /dev/null http://127.0.0.1:3000/; then
  echo "-- start next --"
  (cd /Users/tinker/src/fuye/PriceAI && nohup "$NODE" node_modules/next/dist/bin/next dev --webpack -H 0.0.0.0 -p 3000 >>"$LOGDIR/next.out.log" 2>>"$LOGDIR/next.err.log" & echo $! >"$LOGDIR/next.pid")
fi

# 3) Ensure single Caddy with current config (prefer `caddy start` daemon)
echo "-- reload caddy --"
if curl -sf --max-time 1 -o /dev/null http://127.0.0.1:2019/config/ 2>/dev/null; then
  # admin up: load new config without killing daemon wrongly
  /opt/homebrew/bin/caddy reload --config "$CADDYFILE" 2>>"$LOGDIR/caddy.err.log" || true
else
  /opt/homebrew/bin/caddy stop 2>/dev/null || true
  pkill -f 'Caddyfile.local' 2>/dev/null || true
  sleep 0.3
  if ! /opt/homebrew/bin/caddy start --config "$CADDYFILE" >>"$LOGDIR/caddy.out.log" 2>>"$LOGDIR/caddy.err.log"; then
    nohup /opt/homebrew/bin/caddy run --config "$CADDYFILE" >>"$LOGDIR/caddy.out.log" 2>>"$LOGDIR/caddy.err.log" &
    echo $! >"$LOGDIR/caddy.pid"
  fi
fi
sleep 0.5

# 4) Supervisor for KeepAlive
if [[ -f "$PLIST" ]]; then
  if ! launchctl print "$LABEL" >/dev/null 2>&1; then
    launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  fi
  # do not kickstart -k (kills healthy children race); only start if absent
  if ! pgrep -f hub-supervisor.sh >/dev/null 2>&1; then
    launchctl kickstart "$LABEL" 2>/dev/null || true
  fi
  echo "  supervisor ok"
fi

echo "-- health --"
ok=0
for i in $(seq 1 40); do
  a=0;n=0;h=0;l=0;logo=0;apihub=0
  curl -sf --max-time 1 -o /dev/null http://127.0.0.1:8081/api/v1/settings/public && a=1 || true
  curl -sf --max-time 1 -o /dev/null http://127.0.0.1:3000/ && n=1 || true
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "$HUB/" 2>/dev/null || echo 0)
  [[ "$code" == "200" ]] && h=1 || true
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "$HUB/login" 2>/dev/null || echo 0)
  [[ "$code" == "200" ]] && l=1 || true
  # logo must be image/svg
  ct=$(curl -sS -D- -o /tmp/hub-logo.svg --max-time 2 "$HUB/logo.svg" 2>/dev/null | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2; exit}')
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "$HUB/logo.svg" 2>/dev/null || echo 0)
  [[ "$code" == "200" && "$ct" == *svg* ]] && logo=1 || true
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "$HUB/api/v1/settings/public" 2>/dev/null || echo 0)
  [[ "$code" == "200" ]] && apihub=1 || true
  echo "  try $i api=$a next=$n hub=$h login=$l logo=$logo apihub=$apihub ct=${ct:-}"
  if [[ "$a$n$h$l$logo$apihub" == "111111" ]]; then ok=1; break; fi
  sleep 1
done

if [[ "$ok" != "1" ]]; then
  echo "ERROR: hub not green"
  tail -20 "$LOGDIR/supervisor.log" 2>/dev/null || true
  tail -15 "$LOGDIR/caddy.err.log" 2>/dev/null || true
  exit 1
fi

# sanity: login HTML is SPA not PriceAI
if curl -sS "$HUB/login" | grep -q 'hub proxy error'; then
  echo "ERROR: login still 502"
  exit 1
fi

echo
echo "Hub L2 ready → $HUB"
echo "  (Vite :5173 not required)"
echo "  login:    $HUB/login"
echo "  logo:     $HUB/logo.svg"
echo "  console:  $HUB/console"
echo "  detector: $HUB/api-transit/detector"
