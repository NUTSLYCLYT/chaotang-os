# 变更摘要：docs-r0-w08-activation-design-20260728-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-r0-w08-activation-design-20260728-20260728 |
| 类型 | docs |
| 状态 | CANDIDATE_DESIGN / NON_AUTHORIZING / NOT_DEPLOYED |
| Owner | EXT Master Governance |
| 创建日期 | 20260728 |
| Authorized base | `28f8e0c6d566dc866a7de2e4da9d32a8361820a7` |
| Base branch | local `feature-chaotang-ext` |

## 范围

- 主线：R0-W08 activation design only.
- 文件：本 Packet 下 `summary.md`、`request_analysis/spec.md`、
  `request_analysis/tasks.md`、`ci_result/ci_summary.md`。
- 验证：authority remains quiescent, root doctor, diff check。

## Product Owner Approval

Product Owner approved:

> 批准基于本地 EXT `28f8e0c6d566dc866a7de2e4da9d32a8361820a7`
> 创建 isolated R0-W08 activation design Packet；范围仅治理、产品验收规格和证据计划，
> 定义 W08 为 Product Acceptance Hardening：36 黄金合同、10/10 real backend browser flow、
> 5 名非开发用户至少 4 成功、ContractReviewPack 下载与 Shiguan audit replay 验收；
> 不修改产品代码、不激活 W08、不 push、不部署、不迁移数据库、不操作 3050。

## Current Project Goal

Build `feature-chaotang-ext` into the sole trusted R0 integration mainline for
the Chinese manufacturing / B2B contract review loop:

```text
upload contract
-> parse
-> review
-> evidence supplementation
-> risk decision
-> ContractReviewPack
-> PDF/DOCX/JSON ArtifactManifest
-> authorized download
-> Shiguan audit replay
```

## W08 Decision

R0-W08 is `Product Acceptance Hardening`. It is not a feature-expansion package.
Its purpose is to prove the existing W07 runnable minimum as a complete product
workflow with real backend browser evidence and human acceptance.

## Non-Authorizing Boundary

This Packet does not activate W08. It defines the exact activation design,
acceptance contract, evidence plan, and work allocation to be used by a later
exact-H activation candidate.

## Integration Readiness

No W08/W09 worktree or Packet conflict was found before creating this isolated
Packet. W07 is closed and the repository authority is quiescent:

- v1 `--check`: `VALID_INACTIVE_GUARD`
- v2 `R0-W08`: `STOP / NO_ACTIVE_WORK_PACKAGE`
- root doctor: `0 errors / 0 warnings`
- `activeWorkPackage`: expected to remain `null`

## Boundaries

- `NO_PRODUCT_CODE_CHANGE`
- `NO_R0_W08_ACTIVATION`
- `NO_R0_W09_ACTIVATION`
- `NO_PUSH`
- `NOT_DEPLOYED`
- `NO_DB_MIGRATION`
- `NO_LISTENER_3050_TAKEOVER`
- `NO_NEW_AGENT`
- `NO_NEW_PRODUCT_PAGE`
- `NO_SECOND_TASK_STATUS_SYSTEM`

## Rollback

Before local integration, revert this isolated Packet's commit. After local
integration, supersede it with a separately approved governance Packet. There is
no production rollback because this Packet does not deploy or mutate runtime
state.
