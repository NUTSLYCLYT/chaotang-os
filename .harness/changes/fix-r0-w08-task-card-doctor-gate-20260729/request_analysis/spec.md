# 规格说明：fix-r0-w08-task-card-doctor-gate-20260729

## 背景

上一 Packet 增加了 W08 非开发用户验收任务卡，但 backend harness manifest 尚未把该文件列为 required。结果是任务卡被删除时，backend doctor 不会直接把 W08 product acceptance surface 判为不完整。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | R0-W08 authority GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 已验证 | 否 |
| 已确认事实 | 任务卡存在但不在 manifest required 中 | RED test `1 failed` | TDD | 是 |
| 已确认事实 | manifest required surfaces 由 backend doctor 检查 | `backend/scripts/harness_doctor.py` | 已验证 | 否 |

## 数据流与调用链

`backend/harness/manifest.json` declares primary harness required files. `backend/scripts/harness_doctor.py` loads the manifest and checks every `required` file. Adding the task card path to `chaotang-true-loop.required` turns the task card into a doctor-enforced surface.

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| backend harness manifest | `backend/harness/manifest.json` | backend doctor | focused manifest test + backend doctor |
| participant task card | `product_acceptance/user_acceptance/participant_task_card.zh-CN.md` | W08 user acceptance sessions | backend doctor required-file check |

## 范围

- Add focused test asserting W08 participant task card is declared in backend harness manifest.
- Add task card path to `chaotang-true-loop.required`.
- Record evidence in root change record.

## 非目标

- No product/runtime code changes.
- No user acceptance evidence creation.
- No W08 closeout.
- No W09 activation.
- No push, deployment, database migration, or listener 3050 operation.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| Task card file removed later | backend doctor reports missing required file | backend doctor |
| Real user records still absent | W08 closeout remains BLOCKED | closeout preflight |

## 风险与回滚边界

Risk is low and limited to harness metadata plus one focused test. Rollback is the manifest entry and focused test file.

## 计划确认记录

- 批准人：User directional approval via "下一步"
- 批准日期：20260729
- 批准范围：continue W08 hardening without fabricating acceptance evidence
- 明确未批准：push、deployment、database migration、3050 operation、W09 activation、synthetic user acceptance evidence

## 验收标准

- RED test fails before manifest update.
- GREEN test passes after manifest update.
- Backend doctor reports required task card and returns 0 errors / 0 warnings.
- W08 closeout preflight remains fail-closed without records JSON.

## 验证计划

- `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py`
- `cd backend && python3 scripts/harness_doctor.py`
- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- `node scripts/harness-doctor.mjs`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `git diff --check`
