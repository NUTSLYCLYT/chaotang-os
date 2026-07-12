#!/usr/bin/env bash
# 防复发·阶段5(2026-07-03 落地)：把 frontend/scripts/git-hooks/* 装进 .git/hooks/。
# .git/hooks 不入库，装一次就地生效；实际生产 prepare 入口是
# frontend/scripts/install-git-hooks.mjs(package.json "prepare" 用的是它)，这份 .sh
# 是手动重装用的备用入口:`bash frontend/scripts/install-git-hooks.sh`。不改 git
# config(不设 core.hooksPath)，只是把已跟踪的 hook 脚本复制/覆盖进 git 默认识别的
# .git/hooks 目录。
#
# 2026-07-12 修复(Codex 停止前审查发现)：这个手动入口跟 install-git-hooks.mjs 当时
# 犯的是同一个 monorepo 合并遗留 bug——`scripts/git-hooks/*` 是相对仓库根的路径，但
# hooks 实际在 frontend/scripts/git-hooks/ 下。这个 .sh 版本因为 `set -euo pipefail` +
# 裸 glob 不匹配会直接报错退出(不像 .mjs 版本那样静默跳过)，但依然是装不上——两处都
# 已经改成同一个正确路径。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 非 git 仓库(如打包环境提取源码后跑 pnpm install)静默跳过，不阻断安装。
if [ ! -d .git ]; then
  echo "[install-git-hooks] 非 git 工作区(无 .git)，跳过。"
  exit 0
fi

mkdir -p .git/hooks
for hook in frontend/scripts/git-hooks/*; do
  name="$(basename "$hook")"
  cp "$hook" ".git/hooks/$name"
  chmod +x ".git/hooks/$name"
done
echo "[install-git-hooks] 已装: $(ls frontend/scripts/git-hooks | tr '\n' ' ')"
