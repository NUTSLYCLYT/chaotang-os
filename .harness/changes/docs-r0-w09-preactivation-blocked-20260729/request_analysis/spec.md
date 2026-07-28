# 规格说明：docs-r0-w09-preactivation-blocked-20260729

## 背景

用户要求按 harness 推进后续任务。当前 R0-W08 仍是 active work package，但 W08 closeout preflight 因缺真实非开发用户验收 records JSON 而 BLOCKED。根据 execution authority，W09 不能在 W08 未关闭时激活。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W08 authority GO，W09 authority STOP / BLOCKED_DEPENDENCY，W08 closeout BLOCKED | exact commands | Codex | 否 |
| 推测 | W09 将在 W08 quiescent closeout 后重新 exact-H 激活 | 项目治理流程 | Release Governance | 否 |
| 未知问题 | W08 真实用户验收何时完成 | 不适用 | Product Acceptance Owner | 是 |

## 数据流与调用链

EXT exact HEAD
-> check W08 authority
-> check W09 authority
-> run W08 closeout preflight
-> record W09 pre-activation BLOCKED decision

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| W09 blocked decision | EXT Master Governance | Authority Agent / Release Governance | exact command evidence |
| W08 closeout preflight | W08 acceptance runner | W09 preactivation blocker | BLOCKED until records exist |

## 范围

- Record W09 activation blocker.
- Define allowed and forbidden work while W08 remains active.
- Define W09 unblock conditions.
- Preserve no-push/no-deploy/no-DB/no-3050 boundaries.

## 非目标

- Do not modify execution-authority manifest.
- Do not generate owner approval.
- Do not activate W09.
- Do not close W08.
- Do not create product code changes.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| W08 active | W09 activation blocked | authority output |
| W09 requested | STOP / BLOCKED_DEPENDENCY | authority output |
| W08 closeout missing records | W09 remains blocked | closeout preflight |

## 风险与回滚边界

Primary risk is schedule pressure causing W09 activation before W08 evidence closure. This Packet makes the blocker explicit and auditable. Rollback is docs-only.

## 计划确认记录

- 批准人：用户授权长时任务继续按 harness 完成后续
- 批准日期：20260729
- 批准范围：W09 preactivation blocked evidence only
- 明确未批准：W08 closeout、W09 activation、authority manifest changes、push、deployment、database migration、listener 3050 operation

## 验收标准

- W08 authority command returns GO.
- W09 authority command returns STOP / BLOCKED_DEPENDENCY.
- W08 closeout preflight returns BLOCKED due missing records.
- Docs state W09 activation is forbidden until unblock conditions are met.

## 验证计划

- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight`
- `cd backend && python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
