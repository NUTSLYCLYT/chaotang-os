# 变更摘要：fix-ext-g0-authority-recovery-20260725

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录 EXT-G0 候选范围与证据；W06 产品实施仍须独立 review 和 exact-H v2 授权。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-ext-g0-authority-recovery-20260725 |
| 类型 | fix |
| 状态 | REVIEW_READY / NOT_ACTIVE / NOT_DEPLOYED |
| Owner | lyt（recorded product owner）/ EXT-G0 governance implementer |
| 创建日期 | 20260725 |

This root-governance candidate documents the authority procedure for EXT recovery. It does not
activate `R0-W06`, grant a product runtime GO, merge to `origin/feature-chaotang-ext`, deploy,
run a migration, or take over listener `3050`.

## Recovery scope

| Field | Value |
| --- | --- |
| Recovery base | `origin/feature-chaotang-ext@8feae838f09ad5202b21332d4280b989ab776bd7` |
| Recovery base tree | `9d63f98041e5e13174dbba4c0b9d27eef1471bf9` |
| Candidate owner | `lyt` (recorded product owner); implementation owner: `EXT-G0 governance implementer` |
| Candidate scope | Root authority procedure and evidence only: v1 integrity check, v2 scoped decision, and W06 review readiness |
| W06 state | `REVIEW_READY / NOT_ACTIVE`; `activeWorkPackage=null`; no W06 ledger `ACTIVE` entry |
| Product execution decision | Only `node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx>` may decide a scoped package |
| v1 boundary | `node scripts/execution-authority.mjs --check` verifies integrity only; v1 `--authorize` remains `STOP / AMENDMENT_APPROVAL_REQUIRED` |

## Exclusions

- No `frontend/` or `backend/` business/runtime code, tests, prompts, provider configuration, or
  product state changes.
- No v2 manifest activation, no W06 ledger row, and no interpretation of W01–W05 review as W06
  approval.
- No whole-branch merge, historical bulk cherry-pick, dirty-directory copy, remote mutation,
  database migration, listener `3050` takeover, or deployment.

## Rollback

If this candidate is rejected, retain the review evidence and revert its focused governance commit
in a later approved operation. Do not reset a shared worktree or alter the EXT integration line.

## Deployment boundary

`NOT_DEPLOYED`: local authority checks and review readiness are not production evidence and do not
authorize deployment.
