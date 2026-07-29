# 规格说明：fix-r0-w08-approved-record-metadata-20260729

## 背景

W08 closeout 文档要求 `records/` 下存在 exactly one approved JSON，但此前机器校验只验证记录内容、数量、路径和 fixture 边界，没有验证 payload 内部是否真的标记为 approved。需要将“approved”从目录/文件名约定提升为 closeout-only 机器校验。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | closeout preflight 可接受 records 内形状正确但无 approval metadata 的 JSON | RED focused tests | Codex | 否 |
| 推测 | 真实验收记录会由 Product Acceptance Owner 审核批准 | runbook/checklist | Product Acceptance Owner | 否 |
| 未知问题 | 真实用户验收何时完成 | 不适用 | Product Acceptance Owner | 是 |

## 数据流与调用链

`--user-acceptance <path>`
-> validates user record content only

`--closeout-preflight`
-> finds/validates records path
-> validates user record content
-> validates closeout approval metadata
-> combines golden/browser/user gates

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `approval.status` | Product Acceptance Owner | W08 closeout preflight | must equal `APPROVED` |
| `approval.owner` | Product Acceptance Owner | W08 closeout preflight | non-empty |
| `approval.approved_at` | Product Acceptance Owner | W08 closeout preflight | non-empty |
| `approval.evidence_review_id` | Product Acceptance Owner | W08 closeout preflight | non-empty |

## 范围

- Add closeout-only approval metadata validation.
- Keep file-level user acceptance validation usable for drafts.
- Update template and user acceptance docs.
- Update readiness dashboard requirements.

## 非目标

- Do not create real user records.
- Do not close W08.
- Do not modify product runtime endpoints or frontend pages.
- Do not activate W09.
- Do not push, deploy, migrate databases, or operate 3050.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| valid records JSON without `approval` | file-level check PASS, closeout BLOCKED | focused test |
| `approval.status != APPROVED` or missing | closeout BLOCKED | focused test |
| incomplete owner/approved_at/evidence_review_id | closeout BLOCKED | focused test |
| approved metadata complete | closeout can proceed to existing gates | focused test |

## 风险与回滚边界

Primary risk is false closeout due a records JSON that is structurally valid but not reviewer-approved. The rollback boundary is the closeout-only approval helper, focused tests, docs, and this change record.

## 计划确认记录

- 批准人：用户授权继续任务
- 批准日期：20260729
- 批准范围：W08 approved record metadata hardening
- 明确未批准：fake user evidence、W08 closeout、W09 activation、push、deployment、database migration、listener 3050 operation

## 验收标准

- RED tests fail before implementation because unapproved records can closeout.
- GREEN tests pass after closeout-only approval validation.
- Current repository preflight remains BLOCKED because no real approved records exist.

## 验证计划

- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- `cd backend && python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `git diff --check`
