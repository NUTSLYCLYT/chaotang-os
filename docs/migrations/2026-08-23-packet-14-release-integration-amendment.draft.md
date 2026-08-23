# Packet 14 Release Integration Amendment V1

## 1. Status and authority

- Status: `CONTRACT_AMENDMENT_DRAFT`.
- Task: `PACKET-14-TRUSTED-ARTIFACT-DELIVERY-RELEASE-INTEGRATION-V1-20260823`.
- Repository: `gitee.com/msxn/chaotang-os`.
- Target branch: `ext-dev`.
- Amendment base commit: `cbfcae91c5a6d91cf166079128ace7ae338d40c7`.
- Amendment base tree: `9d831695edceb75b1e947d005d3f50cade43924a`.
- Accepted predecessor approval digest:
  `sha256:b74bf2ea38ee75fc31af25b7f65bab8a00feaf9551028a661f7cef0d347f09be`.
- This document is governance evidence only. It does not authorize product edits, a product commit,
  push, release or deployment.
- Owner must first accept this document's exact raw SHA-256 and authorize a one-file governance
  commit/push. Only after that remote commit is live may a new machine-readable 30-path approval
  triple be generated and reviewed. Product work resumes only if the new task's
  `product-authority --authorize` returns `GO` with the accepted canonical approval digest.

## 2. Why this amendment is required

The first 21-path candidate was frozen as:

- candidate commit `7ca598a5136b1f315496bd7a50305d7f8efec610`;
- candidate tree `77c7862151ba4cdb76702ac5fa70411f0030d85f`;
- machine evidence digest
  `sha256:e2cdfdef084de6f1c2a176c0fafcbc8c46beac1fdf5324f1e284459317986615`;
- machine result `PASS / CANDIDATE_ELIGIBLE_FOR_OWNER_ACCEPTANCE`.

Independent code and security review nevertheless returned `NO-GO`. The machine matrix proved each
local component, but did not prove three cross-component invariants:

1. Python's accepted runtime registry now computes
   `sha256:0c482d791319e062c698501e69b3c8f9082b93043b475697a2a80c0ef9144c9d`,
   while the offline release schema, builder, verifier and acceptance runner remain pinned to the
   predecessor digest
   `sha256:014a4d2e5467b70cb2e12b7ab2954771040dc0f6c9f170ae20cf5759d9dcaf52`.
2. `confirmation_receipts_guard_insert_v2` is installed only when `ArtifactStorage` is constructed,
   but the application lifespan currently starts the decree writer first. On an old database,
   readiness rejects the missing V2 trigger while the worker may already write.
3. Download admission performs a full file hash before the owner/process lease, and metadata failure
   after reservation can leak that lease. An invalid upstream MIME also leaves cancellation to GC.

The candidate must not be pushed. A locally amended 21-path draft is not authority and must be
replayed under the successor approval.

## 3. Product objective

Produce one successor candidate in which:

- confirmation is owner-bound, append-only and possible only for exactly one published, digest-bound
  management workbook;
- all download limits are enforced before full-file work and every failure path releases file,
  spool and lease resources;
- V2 schema activation completes and its postimage is verified before any decree writer starts;
- readiness, backup, offline manifest schema, offline builder, offline verifier and acceptance runner
  consume the same registry digest;
- legacy read/download behavior remains compatible. Historical P15 receipts and prior-release
  rollback anchors remain immutable and referenceable; the successor manifest, bundle, verification
  and acceptance evidence must be regenerated and their derived digests must change. No predecessor
  PASS or evidence may be reused as successor PASS;
- no database table/column, API namespace, upload feature, second registry or second ledger is added.

## 4. Exact implementation contract

### 4.1 Download admission and cleanup

1. Open the canonical published path with `O_NOFOLLOW|O_CLOEXEC`, then `fstat` and validate regular
   file, `nlink=1`, size `1..64 MiB`, device/inode and database identity.
2. Atomically reserve owner/process/disk budget immediately after the bounded metadata check and
   before the first full-file read or SHA-256 pass. Limits remain owner `1`, process `2`.
3. Perform one bounded streaming copy+digest into the trusted spool; revalidate fd/path identity
   after the copy. Do not perform an unleased preliminary full hash.
