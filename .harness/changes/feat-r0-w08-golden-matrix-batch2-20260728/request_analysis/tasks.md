# 任务：feat-r0-w08-golden-matrix-batch2-20260728

## 任务 1

- 目标：将 W08 黄金合同矩阵从 `6/36` 扩展到 `12/36`。
- 前置条件：R0-W08 authority 为 GO；本地 EXT 基线 `ec2d6e09`。
- 输入：现有 `w08_contracts.json` schema 与 W08 runner。
- 输出：新增 6 个 synthetic/no-secret 中文制造业 B2B case。
- 涉及文件：`backend/harness/chaotang-true-loop/product_acceptance/golden_cases/w08_contracts.json`。
- 状态 / 数据变化：仅 harness JSON 数据变更，无 DB/外部状态。
- 验证命令与证据：W08 runner、focused pytest、backend/root doctor、diff check。
- 回滚边界：还原 JSON。
- 完成定义：runner 输出 `cases: 12` 且 `passed: true`。

## 任务 2

- 目标：补齐 Batch 2 变更记录和验证证据。
- 前置条件：任务 1 通过。
- 输入：执行命令结果。
- 输出：`summary.md`、`spec.md`、`tasks.md`、`ci_summary.md`。
- 涉及文件：`.harness/changes/feat-r0-w08-golden-matrix-batch2-20260728/`。
- 状态 / 数据变化：仅文档。
- 验证命令与证据：root doctor。
- 回滚边界：删除本 change 目录。
- 完成定义：Packet 可被 review 和 fast-forward 整合。
