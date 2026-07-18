# 任务：docs-product-r0-freeze-20260718

## 任务 1：迁移并保护产品定型输入

- 目标：从已审计设计 worktree 保存 14 个融合输入、蓝图和 change 证据。
- 前置条件：源 diff 仅含允许的文档路径；输入 hash 已冻结。
- 输入：design commit `b0e54672f5df55a19f69dbbc454172aca2328cfb`。
- 输出：干净远端基线上的 source-preservation commit `22084d3`。
- 涉及文件：`docs/plans/*2026-07-18.md` 与对应根 change。
- 状态 / 数据变化：文档新增；无运行数据。
- 验证命令与证据：first parent 为 `6ee6d8d`；无冲突；A/B hash 保持。
- 回滚边界：可 revert `22084d3`；不影响运行时。
- 完成定义：已完成。

## 任务 2：冻结产品 SSOT 与 R0/R1 PRD

- 目标：消除产品身份、Offer、41 司、世界杯与发布顺序冲突。
- 前置条件：用户已批准超级助手方向与同仓收敛。
- 输入：融合 RFC、两份候选快照、现有产品 SSOT、工程/商业只读会审。
- 输出：产品宪法、R0/R1 PRD、派生 guide、accepted decision record、文档索引。
- 涉及文件：summary/spec allowlist 中的产品文档。
- 状态 / 数据变化：文档权威状态变化；无 schema、API 或运行状态变化。
- 验证命令与证据：Markdown/链接/关键词/hash/doctor。
- 回滚边界：整提交 revert。
- 完成定义：已完成；机器验证与独立内容预审通过。

## 任务 3：精确候选、独立停门与交付

- 目标：证明候选不含本地大分叉、历史快照漂移或范围外文件。
- 前置条件：任务 2 的所有本地验证通过。
- 输入：候选 diff 与精确 HEAD。
- 输出：独立 `ALLOW`、文档冻结 commit、远端产品分支与 PR 创建信息。
- 涉及文件：只读 Git 元数据与本 change CI 摘要。
- 状态 / 数据变化：创建一个文档 commit 并推送产品分支；不合并目标分支。
- 验证命令与证据：ancestry、allowlist、`git diff --cached --check`、远端 SHA 对账。
- 回滚边界：PR 可关闭，分支 commit 可 revert；禁止 force push。
- 完成定义：本 change 内的候选验证与内容预审已完成；精确提交 stop-gate、推送和 PR 创建是提交后的交付动作。
