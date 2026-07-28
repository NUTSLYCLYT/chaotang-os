# 任务：feat-r0-w08-product-acceptance-runnable-minimum-20260728

## 任务 1

- 目标：建立 W08 RUNNABLE_MINIMUM product acceptance harness。
- 前置条件：R0-W08 v2 authority 返回 `GO / APPROVED_WORK_PACKAGE`。
- 输入：W08 activation design、用户 RUNNABLE_MINIMUM 批准。
- 输出：1 个黄金合同样本、validator、focused pytest、backend harness manifest 登记。
- 涉及文件：`backend/harness/chaotang_product_acceptance/**`、`backend/harness/manifest.json`、`backend/tests/test_w08_product_acceptance_harness.py`。
- 状态 / 数据变化：仅 Git 仓内 harness/test；不触碰生产、数据库迁移、3050。
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`；RED 为 missing runner，GREEN 为 3 passed。
- 回滚边界：移除新增 harness/test，并撤销 manifest 条目。
- 完成定义：RUNNABLE_MINIMUM validator pass；不代表 W08 final acceptance。

## 任务 2

- 目标：保留 W08 完整验收目标，防止误关闭。
- 前置条件：任务 1 完成。
- 输入：W08 设计规格中的 36/10/5 hard gates。
- 输出：`targets` 写入 `w08_contracts.json`，Packet 状态为 `VERIFIED_PARTIAL`。
- 涉及文件：`.harness/changes/feat-r0-w08-product-acceptance-runnable-minimum-20260728/**`。
- 状态 / 数据变化：治理证据更新。
- 验证命令与证据：runner JSON 输出包含完整 `targets`。
- 回滚边界：撤销本 change 目录。
- 完成定义：W08 后续工作明确继续扩展，不误判完成。
