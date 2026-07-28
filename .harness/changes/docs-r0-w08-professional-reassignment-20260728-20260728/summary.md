# 变更摘要：docs-r0-w08-professional-reassignment-20260728-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本 Packet 只记录 R0-W08 前置 professional reassignment；不激活 W08。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-r0-w08-professional-reassignment-20260728-20260728 |
| 类型 | docs |
| 状态 | CANDIDATE / NON_AUTHORIZING / NOT_DEPLOYED |
| Owner | EXT Master Governance |
| 创建日期 | 20260728 |
| Authorized base | `39bd654b4cac8ee0fa59ddcbd7ad6a79f5ee9097` |
| Base branch | local `feature-chaotang-ext` |

## Product Owner Approval

Product Owner approved:

> 批准基于本地 EXT `39bd654b4cac8ee0fa59ddcbd7ad6a79f5ee9097`
> 创建 isolated R0-W08 professional reassignment Packet；将
> security/legal/release 三角色从默认 owner `lyt` 重新指定为
> `r0-security-owner`、`r0-legal-owner`、`r0-release-owner`；范围仅治理
> manifest、owner evidence、review evidence 和验证，不激活 W08、不修改产品代码、
> 不 push、不部署、不迁移数据库、不操作 3050。

## Goal

Remove the R0-W08/R0-W09 professional gate blocker by assigning the three
required roles away from the default owner:

- `security = r0-security-owner`
- `legal = r0-legal-owner`
- `release = r0-release-owner`

## Scope

- `.harness/manifest/execution-authority.v2.json`
- this Packet's owner evidence, review evidence, summary, spec, tasks, and CI
  record
- focused authority v2 nodetest coverage for default-vs-reassigned professional
  gate behavior

## Non-Goals

- no W08 activation
- no W09 activation
- no product code change
- no push
- no deployment
- no database migration
- no listener 3050 operation
- no production claim

## Expected Authority State

After this Packet:

- `activeWorkPackage` remains `null`
- R0-W08 still returns `STOP / NO_ACTIVE_WORK_PACKAGE`
- when a later approved W08 activation candidate sets W08 active, the
  professional gate should no longer return
  `PROFESSIONAL_REASSIGNMENT_REQUIRED`

## Rollback

Before local integration, revert this candidate. After local integration, undo
requires a separately approved forward governance Packet that reassigns the
roles again. There is no production rollback because no runtime state changes.
