# Tasks: feat-ext-w06r-artifact-delivery-20260725

## Task 1: Freeze W06R Packet And Restore Schema Authority Baseline

- Authority: `R0-W06` is authorized only when v2 reports `GO / APPROVED_WORK_PACKAGE`.
- Input: Alembic graph head `024_artifact_manifest_tenant` and the existing P26 schema-test hunk.
- Output: the corrected W06 focused baseline and root Packet evidence.
- File boundary: `backend/tests/test_schema_authority.py` plus these four root change-record files only.
- Required correction: use `024_artifact_manifest_tenant` in the three expected-head assertions and disposable `alembic_version` row; do not expand the hunk.
- Verification: focused five-file pytest suite, W06 authority, root harness doctor, and `git diff --check`.
- Production boundary: disposable test SQLite data only; `NOT_DEPLOYED`; `NO_LISTENER_TAKEOVER`; no persistent DB migration, push, or deployment.
- Rollback: revert the four schema-test literals changed from `022_shiguan_memorial_identity` to `024_artifact_manifest_tenant`, then remove this Packet's four files; do not perform any production database operation.
- Done: initial `3 failed, 19 passed` baseline is recorded, corrected suite is `22 passed`, and all governance checks pass.
