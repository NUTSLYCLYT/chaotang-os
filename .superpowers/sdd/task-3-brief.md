### Task 3: Bind archive and decree persistence to the authenticated owner

**Files:**
- Modify: `backend/app/shiguan/models.py`, `backend/app/shiguan/storage.py`, `backend/app/shiguan/recall.py`, `backend/app/shiguan/archive_decree.py`, `backend/app/shiguan/db.py`
- Modify: `backend/app/api/shiguan.py`, `backend/app/api/decrees.py`
- Test: `backend/tests/test_shiguan_storage.py`, `backend/tests/test_shiguan_recall.py`, `backend/tests/test_shiguan_api.py`, `backend/tests/test_shiguan_archive_decree.py`, `backend/tests/test_decrees_api.py`

**Interfaces:**
- Every storage/read function receives `owner_user_id: str` as a required server-side argument; request models never contain it.
- `archive_chancellor_decree(decree_text, response, *, owner_user_id: str) -> None` writes both resulting records under that owner.
- Existing archive response models do not expose `owner_user_id`.

- [ ] **Step 1: Add failing two-user isolation tests**

```python
def test_archives_statistics_recall_and_review_are_owner_scoped(two_users):
    owner_a, owner_b = two_users
    created = create_archive(valid_memorial(), owner_user_id=owner_a.id)
    assert list_archives(owner_user_id=owner_a.id) == [created]
    assert list_archives(owner_user_id=owner_b.id) == []
    assert get_statistics(owner_user_id=owner_b.id).total == 0
    with pytest.raises(ArchiveNotFoundError):
        update_review_status(created.id, valid_review(), owner_user_id=owner_b.id)

def test_legacy_unowned_rows_are_not_visible(two_users, raw_legacy_archive):
    assert list_archives(owner_user_id=two_users[0].id) == []
```

- [ ] **Step 2: Verify RED**

Run the four archive/decree test files listed above.
Expected: FAIL because the storage APIs do not require an owner and cross-user reads are still possible.

- [ ] **Step 3: Implement schema migration and owner propagation**

Add nullable `owner_user_id` to the existing archive table in an idempotent migration; never backfill legacy rows. Add owner predicates to archive lists, get-by-ID, statistics, recall, review update and all relationship lookups. Inject `require_current_user` into every shiguan/decree route; pass `current_user.id` to storage and into automatic archival after a successful decree response. Return 404, not 403, when an authenticated user requests another user's archive ID, preventing existence disclosure. Preserve all existing response JSON field names.

- [ ] **Step 4: Verify GREEN**

Run the Task 3 command.
Expected: existing behavior is retained for an owner, cross-user reads/writes appear nonexistent, and unowned legacy data is absent.
