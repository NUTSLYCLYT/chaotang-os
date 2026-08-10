# CI Summary: EXT-G0 Authority Recovery Candidate

## Authority state

`AUTHORIZED / ACTIVE / NOT_DEPLOYED`

| Command | Exit | Result |
| --- | ---: | --- |
| `node --test scripts/execution-authority.nodetest.mjs` | 0 | `10/10` passing; includes semantic-marker, inventory-drift, and Task 1 scope-path regressions |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | `52/52` passing, including active-W06 and negative successor/evidence-tampering cases |
| `node scripts/execution-authority.mjs --check` | 0 | `VALID_INACTIVE_GUARD / AMENDMENT_APPROVAL_REQUIRED` |
| `node scripts/execution-authority.mjs --authorize` | 2 | `STOP / AMENDMENT_APPROVAL_REQUIRED` (expected deny) |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06` | 0 | `GO / APPROVED_WORK_PACKAGE` |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W05` | 2 | `STOP / WORK_PACKAGE_MISMATCH` |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07` | 2 | `STOP / BLOCKED_DEPENDENCY` |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09` | 2 | `STOP / BLOCKED_DEPENDENCY` |
| `node scripts/harness-doctor.mjs` | 0 | `0 errors, 0 warnings` |
| `git diff --check` | 0 | clean |

The committed Task 1 candidate series begins with `34110e2f`, then plan correction `8c891ffd`,
and this focused H1-M3 follow-up. The accepted final review now authorizes only R0-W06: v2 has
`activeWorkPackage=R0-W06` and exactly one W06 `ACTIVE` ledger entry. This is not evidence of W06
implementation completion, deployment, remote update, database migration, or listener `3050`
operation.

## Task 2A preparation evidence

| Command | Exit | Result |
| --- | ---: | --- |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | `52/52` passing, including temporary-root activation-intent, reviewer-identity, exact review-package digest/path/header/path-set, allowlist, and required-command cases |
| `sha256sum review_inputs/review-7df6e4e1..e8be2ca9.diff` | 0 | `0fdf3da62b977d6935b65c68e5509ee6b52eb98d7ee80a142341625bd4d3f885` |

The tracked v2 manifest is atomically updated with the exact owner approval and final-review
digests. The owner approval, activation intent, exact QA-reviewed package, and copied final review
remain authority evidence only; authorization does not claim W06 implementation completion,
deployment, merge, push, production readiness, migration, or listener takeover.

## Review handoff

Task 1 supplies only a review-ready procedure candidate. Task 2 must independently verify exact
candidate identity and proposed v2 activation before any W06 authorization can exist.
