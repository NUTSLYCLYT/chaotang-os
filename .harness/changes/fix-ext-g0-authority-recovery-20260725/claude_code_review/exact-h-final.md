# R0-W06 Task 2A Final Independent Review Candidate

## Verdict

- `SPEC_COMPLIANCE: GO`
- `QUALITY: GO`
- Findings: `HIGH=0 / MEDIUM=0 / LOW=0`
- State: `REVIEW_ACCEPTED / NOT_ACTIVE / NOT_DEPLOYED`

This review accepts only the R0-W06 activation intent. It does not authorize deployment, merge,
push, production claims, real customer data, database migration, listener `3050` takeover, or any
R0-W07 through R0-W09 work.

## Authority identity

| Field | Exact value |
| --- | --- |
| Work package | `R0-W06` |
| Effective base / candidate H | `origin/feature-chaotang-ext@8feae838f09ad5202b21332d4280b989ab776bd7` |
| Candidate tree | `9d63f98041e5e13174dbba4c0b9d27eef1471bf9` |
| Owner approval path | `.harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md` |
| Owner approval SHA-256 | `4598a0fa9c12a19e9cc5e9bc34f075af552d5d93765a969f6f9d764772c1b7c2` |
| Activation intent path | `.harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json` |
| Activation intent SHA-256 | `1608ad619c20207e859a8e0e0dd513dbf294e991930ba1a2f99195e31641e652` |
| Immutable review input | `.harness/changes/fix-ext-g0-authority-recovery-20260725/review_inputs/review-7df6e4e1..e8be2ca9.diff` |
| Immutable review input SHA-256 | `0fdf3da62b977d6935b65c68e5509ee6b52eb98d7ee80a142341625bd4d3f885` |

The tracked immutable review input is byte-for-byte identical to the previously audited cumulative
package. Its parser-derived path set contains exactly the eleven paths recorded in the evidence
block below.

## Remediation identity

The current remediation was separately reviewed at commit
`617446f5dc1927ae8c4da6222d4e466e6108a52d`, tree
`9a7176210c8d363c6c1e5d156069be279399450c`.

Its exact fix package is
`.superpowers/sdd/2026-07-25-ext-recovery-program/review-e8be2ca9..617446f5.diff`, SHA-256
`a07637736156f5fc2d538ef0671c0861ecaebbfb9cb5abce952e6a86c995d003`. Its ten path headers match
the commit range exactly and remain confined to root governance, authority evidence, loader code,
and authority tests.

## Review results

- `R1-001 RESOLVED`: the active loader reads the pinned review package, verifies its actual
  SHA-256, rejects malformed, unsafe, empty, or duplicate path headers, and requires the review
  path set to equal the complete normalized package path set.
- Exact active-loader evidence returned `GO / APPROVED_WORK_PACKAGE`.
- Fabricated package digest, partial path set, extra path set, missing package, unsafe header,
  duplicate header, and arbitrary command metadata each returned
  `STOP / INVALID_EXECUTION_AUTHORITY`.
- Prior QA-001, QA-002, and QA-003 remediations remain intact: independent reviewer binding,
  activation-intent byte verification and semantic validation, and placeholder-free
  non-authorizing intent all fail closed.
- The scoped `review_inputs/.gitattributes` marks only `*.diff` beneath that directory as binary.
  Both external review packages and ordinary source/docs paths remain attribute-unspecified.
- The tracked v2 manifest remains quiescent with `activeWorkPackage=null`, W05 ending
  `MERGED_AND_VERIFIED`, no W06 `ACTIVE` row, and no tracked final-review file.

## Commands and results

| Command | Result |
| --- | --- |
| `git show -s --format='%H%n%T' 8feae838f09ad5202b21332d4280b989ab776bd7` | exact candidate and tree |
| `git merge-base --is-ancestor 8feae838f09ad5202b21332d4280b989ab776bd7 HEAD` | exit 0 |
| `sha256sum owner_approval/exact-h-approval.md` | exact `4598a0fa...` |
| `sha256sum activation_intent/r0-w06-activation-intent.json` | exact `1608ad61...` |
| `sha256sum review_inputs/review-7df6e4e1..e8be2ca9.diff` | exact `0fdf3da6...` |
| `node --test scripts/execution-authority.nodetest.mjs` | PASS, 10/10 |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | PASS, 52/52 |
| `node scripts/execution-authority.mjs --authorize` | expected exit 2, `STOP / AMENDMENT_APPROVAL_REQUIRED` |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06` | expected pre-activation exit 2, `STOP / NO_ACTIVE_WORK_PACKAGE` |
| `node scripts/harness-doctor.mjs` | PASS, 0 errors and 0 warnings |
| `git diff --check` | clean |

W05, W07, and W09 authorization checks also returned the expected
`STOP / NO_ACTIVE_WORK_PACKAGE`.

## Machine-readable evidence

<!-- execution-authority-v2-evidence:start -->
```json
{
  "evidenceVersion": "execution-authority-v2-evidence.v1",
  "kind": "independent-review",
  "verdict": "GO",
  "reviewer": "Claude Code",
  "workPackage": "R0-W06",
  "effectiveBase": {
    "ref": "origin/feature-chaotang-ext",
    "sha": "8feae838f09ad5202b21332d4280b989ab776bd7"
  },
  "candidateH": "8feae838f09ad5202b21332d4280b989ab776bd7",
  "tree": "9d63f98041e5e13174dbba4c0b9d27eef1471bf9",
  "approvedScope": ["R0-W06"],
  "ownerApprovalPath": ".harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md",
  "ownerApprovalSha256": "4598a0fa9c12a19e9cc5e9bc34f075af552d5d93765a969f6f9d764772c1b7c2",
  "activationIntentPath": ".harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json",
  "activationIntentSha256": "1608ad619c20207e859a8e0e0dd513dbf294e991930ba1a2f99195e31641e652",
  "reviewPackagePath": ".harness/changes/fix-ext-g0-authority-recovery-20260725/review_inputs/review-7df6e4e1..e8be2ca9.diff",
  "diffSha256": "0fdf3da62b977d6935b65c68e5509ee6b52eb98d7ee80a142341625bd4d3f885",
  "changedPaths": [
    ".harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json",
    ".harness/changes/fix-ext-g0-authority-recovery-20260725/ci_result/ci_summary.md",
    ".harness/changes/fix-ext-g0-authority-recovery-20260725/claude_code_review/review-request.md",
    ".harness/changes/fix-ext-g0-authority-recovery-20260725/owner_approval/exact-h-approval.md",
    ".harness/changes/fix-ext-g0-authority-recovery-20260725/owner_scope/recovery-boundary.md",
    ".harness/changes/fix-ext-g0-authority-recovery-20260725/request_analysis/tasks.md",
    ".harness/changes/fix-ext-g0-authority-recovery-20260725/summary.md",
    "docs/superpowers/plans/2026-07-25-ext-recovery-program.md",
    "scripts/execution-authority-v2.nodetest.mjs",
    "scripts/execution-authority.nodetest.mjs",
    "scripts/lib/execution-authority-v2.mjs"
  ],
  "commands": [
    "node --test scripts/execution-authority.nodetest.mjs",
    "node --test scripts/execution-authority-v2.nodetest.mjs",
    "node scripts/execution-authority.mjs --authorize",
    "node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06",
    "node scripts/harness-doctor.mjs",
    "git diff --check"
  ],
  "productionReady": false
}
```
<!-- execution-authority-v2-evidence:end -->
