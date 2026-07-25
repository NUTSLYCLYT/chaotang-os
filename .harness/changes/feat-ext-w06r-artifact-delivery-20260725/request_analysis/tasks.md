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
- [x] Receive and preserve the final scoped rereview (`1` Medium, `1` Low)
  and approved round 3 design supplement `221a98f5`.

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

### Fix Round 2: Relative Expiry Identity

- [x] Observe five focused RED failures: sequential HTTP retry 409, eight-way
  HTTP 409 responses, old direct-service signature, and missing migration
  column/guard.
- [x] Persist and downgrade-guard `requested_expiry_seconds`.
- [x] Pass relative TTL from HTTP to the create command and replay the original
  absolute expiry for request-equivalent winners.
- [x] Prove changed relative TTL conflicts and eight concurrent requests all
  succeed with one manifest and no duplicate delivery facts.
- [x] Verify focused `5 passed` and expanded `91 passed`.
- [x] Commit `3bbbaa5b`.

### Fix Round 2: Strict JSON Integrity

- [x] Observe `6 failed, 2 passed` across persisted manifest/source
  `NaN`/`Infinity` and low-level canonicalization.
- [x] Reject non-finite constants during parse and canonical serialization.
- [x] Normalize parse/canonical failures to `DeliveryIntegrityError`.
- [x] Verify read/download 409 and one durable failed download audit for all
  four corruption combinations.
- [x] Verify focused `8 passed` and expanded `108 passed`.
- [x] Commit `fbf3f222`.

### Fix Round 3: Sealed Relative TTL

- [x] Observe `4 failed` across the manifest contract, direct service replay,
  and real HTTP GET/download/authentic-retry/forged-retry boundaries.
- [x] Add required `requested_expiry_seconds` to sealed
  `ArtifactManifestV1` bytes and every fixture.
- [x] Persist the row value from the seal, bind row/seal in the unified
  verifier, and carry the original relative TTL into resume revisions.
- [x] Keep relative TTL absent from the public HTTP projection.
- [x] Verify focused `4 passed` and expanded `112 passed`.
- [x] Commit `32f17cb7`.

### Fix Round 3: Required Source Integrity

- [x] Observe `1 failed, 2 passed`; the `NULL` source case returned
  `200 / 200 / 409` and recorded download SUCCESS.
- [x] Require non-null canonical strict `source_payload_json` whose SHA-256
  matches sealed `payload_hash` in persistence and the unified verifier.
- [x] Prove NULL, malformed JSON, and canonical hash mismatch all return
  GET/download/replay `409`.
- [x] Prove every failed download appends exactly one durable FAILURE and no
  SUCCESS.
- [x] Verify focused `3 passed` and expanded `115 passed`.
- [x] Commit `70422b9f`.

### Packet And Closeout

- [x] Replace the stale schema-test-only Packet scope with the actual 23-file
  runtime/migration/storage/API/test/design/plan scope.
- [x] Preserve `NOT_DEPLOYED`, `NO_PUSH`, `NO_PERSISTENT_DB_MIGRATION`, and
  `NO_LISTENER_TAKEOVER`.
- [x] Run and record the final complete suite, isolated migration suite, Ruff,
  compileall, doctors, authority checks, strict closeout, and baseline diff.
- [ ] Request independent requirements and quality re-review. Implementer
  evidence cannot mark those reviews GO.

### Fix Round 4: Full-Diff MIME And Orphan Audit

- [x] Preserve the fresh full-diff review verdict: `SPEC NO-GO / QUALITY
  NO-GO`, two Medium findings.
- [x] Observe four manifest/API RED failures and one renderer-boundary RED
  failure.
- [x] Require canonical PDF/DOCX/JSON MIME mapping in the immutable contract.
- [x] Treat renderer MIME mismatch as `renderer_failed` rather than STORED.
- [x] Append one identifier-free requester-tenant failure audit when an
  artifact resolves to an unknown or unauthorized manifest.
- [x] Verify focused `6 passed` and complete W06R `159 passed`.
- [x] Commit `00cc5954`.
- [ ] Receive fresh full-diff SPEC and QUALITY GO for the remediated candidate.

Final implementer evidence: W06R `159 passed`, isolated migration `10 passed`,
scoped Ruff and compileall PASS, both doctors clean, v1
`VALID_INACTIVE_GUARD`, v2 `GO / APPROVED_WORK_PACKAGE`, and strict
closeout/baseline diff PASS. Status:
`IMPLEMENTER_VERIFIED / INDEPENDENT_REREVIEW_PENDING`.

## Rollback Boundary

Task 8 implementation commits, newest first:

1. `00cc5954`
2. `70422b9f`
3. `32f17cb7`
4. `fbf3f222`
5. `3bbbaa5b`
6. `9261f852`
7. `23ddf988`
8. `c5947c00`
9. `fd38d017`

Revert Packet synchronization/evidence commits after those if remediation is
removed; prior checkpoints are `9b475d72` and `25a979b1`. Do not downgrade or
modify a persistent database and do not delete production storage; no such
deployment occurred.
