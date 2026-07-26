# CI Summary: R0 Reviewer Reassignment

## Status

`TENTH_CANDIDATE_PRE_FREEZE / NINE_CANDIDATES_REJECTED / NOT_AUTHORIZED`

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

## Fifth Rejected Candidate

```text
candidate = 993edb11c084a8b9365a77151dd9a51bcfcdf599
tree = 6b8b73e9cbcd94f13e53de13626e9db16d7a101d
package = 32af654ccc7bf9212b974c0219c1acaa6774830821aecb159acfe94e422b44e7
pass 1 = NO_GO / HIGH 2 / MEDIUM 0
pass 2 = GO / HIGH 0 / MEDIUM 0
combined = NO_GO
```

## Sixth Candidate Pre-Freeze Verification

```text
authority test suites: 92 pass / 0 fail
project-harness-doctor: 0 errors / 0 warnings
v2 authorize R0-W07: STOP / NO_ACTIVE_WORK_PACKAGE
working diff check: PASS
```

The exact H0-to-H1 ranged diff check must be rerun after commit freeze.

## Sixth Rejected Candidate

```text
candidate = 4751c63b689c3304ea462f468d94aa2ad9a1df62
tree = 1a2878336d455dd6ffb33acd1318aacb8b455700
package = 85ae15c7b0eb7370602c08614c40085b39f603f5b3d8ec823712a89b253ac19f
pass 1 = NO_GO / HIGH 1 / MEDIUM 0
pass 2 = NO_GO / HIGH 0 / MEDIUM 1
```

Both findings traced to the same root cause: the history verifier conflated
the activation commit with current `HEAD` and did not bind live working-tree
authority bytes.

## Seventh Candidate Pre-Freeze Verification

```text
authority test suites: 92 pass / 0 fail
project-harness-doctor: 0 errors / 0 warnings
v1 authorize: STOP / AMENDMENT_APPROVAL_REQUIRED
v2 check: VALID_STRUCTURE / NOT_AN_AUTHORIZATION
v2 authorize R0-W07: STOP / NO_ACTIVE_WORK_PACKAGE
working diff check: PASS
```

Regression coverage proves that a committed two-event activation survives
unrelated descendants, while uncommitted activation and protected-file drift
fail closed. Exact ranged verification must be repeated after commit freeze.

## Seventh Rejected Candidate

```text
candidate = 94f6e6f96da22314c542ca8934a279c16f15bb2c
tree = 4f8dee347217f21471aa0acf0952446094be29d1
package = 0e5af59ec65335ca822019cdb477d8b4cd12344b5f4ed8dc29582a7eee8b57b1
pass 1 = NO_GO / HIGH 1 / MEDIUM 0
pass 2 = NO_GO / HIGH 1 / MEDIUM 0
```

The findings were expired-overlay replay through interrupted history and the
absence of a genuine W07 evidence contract.

## Eighth Candidate Pre-Freeze Verification

```text
authority test suites: 96 pass / 0 fail
project-harness-doctor: 0 errors / 0 warnings
W07 forged self-consistent review package: REJECTED
W07 exact Git review package after separate registration/activation: GO in temp fixture
v1 authorize: STOP / AMENDMENT_APPROVAL_REQUIRED
v2 check: VALID_STRUCTURE / NOT_AN_AUTHORIZATION
v2 authorize R0-W07: STOP / NO_ACTIVE_WORK_PACKAGE
working diff check: PASS
```

The temporary W07 GO proves contract executability only. The real workspace
remains quiescent and is not authorized, pushed, deployed, migrated, or bound
to listener 3050.

## Eighth Rejected Candidate

```text
candidate = 6459279075aabe7cf4cc28d5d14402a110655590
tree = ed5edf0227379ce29f52aa1842ae22f79f81f00f
package = b6a1efb66a11bdf5ed3d6d58f5743aac24df785ef59535165dc10a345e21d05e
pass 1 = GO / HIGH 0 / MEDIUM 0
pass 2 = NO_GO / HIGH 0 / MEDIUM 1
combined = NO_GO
```

The package reader and hardened Git diff were decoded through UTF-8 strings
before equality comparison. That violated the exact-byte contract for invalid
UTF-8 input, so the candidate and its GO result are not reusable.

## Ninth Candidate Pre-Freeze Verification

```text
authority test suites: 96 pass / 0 fail
project-harness-doctor: 0 errors / 0 warnings
non-UTF-8 W07 review package registration/activation fixture: PASS
v2 check: VALID_STRUCTURE / NOT_AN_AUTHORIZATION
v2 authorize R0-W07: STOP / NO_ACTIVE_WORK_PACKAGE
```

Review-package hashing and exact Git diff comparison now preserve raw Buffers
end to end. UTF-8 decoding occurs only for changed-path header parsing. These
results permit candidate freeze and review only; they do not approve the
overlay or activate W07.

## Ninth Rejected Candidate

```text
candidate = 50e05e85f791b8e90c2272155637110426a02b0f
tree = 97ee9f6a2e2d9da0b16f744e3be0ff603d4e6caf
package = 8350e3566375d3aa28e7305f668b3a3f59b56666848ed9317b389b7e2a59e791
pass 1 = NO_GO / HIGH 1 / MEDIUM 2
pass 2 = GO / HIGH 0 / MEDIUM 0
combined = NO_GO
```

The rejected candidate allowed terminal W07 reactivation, decoded other
active-packet evidence before hashing, and reopened paths after checking them.
Neither review result may be reused.

## Tenth Candidate Pre-Freeze Verification

```text
focused TDD RED: 3 expected failures
focused TDD GREEN: 3 pass / 0 fail
authority test suites: 98 pass / 0 fail
project-harness-doctor: 0 errors / 0 warnings
v2 check: VALID_STRUCTURE / NOT_AN_AUTHORIZATION
v2 authorize R0-W07: STOP / NO_ACTIVE_WORK_PACKAGE
working diff check: PASS
```

The activation parent must have no W07 ledger entry. Governed file digests use
raw Buffers, and working-tree reads bind an `O_NOFOLLOW` file descriptor to
the expected repository path through `/proc/self/fd`. Missing platform support
or any binding mismatch fails closed.

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

## Fourth Rejected Candidate

```text
candidate = 8bfeaedb6223d21df9f32b6678e643a9581ea2a5
tree = 4839e45d60dc5c129776da5ad6cb09cc0d14f033
package = c2ae75fd1885f62af46611744da404e94ef4d025edfbfafceb50ac03325b7473
pass 1 = NO_GO / HIGH 1 / MEDIUM 1
pass 2 = GO / HIGH 0 / MEDIUM 0
combined = NO_GO
```

The remaining external-identity finding was resolved by the explicit Product
Owner threat-model B direction. Git replacement-object handling is remediated
in the fifth candidate.

## Fifth Candidate Pre-Freeze Verification

```text
authority test suites: 91 pass / 0 fail
project-harness-doctor: 0 errors / 0 warnings
v2 check: VALID_STRUCTURE / NOT_AN_AUTHORIZATION
v2 authorize R0-W07: STOP / NO_ACTIVE_WORK_PACKAGE
working diff check: PASS
```

The live project manifest does not contain the overlay. The effective reviewer
therefore remains `Claude Code`, and W07 remains stopped.

## Runtime Boundary

`NOT_DEPLOYED / NO_PUSH / NO_DB_MIGRATION / NO_LISTENER_3050_TAKEOVER`
