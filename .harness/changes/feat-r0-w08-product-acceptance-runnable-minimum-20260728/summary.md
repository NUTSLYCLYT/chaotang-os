# 变更摘要：feat-r0-w08-product-acceptance-runnable-minimum-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w08-product-acceptance-runnable-minimum-20260728 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / W08 Product Acceptance |
| 创建日期 | 20260728 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening
- 文件：`backend/harness/chaotang-true-loop/product_acceptance/**`、`backend/harness/manifest.json`、`backend/tests/test_w08_product_acceptance_harness.py`
- 验证：`python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`、`python3 backend/harness/chaotang_product_acceptance/scripts/run_w08_acceptance.py`

## 判定

本 Packet 在既有 `chaotang-true-loop` 下建立 W08 `RUNNABLE_MINIMUM` 验收入口：1 个中文制造业/B2B 黄金合同样本、可重复 validator、后端 harness manifest 登记和 focused tests。

它不关闭 W08，也不声明最终产品验收完成。最终 W08 仍需要 36 黄金合同、10/10 real backend browser flow、5 名非开发用户至少 4 成功、ContractReviewPack 下载和 Shiguan audit replay 的完整证据。
