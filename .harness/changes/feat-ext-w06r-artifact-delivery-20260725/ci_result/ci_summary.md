# CI Summary: feat-ext-w06r-artifact-delivery-20260725

## Observed Failing Baseline

```text
python3 -m pytest -q tests/test_artifact_manifest_v1.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_artifact_manifest_access.py \
  tests/test_artifact_delivery_render.py \
  tests/test_schema_authority.py

Observed before correction: 3 failed, 19 passed.
All failures expected 022_shiguan_memorial_identity while the graph returned
024_artifact_manifest_tenant.
```

## Corrected Verification

| Command | Expected Result | Actual Result |
| --- | --- | --- |
| Focused W06 pytest suite | `22 passed` | `22 passed` |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06` | W06 `GO` | `GO / APPROVED_WORK_PACKAGE` |
| `node scripts/harness-doctor.mjs` | `0 errors / 0 warnings` | `0 errors / 0 warnings` |
| `git diff --check` | clean | clean |

## Boundary Confirmation

- Only the existing three assertion expectations and disposable SQLite row changed in the schema-authority test.
- `NOT_DEPLOYED`; `NO_LISTENER_TAKEOVER`. No Alembic migration, runtime implementation, persistent database, push, deployment, or production migration was performed.

## Rollback Boundary

- Revert the four schema-test literals changed from `022_shiguan_memorial_identity` to `024_artifact_manifest_tenant`, then remove this Packet's four files.
- No production database operation is part of rollback.

## Task 7 Verification Evidence

| Field | Recorded value |
| --- | --- |
| Packet status | `IMPLEMENTER_VERIFIED / INDEPENDENT_REVIEW_PENDING` |
| Pre-evidence candidate HEAD | `4d3612261dea194b8525190cab022bbc12918213` |
| Pre-evidence candidate tree | `6c38d956d22c4583c4800d7a5ecd3c7b8fa0c535` |
| Comparison baseline | `64d7f9358dc8a43d886889629e1b745f491593ef` |
| Focused suite | `105 passed, 0 skipped in 21.55s` |
| Isolated migration suite | `6 passed in 15.98s` |
| Backend/root doctor | `0 errors, 0 warning(s)` / `0 errors, 0 warning(s)` |
| Scoped W06 authority | `GO / APPROVED_WORK_PACKAGE` |
| Compile/diff/closeout | PASS / PASS / PASS |
| Ruff | FAIL: one `B904` at `backend/src/artifacts/storage.py:233` |

### Commands And Results

```bash
cd backend
/tmp/ext-w06r-task3-venv/bin/python -m pytest -q \
  tests/test_schema_authority.py \
  tests/test_artifact_manifest_v1.py \
  tests/test_artifact_delivery_migration.py \
  tests/test_artifact_storage.py \
  tests/test_artifact_delivery_render.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_artifact_delivery_service.py \
  tests/test_artifact_manifest_access.py \
  tests/test_artifact_delivery_api.py
```

Result: `105 passed in 21.55s`; no skips occurred. The suite's only skip
mechanism is `pytest.importorskip` for Alembic in the migration module. Alembic
was installed in `/tmp/ext-w06r-task3-venv`, so it did not activate. There is
therefore no skipped test to accept or reject in this run.

```bash
cd backend
/tmp/ext-w06r-task3-venv/bin/python -m pytest -vv \
  --basetemp=/tmp/ext-w06r-task7-migration-4d361226 \
  tests/test_artifact_delivery_migration.py
```

Result: `6 passed in 15.98s`. The reversible legacy loop was isolated at
`/tmp/ext-w06r-task7-migration-4d361226/test_upgrade_downgrade_reupgra0/artifact-delivery-loop.db`:

```text
upgrade 024_artifact_manifest_tenant -> 025_artifact_delivery_state
downgrade 025_artifact_delivery_state -> 024_artifact_manifest_tenant
re-upgrade 024_artifact_manifest_tenant -> 025_artifact_delivery_state
final alembic_version: 025_artifact_delivery_state
```

The isolated tests also prove downgrade preflight refusal for duplicate legacy
lineage, persisted delivery-item/audit facts, and persisted source payload
before DDL. No path under `backend/var`, the main worktree, or a persistent
database was used.

```bash
cd backend
/tmp/ext-w06r-task3-venv/bin/python scripts/harness_doctor.py
/tmp/ext-w06r-task3-venv/bin/python -m compileall -q \
  src/contracts/artifact_manifest.py src/artifacts/storage.py \
  src/artifacts/delivery.py src/artifacts/service.py src/db/models.py \
  web/routers/artifacts.py alembic/versions/025_artifact_delivery_state.py
/tmp/ext-w06r-task3-venv/bin/python scripts/commit_closeout_check.py --strict

