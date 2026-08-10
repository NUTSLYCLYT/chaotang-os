# 任务：feat-r0-w08-golden-matrix-batch1-20260728

## 任务 1

- 目标：将 W08 黄金合同矩阵扩展到 Batch 1。
- 前置条件：R0-W08 active；RUNNABLE_MINIMUM Packet 已整合。
- 输入：现有 1 个黄金合同样本。
- 输出：6 个合成黄金合同、coverage 输出、focused pytest。
- 涉及文件：`backend/harness/chaotang-true-loop/product_acceptance/**`、`backend/tests/test_w08_product_acceptance_harness.py`。
- 状态 / 数据变化：仅 Git 仓内 harness/test；无运行时、生产或数据库外部状态变化。
- 验证命令与证据：focused pytest 和 runner。
- 回滚边界：撤销本 commit 对 golden matrix、runner、test 的修改。
- 完成定义：6/36 Batch 1 pass；W08 final acceptance 仍未完成。
