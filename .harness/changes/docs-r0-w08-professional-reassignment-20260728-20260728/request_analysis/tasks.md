# 任务：docs-r0-w08-professional-reassignment-20260728-20260728

## Task 1: Establish Isolated Packet

- [x] Create isolated worktree from local EXT `39bd654b...`.
- [x] Create root `.harness/changes/` Packet.
- [x] Record Product Owner scope and non-goals.

## Task 2: Reassign Professional Roles

- [x] Set `professionalReassignment.assignments.security` to
  `r0-security-owner`.
- [x] Set `professionalReassignment.assignments.legal` to `r0-legal-owner`.
- [x] Set `professionalReassignment.assignments.release` to
  `r0-release-owner`.
- [x] Preserve `activeWorkPackage = null`.
- [x] Preserve W07 as `MERGED_AND_VERIFIED`.

## Task 3: Focused Validation

- [x] Add a policy-level test that default assignment returns
  `PROFESSIONAL_REASSIGNMENT_REQUIRED`.
- [x] Add a policy-level test that reassigned W08 proceeds to
  `POLICY_ELIGIBLE`.

## Task 4: Evidence

- [x] Add owner evidence for the three assignments.
- [x] Add Codex review evidence scaffold.
- [x] Finalize Codex review evidence after verification.

## Task 5: Verification

- [x] `node --test scripts/execution-authority-v2.nodetest.mjs`
- [x] `node scripts/execution-authority.mjs --check`
- [x] `node scripts/execution-authority-v2.mjs --check`
- [x] `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- [x] `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09`
- [x] `node scripts/harness-doctor.mjs`
- [x] `git diff --check`

## Completion Boundary

This Packet is not integrated into local `feature-chaotang-ext` until it has
fresh verification and review. It does not activate W08.