cd ..
node scripts/harness-doctor.mjs
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
git diff --check 64d7f935..HEAD
```

Result: both doctors reported `0 errors, 0 warning(s)`; compileall, closeout,
and diff checks passed; authority returned `GO / APPROVED_WORK_PACKAGE`.

```bash
cd backend
/tmp/ext-w06r-task3-venv/bin/ruff check \
  src/contracts/artifact_manifest.py src/artifacts/storage.py \
  src/artifacts/delivery.py src/artifacts/service.py src/db/models.py \
  web/routers/artifacts.py alembic/versions/025_artifact_delivery_state.py \
  tests/test_schema_authority.py tests/test_artifact_manifest_v1.py \
  tests/test_artifact_delivery_migration.py tests/test_artifact_storage.py \
  tests/test_artifact_delivery_render.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_artifact_delivery_service.py \
  tests/test_artifact_manifest_access.py tests/test_artifact_delivery_api.py
```

Result: one failure, `B904` at `src/artifacts/storage.py:233`, requiring the
raised `DeliveryIntegrityError` in an `except OSError` branch to use explicit
exception chaining. This evidence-only task leaves source unchanged; the
failure is an independent-review concern, not a waived check.

### Requirement And Quality Coverage

| Area | Evidence |
| --- | --- |
| Exact PDF/DOCX/JSON membership and immutable public manifest | `test_artifact_manifest_v1.py`, `test_artifact_delivery_render.py` |
| Sealed identity, revisions, idempotency, duplicate suppression, and durable audit state | `test_artifact_manifest_persistence.py`, `test_artifact_delivery_service.py`, `test_artifact_delivery_migration.py` |
| Atomic single-writer storage, reuse, path safety, and corrupt-byte rejection | `test_artifact_storage.py`, `test_artifact_delivery_service.py` |
| PARTIAL, retry, resume, expiry, replay, and recovery of durable source input | `test_artifact_delivery_service.py`, `test_artifact_delivery_api.py` |
| Tenant authorization, manifest membership, public secret/path exclusion, verified download, and download audit durability | `test_artifact_manifest_access.py`, `test_artifact_delivery_api.py` |
| Transaction rollback/reload and competing-session behavior | `test_artifact_manifest_persistence.py`, `test_artifact_delivery_service.py` |
| Timing-safe resume-token and sealed-hash comparisons | service implementation uses `hmac.compare_digest`; exercised by service/access tests |
| Migration reversibility and destructive-downgrade protection | `test_artifact_delivery_migration.py` |

### Candidate Inventory

`git diff --name-status 64d7f935..4d361226` recorded these 21 candidate files:

```text
A  .harness/changes/feat-ext-w06r-artifact-delivery-20260725/ci_result/ci_summary.md
A  .harness/changes/feat-ext-w06r-artifact-delivery-20260725/request_analysis/spec.md
A  .harness/changes/feat-ext-w06r-artifact-delivery-20260725/request_analysis/tasks.md
A  .harness/changes/feat-ext-w06r-artifact-delivery-20260725/summary.md
A  backend/alembic/versions/025_artifact_delivery_state.py
M  backend/src/artifacts/delivery.py
M  backend/src/artifacts/service.py
A  backend/src/artifacts/storage.py
M  backend/src/contracts/artifact_manifest.py
M  backend/src/db/models.py
A  backend/tests/test_artifact_delivery_api.py
A  backend/tests/test_artifact_delivery_migration.py
A  backend/tests/test_artifact_delivery_service.py
M  backend/tests/test_artifact_manifest_access.py
M  backend/tests/test_artifact_manifest_persistence.py
M  backend/tests/test_artifact_manifest_v1.py
A  backend/tests/test_artifact_storage.py
M  backend/tests/test_schema_authority.py
M  backend/web/routers/artifacts.py
A  docs/superpowers/plans/2026-07-25-ext-w06r-artifact-delivery.md
A  docs/superpowers/specs/2026-07-25-ext-w06r-artifact-delivery-design.md
```

`backend/harness/manifest.json` was inspected but not changed: artifact
delivery is a runtime feature, not a separate harness package, so no inventory
entry is missing.

### Boundary And Parked Risks

- `NOT_DEPLOYED`; `NO_PUSH`; `NO_PERSISTENT_DB_MIGRATION`;
  `NO_LISTENER_TAKEOVER`.
- All migration databases and artifact roots were pytest-owned or under `/tmp`.
- Production blocker: define retention, encryption, and access policy for
  internal `source_payload_json` before deployment.
- Production blocker: delivery-command callers must supply a command-owned
  Session because the command commits the complete supplied transaction.
- Independent requirements and quality review remain pending. This evidence
  does not claim QA, Codex, integration, or deployment acceptance.

## Task 7 Evidence Refresh After 8a703168

| Field | Recorded value |
| --- | --- |
| Packet status | `IMPLEMENTER_VERIFIED / INDEPENDENT_REVIEW_PENDING` |
| Pre-evidence candidate HEAD | `8a703168e4427b05e1e0a2bf1b0f18f539608021` |
| Pre-evidence candidate tree | `51a8b208160e12525866a4a7895b55fed29c057c` |
| Lint-fix commit | `8a703168e4427b05e1e0a2bf1b0f18f539608021` `fix(w06r): chain artifact storage integrity error` |
| Focused suite | `105 passed, 0 skipped in 21.66s` |
| Isolated migration suite | `6 passed in 18.19s` |
| W06R scoped Ruff | PASS |
| Full backend Ruff | FAIL: `843` pre-existing findings outside W06R scope |
| Full backend compileall | PASS |
| Backend/root doctor | `0 errors, 0 warning(s)` / `0 errors, 0 warning(s)` |
| Scoped W06 authority | `GO / APPROVED_WORK_PACKAGE` |
| Diff/strict closeout | PASS / PASS |

The preceding Task 7 section remains the first-run history: it recorded the
original `B904` failure at `backend/src/artifacts/storage.py:233`. Commit
`8a703168` adds explicit exception chaining at that site. The refreshed W06R
Ruff command below passes; the independent-review concern is therefore no
longer an unaddressed W06R lint error.

### Refreshed Commands And Results

```bash
cd backend
/tmp/ext-w06r-task3-venv/bin/python -m pytest -q \
  tests/test_schema_authority.py \
  tests/test_artifact_manifest_v1.py \
  tests/test_artifact_delivery_migration.py \
  tests/test_artifact_storage.py \
  tests/test_artifact_delivery_render.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_artifact_delivery_service.py \
  tests/test_artifact_manifest_access.py \
  tests/test_artifact_delivery_api.py
