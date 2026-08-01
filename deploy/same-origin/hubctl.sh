#!/usr/bin/env bash
# hubctl — 词元集市集合体：检查 / 打包 / 本地验收 统一入口
#
# 现实约束：
# - TokenBazaar 镜像 Dockerfile 已多阶段：pnpm build → go -tags embed（无需另写“生成前端”）
# - 缺的是 hub 构建参数 VITE_PRICEAI_PUBLIC_ORIGIN 与一键检查
# - PriceAI 走独立 CF/OpenNext 流水线，不打进 TB 镜像
#
# Usage:
#   ./deploy/same-origin/hubctl.sh check [--origin https://www.example.com]
#   ./deploy/same-origin/hubctl.sh build-tb [--origin URL] [--image|--binary] [--tag name]
#   ./deploy/same-origin/hubctl.sh check-pa          # PriceAI 仓存在时
#   ./deploy/same-origin/hubctl.sh package [--origin URL] [--tag name]  # check + build-tb --image
#   ./deploy/same-origin/hubctl.sh verify-local      # make hub-verify
#   ./deploy/same-origin/hubctl.sh ci                # make hub-ci
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PA_ROOT="$(cd "$ROOT/../PriceAI" 2>/dev/null && pwd || true)"
ORIGIN="${VITE_PRICEAI_PUBLIC_ORIGIN:-${PUBLIC_ORIGIN:-}}"
HOME_PATH="${VITE_PRICEAI_PUBLIC_HOME_PATH:-/}"
TAG="${IMAGE_TAG:-tokenbazaar:hub}"
MODE="image" # image | binary | dist

die() { echo "hubctl: $*" >&2; exit 1; }
log() { echo "hubctl: $*"; }

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \?//'
}

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

cmd_check() {
  log "check (no compile)"
  need_cmd node
  node "$ROOT/deploy/same-origin/check-route-map.mjs"

  # hub-contract sibling copy when PriceAI present
  if [[ -n "${PA_ROOT}" && -f "$PA_ROOT/src/lib/hub-contract.json" ]]; then
    if [[ -f "$ROOT/contracts/sync.mjs" ]]; then
      log "hub-contract sync check vs PriceAI"
      (cd "$ROOT" && node contracts/sync.mjs check) || die "hub-contract out of sync — run: make push-contract"
    fi
  else
    log "skip hub-contract cross-repo (PriceAI not found at $ROOT/../PriceAI)"
  fi

  if [[ -n "$ORIGIN" ]]; then
    log "origin check: $ORIGIN"
    case "$ORIGIN" in
      https://*|http://127.0.0.1:*|http://localhost:*) ;;
      http://*)
        echo "warning: non-local http origin in production is unusual: $ORIGIN" >&2
        ;;
      *)
        die "ORIGIN must be absolute URL, got: $ORIGIN"
        ;;
    esac
    # bare essentials files
    grep -q 'priceai_bridge' "$ROOT/deploy/config.example.yaml" || die "config.example.yaml missing priceai_bridge"
  else
    log "ORIGIN unset — OK for standalone TB; hub production requires --origin"
  fi

  # Dockerfile must accept hub build-arg
  if ! grep -q 'VITE_PRICEAI_PUBLIC_ORIGIN' "$ROOT/deploy/Dockerfile" && ! grep -q 'VITE_PRICEAI_PUBLIC_ORIGIN' "$ROOT/Dockerfile" 2>/dev/null; then
    die "Dockerfile missing VITE_PRICEAI_PUBLIC_ORIGIN build-arg"
  fi

  log "check OK"
}

cmd_check_pa() {
  [[ -n "$PA_ROOT" ]] || die "PriceAI repo not found next to TokenBazaar"
  log "check-pa in $PA_ROOT"
  need_cmd node
  (cd "$PA_ROOT" && npm run verify:hub-contract && npm run verify:headers && npm run test:tokenbazaar)
  if [[ -n "$ORIGIN" ]]; then
    log "remind: PA production env must set NEXT_PUBLIC_TOKENBAZAAR_ORIGIN=$ORIGIN and TOKENBAZAAR_API_ORIGIN=$ORIGIN"
  fi
  log "check-pa OK"
}

cmd_build_tb_dist() {
  need_cmd node
  log "build-tb dist (VITE_PRICEAI_PUBLIC_ORIGIN=${ORIGIN:-empty})"
  (
    cd "$ROOT/frontend"
    export VITE_PRICEAI_PUBLIC_ORIGIN="${ORIGIN}"
    export VITE_PRICEAI_PUBLIC_HOME_PATH="${HOME_PATH}"
    if command -v pnpm >/dev/null; then
      pnpm exec vite build
    else
      node node_modules/vite/bin/vite.js build
    fi
  )
  test -f "$ROOT/backend/internal/web/dist/index.html" || die "dist/index.html missing"
  test -f "$ROOT/backend/internal/web/dist/logo.svg" || die "dist/logo.svg missing"
  log "dist OK → backend/internal/web/dist"
}

cmd_build_tb_binary() {
  cmd_build_tb_dist
  need_cmd go
  log "build-tb binary (-tags embed)"
  (
    cd "$ROOT/backend"
    CGO_ENABLED=0 go build -tags embed \
      -ldflags="-s -w -X main.BuildType=release" \
      -o bin/server-embed \
      ./cmd/server
  )
  log "binary OK → backend/bin/server-embed"
}

cmd_build_tb_image() {
  need_cmd docker
  log "build-tb image tag=$TAG origin=${ORIGIN:-empty}"
  ORIGIN="$ORIGIN" VITE_PRICEAI_PUBLIC_HOME_PATH="$HOME_PATH" IMAGE_TAG="$TAG" \
    "$ROOT/deploy/build_image.sh" --origin "${ORIGIN}" --home-path "${HOME_PATH}" --tag "$TAG"
}

cmd_build_tb() {
  case "$MODE" in
    dist) cmd_build_tb_dist ;;
    binary) cmd_build_tb_binary ;;
    image) cmd_build_tb_image ;;
    *) die "unknown build mode: $MODE" ;;
  esac
}

cmd_package() {
  # Production packaging path for TB hub image + gates
  cmd_check
  if [[ -z "$ORIGIN" ]]; then
    die "package requires --origin (public hub URL), e.g. --origin https://www.example.com"
  fi
  MODE=image
  cmd_build_tb
  log "package OK — deploy image $TAG behind same-origin proxy (route-map.json)"
  log "next: configure priceai_bridge.return_origins += $ORIGIN and PA NEXT_PUBLIC_TOKENBAZAAR_ORIGIN"
}

cmd_verify_local() {
  (cd "$ROOT" && make hub-verify)
}

cmd_ci() {
  (cd "$ROOT" && make hub-ci)
}

# --- parse ---
[[ $# -ge 1 ]] || { usage; exit 2; }
CMD="$1"; shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --origin) ORIGIN="${2:-}"; shift 2 ;;
    --home-path) HOME_PATH="${2:-}"; shift 2 ;;
    --tag) TAG="${2:-}"; shift 2 ;;
    --image) MODE=image; shift ;;
    --binary) MODE=binary; shift ;;
    --dist) MODE=dist; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown arg: $1" ;;
  esac
done

case "$CMD" in
  check) cmd_check ;;
  check-pa) cmd_check_pa ;;
  build-tb) cmd_build_tb ;;
  package) cmd_package ;;
  verify-local|verify) cmd_verify_local ;;
  ci) cmd_ci ;;
  help|-h|--help) usage ;;
  *) die "unknown command: $CMD (try: check|package|build-tb|check-pa|verify-local|ci)" ;;
esac
