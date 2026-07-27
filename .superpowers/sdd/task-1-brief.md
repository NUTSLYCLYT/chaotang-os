### Task 1: Establish the authentication domain and persistent schema

**Files:**
- Create: `backend/app/auth/__init__.py`, `backend/app/auth/models.py`, `backend/app/auth/passwords.py`, `backend/app/auth/sessions.py`, `backend/app/auth/storage.py`, `backend/app/auth/errors.py`
- Modify: `backend/app/shiguan/db.py`
- Test: `backend/tests/test_auth_passwords.py`, `backend/tests/test_auth_storage.py`

**Interfaces:**
- Produces immutable `AuthenticatedUser(id: str, username: str, email: str)` and `Session(id: str, user_id: str, expires_at: datetime, revoked_at: datetime | None)`.
- Produces `hash_password(password: str) -> str`, `verify_password(password: str, encoded_hash: str) -> bool`, `create_user(username, email, password) -> AuthenticatedUser`, `authenticate(identifier, password) -> AuthenticatedUser | None`, `create_session(user_id) -> str`, `get_session_user(session_id) -> AuthenticatedUser | None`, and `revoke_session(session_id) -> None`.

- [ ] **Step 1: Write failing password and storage tests**

```python
def test_password_hash_is_salted_and_verifiable():
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")
    assert first != second
    assert verify_password("correct horse battery staple", first) is True
    assert verify_password("wrong", first) is False

def test_login_accepts_username_or_normalized_email_and_revocation_wins(tmp_path):
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("court", "Court@Example.com", "six-or-more")
    assert authenticate("court", "six-or-more") == user
    assert authenticate("court@example.com", "six-or-more") == user
    session_id = create_session(user.id)
    assert get_session_user(session_id) == user
    revoke_session(session_id)
    assert get_session_user(session_id) is None
```

- [ ] **Step 2: Verify RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_passwords.py backend/tests/test_auth_storage.py -q` from repository root.
Expected: FAIL because `app.auth` does not exist.

- [ ] **Step 3: Implement the schema and pure security helpers**

Use `hashlib.scrypt` with a fresh `secrets.token_bytes(16)` salt, store a versioned encoded value containing algorithm parameters, salt and derived key, and use `hmac.compare_digest` during verification. Add `users` (UUID text ID, unique `username`, unique normalized `email`, password hash, created time) and `auth_sessions` (random 32-byte URL-safe ID, user ID, created/expires/revoked time) tables inside the existing SQLite initialization transaction. Reject blank usernames/emails, passwords below six characters, duplicate normalized values, expired sessions, and revoked sessions with explicit domain errors.

- [ ] **Step 4: Verify GREEN**

Run the Task 1 command again.
Expected: PASS; the same password produces different hashes, credentials work with either identifier, and revoked sessions no longer resolve.
