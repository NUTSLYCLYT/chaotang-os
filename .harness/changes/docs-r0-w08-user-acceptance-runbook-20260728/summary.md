# 变更摘要：docs-r0-w08-user-acceptance-runbook-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-r0-w08-user-acceptance-runbook-20260728 |
| 类型 | docs |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / Product Acceptance |
| 创建日期 | 20260728 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening
- 文件：`backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/**`、`backend/harness/manifest.json`
- 验证：focused pytest、backend/root harness doctor、authority、diff check

## 结论

本 Packet 建立真实非开发用户验收执行包：session runbook、observer checklist、acceptance rules、submission checklist，并登记到 backend harness manifest。

它不包含真实用户记录，因此不能关闭 W08。
