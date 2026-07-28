# 变更摘要：test-r0-w08-user-acceptance-fixture-20260729

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | test-r0-w08-user-acceptance-fixture-20260729 |
| 类型 | test |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / Product Acceptance |
| 创建日期 | 20260729 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening
- 文件：`backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/fixtures/**`、`backend/tests/test_w08_product_acceptance_harness.py`、`backend/harness/manifest.json`
- 验证：focused pytest、fixture CLI validation、backend/root doctor、authority、diff check

## 结论

本 Packet 增加 W08 用户验收 JSON fixture，供测试和 reviewer rehearsal 使用。fixture 位于 `fixtures/`，不在 `records/`，不能作为真实用户验收证据。

W08 closeout 仍需要真实非开发用户记录。
