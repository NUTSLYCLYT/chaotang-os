# CI Summary: feat-ext-w06r-artifact-delivery-20260725

## Current Status

`IMPLEMENTER_VERIFIED / INDEPENDENT_REREVIEW_PENDING`

This is implementer evidence. It does not replace the read-only Task 7
requirements and quality reviews or claim independent GO.

| Field | Value |
| --- | --- |
| Baseline | `64d7f9358dc8a43d886889629e1b745f491593ef` |
| Task 7 reviewed candidate | `61aa193c5b4b44d2f076a92762f382481e13021b` |
| Task 7 requirements verdict | `REQUIREMENTS NO-GO`, 6 findings |
| Task 7 quality verdict | `QUALITY: NO-GO`, 7 findings |
| Task 8 verification candidate | `25a979b1` |
| Candidate inventory | 23 tracked files |
| Runtime boundary | `NOT_DEPLOYED` |

## Task 8 RED To GREEN

| Group | RED | GREEN | Commit |
| --- | --- | --- | --- |
| A: content/source | `13 failed in 3.49s` | targeted `13 passed`; affected `56 passed` | `fd38d017` |
| B: identity/seal/root | service/API/root-guard RED recorded separately | affected `73 passed` | `c5947c00` |
| C: status/audit/expiry | `10 failed, 1 passed in 5.75s` | targeted `11 passed`; affected `84 passed` | `23ddf988` |
| D: migration/fsync | `6 failed in 13.20s` | targeted `6 passed`; migration/storage `28 passed`; related `78 passed` | `9261f852` |

The full command output and finding-to-test-to-fix mapping are recorded in
`.superpowers/sdd/2026-07-25-ext-w06r-artifact-delivery/task-8-report.md`.
That SDD path is intentionally ignored by Git and is not reviewer evidence.

## Finding Closure

| Review finding | Task 8 evidence |
| --- | --- |
| Requirements HIGH-1: incomplete PDF/DOCX | Complete deterministic three-format renderer tests |
| Requirements HIGH-2: canonical/reused identity | Canonical hash and stable origin-row/download tests |
| Requirements MEDIUM-3: resume statuses | Service exception and same-tenant HTTP 409 tests |
| Requirements MEDIUM-4: unaudited auth failures | Generic requester-tenant audit tests |
| Requirements MEDIUM-5: incomplete mutable state | `last_failure`, `EXPIRED`, immutable seal, repeated 410 tests |
| Requirements MEDIUM-6: contradictory root Packet | These synchronized Packet documents |
| Quality HIGH-1: unverified memorial source | Missing/cross-tenant/stale/state/hash/pack mismatch tests |
| Quality HIGH-2: direct replay bypasses seal | Unified verifier and tampered replay tests |
| Quality HIGH-3: destructive identity downgrade | Four-field preflight snapshot tests |
| Quality MEDIUM-1: mutable reason override | Sealed reason projection corruption tests |
| Quality MEDIUM-2: path outside root | Create replay and resume root-guard tests |
| Quality MEDIUM-3: missing directory fsync | Directory syscall and fault-injection tests |
| Quality LOW-1: unbounded expiry | 0/86401/oversized HTTP 422 tests |

## Candidate Inventory

The baseline comparison contains these 23 tracked files:

```text
.harness/changes/feat-ext-w06r-artifact-delivery-20260725/ci_result/ci_summary.md
.harness/changes/feat-ext-w06r-artifact-delivery-20260725/request_analysis/spec.md
.harness/changes/feat-ext-w06r-artifact-delivery-20260725/request_analysis/tasks.md
.harness/changes/feat-ext-w06r-artifact-delivery-20260725/summary.md
backend/alembic/versions/025_artifact_delivery_state.py
backend/src/artifacts/delivery.py
backend/src/artifacts/service.py
backend/src/artifacts/storage.py
backend/src/contracts/artifact_manifest.py
backend/src/db/models.py
backend/tests/artifact_delivery_support.py
backend/tests/test_artifact_delivery_api.py
backend/tests/test_artifact_delivery_migration.py
backend/tests/test_artifact_delivery_render.py
backend/tests/test_artifact_delivery_service.py
backend/tests/test_artifact_manifest_access.py
backend/tests/test_artifact_manifest_persistence.py
backend/tests/test_artifact_manifest_v1.py
backend/tests/test_artifact_storage.py
backend/tests/test_schema_authority.py
backend/web/routers/artifacts.py
docs/superpowers/plans/2026-07-25-ext-w06r-artifact-delivery.md
docs/superpowers/specs/2026-07-25-ext-w06r-artifact-delivery-design.md
```

`backend/harness/manifest.json` remains unchanged because it inventories
harness packages, while artifact delivery is backend runtime behavior.

## Final Verification Matrix

| Check | Actual result |
| --- | --- |
| Complete W06R suite | `135 passed in 29.19s`, no skips |
| Isolated migration suite | `9 passed in 20.52s` |
| W06R scoped Ruff | `All checks passed!` |
| Full backend compileall | PASS |
| Backend harness doctor | `0 errors, 0 warning(s)` |
| Root harness doctor | `0 errors, 0 warning(s)` |
| Authority v1 | `VALID_INACTIVE_GUARD` |
| Authority v2, `R0-W06` | `GO / APPROVED_WORK_PACKAGE` |
| Strict closeout | PASS, zero staged/unstaged high-risk drift |
| `git diff --check 64d7f935..HEAD` | PASS |

Commands:

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

/tmp/ext-w06r-task3-venv/bin/python -m pytest -q \
  --basetemp=/tmp/ext-w06r-task8-final-migration \
  tests/test_artifact_delivery_migration.py

/tmp/ext-w06r-task3-venv/bin/ruff check \
  src/contracts/artifact_manifest.py src/artifacts/storage.py \
  src/artifacts/delivery.py src/artifacts/service.py src/db/models.py \
  web/routers/artifacts.py alembic/versions/025_artifact_delivery_state.py \
  tests/artifact_delivery_support.py tests/test_schema_authority.py \
  tests/test_artifact_manifest_v1.py \
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
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
git diff --check 64d7f935..HEAD
```

## Production Boundary And Concerns

- `NOT_DEPLOYED`; `NO_PUSH`; `NO_PERSISTENT_DB_MIGRATION`;
  `NO_LISTENER_TAKEOVER`.
- All migration files, databases, and storage roots used for verification are
  pytest-owned or under `/tmp`.
- Before production deployment, internal `source_payload_json` still requires
  an approved retention, encryption, and access policy.
- Delivery command callers must continue to supply a command-owned Session
  because the command owns commit of the supplied transaction.
- Independent requirements and quality re-review remain required before
  integration acceptance.

## Rollback

Revert Task 8 commits `9261f852`, `23ddf988`, `c5947c00`, and `fd38d017` in
that order, followed by Packet synchronization commit `25a979b1` and its final
evidence update. No production database or storage rollback is part of this
candidate.
