# 变更摘要：fix-r0-w08-approved-record-metadata-20260729

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w08-approved-record-metadata-20260729 |
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

W08 closeout 现在要求真实用户验收 JSON 包含 closeout-only approval metadata：
`approval.status = APPROVED`，且 `owner`、`approved_at`、`evidence_review_id`
均非空。普通 `--user-acceptance` 文件级检查仍可用于草稿记录校验；只有
closeout preflight 强制 approved metadata。

## 明确非目标

- 不生成真实用户验收记录。
- 不关闭 W08。
- 不激活 W09。
- 不 push、不部署、不迁移数据库、不操作 3050。
