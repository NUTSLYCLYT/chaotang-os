# 变更摘要：fix-ext-g0-authority-recovery-20260725

> 执行授权：`R0-W06 AUTHORIZED_BY_TRACKED_V2_MANIFEST`
> 本目录记录已审阅的 W06 授权；授权不证明 W06 产品实施、部署或生产状态。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-ext-g0-authority-recovery-20260725 |
| 类型 | fix |
| 状态 | AUTHORIZED / ACTIVE / NOT_DEPLOYED |
| Owner | lyt（recorded product owner）/ EXT-G0 governance implementer |
| 创建日期 | 20260725 |

This root-governance record documents the independently reviewed authority transition for EXT
recovery. The tracked v2 manifest authorizes `R0-W06` only. It does not show W06 implementation
completion, merge to `origin/feature-chaotang-ext`, push, deployment, a migration, or listener
`3050` takeover.

## Recovery scope

| Field | Value |
| --- | --- |
| Recovery base | `origin/feature-chaotang-ext@8feae838f09ad5202b21332d4280b989ab776bd7` |
| Recovery base tree | `9d63f98041e5e13174dbba4c0b9d27eef1471bf9` |
| Candidate owner | `lyt` (recorded product owner); implementation owner: `EXT-G0 governance implementer` |
| Candidate scope | Root authority procedure and evidence only: v1 integrity check, v2 scoped decision, and W06 authorization evidence |
| W06 state | `AUTHORIZED / ACTIVE / NOT_DEPLOYED`; `activeWorkPackage=R0-W06`; exactly one W06 ledger `ACTIVE` entry |
| Product execution decision | Only `node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx>` may decide a scoped package |
| v1 boundary | `node scripts/execution-authority.mjs --check` verifies integrity only; v1 `--authorize` remains `STOP / AMENDMENT_APPROVAL_REQUIRED` |

## Exclusions

- No `frontend/` or `backend/` business/runtime code, tests, prompts, provider configuration, or
  product state changes.
- No authorization beyond R0-W06 and no interpretation of W01–W05 review as W06 approval.
- No whole-branch merge, historical bulk cherry-pick, dirty-directory copy, remote mutation,
  database migration, listener `3050` takeover, or deployment.

## Rollback

If this candidate is rejected, retain the review evidence and revert its focused governance commit
in a later approved operation. Do not reset a shared worktree or alter the EXT integration line.

## Deployment boundary

`NOT_DEPLOYED`: local authority checks and review readiness are not production evidence and do not
authorize deployment.

## Task 2B activation

- Positive W06-only owner approval: `owner_approval/exact-h-approval.md`, with one strict JSON
  evidence block bound to `8feae838f09ad5202b21332d4280b989ab776bd7`, tree
  `9d63f98041e5e13174dbba4c0b9d27eef1471bf9`, the W06-only scope, exclusions, and the activation
  intent digest.
- Exact non-authorizing activation intent:
  `activation_intent/r0-w06-activation-intent.json`. Its strict closed JSON shape records the only
  permitted W06 ledger transition, evidence paths, and the exact pinned review package
  `review_inputs/review-7df6e4e1..e8be2ca9.diff` with SHA-256
  `0fdf3da62b977d6935b65c68e5509ee6b52eb98d7ee80a142341625bd4d3f885`; it is neither tracked v2
  manifest bytes nor an authorization.
- Final independent review: `claude_code_review/exact-h-final.md`, copied byte-for-byte from the
  accepted review candidate and pinned in the manifest at SHA-256
  `7453e1642d2150d13ee69eb38f49450d1fc69b0b2dbb8dce65b557230941dd62`.
- The v2 loader now requires uniquely marked, duplicate-key-free JSON evidence, a pinned activation
  intent whose actual SHA-256 and semantics match an active manifest, a pinned review package whose
  actual SHA-256 and parsed `diff --git` paths exactly match review evidence, and an independent
  reviewer exactly equal to amendment governance's `Claude Code` assignment and different from the
  owner. The resulting manifest authorizes only R0-W06; W05 and successors remain stopped.
