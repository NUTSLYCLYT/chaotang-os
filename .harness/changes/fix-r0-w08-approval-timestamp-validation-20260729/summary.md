# 变更摘要：fix-r0-w08-approval-timestamp-validation-20260729

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w08-approval-timestamp-validation-20260729 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / Product Acceptance |
| 创建日期 | 20260729 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening
- 文件：
  - `backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
  - `backend/tests/test_w08_product_acceptance_harness.py`
  - `backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/w08_user_acceptance_template.json`
  - `backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/README.md`
  - `backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/submission_checklist.md`
  - `.harness/changes/docs-r0-w08-readiness-dashboard-20260729/readiness_dashboard.md`
- 验证：TDD RED/GREEN、focused pytest、expected BLOCKED preflight、doctor、authority、diff check

## 结论

W08 closeout approval metadata 现在要求 `approval.approved_at` 是 UTC
ISO-8601 时间戳并以 `Z` 结尾，例如 `2026-07-29T12:00:00Z`。非空但不可解析的自然语言或本地时间字符串会被 closeout preflight 拒绝。

## 明确非目标

- 不生成真实用户验收记录。
- 不关闭 W08。
- 不激活 W09。
- 不 push、不部署、不迁移数据库、不操作 3050。
