# 任务：docs-r0-w08-activation-design-20260728-20260728

## Task 1: Conflict And Authority Check

- [x] Confirm isolated worktree exists from local EXT
  `28f8e0c6d566dc866a7de2e4da9d32a8361820a7`.
- [x] Confirm no existing W08/W09 worktree or Packet conflict was found.
- [x] Confirm v1 is inactive guard only.
- [x] Confirm v2 W08 returns `STOP / NO_ACTIVE_WORK_PACKAGE`.

## Task 2: W08 Product Acceptance Contract

- [x] Define W08 as `Product Acceptance Hardening`.
- [x] Bind W08 to the original product goal:
  upload -> parse -> review -> evidence supplementation -> risk decision ->
  ContractReviewPack -> download -> Shiguan audit replay.
- [x] Define 36 golden contracts as a hard gate.
- [x] Define 10/10 real backend browser flow as a hard gate.
- [x] Define five non-developer users with at least four successful completions
  as a hard gate.
- [x] Define ContractReviewPack download and Shiguan audit replay evidence.

## Task 3: Complete Work Plan

- [x] Define Phase 0 Governance / Authority.
- [x] Define Phase 1 Golden Dataset Contract.
- [x] Define Phase 2 Real Backend Browser Flow.
- [x] Define Phase 3 Human Acceptance.
- [x] Define Phase 4 Artifact And Audit Evidence.
- [x] Define Phase 5 Closeout / W09 Readiness.
- [x] Define multi-window ownership, scope, out-of-scope, and verification.

## Task 4: Boundary Preservation

- [x] State that this Packet does not activate W08.
- [x] State no product code changes are included.
- [x] State no push, deployment, DB migration, or listener 3050 operation.
- [x] State no new agent, page, BFF, or task status system.
- [x] State W09 waits for W08 evidence and remains separate from deployment.

## Task 5: Verification

- [x] `git status --short --branch`
- [x] `node scripts/execution-authority.mjs --check`
- [x] `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- [x] `node scripts/harness-doctor.mjs`
- [x] `git diff --check`

## Future Activation Queue

These tasks are not authorized by this Packet. They become actionable only after
a later exact-H W08 activation candidate is approved.

- [ ] Create machine-readable W08 work package activation candidate.
- [ ] Assign W08 owners and file locks.
- [ ] Build the 36 golden contract matrix.
- [ ] Run the 10/10 real backend browser flow.
- [ ] Run five non-developer user tests and collect evidence.
- [ ] Verify ContractReviewPack download and Shiguan replay.
- [ ] Run independent QA review.
- [ ] Close W08 and hand evidence to W09.
