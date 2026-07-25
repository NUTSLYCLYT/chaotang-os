# Specification: feat-ext-w06r-artifact-delivery-20260725

## Background

The Alembic graph head is `024_artifact_manifest_tenant`, while three W06 schema-authority expectations and the disposable test database row still named `022_shiguan_memorial_identity`. The mismatch made the W06 artifact-delivery focused baseline fail despite the graph being correct.

## Authority And Fact Source

| Item | Source | Consumer | Required Evidence |
| --- | --- | --- | --- |
| Product execution authority | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06` | This Task 1 change | `GO / APPROVED_WORK_PACKAGE` |
| Alembic head | Alembic version graph | `expected_alembic_head()` and schema-authority tests | exact head `024_artifact_manifest_tenant` |
| Corrected baseline | focused backend pytest suite | W06 Packet | `22 passed` |

## Scope

- Change only the existing P26 hunk in `backend/tests/test_schema_authority.py`: three expected-head assertions and one disposable database row.
- Create this root Packet's summary, specification, task list, and CI result.

## Non-Goals And Production Boundary

- Do not import any other P26 diff.
- Do not modify Alembic migrations, runtime code, API contracts, artifact storage, providers, deployment configuration, or persistent databases.
- Do not push, deploy, or migrate a persistent database. The test row is created only in a disposable SQLite database.

## Acceptance Criteria

- The focused suite changes from the recorded `3 failed, 19 passed` mismatch baseline to `22 passed`.
- Authority returns W06 `GO`; root doctor reports `0 errors / 0 warnings`; `git diff --check` is clean.
