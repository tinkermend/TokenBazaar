#!/usr/bin/env bash
# Build TokenBazaar (sub2api) production image with embedded SPA.
# Hub same-origin: pass VITE_PRICEAI_PUBLIC_ORIGIN so the console knows the portal.
#
# Usage:
#   ./deploy/build_image.sh
#   VITE_PRICEAI_PUBLIC_ORIGIN=https://www.example.com ./deploy/build_image.sh
#   ./deploy/build_image.sh --origin https://www.example.com --tag tokenbazaar:hub
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TAG="${IMAGE_TAG:-sub2api:latest}"
ORIGIN="${VITE_PRICEAI_PUBLIC_ORIGIN:-}"
HOME_PATH="${VITE_PRICEAI_PUBLIC_HOME_PATH:-/}"
DOCKERFILE="${REPO_ROOT}/deploy/Dockerfile"
# Prefer root Dockerfile if that's what historical scripts used
if [[ -f "${REPO_ROOT}/Dockerfile" ]]; then
  DOCKERFILE="${REPO_ROOT}/Dockerfile"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --origin) ORIGIN="${2:-}"; shift 2 ;;
    --home-path) HOME_PATH="${2:-}"; shift 2 ;;
    --tag) TAG="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '1,12p' "$0"
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

echo "== build image =="
echo "  dockerfile: $DOCKERFILE"
echo "  tag:        $TAG"
echo "  portal:     ${ORIGIN:-"(empty = standalone)"}"

ARGS=(
  -t "$TAG"
  --build-arg "GOPROXY=${GOPROXY:-https://goproxy.cn,direct}"
  --build-arg "GOSUMDB=${GOSUMDB:-sum.golang.google.cn}"
  --build-arg "VITE_PRICEAI_PUBLIC_ORIGIN=${ORIGIN}"
  --build-arg "VITE_PRICEAI_PUBLIC_HOME_PATH=${HOME_PATH}"
  -f "$DOCKERFILE"
  "$REPO_ROOT"
)

docker build "${ARGS[@]}"
echo "OK  docker image $TAG"
