# 任务拆解

## 任务 1：修正 DOWN 操作指引

- 目标：让操作者只进入 monorepo backend launcher。
- 输入：`scripts/jiqun-contract-smoke.mjs` DOWN 分支。
- 输出：canonical 命令与回归测试。
- 验收：1 条新增 RED→GREEN，实际 DOWN 输出正确。
- 依赖：`../backend/scripts/serve-dev.sh`。
