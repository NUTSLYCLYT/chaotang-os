# 变更摘要：feat-w08-product-acceptance-harness-20260728

| 字段 | 值 |
| --- | --- |
| Change ID | feat-w08-product-acceptance-harness-20260728 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | Backend Harness / W08 Product Acceptance |
| 创建日期 | 20260728 |

## 范围

- 在既有 `backend/harness/chaotang-true-loop/product_acceptance/` 下新增 W08 验收入口。
- 新增 W08 RUNNABLE_MINIMUM 黄金合同样本与 validator。
- 在 `backend/harness/manifest.json` 登记该 harness。
- 新增 `backend/tests/test_w08_product_acceptance_harness.py`。

## 非目标

- 不关闭 W08。
- 不声明 36/10/5 最终验收完成。
- 不 push、不部署、不迁移数据库、不操作 3050。
