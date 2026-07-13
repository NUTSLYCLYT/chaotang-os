# 任务：fix-launch-s1-operational-source-paths-20260714

## 任务 1：逐文件 RED

- 目标：证明每个执行自动化仍依赖旧代码源。
- 输入：八个 tracked cron/monitor/restore 文件。
- 输出：`scripts/operational-source-paths.nodetest.mjs`。
- 验收：首次运行 0/8，通过输出逐文件定位旧引用。

## 任务 2：最小 GREEN

- 目标：只收敛执行目录和恢复指令。
- 输入：canonical root 与已验证 backend runner。
- 输出：八个文件的路径修改。
- 验收：相同测试 8/8，Shell/Node 语法通过。

## 任务 3：候选证据循环

- 目标：验证累计 S1 候选且不触发外部副作用。
- 输入：分支完整 diff。
- 输出：verification-loop 与变更记录。
- 验收：机械检查通过；prod STOP、shellcheck 缺失与 dry-run 语义矛盾明确披露。
