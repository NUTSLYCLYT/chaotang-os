# 任务：docs-r0-w08-exact-h-activation-20260728-20260728

## Task 1: Candidate Setup

- [x] Create isolated worktree from local EXT `80940d23...`.
- [x] Create W08 activation Packet.
- [x] Generate review package from `39bd654b..80940d23`.

## Task 2: Authority Profile

- [x] Add R0-W08 active-packet profile.
- [x] Bind profile to W08 evidence root.
- [x] Bind W08 required commands and allowed changed paths.

## Task 3: Evidence

- [x] Generate activation intent.
- [x] Generate owner approval evidence.
- [x] Generate independent review evidence.
- [x] Pin manifest owner/review digests.

## Task 4: Manifest Activation Candidate

- [x] Set `activeWorkPackage = R0-W08`.
- [x] Append R0-W08 ledger entry as `ACTIVE`.
- [x] Preserve W00-W07 as `MERGED_AND_VERIFIED`.
- [x] Preserve W09 inactive.

## Task 5: Verification

- [x] `node --test scripts/execution-authority-v2.nodetest.mjs`
- [x] `node scripts/execution-authority.mjs --check`
- [x] pre-integration `node scripts/execution-authority-v2.mjs --check`
- [x] pre-integration `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- [x] pre-integration `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09`
- [x] pre-integration `node scripts/harness-doctor.mjs`
- [x] `git diff --check -- . ':(exclude).harness/changes/docs-r0-w08-exact-h-activation-20260728-20260728/review_inputs/activation-candidate.diff'`

## Pre-Integration Note

`execution-authority-v2 --check`, W08/W09 authorization, and root doctor
correctly fail closed before EXT fast-forward because
`refs/heads/feature-chaotang-ext` does not yet equal the pinned candidate HEAD.
Post-integration acceptance must rerun these commands from local
`feature-chaotang-ext`.
