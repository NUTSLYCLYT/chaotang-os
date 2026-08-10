# 变更摘要：fix-r0-w08-closeout-record-path-boundary-20260729

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w08-closeout-record-path-boundary-20260729 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / Product Acceptance |
| 创建日期 | 20260729 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening
- 文件：
  - `backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
  - `backend/tests/test_w08_product_acceptance_harness.py`
  - `backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/README.md`
  - `backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/submission_checklist.md`
- 验证：TDD RED/GREEN、focused pytest、expected BLOCKED preflight、doctor、authority、diff check

## 结论

W08 closeout preflight 现在拒绝 `user_acceptance/records/` 外的显式
`--user-acceptance` 路径。普通 `--user-acceptance` 文件级验证保持可用；
只有 closeout preflight 需要使用受治理的 records 目录。

## 明确非目标

- 不生成真实用户验收记录。
- 不关闭 W08。
- 不修改产品运行时代码。
- 不 push、不部署、不迁移数据库、不操作 3050。