```

Result: `105 passed in 21.66s`; `0 skipped`. Alembic was available in the
temporary virtual environment, so the migration module's `pytest.importorskip`
guard did not activate.

```bash
cd backend
/tmp/ext-w06r-task3-venv/bin/python -m pytest -vv \
  --basetemp=/tmp/ext-w06r-task7-migration-8a703168 \
  tests/test_artifact_delivery_migration.py
```

Result: `6 passed in 18.19s`. The only legacy loop database was
`/tmp/ext-w06r-task7-migration-8a703168/test_upgrade_downgrade_reupgra0/artifact-delivery-loop.db`:

```text
upgrade 024_artifact_manifest_tenant -> 025_artifact_delivery_state
downgrade 025_artifact_delivery_state -> 024_artifact_manifest_tenant
re-upgrade 024_artifact_manifest_tenant -> 025_artifact_delivery_state
final alembic_version: 025_artifact_delivery_state
```

```bash
cd backend
/tmp/ext-w06r-task3-venv/bin/ruff check \
  src/contracts/artifact_manifest.py src/artifacts/storage.py \
  src/artifacts/delivery.py src/artifacts/service.py src/db/models.py \
  web/routers/artifacts.py alembic/versions/025_artifact_delivery_state.py \
  tests/test_schema_authority.py tests/test_artifact_manifest_v1.py \
  tests/test_artifact_delivery_migration.py tests/test_artifact_storage.py \
  tests/test_artifact_delivery_render.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_artifact_delivery_service.py \
  tests/test_artifact_manifest_access.py tests/test_artifact_delivery_api.py
/tmp/ext-w06r-task3-venv/bin/python -m compileall -q .
/tmp/ext-w06r-task3-venv/bin/python scripts/harness_doctor.py
/tmp/ext-w06r-task3-venv/bin/python scripts/commit_closeout_check.py --strict

cd ..
node scripts/harness-doctor.mjs
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
git diff --check 64d7f935..HEAD
```

Result: all listed W06R Ruff files passed; full backend compileall passed;
both doctors reported `0 errors, 0 warning(s)`; strict closeout and diff passed;
authority returned `GO / APPROVED_WORK_PACKAGE`.

The requested full lint command was also run:

```bash
cd backend
/tmp/ext-w06r-task3-venv/bin/ruff check .
```

Result: `843` failures, beginning in historical `alembic/env.py`, old Alembic
revisions, `cli.py`, and unrelated routers/schemas. The W06R files named above
were separately clean after `8a703168`; this repository-wide baseline remains
open and is not a pass claim.

### Boundary Confirmation

- `NOT_DEPLOYED`; `NO_PUSH`; `NO_PERSISTENT_DB_MIGRATION`;
  `NO_LISTENER_TAKEOVER`.
- All migration paths and database files were pytest-owned or under `/tmp`;
  none used `backend/var`, the main worktree, or a persistent database.
- The two parked production blockers remain: `source_payload_json` retention,
  encryption, and access policy; and command-owned Session/transaction
  ownership for delivery callers.
- Independent requirements and quality review remain pending. This refresh
  does not claim QA, Codex, integration, or deployment acceptance.
