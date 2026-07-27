# 变更摘要：feat-r0-w07-a0-runnable-minimum-20260727

> 执行授权：`R0-W07 / APPROVED_WORK_PACKAGE`
>
> Product Owner 已批准在 integrated EXT exact H 上执行 Checkpoint A。
> 本 Packet 不授权 Checkpoint B、持久数据库迁移、push、部署或 listener 3050。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w07-a0-runnable-minimum-20260727 |
| 类型 | feat |
| 状态 | `IMPLEMENTATION_CANDIDATE_FROZEN / INDEPENDENT_REVIEW_PENDING / NOT_DEPLOYED` |
| Owner | Codex W07 Implementation Lead |
| Product Owner | `lyt` |
| 创建日期 | `2026-07-27` |
| Base H | `ed822255a452e8dd8dda8f86a180fd7c099b181e` |
| Base tree | `0a56a0eab0135dcf46c31e5ae2cbc46f501cfdcb` |
| Implementation candidate H | `b12b0db4fecda88f7a5f44cc2205a8bb534cae2f` |
| Implementation candidate tree | `8df6679495f46006d9d9e70ccd05d141b3f393cb` |
| Integration target | local `feature-chaotang-ext` |
| Authority before first edit | v1 `VALID_INACTIVE_GUARD`; v2 W07 `GO / APPROVED_WORK_PACKAGE` |

## 目标

用现有持久表、W05/W06 能力和现有 `/shangshufang`、`/shiguan` 跑通一条合成合同
真实后端闭环。验收结论最多为 `RUNNABLE_MINIMUM`，不关闭 W07。

## 独立审查状态

截至 review envelope `a8e88589...` 的独立 Codex 只读审查均为 `NO-GO`。
最新适用 findings 已按批准 scope 完成 TDD：合同 final 存在时 exact CourtReview
必须存在且匹配 task/tenant/final；runtime parser 使用结构化 schema 拒绝 malformed
optional facts、坏 hash/date 和矛盾 DECIDE；史馆保留 `LIVE_ENGINE` 的真实来源；
上书房从 URL 首帧起阻断目标合同的 legacy footer、modal 和 handler。审查提出的
“PARTIAL 不得显示 LIVE”不适用：设计中 `LIVE` 是来源真实性，`PARTIAL` 是交付
完整度；现有合同只禁止把 PARTIAL 宣称为 READY、ARCHIVED 或 resumable。W06 明确
批准的是 tenant-owned artifact，故“同租户再按 user 隔离”也不作为 W07 缺陷扩展。
新 implementation candidate 已冻结；fresh two-pass GO 前不整合 EXT。

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
- test-only、JWT-protected browser launcher：
  `backend/harness/chaotang-true-loop/scripts/run_w07_runnable_backend.py`；该脚本只在
  隔离进程中加载 canonical app，并注册 `include_in_schema=False` 的 seed route；
  不进入产品 OpenAPI，只使用临时 runtime/DB。
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
