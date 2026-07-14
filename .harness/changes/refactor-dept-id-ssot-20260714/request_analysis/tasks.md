# 任务：refactor-dept-id-ssot-20260714

## 任务 1：安全重切与迁移

- 目标：将旧 P1 补丁语义等价重切到 `f9b3e88` 并迁出 `/tmp`。
- 前置条件：保留旧提交可恢复引用。
- 输入：`c06d66d`、父提交 `e90d035`、新基线 `f9b3e88`。
- 输出：`8a16e876`，worktree `~/Projects/.fullcourt-worktrees/p1-dept-id-ssot`。
- 状态 / 数据变化：完成；创建 archive 引用，patch-id 完全一致。
- 回滚边界：`archive/p1-dept-id-ssot-pre-f9b3e88`。
- 完成定义：新提交父级为 `f9b3e88`、无冲突、工作树干净。

## 任务 2：合入 EXT

- 目标：按用户后续裁决把 P0、P1 和既有 EXT 改动统一到 `feature-chaotang-ext`。
- 输出：P0 merge `cf18e7a`、P1 merge `defd157`。
- 状态 / 数据变化：完成；两个 merge 均无冲突，当前分支为 EXT。
- 回滚边界：分别 revert 对应 merge commit，不重写历史。
- 完成定义：EXT 同时包含 P0 与 P1，工作目录不离开 EXT。

## 任务 3：重建 change 记录

- 目标：恢复丢失的 spec、tasks、summary 与 ci_summary。
- 状态：完成。
- 完成定义：四类必需记录完整、事实可由 Git 和命令输出复核。

## 任务 4：全套验收

- 目标：执行 SSOT、golden、三层 doctor、tsc、代表性套件和浏览器 smoke。
- 状态：完成（P1 门禁全绿；完整 nodetest 保持 P0 同一组 7 个既有失败）。
- 验证命令与证据：见 `../ci_result/ci_summary.md`。
- 完成定义：所有强制门禁通过；任何无法运行项有明确原因和剩余风险。

## 任务 5：证据提交与交审

- 目标：只提交 change 记录和验收产物，给出 P1 可审状态。
- 状态：完成。
- 完成定义：EXT 工作树干净，证据提交可独立审阅，未 push。
