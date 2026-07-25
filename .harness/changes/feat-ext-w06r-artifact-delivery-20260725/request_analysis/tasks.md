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

## Task 7: Close Verification Evidence

- Status: `IMPLEMENTER_VERIFIED / INDEPENDENT_REVIEW_PENDING`. This is an
  implementer evidence record only; it is not QA, Codex, integration, or
  deployment acceptance.
- Refreshed pre-evidence candidate: HEAD
  `8a703168e4427b05e1e0a2bf1b0f18f539608021`; tree
  `51a8b208160e12525866a4a7895b55fed29c057c`; baseline
  `64d7f9358dc8a43d886889629e1b745f491593ef`.
- Focused suite refresh: all nine W06R files completed with
  `105 passed, 0 skipped in 21.66s`.
  No test was skipped in the supplied temporary virtual environment; Alembic
  was available, so the migration module's `pytest.importorskip` guard did
  not activate.
- Disposable migration refresh: all six migration tests passed in `18.19s`
  with pytest `--basetemp=/tmp/ext-w06r-task7-migration-8a703168`. The legacy loop
  used only
  `/tmp/ext-w06r-task7-migration-8a703168/test_upgrade_downgrade_reupgra0/artifact-delivery-loop.db`:
  `024_artifact_manifest_tenant -> 025_artifact_delivery_state ->
  024_artifact_manifest_tenant -> 025_artifact_delivery_state`. Its retained
  final `alembic_version` was `025_artifact_delivery_state`.
- Governance and closeout refresh: backend doctor and root doctor each reported
  `0 errors, 0 warning(s)`; `R0-W06` authority returned
  `GO / APPROVED_WORK_PACKAGE`; full backend compileall and
  `git diff --check 64d7f935..HEAD` passed; strict closeout found zero staged
  or unstaged high-risk files.
- Ruff history: the first evidence run found one `B904` error at
  `backend/src/artifacts/storage.py:233` (a `DeliveryIntegrityError` raised
  in an `except OSError` branch without `from`). Commit
  `8a703168e4427b05e1e0a2bf1b0f18f539608021` corrected that error; the full
  W06R Ruff scope now passes. Full `backend` Ruff remains red with `843`
  pre-existing findings outside the W06R scope and is recorded as a repository
  baseline concern, not waived or attributed to this fix.
- Inventory decision: `backend/harness/manifest.json` was inspected and
  already inventories harness packages, not this artifact-delivery runtime
  feature. No inventory entry was missing and the manifest was not modified.
- Production boundary: `NOT_DEPLOYED`; `NO_PUSH`;
  `NO_PERSISTENT_DB_MIGRATION`; `NO_LISTENER_TAKEOVER`. All migration databases
  and storage roots were disposable `/tmp` or pytest-owned paths.
- Parked production blockers remain open: source payload retention/encryption
  and access policy; and the requirement that delivery command callers own the
  supplied Session/transaction.
- Independent requirements and quality review remain pending. The candidate
  must not be integrated into `feature-chaotang-ext` without explicit approval.
