#!/usr/bin/env bash
# 待命合码脚本(2026-07-02)——方案第 2 步:master → feat/department-flywheel。
# 把 master 的更新合进【我的分支】,冲突在我分支上解,master 全程不动、保持稳定。
# 安全闸:树必须干净 + 分支必须对,否则拒绝(不在脏树/并发活跃时动 merge)。
#
# 前置(方案第 0-1 步,须先满足):所有并发 agent 已各自落袋,git status 干净。
# 用法: bash dev/scripts/merge-master-into-flywheel.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BR=feat/department-flywheel

echo "== 闸1:当前分支 =="
cur=$(git branch --show-current)
[ "$cur" = "$BR" ] || { echo "✗ 当前在 $cur,请先切到 $BR"; exit 1; }

echo "== 闸2:工作区必须干净(除 db 垃圾)=="
dirty=$(git status --porcelain | grep -vE '\.db(\.bak.*)?$' || true)
if [ -n "$dirty" ]; then
  echo "✗ 工作区不干净,先让并发 agent 落袋(方案第0-1步):"; echo "$dirty" | head; exit 1
fi

echo "== 闸3:无遗留冲突标记 =="
bash scripts/guard-conflict-markers.sh

echo "== 拉取最新 =="
git fetch origin

echo "== 我的分支已推?(合前先确保本地已备份到远程)=="
git rev-list --left-right --count origin/$BR...HEAD

echo "== 合 master 进来(--no-ff,冲突停下手动解)=="
git merge --no-ff origin/master -m "merge: master → $BR(方案第2步·冲突在特性分支解,master不动)" || {
  echo ""
  echo "⚠️ 有冲突。逐文件解(git status 看 UU),解完:"
  echo "   git add <解好的文件> && git commit"
  echo "   再跑双门:pnpm exec tsc --noEmit && NEXT_PUBLIC_API_MODE=real pnpm build"
  echo "   然后 scripts/guard-conflict-markers.sh 确认零标记"
  exit 2
}

echo "== 双门 =="
pnpm exec tsc --noEmit
NEXT_PUBLIC_API_MODE=real pnpm build
echo "✓ 合码+双门通过。下一步:推分支 → 开 PR feat→master(方案第3步,你点合并)"
