# 变更摘要：fix-r0-w08-reject-fixture-records-20260729

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w08-reject-fixture-records-20260729 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / Product Acceptance |
| 创建日期 | 20260729 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening
- 文件：`backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`、`backend/tests/test_w08_product_acceptance_harness.py`、`backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/**`
- 验证：focused pytest、fixture rejection CLI、backend/root doctor、authority、diff check

## 结论

本 Packet 修复 W08 用户验收 fixture 误用风险：最终 user acceptance 不再接受 `fixture: true` payload，也拒绝 `fixture-` 前缀的参与者或证据 ID。fixture 仍可通过 `allow_fixture=True` 做测试形状演练。

本 Packet 不包含真实用户记录，不能关闭 W08。
