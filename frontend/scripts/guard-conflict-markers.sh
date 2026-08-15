#!/usr/bin/env bash
# Reject unresolved merge markers in tracked source and documentation files.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

markers='^(<<<<<<<|>>>>>>>)'
hits=$(git grep -nE "$markers" -- \
  ':(exclude)frontend/scripts/guard-conflict-markers.sh' \
  '*.ts' '*.tsx' '*.js' '*.mjs' '*.json' '*.md' '*.css' 2>/dev/null || true)

if [ -n "$hits" ]; then
  echo "✗ 发现未解决的合并冲突标记(禁止提交/合并):"
  echo "$hits"
  echo ""
  echo "先解决冲突再提交。"
  exit 1
fi

echo "✓ 无冲突标记"
