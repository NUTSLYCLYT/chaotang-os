# R0 Reviewer Reassignment Implementation Plan

**Goal:** Create and verify a W07-only reviewer-reassignment overlay from
`Claude Code` to `Codex Independent QA`.

**Baseline:** Local EXT
`55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca`, tree
`f692b9090be04722595bbedd8725578f5ed9a745`.

## Task 1: Freeze Scope And RED

- [ ] Create the non-authorizing reassignment Packet.
- [ ] Add validator tests for the approved overlay shape.
- [ ] Add negative tests for scope expansion, one review, reused sessions,
  writable review, non-GO verdict, and digest drift.
- [ ] Prove the current validator rejects or ignores the required overlay.

## Task 2: Overlay Validator

- [ ] Add a closed overlay validator to amendment governance.
- [ ] Preserve the original amendment and approval evidence.
- [ ] Resolve the effective reviewer by work package.
- [ ] Keep packages outside R0-W07 on the historical reviewer.
- [ ] Run focused and full authority tests.

## Task 3: Freeze Candidate

- [ ] Keep `project-harness.json` without an effective overlay.
- [ ] Run amendment, authority, and doctor checks.
- [ ] Freeze exact candidate H/tree and deterministic review package.

## Task 4: Bootstrap Reviews

- [ ] Run two fresh `fork_context=false` Codex QA reviews.
- [ ] Require unique sessions, read-only confirmation, double GO, and zero
  unresolved HIGH/MEDIUM findings.
- [ ] Store review records without activating the overlay.

## Task 5: Owner Exact-H Gate

- [ ] Present candidate H/tree/package digest and both review digests.
- [ ] Stop for explicit Product Owner approval.

## Task 6: Atomic Overlay Candidate

- [ ] Store owner approval.
- [ ] Atomically add the approved overlay to `project-harness.json`.
- [ ] Prove W07 resolves to `Codex Independent QA` while other scopes retain
  `Claude Code`.
- [ ] Independently verify and request local EXT integration approval.

## Prohibited

No W07 activation, product code, push, deployment, migration, listener
operation, real customer data, or production claim.
