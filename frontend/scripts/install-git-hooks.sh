#!/usr/bin/env bash
# 防复发·阶段5(2026-07-03 落地)：把 scripts/git-hooks/* 装进 .git/hooks/。
# .git/hooks 不入库，装一次就地生效；由 package.json "prepare" 在 pnpm install 时自动跑，
# 也可手动 `bash scripts/install-git-hooks.sh` 重装。不改 git config(不设 core.hooksPath)，
# 只是把已跟踪的 hook 脚本复制/覆盖进 git 默认识别的 .git/hooks 目录。
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 非 git 仓库(如打包环境提取源码后跑 pnpm install)静默跳过，不阻断安装。
if [ ! -d .git ]; then
  echo "[install-git-hooks] 非 git 工作区(无 .git)，跳过。"
  exit 0
fi

mkdir -p .git/hooks
for hook in scripts/git-hooks/*; do
  name="$(basename "$hook")"
  cp "$hook" ".git/hooks/$name"
  chmod +x ".git/hooks/$name"
done
echo "[install-git-hooks] 已装: $(ls scripts/git-hooks | tr '\n' ' ')"
