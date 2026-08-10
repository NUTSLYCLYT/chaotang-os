# 规格说明：docs-r0-w08-user-acceptance-task-card-20260729

## 背景

R0-W08 当前已通过 36 黄金合同和 10/10 real backend browser flow，但 closeout preflight 仍因缺少真实非开发用户验收记录而 BLOCKED。现有 runbook 定义了规则，但缺少直接给参与者使用的稳定任务卡，现场容易变成工程师口头引导，导致记录不可计入。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | R0-W08 authority GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 已验证 | 否 |
| 已确认事实 | W08 focused harness baseline 通过 | `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 已验证 | 否 |
| 已确认事实 | W08 closeout 仍缺真实用户验收记录 | closeout preflight BLOCKED on records JSON | 已验证 | 是 |
| 假设 | 统一参与者任务卡可减少 engineer-guided session 风险 | 本 Packet 设计 | Product Acceptance Owner | 否 |

## 数据流与调用链

Observer gives `participant_task_card.zh-CN.md` to a non-developer participant, then records observations in `observer_checklist.md`. Final deidentified JSON remains the only closeout evidence source under `user_acceptance/records/`.

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| participant task prompt | `participant_task_card.zh-CN.md` | session observer / participant | docs + harness doctor |
| final user acceptance record | approved JSON under `user_acceptance/records/` | closeout preflight | unchanged |

## 范围

- Add Chinese participant-facing W08 task card.
- Reference it from README, session runbook, and submission checklist.
- Preserve all closeout gates.

## 非目标

- No synthetic user evidence.
- No product/runtime code changes.
- No W08 closeout.
- No W09 activation.
- No push, deployment, database migration, or listener 3050 operation.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| Participant needs task instructions | Use task card only; no step-by-step engineering guidance | session runbook/checklist |
| Participant gets stuck | Record as feedback; do not convert guided completion into success | acceptance rules unchanged |
| Closeout evidence missing | preflight remains BLOCKED | `--closeout-preflight` |

## 风险与回滚边界

Risk is low because the change is documentation-only. Rollback is limited to the new task card and references from W08 user acceptance docs.

## 计划确认记录

- 批准人：User directional approval via "下一步"
- 批准日期：20260729
- 批准范围：continue W08 evidence collection readiness without fabricating user evidence
- 明确未批准：push、deployment、database migration、3050 operation、W09 activation、synthetic acceptance evidence

## 验收标准

- Task card is directly usable by Chinese non-developer participants.
- Session runbook requires task card as the only task prompt.
- Submission checklist records that the task card was used as the only task prompt.
- Harness verification remains clean.

## 验证计划

- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- `cd backend && python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
