# Task 3 implementation report: authenticated archive ownership

## Scope and assumptions

- Implemented only the production and test paths enumerated by Task 3, plus this report.
- Authentication is supplied by the preceding task through `CurrentUser` / `require_current_user`.
- Existing `NULL` ownership is deliberately left untouched: migration adds the column but never backfills it.

## RED evidence

Added test-first coverage for:

- A record created by owner A is visible only to A; owner B receives an empty list, zero statistics, and `ArchiveNotFoundError` on review update.
- A legacy `archives` table row without `owner_user_id` is hidden after the idempotent migration.
- Automatic decree archival writes both linked records for the supplied authenticated owner and exposes none to another owner.

Before production changes, the Task 3 test command failed as intended:

```text
3 failed, 114 passed
TypeError: create_archive() got an unexpected keyword argument 'owner_user_id'
TypeError: list_archives() got an unexpected keyword argument 'owner_user_id'
TypeError: archive_chancellor_decree() got an unexpected keyword argument 'owner_user_id'
```

## GREEN implementation

- `db.py`: adds nullable `archives.owner_user_id` both to fresh-schema creation and an idempotent `PRAGMA table_info` / `ALTER TABLE` migration. No legacy backfill occurs.
- `storage.py`: makes owner identity a required keyword-only server-side argument for create, linked-pair create, get, list, review update, and statistics. Every archive fetch is constrained by owner; related-record lookup joins the target archive and applies the same owner predicate.
- `recall.py`: forwards the owner to archive lookup. The graph-only safe recall entry point returns its existing fail-closed unavailable result when no owner context is supplied, so it performs no unscoped query.
- `archive_decree.py`: requires `owner_user_id` and passes it to the atomic memorial/decision write.
- `api/shiguan.py` and `api/decrees.py`: require the authenticated user on every route and pass only `current_user.id` to storage/automatic archival. Request and response schemas do not expose the owner ID. Cross-owner archive ID access resolves as `ArchiveNotFoundError`, therefore the established handler returns 404.

## Verification

Passed:

```text
.venv\Scripts\python.exe -m ruff check app/shiguan app/api/shiguan.py app/api/decrees.py tests/test_shiguan_storage.py tests/test_shiguan_recall.py tests/test_shiguan_api.py tests/test_shiguan_archive_decree.py tests/test_decrees_api.py
All checks passed!

.venv\Scripts\python.exe -m pytest tests/test_shiguan_storage.py tests/test_shiguan_recall.py tests/test_shiguan_api.py tests/test_shiguan_archive_decree.py tests/test_decrees_api.py
117 passed, 1 warning
```

The warning is the repository's pre-existing FastAPI TestClient deprecation warning for the installed `httpx` major version.

## Self-review and concern

- Confirmed legacy NULL-owned rows are filtered by `owner_user_id = ?`, not made visible by migration.
- Confirmed statistics use an owner-constrained join for review counts, avoiding cross-user aggregation.
- Confirmed decree success response remains unchanged; archival failures remain degraded and do not change the HTTP success path.
- Full `pytest` reaches `411 passed`, then has one unrelated compatibility failure in `backend/tests/test_shiguan_validation.py`: its direct `storage.create_archive(...)` call omits the now-required owner argument. That file is outside the Task 3 allowed test paths, so it was intentionally not edited. Updating that legacy call to pass an owner is needed for a fully green suite.

## Review follow-up: validation ownership and HTTP non-disclosure

### RED

- Updated `test_shiguan_validation.py` to call `validate_related_archive_ids(..., owner_user_id=...)` and added a cross-owner relation-ID rejection case. Before the implementation, focused validation/API tests failed with four expected `TypeError` instances because the validator did not accept the owner argument.
- Added an API-level regression case: a second authenticated user receives 404, with `archive_not_found`, for both `GET /archives/{id}` and `PATCH /archives/{id}/review` against account A's archive. This passed immediately because the earlier storage predicates already enforced the intended HTTP behavior; it is retained as the external non-disclosure regression guard.

### GREEN

- `validate_related_archive_ids` now requires `owner_user_id` and queries `archives` by both ID and owner.
- `_insert_validated_archive` delegates relation checking to that validator, eliminating the duplicated owner-scoped SQL and keeping the validation boundary authoritative.
- Updated validation tests' direct storage calls to provide the required owner.
- API/recall/decree test authentication fixtures now configure an explicit per-test temporary auth database and reset it after each test. This prevents a full-suite-only duplicate-user fixture failure without touching production behavior.

### Follow-up verification

```text
.venv\Scripts\python.exe -m pytest tests/test_shiguan_validation.py tests/test_shiguan_api.py tests/test_shiguan_storage.py
73 passed, 1 warning

.venv\Scripts\python.exe -m ruff check .
All checks passed!

.venv\Scripts\python.exe -m pytest
495 passed, 1 warning
```

The sole warning remains FastAPI TestClient's installed-`httpx` deprecation warning; no test failures or remaining Task 3 concerns remain.
