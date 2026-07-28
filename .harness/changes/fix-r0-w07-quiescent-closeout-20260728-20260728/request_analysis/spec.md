# 规格说明：fix-r0-w07-quiescent-closeout-20260728-20260728

## 背景

W07-A0 `RUNNABLE_MINIMUM` has been accepted and locally integrated into
`feature-chaotang-ext`. A closeout decision Packet
`docs-r0-w07-closeout-decision-20260728-20260728` recommends a quiescent W07
closeout before any W08/W09 work.

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W07-A0 accepted receipt exists | `.harness/changes/feat-r0-w07-a0-runnable-minimum-20260727/summary.md` | verified | 否 |
| 已确认事实 | W07 closeout decision exists | `.harness/changes/docs-r0-w07-closeout-decision-20260728-20260728/summary.md` | verified | 否 |
| 已确认事实 | User approved this isolated closeout Packet | current Packet summary | Product Owner | 否 |
| 未知问题 | W08/W09 scope | 不适用 | future activation Packet | 否 |

## 数据流与调用链

This Packet changes only governance state:

```text
execution-authority.v2.json
R0-W07 ACTIVE -> MERGED_AND_VERIFIED
activeWorkPackage R0-W07 -> null
R0-W08/R0-W09 remain not active
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `activeWorkPackage` | `.harness/manifest/execution-authority.v2.json` | `scripts/execution-authority-v2.mjs` | must become `null` |
| `workPackageLedger` | `.harness/manifest/execution-authority.v2.json` | authority v2 and root doctor | W07 must become `MERGED_AND_VERIFIED` |
| `professionalReassignment` | existing manifest | future W08/W09 gates | preserved unchanged |

## 范围

- `.harness/manifest/execution-authority.v2.json`
- `.harness/changes/fix-r0-w07-quiescent-closeout-20260728-20260728/**`

## 非目标

- Product code, runtime code, frontend, backend business logic, migrations.
- W08/W09 activation.
- Push, deployment, production claims, listener 3050 operations.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| W07 authorize after closeout | `STOP / NO_ACTIVE_WORK_PACKAGE` | v2 CLI |
| W08/W09 authorize after closeout | `STOP / NO_ACTIVE_WORK_PACKAGE` | v2 CLI |
| root doctor | `0 errors / 0 warnings` | root doctor |
| v1 authority | still fail-closed; not used to claim product execution | v1 CLI |

## 风险与回滚边界

Risk: closing W07 could be mistaken for W08/W09 activation. Mitigation: manifest
sets `activeWorkPackage=null`; W08/W09 CLI must STOP.

Rollback: revert the closeout candidate before integration. After integration,
authority rollback requires a separately approved governance event.

## 计划确认记录

- 批准人：`lyt`
- 批准日期：`2026-07-28`
- 批准范围：governance manifest and closeout evidence only
- 明确未批准：W08/W09 activation, product code, push, deployment, DB migration, 3050

## 验收标准

- Manifest has no active work package.
- W07 ledger entry is `MERGED_AND_VERIFIED`.
- W08/W09 remain inactive.
- Authority tests and root doctor pass.
- Changed files are limited to manifest and this Packet.

## 验证计划

- `node --test scripts/execution-authority-v2.nodetest.mjs`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
