# 规格说明：fix-r0-w08-approval-timestamp-validation-20260729

## 背景

上一阶段已要求 W08 closeout records JSON 带 `approval` metadata，但 `approval.approved_at` 仅要求非空。非空自然语言字符串会削弱审计性，因此需要机器校验 UTC ISO-8601 `Z` 时间戳。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | invalid `approved_at` 当前可通过 closeout | RED focused test | Codex | 否 |
| 推测 | Product Acceptance Owner 会以 UTC 时间记录批准 | submission checklist | Product Acceptance Owner | 否 |
| 未知问题 | 真实用户记录何时产生 | 不适用 | Product Acceptance Owner | 是 |

## 数据流与调用链

closeout preflight
-> load approved records JSON
-> validate user records
-> validate approval metadata
-> validate `approval.approved_at` against UTC `YYYY-MM-DDTHH:MM:SSZ`

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `approval.approved_at` | Product Acceptance Owner | W08 closeout preflight | UTC ISO-8601 timestamp ending with `Z` |

## 范围

- Add strict UTC timestamp format validation for `approval.approved_at`.
- Update focused tests.
- Update template, records docs, submission checklist, and readiness dashboard.

## 非目标

- Do not create real user records.
- Do not close W08.
- Do not alter product runtime endpoints or frontend pages.
- Do not activate W09.
- Do not push, deploy, migrate DB, or operate 3050.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| `approved_at = approved yesterday` | closeout BLOCKED | focused RED/GREEN test |
| `approved_at = 2026-07-29T12:00:00Z` | approval timestamp gate passes | existing focused tests |

## 风险与回滚边界

Primary risk is accepting ambiguous approval timestamps that cannot be reliably audited. Rollback is limited to the timestamp validator, tests, docs, and this change record.

## 计划确认记录

- 批准人：用户授权继续任务
- 批准日期：20260729
- 批准范围：W08 approval timestamp validation
- 明确未批准：fake user evidence、W08 closeout、W09 activation、push、deployment、database migration、listener 3050 operation

## 验收标准

- RED test fails before implementation.
- GREEN test passes after timestamp validation.
- Current repository closeout remains BLOCKED because no real approved records exist.

## 验证计划

- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- `cd backend && python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `git diff --check`
