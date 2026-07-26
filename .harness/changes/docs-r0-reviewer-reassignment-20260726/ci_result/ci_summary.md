# CI Summary: R0 Reviewer Reassignment

## Status

`FOURTH_CANDIDATE_REVIEW_READY / THREE_CANDIDATES_NO_GO / NOT_AUTHORIZED`

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

## Remediated Verification

```text
authority test suites: 86 pass / 0 fail
project-harness-doctor: 0 errors / 0 warnings
v1 authorize: STOP / AMENDMENT_APPROVAL_REQUIRED
v2 authorize R0-W07: STOP / NO_ACTIVE_WORK_PACKAGE
git diff --check: PASS
```

This verification permits a new review candidate freeze only. It does not
approve or register the reviewer overlay and does not activate W07.

## Second Rejected Candidate

```text
candidate = 524c7f15c83570bd3662f8d6785a0eb033b4c550
tree = f052e129373980203fc9ccb870e49cd56fb78635
package = 37515799c7f84e57df2a39d7fda3fd7ce0292c753397f49e70b9e69ad15e6d88
pass 1 = NO_GO / HIGH 3 / MEDIUM 1
pass 2 = NO_GO / HIGH 1 / MEDIUM 1
```

The third candidate must carry a fresh verification result. No prior PASS or
review result may be reused.

## Third Candidate Pre-Freeze Verification

```text
authority test suites: 88 pass / 0 fail
project-harness-doctor: 0 errors / 0 warnings
v2 check: VALID_STRUCTURE / NOT_AN_AUTHORIZATION
v2 authorize R0-W07: STOP / NO_ACTIVE_WORK_PACKAGE
working diff check: PASS
```

The exact H0-to-H1 ranged diff check must be rerun after commit freeze.

## Third Rejected Candidate

```text
candidate = 8af162e565345e29ad4fb508e7885dc3578dcaf2
tree = 6e28644ee7a757fff3c6f87b660346d196b1fde2
package = 1e88d3a81cedb496b0693bde09901e09159b32b687141bfb61691fb6aeec3ccb
pass 1 = NO_GO / HIGH 2 / MEDIUM 1
pass 2 = NO_GO / HIGH 2 / MEDIUM 0
```

Its review sessions are now part of the immutable rejection set.

## Fourth Candidate Pre-Freeze Verification

```text
authority test suites: 91 pass / 0 fail
project-harness-doctor: 0 errors / 0 warnings
v2 authorize R0-W07: STOP / NO_ACTIVE_WORK_PACKAGE
working diff check: PASS
```

Exact ranged verification must be repeated after commit freeze.

The live project manifest does not contain the overlay. The effective reviewer
therefore remains `Claude Code`, and W07 remains stopped.

## Runtime Boundary

`NOT_DEPLOYED / NO_PUSH / NO_DB_MIGRATION / NO_LISTENER_3050_TAKEOVER`
