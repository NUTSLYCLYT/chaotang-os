# 变更摘要：fix-r0-w07-quiescent-closeout-20260728-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w07-quiescent-closeout-20260728-20260728 |
| 类型 | fix |
| 状态 | CANDIDATE_VERIFIED / INDEPENDENT_REVIEW_PENDING / NOT_DEPLOYED |
| Owner | EXT Master Governance |
| 创建日期 | 20260728 |
| Authorized base | `ceb46c1dddb24243170936a80b6440a72f23f3b9` |
| Base branch | local `feature-chaotang-ext` |

## 范围

- 主线：R0-W07 quiescent closeout。
- 文件：`.harness/manifest/execution-authority.v2.json` 与本 closeout Packet。
- 验证：authority tests、W07/W08/W09 CLI、root doctor、diff check。

## Product Owner Approval

Product Owner approved:

> 批准基于本地 EXT `ceb46c1dddb24243170936a80b6440a72f23f3b9`
> 创建 isolated R0-W07 quiescent closeout Packet；范围仅治理 manifest 与
> closeout evidence，将 R0-W07 标记为 `MERGED_AND_VERIFIED`、`activeWorkPackage`
> 置空；不激活 W08/W09、不修改产品代码、不 push、不部署、不迁移数据库、不操作 3050。

## Intended Outcome

Close R0-W07 from `ACTIVE` to `MERGED_AND_VERIFIED` and set
`activeWorkPackage=null`. This is a quiescent governance event. It does not
activate R0-W08 or R0-W09 and does not authorize product implementation.

## Current Blocker

The committed closeout candidate `53a28d602711693c18967271dab1f5cfdf15ab35`
correctly makes W07/W08/W09 return `STOP / NO_ACTIVE_WORK_PACKAGE`, and root
doctor returns `0 errors / 0 warnings`. However, the full
`scripts/execution-authority-v2.nodetest.mjs` suite still has real-repository
phase assertions that expect the last merged package to be `R0-W06`. After W07
closeout, the last merged package is correctly `R0-W07`, so three tests fail
with expected `R0-W06` vs actual `R0-W07`.

Fixing this requires a test-only scope amendment for
`scripts/execution-authority-v2.nodetest.mjs`. This Packet will not modify that
file without Product Owner approval.

## Test-Only Scope Amendment

Product Owner approved a test-only amendment allowing only
`scripts/execution-authority-v2.nodetest.mjs` to update the real-repository
quiescent phase fixture. The fixture now derives quiescent state from zero ACTIVE
entries and the latest `MERGED_AND_VERIFIED` ledger entry, which is `R0-W07`
after this closeout.

Fresh verification:

- `node --test scripts/execution-authority-v2.nodetest.mjs`: `73 passed`
- `R0-W07`: `STOP / NO_ACTIVE_WORK_PACKAGE`
- `R0-W08`: `STOP / NO_ACTIVE_WORK_PACKAGE`
- `R0-W09`: `STOP / NO_ACTIVE_WORK_PACKAGE`
- root doctor: `0 errors / 0 warnings`

## Boundaries

- `NOT_DEPLOYED`
- `NO_PUSH`
- `NO_DB_MIGRATION`
- `NO_LISTENER_3050_TAKEOVER`
- `NO_R0_W08_ACTIVATION`
- `NO_R0_W09_ACTIVATION`
- `NO_PRODUCT_CODE_CHANGE`

## Rollback

Before local integration, revert this isolated Packet's commits. After local
integration, authority rollback requires a separately approved governance event;
it is not a production rollback.
