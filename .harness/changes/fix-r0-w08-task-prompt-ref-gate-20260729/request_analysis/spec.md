# 规格说明：fix-r0-w08-task-prompt-ref-gate-20260729

## 背景

W08 runbook 和 checklist 已要求参与者只使用 `participant_task_card.zh-CN.md` 作为任务提示，但 final user acceptance JSON 没有机器可校验字段记录该事实。真实用户验收记录提交后，缺少该字段会让 reviewer 只能人工猜测现场提示边界。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | R0-W08 authority GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 已验证 | 否 |
| 已确认事实 | payload previously passed without task prompt ref | RED test `1 failed, 17 passed` | TDD | 是 |
| 已确认事实 | W08 closeout remains blocked without records JSON | closeout preflight | 已验证 | 是 |

## 数据流与调用链

`participant_task_card.zh-CN.md` -> unassisted participant session -> final deidentified user acceptance JSON with `task_prompt_ref` -> closeout preflight. This Packet adds the machine field and validation.

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| task prompt reference | final user acceptance JSON `task_prompt_ref` | W08 validation runner | focused W08 harness |
| participant task card | `participant_task_card.zh-CN.md` | session runner / reviewer | backend doctor + focused tests |

## 范围

- Add fail-closed validation for `task_prompt_ref`.
- Add RED/GREEN focused test.
- Update template, fixture, records README, and submission checklist.

## 非目标

- No real user acceptance record creation.
- No W08 closeout.
- No W09 activation.
- No product/runtime flow changes.
- No push, deployment, database migration, or listener 3050 operation.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| Missing task prompt reference | user acceptance payload fails | focused W08 harness |
| Real records still absent | closeout remains BLOCKED | closeout preflight |

## 风险与回滚边界

Risk is low and constrained to W08 acceptance payload validation plus templates. Existing valid fixtures are updated to the new required field.

## 计划确认记录

- 批准人：User directional approval via "下一步"
- 批准日期：20260729
- 批准范围：continue W08 acceptance hardening without fabricating evidence
- 明确未批准：push、deployment、database migration、3050 operation、W09 activation、synthetic user evidence

## 验收标准

- RED test proves payload without `task_prompt_ref` previously passed.
- GREEN focused harness passes after validation and template updates.
- W08 closeout preflight remains fail-closed without real records.

## 验证计划

- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- `cd backend && python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `git diff --check`
