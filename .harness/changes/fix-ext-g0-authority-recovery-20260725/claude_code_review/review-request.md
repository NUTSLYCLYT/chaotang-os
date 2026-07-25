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
| Owner approval SHA-256 | `25df77d4b695e539f5344acb4ed03a74499b0d843406e93011d8fee5e924604e` |
| Activation intent | `activation_intent/r0-w06-activation-intent.json` |
| Activation intent SHA-256 | `f8b09ca694ba049420ae3f7572515563e9d5410a0c78819e989b6b31711dd614` |
| Required independent reviewer | `Claude Code` |
| Current authority state | `REVIEW_REQUEST_READY / NOT_ACTIVE / NOT_DEPLOYED` |

## Required inspection

1. Verify the candidate is exactly `8feae838f09ad5202b21332d4280b989ab776bd7`, its tree is exactly
   `9d63f98041e5e13174dbba4c0b9d27eef1471bf9`, and the recovery worktree ancestry contains it.
2. Parse the marked JSON evidence in the owner approval; verify decision `APPROVED`, approver
   `lyt`, one scope item `R0-W06`, the candidate/tree, every stated exclusion, and the activation
   intent digest.
3. Strict-parse the closed JSON activation intent and verify its exact effective base,
   candidate/tree/scope, owner/review evidence paths, `activeWorkPackage=R0-W06`, and complete
   ledger transition ending in one W06 `ACTIVE` entry after W05 `MERGED_AND_VERIFIED`. It is
   non-authorizing and is not final manifest bytes.
4. Verify the authority implementation uses strict JSON parsing with duplicate-key rejection and
   validates owner/review scope, candidate, tree, approval digest, review verdict, activation intent,
   `amendmentGovernance.independentReviewer=Claude Code`, reviewer/approver separation, and
   `productionReady=false` before an active manifest can produce GO.
5. Confirm changed paths are root governance/authority-only. Reject any business/runtime code,
   frontend/backend product changes, deployment path, real-data path, database migration, or
   listener `3050` operation.

## Required commands

```bash
git show -s --format='%H%n%T' 8feae838f09ad5202b21332d4280b989ab776bd7
git merge-base --is-ancestor 8feae838f09ad5202b21332d4280b989ab776bd7 HEAD
sha256sum .harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md
sha256sum .harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json
node --test scripts/execution-authority-v2.nodetest.mjs
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
git diff --check
```

## Verdict rules

Return `NO_GO` for any W01-W05 review reuse, any different candidate or tree, a non-`APPROVED`
owner decision, owner approval or activation-intent digest mismatch, a review verdict other than
manifest `GO`, reviewer other than `Claude Code`, reviewer equal to the owner approver, intent
schema/path/ledger mismatch, any reference to production readiness, or any approval outside R0-W06.
`NO_GO` leaves v2 quiescent and ends the recovery program.

Only a reviewer-created `claude_code_review/exact-h-final.md` may later contain final review
evidence. A `GO` must bind the exact owner approval digest and activation-intent digest in its
marked JSON evidence block, use only authority-review changed paths, and record exactly the required
verification commands. It does not authorize deployment, merge, production claims, W07-W09, real
customer data, database migration, or listener `3050` takeover.