4. Transfer spool and reservation ownership only after metadata projection succeeds. Until transfer,
   a single `finally` must close the spool/fd and release the exact reservation for every
   `ArtifactStorageError`, SQLite, OS, JSON, type, validation or constructor failure.
5. Confirmation revalidates payload, binding, artifact state and file bytes before returning a
   terminal-state conflict. No new receipt is written on any failure.
6. The Next download BFF cancels any non-null upstream body for invalid MIME, length or stream
   contract before returning a sanitized error.

### 4.2 V2 activation before writer startup

1. The application lifespan performs the existing closed `ArtifactStorage` initialization/migration
   before constructing or starting `DecreeJobWorker`.
2. Activation accepts only the exact legacy schema or exact V2 schema, uses the existing exclusive
   transaction, verifies the V2 postimage, and fails closed on busy, tamper, unknown or partial schema.
3. If activation fails, the lifespan raises before `worker.start()`; no writer thread or business
   request is started. `/health` must not be used to bypass startup failure.
4. If activation succeeds, the worker starts exactly once and readiness observes the same registry
   entry and V2 postimage. Worker-disabled test/dev mode still activates the schema because schema
   readiness is independent of worker enablement.
5. No business request is used as a migration trigger. No second activation state, table or ledger is
   introduced.

### 4.3 One runtime registry digest across Python and Node

1. The only registry fact source remains
   `backend/app/operations/runtime_data_registry.py`.
2. Its accepted candidate digest is exactly
   `sha256:0c482d791319e062c698501e69b3c8f9082b93043b475697a2a80c0ef9144c9d`.
3. `deploy/release-manifest.schema.json`, offline builder, verifier and acceptance input use that exact
   value. The predecessor digest is rejected for a successor release manifest/input.
4. A cross-language regression must execute the candidate Python registry projection with
   `PYTHONNOUSERSITE=1`, empty `PYTHONPATH`, sanitized cwd/environment and candidate wheel/commit
   provenance. Candidate Python emits one canonical digest line whose stdout digest is bound into
   the test evidence; compare that exact value to the Node release constant and JSON Schema const.
   Host/user-site Python and fixture-only values are forbidden. Merely updating fixtures is
   insufficient.
5. Build, verify and acceptance tests cover new-digest PASS, old-digest rejection, single-character
   drift rejection and builder/verifier/runner/schema exact equality.

## 5. Exact product paths

The successor M0 `request.productPaths` must equal the following sorted 30 paths. No directory, glob,
implicit test or additional file is allowed.

1. `backend/app/accounting_reports/storage.py`
2. `backend/app/api/report_artifacts.py`
3. `backend/app/main.py`
4. `backend/app/operations/runtime_data_registry.py`
5. `backend/app/operations/sqlite_backup.py`
6. `backend/app/readiness.py`
7. `backend/tests/test_accounting_confirmation_api.py`
8. `backend/tests/test_accounting_report_storage.py`
9. `backend/tests/test_accounting_work_product_storage.py`
10. `backend/tests/test_decree_async_integration.py`
11. `backend/tests/test_readiness.py`
12. `backend/tests/test_report_artifacts_api.py`
13. `backend/tests/test_six_ministry_accounting_evidence_adapter.py`
14. `backend/tests/test_sqlite_backup.py`
15. `deploy/release-manifest.schema.json`
16. `frontend/src/app/api/report-artifacts/[id]/confirmation/handler.ts`
17. `frontend/src/app/api/report-artifacts/[id]/confirmation/route.test.ts`
18. `frontend/src/app/api/report-artifacts/[id]/handler.ts`
19. `frontend/src/app/api/report-artifacts/[id]/route.test.ts`
20. `frontend/src/features/study-visual/StudyArtifactConfirmation.test.ts`
21. `frontend/src/features/study-visual/StudyArtifactLinks.test.ts`
22. `frontend/src/features/study-visual/StudyArtifactLinks.ts`
23. `frontend/src/lib/backendClient.test.ts`
24. `frontend/src/lib/backendClient.ts`
25. `scripts/build_offline_release.mjs`
26. `scripts/build_offline_release.test.mjs`
27. `scripts/run_rc1_release_acceptance.mjs`
28. `scripts/run_rc1_release_acceptance.test.mjs`
29. `scripts/verify_offline_release.mjs`
30. `scripts/verify_offline_release.test.mjs`

