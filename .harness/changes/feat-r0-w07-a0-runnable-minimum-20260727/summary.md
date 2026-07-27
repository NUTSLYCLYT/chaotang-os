# 变更摘要：feat-r0-w07-a0-runnable-minimum-20260727

> 执行授权：`R0-W07 / APPROVED_WORK_PACKAGE`
>
> Product Owner 已批准在 integrated EXT exact H 上执行 Checkpoint A。
> 本 Packet 不授权 Checkpoint B、持久数据库迁移、push、部署或 listener 3050。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w07-a0-runnable-minimum-20260727 |
| 类型 | feat |
| 状态 | `REMEDIATION_VERIFIED / INDEPENDENT_REVIEW_PENDING / NOT_DEPLOYED` |
| Owner | Codex W07 Implementation Lead |
| Product Owner | `lyt` |
| 创建日期 | `2026-07-27` |
| Base H | `ed822255a452e8dd8dda8f86a180fd7c099b181e` |
| Base tree | `0a56a0eab0135dcf46c31e5ae2cbc46f501cfdcb` |
| Integration target | local `feature-chaotang-ext` |
| Authority before first edit | v1 `VALID_INACTIVE_GUARD`; v2 W07 `GO / APPROVED_WORK_PACKAGE` |

## 目标

用现有持久表、W05/W06 能力和现有 `/shangshufang`、`/shiguan` 跑通一条合成合同
真实后端闭环。验收结论最多为 `RUNNABLE_MINIMUM`，不关闭 W07。

## 独立审查状态

两路 Codex 只读审查均为 `NO-GO`。Product Owner 已批准最小 remediation scope
amendment：修复全部 HIGH/MEDIUM，允许修改既有裁决端点及 focused tests 以增加
`tenant_id + user_id` 双重所有权校验，并补 seeded PARTIAL browser refresh 和固定
OpenAPI baseline。全部已报告项已完成 TDD 和本地验证；fresh two-pass GO 前不整合
EXT。

## 允许范围

- `MissionContractV1 -> DecisionTask` 的 R0 唯一兼容绑定。
- 现有 `CourtLoopRun` 上的 mission revision snapshot repository。
- `ContractTaskReadModelV1`、server `allowed_actions` 与 blockers。
- current FinalMemorial/ContractReviewPack、latest ArtifactManifest、exact ArchiveReceipt 同
  lineage 投影。
- 既有 decision endpoint 的 `tenant_id + user_id` 双重所有权校验。
- generated/verified TypeScript consumer。
- 现有 Shangshufang/Shiguan 的 hunk-level 接入。
- 一条 synthetic real-backend browser flow。
- 根、后端和前端 change/evidence/test 文件。

## 禁止范围

- Checkpoint B mission 表、Alembic migration、并发/CAS hardening。
- PARTIAL 跨刷新恢复；Checkpoint A 必须诚实显示 blocker。
- 新页面、Agent、BFF、部门、任务状态机、完成状态或裁决系统。
- `/dadian`、真实客户数据、push、部署、持久 DB 操作和 listener 3050。

## 完成公式

```text
RUNNABLE_MINIMUM =
real backend synthetic flow
+ server-owned read model/actions
+ exact pack/manifest/archive lineage
+ existing two-page consumption
+ honest PARTIAL limitation
+ focused regression and browser evidence
```
