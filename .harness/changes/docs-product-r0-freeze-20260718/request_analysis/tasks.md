# 任务：docs-product-r0-freeze-20260718

## 任务 1：迁移并保护产品定型输入

- 目标：从已审计设计 worktree 保存 14 个融合输入、蓝图和 change 证据。
- 前置条件：源 diff 仅含允许的文档路径；输入 hash 已冻结。
- 输入：design commit `b0e54672f5df55a19f69dbbc454172aca2328cfb`。
- 输出：最新干净远端基线上的 source-preservation commit `33dac7b`。
- 涉及文件：`docs/plans/*2026-07-18.md` 与对应根 change。
- 状态 / 数据变化：文档新增；无运行数据。
- 验证命令与证据：first parent 为 `5d273c3`；无冲突；A/B hash 保持。
- 回滚边界：可 revert `33dac7b`；不影响运行时。
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

## 任务 4：PR 精确头权威残留收口

- 目标：关闭 PR !3 精确头终审发现的产品冻结 DoD 与旧 P0–P9/C0–C2 执行权威矛盾。
- 前置条件：PR head `3c05aae1c9abef51d114a6e7c3e71a685833bd87` 对最新 target `05582e520300e32a5d84e2b38b3822903f75c954` 的服务端预合并与根 doctor 已通过；独立 stop-gate 为 `BLOCK`。
- 输入：精确 stop-gate 三项 blocker 与当前产品宪法、PRD、M0–M10 权威关系。
- 输出：PRD 将跨端五裁决移入 R0 实现/退出门；部门 Agent 和唯一事实源历史稿不再发布当前旧路线命令；本 change 证据更新。
- 涉及文件：上述 3 份文档与本 change；不修改 frontend、backend、scripts、source_inputs 或产品事实字段。
- 状态 / 数据变化：仅文案权威与审计证据；无运行状态、schema、数据或外部副作用。
- 验证命令与证据：路径 allowlist、Markdown/link、冲突语句扫描、root doctor、最新 target 预合并与新精确 HEAD 独立 stop-gate。
- 回滚边界：用普通 revert 撤销窄修复；禁止 force push 或改写已共享历史。
- 完成定义：三项 blocker 在新精确 HEAD 全部关闭，最终 stop-gate `ALLOW`，PR 仍通过正式 Gitee 流程合入。
- 状态：`CONTENT_COMPLETE / EXACT_SHA_DELIVERY_GATE_PENDING`。
