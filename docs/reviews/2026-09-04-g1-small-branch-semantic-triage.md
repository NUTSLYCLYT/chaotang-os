# G1 Small Branch Semantic Triage · 2026-09-04

## Status

Review

## Baseline

- Repository: `gitee.com/msxn/chaotang-os`
- Branch: `origin/ext-dev`
- Baseline HEAD: `d2749a32454e0956f6a881dbb1ad7462a8a734fe`
- Observation mode: read-only semantic triage
- Production deployment: not authorized and not performed

This review turns the small historical branch set into an execution queue. It
does not approve cherry-picking, merging, rewriting, deleting, or inheriting
old candidate identity.

## Key finding

Several small-ahead branches are semantically small but structurally unsafe to
merge directly because their bases predate the current `ext-dev` authority,
approval, and product lineage. Direct branch diffs show many current mainline
files as deleted. Therefore each branch must be treated as a donor and replayed
forward through a new successor when its value is still desired.

## Decisions

| Donor | Tip | Decision | Reason |
| --- | --- | --- | --- |
| `ext-dev` | `0cfc865ceb0c02973113671e6290155ea2cda6d3` | `REPLAY_NEXT` | Contains the only observed `studyTaskCockpit` pure frontend projection. Current mainline has the First Decree approval but lacks `frontend/src/features/study-visual/studyTaskCockpit.ts` and its test. |
| `codex/packet-14-trusted-artifact-delivery-contract-20260822` | `746c12817c0b5b7f1864481720dc91f4ef720867` | `REVIEW_WITH_P14_SUCCESSOR` | Trusted artifact delivery value is real, but current mainline already contains later P14 exact30 governance and corrective lineages. Replay must compare against current P14 contracts, not the old branch tree. |
| `codex/harness-only-worktree` | `c5d5bd429d4398391edf3d44741faf1a9d387c3f` | `DOC_ARCHIVE_REVIEW` | Latest tip is a Hubu accounting office MVP plan. It may be valuable product planning, but it does not justify runtime replay. Earlier commits in the seven-commit branch need separate review before any Harness-only changes. |
| `codex/ext-dev-legacy-92007a-20260825` / `codex/ext-dev-pre-sync-20260823` | `92007a2d9a7895d5b1418a603da5fb46746cf8cb` | `REVIEW_FOR_EVAL_DISTILLATION` | Contains eval runner semantics around separating output text from input task. It may be useful for future evaluation quality, but it must not replace the current Harness without a scoped successor. |
| `codex/tenant-principal-v1-governance-20260828` | `c471b034353440401b18995ac13fbfdbe5cbc966` | `SUPERSEDED` | Tenant Principal was later advanced through exact15 and authority-lineage corrections on the mainline. Old exact14/exact15 donor identity must not be inherited. |
| `codex/packet01-battery-safety-e67beabc-20260825` | `e67beabc50ccb338e851053577f963516b9834f7` | `SUPERSEDED` | P01 Battery Safety was later closed by exact10 and pushed as `29094bc2d7c52f89122338975eddb8130c433c35`, now contained in mainline history. |
| `codex/rc1-release-blocker-remediation-approval-20260817` | `dd28a1c133f0c0327086ded8006998d22163f1bd` | `SUPERSEDED / REFERENCE_ONLY` | Current mainline already contains release evidence, offline release, SQLite backup, runtime lock, and acceptance scripts. Old RC1 bytes should be used only as provenance. |
| `codex/rc1-release-verification-sandbox-corrective-v2-20260819` | `4c0b10630859eb143a6a63c2ed2332352f6d50ec` | `REFERENCE_ONLY` | Later credential-separated verifier and installed-acceptance corrective packages supersede the sandbox corrective approval. |
| `codex/readiness-fingerprint-repair-v2-20260816` | `2fac9ffc825893559885f9331712e9784d85c9d7` | `SUPERSEDED` | Current readiness validator successor already landed a fourth compatibility pair and passed full matrix. |
| `feature-chaotang-release` | `44aa7f0674c1304f85afcd31d7b1e5087ee5e74e` | `DOC_ARCHIVE_REVIEW` | Contains old Harness doctor Python fallback change records. Current Harness passes; archive only unless a present failure requires replay. |

## First replay candidate

The strongest near-term replay candidate is First Decree task cockpit:

- Missing current paths:
  - `frontend/src/features/study-visual/studyTaskCockpit.ts`
  - `frontend/src/features/study-visual/studyTaskCockpit.test.ts`
- Donor source:
  - `0cfc865ceb0c02973113671e6290155ea2cda6d3`
- Semantics:
  - Pure frontend projection.
  - Distinguishes `LOCAL` from `API_LIVE`.
  - Prevents a retained draft, enqueueing state, stale error, or bare job ID
    from masquerading as a verified API-backed task.
  - Exposes first-decree acceptance fields without inventing placeholder truth.

This is aligned with the roadshow goal because it improves the user-facing
front-door task cockpit without touching backend authority, release machinery,
P01, P10, or P14.

## Replay constraints for First Decree cockpit

If promoted, the successor should:

1. Use current `origin/ext-dev` as base.
2. Treat `0cfc865ce` only as byte/semantic donor.
3. Preserve the current `/study` and `/dadian` browser chain.
4. Avoid adding a second frontend store or task authority.
5. Keep backend state, authority, and product evidence sources unchanged.
6. Run frontend focused tests, full frontend tests, typecheck, lint, production
   build, root Harness, V2 convergence, and a real browser smoke of `/study`
   plus `/dadian`.

## Stop conditions for replay

- The replay needs backend runtime changes.
- The replay creates another task ledger, approval system, or evidence source.
- `/study` or `/dadian` loses current route, login, or stale-session behavior.
- The cockpit labels unverified local state as API-backed truth.
- Frontend build, tests, or root Harness fail.

## Decision

`G1_TRIAGE_RECORDED / FIRST_DECREE_COCKPIT_REPLAY_NEXT / BULK_BRANCH_MERGE_FORBIDDEN`

The correct next product move is a new narrow First Decree cockpit successor
based on the latest `ext-dev`, not a merge of the old `ext-dev` branch.
