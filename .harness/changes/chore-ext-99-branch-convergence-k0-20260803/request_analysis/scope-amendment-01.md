# DRAFT Scope Amendment 01: Pre-Integration Authority Sequence

> Status: `DRAFT_REQUIRES_USER_APPROVAL`
>
> This document does not change authority, move `feature-chaotang-ext`, approve
> integration, or modify the implementation plan by itself.

## Trigger

Task 1 Step 4 currently expects the root Harness doctor to pass on an isolated
candidate before independent review. The repository's active W08 authority
contract intentionally makes that state impossible: while an isolated
candidate is checked out, `HEAD` differs from `refs/heads/feature-chaotang-ext`,
so authority v2 and the root doctor fail closed with exactly:

```text
active-packet EXT ref must equal pinned HEAD
```

This behavior is already documented as the expected pre-integration result in:

- `.harness/changes/docs-r0-w08-exact-h-activation-20260728-20260728/request_analysis/spec.md`
- `.harness/changes/docs-r0-w08-exact-h-activation-20260728-20260728/ci_result/ci_summary.md`
- `.harness/changes/feat-r0-w07-a0-runnable-minimum-20260727/ci_result/ci_summary.md`

Changing the authority manifest or moving the EXT ref to make a candidate
doctor pass would bypass the intended trust boundary and is not proposed.

## Proposed minimal sequencing correction

Replace only the Task 1 Step 4/5 ordering and expected doctor result:

1. On the isolated exact-H candidate, require the convergence tests, CLI,
   `git diff --check`, clean worktree, exact tree, and frozen-ref verification
   to pass.
2. On that pre-integration candidate, require authority v2 and root doctor to
   fail for the single expected reason `active-packet EXT ref must equal pinned
   HEAD`; any additional error is a Packet failure.
3. Obtain an independent read-only review bound to the exact candidate H/tree
   and diff digest.
4. Only after reviewer GO, explicit user integration approval, an integration
   lease, and a clean/coordinated EXT target may the reviewed commit be applied
   through the repository's approved non-merge-candidate integration method.
5. On the resulting EXT exact-H, require authority v2 GO and root doctor
   `0 errors, 0 warnings`; this is the post-integration proof.

## Unchanged boundaries

- The 99-ref denominator, 47 families, dispositions, schema, and CLI stay
  unchanged.
- Independent review remains before local EXT integration.
- No merge, cherry-pick, fast-forward, ref movement, push, deploy, Runtime,
  database, or branch deletion is authorized by this draft.
- Task 2 remains blocked until Task 1 has an approved sequence, an independent
  review receipt, and the required integration decision.

## Approval requested

Approve this sequencing correction only. After approval, the implementation
plan may be updated to distinguish `PRE_INTEGRATION_EXPECTED_STOP` from
`POST_INTEGRATION_REQUIRED_PASS` without modifying execution-authority code or
manifest data.
