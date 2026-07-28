# 变更摘要：feat-r0-w08-golden-matrix-batch1-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w08-golden-matrix-batch1-20260728 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | W08 Product Acceptance |
| 创建日期 | 20260728 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening
- 文件：`backend/harness/chaotang-true-loop/product_acceptance/golden_cases/w08_contracts.json`、`backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`、`backend/tests/test_w08_product_acceptance_harness.py`
- 验证：`python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`、`python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`

## 判定

W08 黄金合同矩阵从 1 个 RUNNABLE_MINIMUM 样本扩展到 Batch 1 的 6 个合成样本，覆盖付款、交付、验收、质保、责任、IP、保密、终止、争议、合规 10 个风险族。

这不是 W08 closeout。最终目标仍是 36 黄金合同、10/10 real backend browser flow、5 名非开发用户至少 4 成功。
