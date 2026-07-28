# 规格说明：docs-r0-w07-closeout-decision-20260728-20260728

## 背景

R0-W07 已完成 W07-A0 `RUNNABLE_MINIMUM` 本地整合。该阶段的目标不是完整产品
发布，而是在现有 `/shangshufang` 与 `/shiguan` 内跑通合成合同的真实后端闭环：
typed server read model、Mission/ReviewPack/ArtifactManifest/ArchiveReceipt 同
lineage 回读、server allowed actions、PARTIAL honesty，以及 focused browser/API
证据。

当前 `R0-W07` 仍在 execution authority v2 manifest 中保持 `ACTIVE`。为了避免
任务状态漂移，需要先形成 closeout decision，再由独立 exact-H closeout Packet
执行 manifest 状态迁移。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W07-A0 已本地整合并登记 receipt | `.harness/changes/feat-r0-w07-a0-runnable-minimum-20260727/summary.md` | Codex verified | 否 |
| 已确认事实 | Local EXT HEAD 为 `6504eda2...`，v2 W07 GO，root doctor 0/0 | `git rev-parse HEAD`、`node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07`、`node scripts/harness-doctor.mjs` | 本 Packet 复核 | 否 |
| 已确认事实 | W08/W09 前置 professional reassignment gate 仍存在 | `.harness/manifest/execution-authority.v2.json` | 本 Packet 复核 | 否 |
| 推测 | W07 可以静默关闭 | 基于 W07-A0 receipt 和 two-pass GO | 需 Product Owner 批准 exact closeout candidate | 是 |
| 未知问题 | W08/W09 的具体 work package scope | 不适用 | 后续 W08/W09 activation Packet 定义 | 否 |

## 数据流与调用链

```text
合同上传/创建
-> MissionContract / DecisionTask binding
-> EvidencePacket / RiskItem
-> FinalMemorial
-> ContractReviewPack
-> ArtifactManifest
-> ArchiveReceipt
-> /shangshufang typed consumption
-> /shiguan exact audit replay
```

W07-A0 只证明上述链路的 `RUNNABLE_MINIMUM`，不证明 production switched，不证明
真实客户数据可用，也不包含 Checkpoint B mission table/migration。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `ContractTaskReadModelV1` | backend typed projection | `/shangshufang` consumer | backend focused tests + frontend Node tests |
| `ContractReviewPack` / `ArtifactManifest` / `ArchiveReceipt` lineage | backend W05/W06/W07 projection | `/shiguan` audit replay | same-lineage tests + archive readback tests |
| `allowed_actions` | backend authority resolver | frontend action policy | server/client focused tests |
| `execution-authority.v2` | root manifest | W07/W08/W09 work governance | v2 CLI + root doctor |

## 范围

- 只形成 W07 closeout decision。
- 固定 W07-A0 accepted evidence。
- 指定后续 quiescent closeout candidate 的允许修改范围。
- 明确 W08/W09 不得由本 Packet 激活。

## 非目标

- 不修改 manifest。
- 不修改产品代码、运行时代码、测试代码。
- 不声明生产上线。
- 不推送远端、不部署、不迁移数据库、不操作 listener 3050。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| W07-A0 已整合但 W07 仍 ACTIVE | 允许继续 closeout decision；不得直接启动 W08/W09 | v2 manifest |
| v1 authority 仍 STOP | 视为旧入口 fail closed；不作为 W07-A0 产品验收失败 | `node scripts/execution-authority.mjs --authorize` |
| W08/W09 被请求 | 必须先完成 W07 quiescent closeout，并满足 professional gate | v2 manifest `professionalReassignment` |
| production 相关请求 | 必须拒绝归入本 Packet；另行 release identity/deployment authority | Non-goals |

## 风险与回滚边界

- 风险：误把 `RUNNABLE_MINIMUM` 描述为完整产品发布。缓解：所有 receipt 使用
  `NOT_DEPLOYED`，并明确 Checkpoint B/W08/W09 未授权。
- 风险：直接在当前 Packet 修改 manifest，形成未审 exact-H 状态迁移。缓解：
  本 Packet 禁止 manifest 修改，下一步单独 closeout candidate。
- 回滚：本 Packet 为文档治理；可 revert 本 docs commit，不影响已整合 W07-A0 代码。

## 计划确认记录

- 批准人：
- 批准日期：待 Product Owner 决策
- 批准范围：待批准生成 isolated W07 quiescent closeout candidate
- 明确未批准：W08/W09 activation、push、deployment、DB migration、3050

## 验收标准

- Packet 清楚区分：W07-A0 已验收整合 vs W07 尚未 closeout。
- 给出下一 exact closeout candidate 的范围、非目标和验证命令。
- v2 W07 authority 与 root doctor 在当前 local EXT 上保持通过。
- 不产生产品代码 diff。

## 验证计划

- `git diff --check`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07`
- `node scripts/harness-doctor.mjs`
- `git status --short --branch`
