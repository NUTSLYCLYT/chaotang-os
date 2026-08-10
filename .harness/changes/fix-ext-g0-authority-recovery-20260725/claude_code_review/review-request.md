# Read-Only Independent Review Request: R0-W06 Activation

## Review target

This is a request for independent read-only review only. Do not edit the tracked v2 manifest, do
not create `exact-h-final.md`, and do not run product implementation, deployment, migration, or
listener operations while reviewing.

| Field | Required value |
| --- | --- |
| Work package | `R0-W06` only |
| Effective base / candidate H | `origin/feature-chaotang-ext@8feae838f09ad5202b21332d4280b989ab776bd7` |
| Tree | `9d63f98041e5e13174dbba4c0b9d27eef1471bf9` |
| Owner approval | `owner_approval/exact-h-approval.md` |
| Owner approval SHA-256 | `4598a0fa9c12a19e9cc5e9bc34f075af552d5d93765a969f6f9d764772c1b7c2` |
| Activation intent | `activation_intent/r0-w06-activation-intent.json` |
| Activation intent SHA-256 | `1608ad619c20207e859a8e0e0dd513dbf294e991930ba1a2f99195e31641e652` |
| Review package | `review_inputs/review-7df6e4e1..e8be2ca9.diff` |
| Review package SHA-256 | `0fdf3da62b977d6935b65c68e5509ee6b52eb98d7ee80a142341625bd4d3f885` |
| Required independent reviewer | `Claude Code` |
| Current authority state | `REVIEW_REQUEST_READY / NOT_ACTIVE / NOT_DEPLOYED` |

## Required inspection

1. Verify the candidate is exactly `8feae838f09ad5202b21332d4280b989ab776bd7`, its tree is exactly
   `9d63f98041e5e13174dbba4c0b9d27eef1471bf9`, and the recovery worktree ancestry contains it.
2. Parse the marked JSON evidence in the owner approval; verify decision `APPROVED`, approver
   `lyt`, one scope item `R0-W06`, the candidate/tree, every stated exclusion, and the activation
   intent digest.
3. Strict-parse the closed JSON activation intent and verify its exact effective base,
   candidate/tree/scope, owner/review evidence paths, review-package path and digest,
   `activeWorkPackage=R0-W06`, and complete ledger transition ending in one W06 `ACTIVE` entry
   after W05 `MERGED_AND_VERIFIED`. It is non-authorizing and is not final manifest bytes.
4. Verify the authority implementation uses strict JSON parsing with duplicate-key rejection and
   validates owner/review scope, candidate, tree, approval digest, review verdict, activation intent,
   `amendmentGovernance.independentReviewer=Claude Code`, reviewer/approver separation, and
   `productionReady=false` before an active manifest can produce GO. It must safely read the pinned
   review package, verify its actual SHA-256, reject unsafe or duplicate diff headers, and require
   review `changedPaths` to equal the package path set exactly.
5. Confirm the package's exact eleven paths are within the narrow root-governance allowlist,
   including only the QA-identified `owner_scope/recovery-boundary.md` and tracked program plan
   additions beyond the existing Task 2 paths. Reject any business/runtime code, arbitrary README,
   broad directory prefix, frontend/backend product change, deployment path, real-data path,
   database migration, or listener `3050` operation.

## Required commands

```bash
git show -s --format='%H%n%T' 8feae838f09ad5202b21332d4280b989ab776bd7
git merge-base --is-ancestor 8feae838f09ad5202b21332d4280b989ab776bd7 HEAD
sha256sum .harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md
sha256sum .harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json
sha256sum .harness/changes/fix-ext-g0-authority-recovery-20260725/review_inputs/review-7df6e4e1..e8be2ca9.diff
node --test scripts/execution-authority.nodetest.mjs
node --test scripts/execution-authority-v2.nodetest.mjs
node scripts/execution-authority.mjs --authorize
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
node scripts/harness-doctor.mjs
git diff --check
```

## Verdict rules

Return `NO_GO` for any W01-W05 review reuse, any different candidate or tree, a non-`APPROVED`
owner decision, owner approval or activation-intent digest mismatch, a review verdict other than
manifest `GO`, reviewer other than `Claude Code`, reviewer equal to the owner approver, intent
schema/path/ledger mismatch, review-package digest/path/header/path-set mismatch, an incomplete or
different verification-command set, any reference to production readiness, or any approval outside
R0-W06.
`NO_GO` leaves v2 quiescent and ends the recovery program.

Only a reviewer-created `claude_code_review/exact-h-final.md` may later contain final review
evidence. A `GO` must bind the exact owner approval digest and activation-intent digest in its
marked JSON evidence block, name the exact pinned review-package path with its actual SHA-256, use
the exact authority-review changed paths parsed from that package, and record exactly the required
verification-command set. It does not authorize deployment, merge, production claims, W07-W09,
real customer data, database migration, or listener `3050` takeover.
