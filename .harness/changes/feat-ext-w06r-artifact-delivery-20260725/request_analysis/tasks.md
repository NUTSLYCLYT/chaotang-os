# Tasks: feat-ext-w06r-artifact-delivery-20260725

## Candidate History

- [x] Align W06 schema authority with Alembic head 024.
- [x] Approve artifact-delivery design and implementation plan.
- [x] Add revision 025 manifest identity, item state, and audit persistence.
- [x] Implement canonical manifest contract, rendering, storage, service, and
  create/read/download/resume API routes.
- [x] Add W06R schema, contract, migration, storage, render, persistence,
  service, access, and API coverage.
- [x] Record Task 7 implementer evidence.
- [x] Receive Task 7 requirements review (`6` findings) and quality review
  (`7` findings). Those reports remain read-only.

## Task 8 Final Remediation

### Group A: Content And Source

- [x] Observe 13 targeted RED failures.
- [x] Render the complete pack in JSON, DOCX, and Unicode PDF.
- [x] Authorize and validate exact current `FinalMemorial` source before
  rendering.
- [x] Verify targeted and affected suites.
- [x] Commit `fd38d017`.

### Group B: Identity And Sealed Recovery

- [x] Observe canonical/reuse/seal/reason RED failures.
- [x] Derive canonical manifest/artifact/lineage identity.
- [x] Reuse the origin item row and stable download identity.
- [x] Route persisted reads through one seal verifier.
- [x] Bind mutable reason to the sealed value.
- [x] Apply exact trusted-root path checks before stored-object reuse.
- [x] Verify 73 affected tests and scoped Ruff.
- [x] Commit `c5947c00`.

### Group C: Status, Audit, And Expiry

- [x] Observe `10 failed, 1 passed` targeted RED.
- [x] Map wrong/expired resume tokens to 409.
- [x] Append one generic requester-tenant audit for unknown/denied download.
- [x] Add `last_failure` and persist/project `EXPIRED` without seal mutation.
- [x] Limit `expiry_seconds` to `1..86400`.
- [x] Verify 84 affected tests and scoped Ruff.
- [x] Commit `23ddf988`.

### Group D: Migration And Durability

- [x] Observe 6 targeted RED failures.
- [x] Refuse downgrade for each revision-025-only identity/payload field before
  DDL.
- [x] Fsync root after tenant creation and tenant after publication/cleanup.
- [x] Fail closed on directory fsync errors.
- [x] Verify 28 migration/storage tests and 78 related delivery tests.
- [x] Commit `9261f852`.

### Packet And Closeout

- [x] Replace the stale schema-test-only Packet scope with the actual 23-file
  runtime/migration/storage/API/test/design/plan scope.
- [x] Preserve `NOT_DEPLOYED`, `NO_PUSH`, `NO_PERSISTENT_DB_MIGRATION`, and
  `NO_LISTENER_TAKEOVER`.
- [x] Run and record the final complete suite, isolated migration suite, Ruff,
  compileall, doctors, authority checks, strict closeout, and baseline diff.
- [ ] Request independent requirements and quality re-review. Implementer
  evidence cannot mark those reviews GO.

Final implementer evidence: W06R `135 passed`, isolated migration `9 passed`,
scoped Ruff and compileall PASS, both doctors clean, v1
`VALID_INACTIVE_GUARD`, v2 `GO / APPROVED_WORK_PACKAGE`, and strict
closeout/baseline diff PASS. Status:
`IMPLEMENTER_VERIFIED / INDEPENDENT_REREVIEW_PENDING`.

## Rollback Boundary

Task 8 implementation commits, newest first:

1. `9261f852`
2. `23ddf988`
3. `c5947c00`
4. `fd38d017`

Revert Packet synchronization/evidence commits after those if remediation is
removed; the synchronization checkpoint is `25a979b1`. Do not downgrade or
modify a persistent database and do not delete production storage; no such
deployment occurred.
