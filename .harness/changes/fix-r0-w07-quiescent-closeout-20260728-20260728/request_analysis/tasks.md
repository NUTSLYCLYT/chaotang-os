# 任务：fix-r0-w07-quiescent-closeout-20260728-20260728

## Task 1: Establish Closeout Packet

- [x] Create isolated worktree from local EXT `ceb46c1d...`.
- [x] Create this closeout Packet.
- [x] Record Product Owner authorization and non-goals.

## Task 2: Apply Governance State Transition

- [x] Set `.harness/manifest/execution-authority.v2.json` `activeWorkPackage`
  from `R0-W07` to `null`.
- [x] Set W07 ledger entry from `ACTIVE` to `MERGED_AND_VERIFIED`.
- [x] Preserve W08/W09 inactive; no product/runtime/test code changes.

## Task 3: Verification

- [x] Pre-commit authority guard fails closed on dirty manifest bytes, as expected.
- [ ] Commit exact closeout candidate.
- [x] `node --test scripts/execution-authority-v2.nodetest.mjs`: `73 passed`.
- [x] `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07`:
  `STOP / NO_ACTIVE_WORK_PACKAGE`.
- [x] `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`:
  `STOP / NO_ACTIVE_WORK_PACKAGE`.
- [x] `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09`:
  `STOP / NO_ACTIVE_WORK_PACKAGE`.
- [x] `node scripts/harness-doctor.mjs`: `0 errors / 0 warnings`.
- [x] `git diff --check`
- [ ] Independent read-only review.

## Scope Amendment Needed

- [x] Product Owner approves test-only update to
  `scripts/execution-authority-v2.nodetest.mjs` so real-repository quiescent
  phase assertions accept W07 as the latest merged package after W07 closeout.
- [x] Test-only fixture remediation implemented.

## Completion Boundary

This candidate is not integrated into local `feature-chaotang-ext` until it has
committed exact-H evidence and independent review. It does not push, deploy,
migrate databases, operate 3050, or activate W08/W09.
