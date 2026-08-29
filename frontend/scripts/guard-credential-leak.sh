#!/usr/bin/env bash
# Reject credential-like literals newly introduced by the staged diff.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

added_lines_against() {
  git diff --cached -U0 "$1" -- \
    ':(exclude)frontend/scripts/guard-credential-leak.sh' \
    '*.md' '*.ts' '*.tsx' '*.js' '*.mjs' '*.py' '*.json' '*.yaml' '*.yml' 2>/dev/null \
    | grep -E '^\+[^+]' || true
}

added_lines=$(added_lines_against HEAD)

merge_head_path=$(git rev-parse --git-path MERGE_HEAD)
if [ -f "$merge_head_path" ]; then
  while IFS= read -r parent; do
    parent_added=$(added_lines_against "$parent")
    added_lines=$(comm -12 \
      <(printf '%s\n' "$added_lines" | LC_ALL=C sort -u) \
      <(printf '%s\n' "$parent_added" | LC_ALL=C sort -u))
  done < "$merge_head_path"
fi

if [ -z "$added_lines" ]; then
  exit 0
fi

pattern='(密码|password|passwd|api[_-]?key|secret)[`"'"'"']?[[:space:]]*[:=][[:space:]]*[`"'"'"'][A-Za-z0-9!@#$%^&*_.-]{8,}[`"'"'"']'
hits_raw=$(echo "$added_lines" | grep -inE "$pattern" || true)

safe_pattern='^[0-9]+:\+[[:space:]]*const[[:space:]]+E2E_[A-Z_]+[[:space:]]*=[[:space:]]*[`"'"'"'][Ee]2[Ee][A-Za-z0-9!@#$%^&*_.-]*[`"'"'"'];?[[:space:]]*$'
hits=$(echo "$hits_raw" | grep -viE "$safe_pattern" || true)

if [ -n "$hits" ]; then
  echo "✗ 疑似把真实密码/密钥写进了本次提交(禁止提交):"
  echo "$hits"
  echo ""
  echo "如果是真实凭据，请先让它失效；如果是误报，请收紧守卫规则，不要绕过校验。"
  exit 1
fi

echo "✓ 未发现疑似凭据泄露"
