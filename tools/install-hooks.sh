#!/usr/bin/env bash
# Install repo git hooks. Idempotent; safe to re-run.
#
#   make install-hooks
#
# pre-push: refuse to push a hub-contract change that has not been mirrored into
# PriceAI. PriceAI's own CI cannot see this repo, so the owner's machine — the only
# place both checkouts exist — is where the contract stays honest.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hooks_dir="$(git -C "$repo_root" rev-parse --git-path hooks)"
mkdir -p "$hooks_dir"

target="$hooks_dir/pre-push"
cat > "$target" <<'HOOK'
#!/usr/bin/env bash
# Managed by tools/install-hooks.sh — re-run `make install-hooks` after editing.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"

# Only nag when the contract itself is part of what is being pushed.
range_has_contract() {
  while read -r _local_ref local_sha _remote_ref remote_sha; do
    [ "$local_sha" = "0000000000000000000000000000000000000000" ] && continue
    if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
      git diff --name-only "$local_sha" -- contracts/ | grep -q . && return 0
    else
      git diff --name-only "$remote_sha" "$local_sha" -- contracts/ | grep -q . && return 0
    fi
  done
  return 1
}

if ! range_has_contract; then
  exit 0
fi

echo "pre-push: contracts/ changed — checking the PriceAI copy is in sync"
if ! node "$repo_root/contracts/sync.mjs" check; then
  cat >&2 <<'MSG'

pre-push blocked: the hub contract differs from PriceAI's vendored copy.

  node contracts/sync.mjs push     # mirror this repo's version into PriceAI
  git -C ../PriceAI add -A && git -C ../PriceAI commit   # commit BOTH repos

Bypass only if you know the PriceAI side is already handled:  git push --no-verify
MSG
  exit 1
fi
HOOK

chmod +x "$target"
echo "installed: $target"
