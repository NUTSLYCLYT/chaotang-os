# 规格说明：fix-r0-w08-task-card-content-gate-20260729

## 背景

W08 真实用户验收任务卡已存在并被 backend doctor required surface 覆盖，但它只描述中文用户动作，没有明确绑定产品合同里的 canonical acceptance objects。为了防止后续任务卡漂移，需要 focused test 固化这些对象。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | R0-W08 authority GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 已验证 | 否 |
| 已确认事实 | task card existed but omitted canonical object names | RED test `1 failed, 1 passed` | TDD | 是 |
| 已确认事实 | W08 closeout remains blocked by missing real user records | closeout preflight | 已验证 | 是 |

## 数据流与调用链

Participant task card -> non-developer browser session -> observer checklist -> deidentified approved JSON under `user_acceptance/records/` -> W08 closeout preflight. This Packet only strengthens the first link.

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| participant task card | `participant_task_card.zh-CN.md` | participant / observer | focused test |
| canonical acceptance objects | MissionContract, RiskItem, ContractReviewPack, ArtifactManifest, ArchiveReceipt | W08 closeout evidence review | focused test |

## 范围

- Add focused test requiring canonical acceptance object names in the participant task card.
- Update task card wording to name those objects while keeping it participant-facing.
- Preserve existing W08 closeout gates.

## 非目标

- No runtime/product code changes.
- No user acceptance JSON creation.
- No W08 closeout.
- No W09 activation.
- No push, deployment, database migration, or listener 3050 operation.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| Task card drifts away from canonical objects | focused test fails | `test_backend_harness_manifest.py` |
| Real records missing | closeout remains BLOCKED | closeout preflight |

## 风险与回滚边界

Low risk, documentation and focused test only. Rollback is limited to task card wording, focused test additions, and this change record.

## 计划确认记录

- 批准人：User directional approval via "继续任务 / 下一步"
- 批准日期：20260729
- 批准范围：continue W08 acceptance hardening without fabricating user evidence
- 明确未批准：push、deployment、database migration、3050 operation、W09 activation、synthetic acceptance evidence

## 验收标准

- RED test fails before task card wording update.
- GREEN focused tests pass after task card update.
- W08 closeout preflight remains fail-closed without real user records.
- backend/root doctors pass.

## 验证计划

- `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py`
- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- `cd backend && python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `git diff --check`
