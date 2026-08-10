# 规格说明：fix-r0-w08-user-surfaces-gate-20260729

## 背景

W08 user acceptance docs require real participants to use only `/shangshufang` and `/shiguan`, but final user records did not include a machine-checkable field proving that boundary. A record containing an extra surface such as `/admin` could pass.

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | R0-W08 authority GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 已验证 | 否 |
| 已确认事实 | extra user surface previously passed | RED test `1 failed, 18 passed` | TDD | 是 |
| 已确认事实 | W08 remains blocked by missing real records | closeout preflight | 已验证 | 是 |

## 数据流与调用链

Participant session uses only `/shangshufang` and `/shiguan` -> observer records `surfaces_used` per participant -> W08 runner validates exact closed-world surface set -> closeout remains blocked until real approved records exist.

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| participant surfaces | each final record `surfaces_used` | W08 acceptance runner | focused W08 harness |
| allowed surfaces | `["/shangshufang", "/shiguan"]` | W08 acceptance runner | focused W08 harness |

## 范围

- Add fail-closed validation for per-record `surfaces_used`.
- Add RED/GREEN focused test.
- Update template, fixture, records README, observer checklist, and submission checklist.

## 非目标

- No real user acceptance record creation.
- No W08 closeout.
- No W09 activation.
- No product/runtime flow changes.
- No push, deployment, database migration, or listener 3050 operation.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| Missing or extra surface | user acceptance payload fails | focused W08 harness |
| Real records missing | closeout remains BLOCKED | closeout preflight |

## 风险与回滚边界

Risk is low and scoped to W08 acceptance evidence validation plus templates/docs. Existing test fixtures are updated to the new required field.

## 计划确认记录

- 批准人：User directional approval via "继续任务"
- 批准日期：20260729
- 批准范围：continue W08 acceptance hardening without fabricating evidence
- 明确未批准：push、deployment、database migration、3050 operation、W09 activation、synthetic user evidence

## 验收标准

- RED test proves payload with `/admin` previously passed.
- GREEN focused harness passes after validation and fixture/template updates.
- W08 closeout preflight remains fail-closed without real records.

## 验证计划

- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- `cd backend && python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `git diff --check`
