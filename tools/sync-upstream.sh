#!/usr/bin/env bash

set -euo pipefail

readonly DEFAULT_BRANCH="main"
readonly UPSTREAM_REMOTE="upstream"
readonly UPSTREAM_BRANCH="main"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

fail() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
用法：
  make init-upstream     首次导入 sub2api 提交历史（仅执行一次）
  make sync-upstream     创建包含最新 sub2api 变更的同步分支
EOF
}

ensure_repository() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail '请在 Git 仓库中执行此命令。'
  git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1 || fail "未配置 $UPSTREAM_REMOTE 远程。"
}

has_head() {
  git rev-parse --verify HEAD >/dev/null 2>&1
}

ensure_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    fail '工作区存在未提交的变更。请先提交、暂存或清理后再同步。'
  fi
}

next_sync_branch() {
  local base_branch="sync/sub2api-$(date +%Y%m%d)"
  local branch="$base_branch"
  local suffix=2

  while git show-ref --verify --quiet "refs/heads/$branch"; do
    branch="$base_branch-$suffix"
    suffix=$((suffix + 1))
  done

  printf '%s\n' "$branch"
}

initialize() {
  if has_head; then
    fail '当前仓库已有提交，无需初始化。请改用 make sync-upstream。'
  fi

  git fetch --prune "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

  cat <<EOF
即将把当前仓库的 main 对齐到 $UPSTREAM_REMOTE/$UPSTREAM_BRANCH。
这会将当前未跟踪文件纳入 sub2api 的提交历史；仅应在尚未开始二开时执行。
输入 yes 继续：
EOF
  read -r confirmation
  [[ "$confirmation" == 'yes' ]] || {
    printf '已取消初始化。\n'
    exit 0
  }

  git reset --hard "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
  git branch --set-upstream-to="$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" "$DEFAULT_BRANCH"

  cat <<'EOF'
初始化完成。
请确认文件无误后执行：git push -u origin main
之后使用：make sync-upstream
EOF
}

synchronize() {
  has_head || fail '当前仓库尚未初始化。请先执行 make init-upstream。'
  ensure_clean_worktree

  git switch "$DEFAULT_BRANCH"
  git pull --ff-only origin "$DEFAULT_BRANCH"
  git fetch --prune "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

  if git merge-base --is-ancestor "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" "$DEFAULT_BRANCH"; then
    printf 'main 已包含最新的 sub2api 变更，无需创建同步分支。\n'
    exit 0
  fi

  local sync_branch
  sync_branch="$(next_sync_branch)"
  git switch -c "$sync_branch"

  if git merge --no-ff "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" -m "chore: sync sub2api"; then
    cat <<EOF
已创建同步分支：$sync_branch
请运行必要测试，确认后执行：git push -u origin $sync_branch
随后通过 Pull Request 将该分支合并到 main。
EOF
    return
  fi

  cat <<EOF
合并发生冲突，当前仍位于 $sync_branch。
解决冲突后执行：git add <文件> && git commit
如需放弃本次同步：git merge --abort
EOF
  exit 1
}

main() {
  ensure_repository

  case "${1:-}" in
    --initialize)
      initialize
      ;;
    '')
      synchronize
      ;;
    -h|--help)
      usage
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
