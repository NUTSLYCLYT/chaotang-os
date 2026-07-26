# CI Summary: R0 Reviewer Reassignment

## Status

`REMEDIATION / PREVIOUS_CANDIDATE_NO_GO / NOT_AUTHORIZED`

## Baseline

```text
local EXT = 55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca
effective reviewer = Claude Code
activeWorkPackage = null
R0-W07 = STOP / NO_ACTIVE_WORK_PACKAGE
```

## Required Evidence

- overlay validator RED/GREEN;
- original amendment digest unchanged;
- two unique read-only Codex QA reviews;
- exact candidate H/tree/review-package digest;
- Product Owner exact-H approval;
- atomic overlay verification.

## Observed RED

```text
SyntaxError: amendment-governance.mjs does not provide
effectiveIndependentReviewer
```

The current governance implementation has no reviewer-reassignment API.

## Rejected Candidate

```text
candidate = a3652c91eaf02f868e8741ed9cf8e1c87db80ec8
tree = 3a5b928e41e43044a33c190e43565d44ef791b83
package = da068313616f240ece9aee8a76c7f4e7c7b03a3f0ceaec68e01d2624a33b918d
pass 1 = NO_GO / HIGH 3 / MEDIUM 1
pass 2 = NO_GO / HIGH 2 / MEDIUM 2
```

The earlier GREEN/doctor claim is superseded. Root doctor failed after
`.gitattributes` became tracked; that file has been removed in remediation.

## Previous Test Result

```text
node --test scripts/r0-amendment-check.nodetest.mjs \
  scripts/execution-authority-v2.nodetest.mjs

tests 80
pass 80
fail 0
```

GREEN covers closed overlay validation, W07-only reviewer resolution, unique
read-only review sessions, zero HIGH/MEDIUM findings, and byte-level digest
verification for all overlay evidence files.

This result applied to the rejected candidate and is not acceptance evidence.
Both authority commands remained fail-closed:

```text
v1: STOP / AMENDMENT_APPROVAL_REQUIRED
v2 R0-W07: STOP / NO_ACTIVE_WORK_PACKAGE
```

The live project manifest does not contain the overlay. The effective reviewer
therefore remains `Claude Code`, and W07 remains stopped.

## Runtime Boundary

`NOT_DEPLOYED / NO_PUSH / NO_DB_MIGRATION / NO_LISTENER_3050_TAKEOVER`
