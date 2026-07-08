#!/usr/bin/env bash
# 防复发守卫(2026-07-02)：拒绝把合并冲突标记留进树。
# 多 agent 一分支时,UU 冲突标记会潜伏一整个 session 挡住 build 却没人发现。
# 用法:
#   pre-commit 钩子 / CI 里跑 `bash scripts/guard-conflict-markers.sh`,遇冲突标记 exit 1。
#   package.json 可加 "guard:conflicts": "bash scripts/guard-conflict-markers.sh"。
set -euo pipefail

# 只查已跟踪的源码/文档,排除本脚本自身(它含标记样例说明)与二进制。
# 只认尖括号标记(<<<<<<< / >>>>>>>):真冲突必含这俩,且 Markdown 永不用尖括号做下划线;
# 不查 ======= —— 它与 Markdown H1 下划线歧义会误报(public/fonts/README.md 已踩)。
markers='^(<<<<<<<|>>>>>>>)'
hits=$(git grep -nE "$markers" -- \
  ':(exclude)scripts/guard-conflict-markers.sh' \
  '*.ts' '*.tsx' '*.js' '*.mjs' '*.json' '*.md' '*.css' 2>/dev/null || true)

if [ -n "$hits" ]; then
  echo "✗ 发现未解决的合并冲突标记(禁止提交/合并):"
  echo "$hits"
  echo ""
  echo "先解决冲突再提交。多 agent 协作见 dev/notes/多agent协作-防复发-2026-07-02.md"
  exit 1
fi
echo "✓ 无冲突标记"
