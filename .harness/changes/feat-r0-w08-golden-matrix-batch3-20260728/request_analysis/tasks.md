# 任务：feat-r0-w08-golden-matrix-batch3-20260728

## 任务 1

- 目标：将 W08 黄金合同矩阵从 `12/36` 扩展到 `18/36`。
- 前置条件：本地 EXT `b4ddfa6e`，R0-W08 authority 为 GO。
- 输入：现有 `w08_contracts.json` 与 W08 runner。
- 输出：新增 6 个 synthetic/no-secret 中文制造业 B2B case。
- 涉及文件：`backend/harness/chaotang-true-loop/product_acceptance/golden_cases/w08_contracts.json`。
- 状态 / 数据变化：仅 harness JSON 数据变更。
- 验证命令与证据：JSON parse、W08 runner。
- 回滚边界：还原 JSON。
- 完成定义：runner 输出 `cases: 18` 且 `passed: true`。

## 任务 2

- 目标：同步 focused regression expectation 和 Packet 证据。
- 前置条件：任务 1 通过。
- 输入：runner 输出与测试输出。
- 输出：focused test 更新、summary/spec/tasks/ci。
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py` 与本 change 目录。
- 状态 / 数据变化：无运行时数据变化。
- 验证命令与证据：pytest、backend/root doctor、diff check。
- 回滚边界：还原 test 和删除本 Packet 目录。
- 完成定义：候选可 fast-forward 整合。
