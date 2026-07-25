# CI Summary: EXT-G0 Authority Recovery Candidate

## Candidate state

`REVIEW_REQUEST_READY / NOT_ACTIVE / NOT_DEPLOYED`

| Command | Exit | Result |
| --- | ---: | --- |
| `node --test scripts/execution-authority.nodetest.mjs` | 0 | `10/10` passing; includes semantic-marker, inventory-drift, and Task 1 scope-path regressions |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | `28/28` passing |
| `node scripts/execution-authority.mjs --check` | 0 | `VALID_INACTIVE_GUARD / AMENDMENT_APPROVAL_REQUIRED` |
| `node scripts/execution-authority.mjs --authorize` | 2 | `STOP / AMENDMENT_APPROVAL_REQUIRED` (expected deny) |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06` | 2 | `STOP / NO_ACTIVE_WORK_PACKAGE` (expected deny) |
| `node scripts/harness-doctor.mjs` | 0 | `0 errors, 0 warnings` |
| `git diff --check` | 0 | clean |

The committed Task 1 candidate series begins with `34110e2f`, then plan correction `8c891ffd`,
and this focused H1-M3 follow-up. It remains review-ready only: v2 has
`activeWorkPackage=null`, no W06 `ACTIVE` ledger entry, and no W06 `GO`. No deployment, remote
update, database migration, or listener `3050` operation occurred.

## Task 2A preparation evidence

| Command | Exit | Result |
| --- | ---: | --- |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | `46/46` passing, including temporary-root activation-intent, reviewer-identity, allowed-path, and required-command cases |

The tracked v2 manifest is intentionally unchanged. The new owner approval and activation intent
are review inputs only; `claude_code_review/exact-h-final.md` has not been created. Final Task 2
activation is prohibited until a read-only reviewer produces that exact evidence and an authorized
operator atomically updates the tracked manifest.

## Review handoff

Task 1 supplies only a review-ready procedure candidate. Task 2 must independently verify exact
candidate identity and proposed v2 activation before any W06 authorization can exist.