The predecessor restrictions remain: `backend/app/operations/sqlite_backup.py` may change only the
P15 synthetic WorkProduct compatibility values already frozen by P14; the six-ministry adapter test
may change only its fixture/digest/error expectation; the download BFF may not change URL, auth,
MIME or content-disposition success semantics.

## 6. Mandatory RED and acceptance nodes

The new approval must bind exact named verification for at least these cases:

1. `P14-DOWNLOAD-PRELEASE-01`: a barrier holds the first leased reader; same-owner and process-cap
   contenders are rejected before their first full-file read/hash.
2. `P14-DOWNLOAD-CLEANUP-02`: corrupt JSON/period/date and injected constructor failure after reserve
   all return stable unavailable and leave active count, owners and reserved bytes at zero.
3. `P14-DOWNLOAD-CANCEL-03`: invalid MIME/length, short/long stream and client cancel all cancel the
   upstream stream exactly once and expose no body/header secret.
4. `P14-CONFIRM-ORDER-04`: terminal receipt plus later payload/binding/file corruption returns storage
   unavailable before transition conflict and writes zero receipts.
5. `P14-ACTIVATION-ORDER-05`: exact legacy DB migrates to V2 before worker construction/start;
   postimage is ready and worker starts once.
6. `P14-ACTIVATION-FAIL-06`: busy/partial/tampered/future schema starts zero workers and performs zero
   business writes.
7. `P14-ACTIVATION-DISABLED-07`: worker-disabled mode still activates and verifies V2 without starting
   a worker.
8. `P14-REGISTRY-CROSSLANG-08`: Python registry, JSON Schema, builder, verifier and acceptance runner
   expose one exact digest; old or mutated values fail closed.
9. `P14-RELEASE-REPLAY-09`: build -> verify -> acceptance consumes the new digest, regenerates the
   successor manifest/bundle/verification/acceptance and their digests, and preserves only immutable
   historical receipts and prior-release rollback anchors as references. Old PASS is never reused.
10. `P14-OWNER-ISOLATION-10`: unknown and cross-owner confirmation/download remain identical 404;
    actor, raw payload, path and private headers never enter public response/log.
11. `P14-LEGACY-11`: ordinary published legacy download and unrelated decree jobs remain compatible.
12. `P14-FULL-12`: P15 isolated backend full+Ruff, frontend build/lint/typecheck/full tests, P09/P15
    release regressions, Root Harness/doctor and V2 convergence all pass from the exact candidate.

## 7. Commit, review and rollback protocol

1. Amendment evidence commit: exact one file (this document), exact single parent of the current live
   `origin/ext-dev`, independently reviewed, Owner accepts raw SHA, then commit and push. Gitee head is
   read twice and must equal that commit.
2. Approval commit: generated only after step 1 is live; exact three governance files (manifest, task,
   plan), exact single parent, closed 30 paths and commands, independent review, Owner accepts canonical
   approval digest, then commit and push. Product authority must return `GO` for that exact digest.
3. Product commit: exact single child of the new approval, exact 30 paths, clean tree. Rebase/cherry-pick
   may replay the unpushed 21-path draft, but its old commit identity is not authority.
4. Product candidate must pass machine `--verify-candidate` and independent code/security review before
   Owner is asked to authorize push.
5. Before any runtime database is activated, rollback may revert the single successor product commit
   while keeping P15 and governance history. After V2 activation, full product revert and restart of an
   old writer are forbidden: the strict backend floor must retain V2, application owner/binding/file
   guards, strict raw parser/public DTO, fd/lease/cleanup semantics and the new registry digest. Any
   rollback after activation requires a separately approved forward-compatible child that preserves
   that floor; otherwise keep the service stopped. A cold restore must never overwrite a database after
   any new confirmation receipt has been created.

## 8. Completion boundary

This amendment is complete only when the successor candidate has one registry digest, deterministic
pre-writer activation, bounded/clean download admission, full machine evidence and independent GO.
It authorizes neither P06/P09-B nor production deployment; those remain later long-task stages.
