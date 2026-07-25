# CI Summary: EXT Asset Capture

## Scope

Documentation-only evidence capture in
`governance/ext-asset-capture-20260725`, based on local accepted EXT
`c0a2c7ec2ac38ba522db3f9945bec722bd47c886`.

## Evidence Status

`VERIFIED_COMPLETE / ACCEPTED_NOT_INTEGRATED`

## Independent QA Review

Window 6 reviewed candidate
`4214c0f5f6a173dd732a8ad3d72b69521c59b162` and returned `QA GO` with zero
blocking findings. The four findings from the earlier `25b0b807` `NO-GO` are
closed:

1. Browser Route Repair has one implementation owner, Window 5, and one target,
   `EXT-P2`; `EXT-Q1` is only the later independent QA gate.
2. Court Writer AST Scanner implementation is owned by Window 5; Window 6 is
   read-only.
3. K2 and R1 record group dirty/untracked counts; R3 records a clean source
   with tracked=0 and untracked=0.
4. One-file/one-writer and protected hunk-level integration are explicit for
   `ShangshufangPage.tsx` and `prod-doctor.mjs`.

Window 0/Codex acceptance is recorded below. No integration is claimed.

## Codex Acceptance

Accepted candidate:
`b38c48098c5fdb37e62acd13b1c4ba71514d3e39`

Accepted tree:
`9fd3f61f3c6bb8020838c6a1b0999ab2a76d9a27`

| Fresh check | Result |
| --- | --- |
| Cumulative scope from `c0a2c7ec` | PASS, only five governance files |
| `git diff --check c0a2c7ec..b38c4809` | PASS |
| `node scripts/execution-authority.mjs --check` | `VALID_INACTIVE_GUARD`; non-authorizing |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06` | `GO / APPROVED_WORK_PACKAGE` |
| `node scripts/harness-doctor.mjs` | PASS, 0 errors and 0 warnings |
| Candidate worktree | CLEAN |
| Local `feature-chaotang-ext` | `c0a2c7ec2ac38ba522db3f9945bec722bd47c886` |
| `origin/feature-chaotang-ext` | `8feae838f09ad5202b21332d4280b989ab776bd7` |

Acceptance status is `ACCEPTED_NOT_INTEGRATED`. Explicit integration approval
remains pending.

## Independent Verification

| Check | Result |
| --- | --- |
| Candidate scope | PASS, only the five declared governance files |
| QA metadata update scope | PASS, only `summary.md`, `tasks.md`, and `ci_summary.md` |
| `node scripts/harness-doctor.mjs` | PASS, 0 errors and 0 warnings |
| `git diff --check c0a2c7ec..25b0b807` | PASS; five governance files |
| `git diff --check 25b0b807..4214c0f5` | PASS; five governance files |
| Candidate worktree | CLEAN at review |
| Runtime boundary | `NOT_DEPLOYED` |

## Verification

| Command | Result |
| --- | --- |
| `node scripts/harness-doctor.mjs` | PASS, 0 errors and 0 warnings |
| `git diff --cached --check` | PASS, no whitespace errors |
| `node scripts/execution-authority.mjs --check` | `VALID_INACTIVE_GUARD`; non-authorizing |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06` | `GO / APPROVED_WORK_PACKAGE` |
| Changed-file boundary | PASS, exactly the five declared governance files |

The first doctor run found a missing summary `Change ID`; the summary was
corrected and the complete doctor was rerun successfully. No business tests
are claimed because no business code is changed.

## Baseline Recheck

- Pre-commit HEAD:
  `c0a2c7ec2ac38ba522db3f9945bec722bd47c886`
- Pre-commit tree:
  `b0cc93c7471fdfb70b6de22cbbb232ef5ae39ec9`
- Remote EXT:
  `8feae838f09ad5202b21332d4280b989ab776bd7`
- Changed files: 5
- Independent Window 6 review: `QA GO`, zero blockers
- Codex acceptance: complete for candidate `b38c4809`
- Integration into local `feature-chaotang-ext`: not performed

## Residual Risk

Source assets may drift after the recorded snapshot. A receiving Packet must
recompute the asset identity and hashes or record exact byte differences for
review before acceptance.

## Production Boundary

- Push: not performed
- Deployment: not performed
- Database migration: not performed
- Listener takeover: not performed
- Production state: `NOT_DEPLOYED`
