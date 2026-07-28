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
- [ ] `node --test scripts/execution-authority-v2.nodetest.mjs`
- [ ] `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07`
- [ ] `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- [ ] `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09`
- [ ] `node scripts/harness-doctor.mjs`
- [ ] `git diff --check`
- [ ] Independent read-only review.

## Completion Boundary

This candidate is not integrated into local `feature-chaotang-ext` until it has
committed exact-H evidence and independent review. It does not push, deploy,
migrate databases, operate 3050, or activate W08/W09.
