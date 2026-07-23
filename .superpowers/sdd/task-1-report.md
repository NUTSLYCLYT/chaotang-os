# Task 1 Implementation Report: Authentication Domain and Persistent Schema

## Scope and assumptions

- Implemented only Task 1's authentication domain, its focused tests, and the
  shared SQLite initialization schema extension.
- `configure_auth_db(path)` is a deliberately small public test seam inferred
  from the approved Task 1 test. It selects the authentication database path;
  `None` restores the existing shared Shiguan database default.
- Authentication continues to use the existing SQLite connection factory, so
  users and sessions are initialized in its same idempotent schema transaction.

## Changed files

- Created `backend/app/auth/__init__.py`: public domain exports.
- Created `backend/app/auth/models.py`: frozen `AuthenticatedUser` and
  `Session` value objects.
- Created `backend/app/auth/passwords.py`: versioned, salted stdlib scrypt
  hashes and constant-time verification.
- Created `backend/app/auth/sessions.py`: opaque 32-byte URL-safe session IDs
  and the 30-day expiration policy.
- Created `backend/app/auth/storage.py`: user creation, username-or-email
  authentication, session creation, lookup, and revocation.
- Created `backend/app/auth/errors.py`: safe authentication-domain errors.
- Modified `backend/app/shiguan/db.py`: idempotent `users` and
  `auth_sessions` tables, including the user foreign key.
- Created `backend/tests/test_auth_passwords.py` and
  `backend/tests/test_auth_storage.py`: password salt/verification, normalized
  email login, revocation, validation/duplicate, and expiration coverage.

## TDD evidence

### RED

The requested backend virtual environment was absent. A direct system-Python
attempt stopped during test collection because the existing `openai`
dependency was not installed. I created `backend/.venv` and installed the
repository's declared editable development dependencies; no private dotenv or
other private environment file was read.

Command (from repository root):

```powershell
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_passwords.py backend/tests/test_auth_storage.py -q
```

Result before production code: exit 1, with collection errors:

```text
ModuleNotFoundError: No module named 'app.auth'
```

This is the expected missing-feature failure specified by Task 1.

### GREEN

Command (from repository root):

```powershell
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_passwords.py backend/tests/test_auth_storage.py -q
```

Result: `4 passed in 0.97s`.

Additional checks:

```powershell
& .\backend\.venv\Scripts\python.exe -m ruff check backend/app/auth backend/app/shiguan/db.py backend/tests/test_auth_passwords.py backend/tests/test_auth_storage.py
git diff --check
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
```

Results: Ruff reported `All checks passed`; `git diff --check` exited 0; the
complete backend suite reported `483 passed, 1 warning in 21.68s`. The sole
warning is a pre-existing FastAPI/Starlette `TestClient` deprecation warning.

## Self-review

- Passwords are never persisted in plaintext. Each encoding carries `v1`,
  `scrypt` parameters, a fresh 16-byte salt, and derived key; verification
  uses `hmac.compare_digest` and safely rejects malformed encodings.
- Emails are trimmed and lowercased before both persistence and lookup;
  usernames are trimmed and remain exact-match identifiers.
- Unique constraints live in SQLite as the final concurrency-safe guard.
- Session IDs are opaque URL-safe values generated from 32 random bytes.
  Session lookup rejects missing, revoked, malformed, and expired IDs, while
  revocation is idempotent.
- Database errors are mapped to authentication-domain errors without exposing
  driver messages or filesystem paths.
- No API routes, cookie handling, authorization dependency, archive ownership,
  documentation, staging, committing, pushing, deployment, or private
  environment access was performed.

## Concerns

- The requested Task 1 behavior requires revoked/expired session resolution to
  return `None`; this is the explicit rejection signal compatible with the
  published `get_session_user(...) -> AuthenticatedUser | None` interface.
  The dedicated error classes cover invalid registration, duplicate identities,
  unknown users, and storage failures; later HTTP wiring should map inactive
  sessions to its single sanitized 401 response.
- The local `backend/.venv` was created only to obtain the required fresh test
  evidence and is ignored by Git. It is not a tracked source change.

## Review follow-up: unambiguous login identifiers

### Change

The review correctly identified that a `username OR email` lookup is ambiguous
when one account's username equals another account's normalized email. User
registration now begins an SQLite `BEGIN IMMEDIATE` transaction and rejects
any proposed username or normalized email that matches either identity column
of an existing account. The immediate transaction serializes registration, so
two concurrent registrations cannot pass the cross-field check independently.

`backend/tests/test_auth_storage.py` adds the regression case for both
directions of a cross-field collision. `backend/tests/test_auth_passwords.py`
also adds a direct malformed-encoding rejection assertion.

### RED

Command (from repository root):

```powershell
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_passwords.py backend/tests/test_auth_storage.py -q
```

Result: exit 1; the new cross-field test failed with:

```text
Failed: DID NOT RAISE DuplicateIdentityError
```

The malformed-password-encoding assertion already passed because the existing
verifier safely returns `False` for malformed data.

### GREEN

Commands (from repository root):

```powershell
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_passwords.py backend/tests/test_auth_storage.py -q
& .\backend\.venv\Scripts\python.exe -m ruff check backend/app/auth backend/app/shiguan/db.py backend/tests/test_auth_passwords.py backend/tests/test_auth_storage.py
git diff --check
```

Results: `6 passed in 1.45s`; Ruff reported `All checks passed`; and
`git diff --check` exited 0. No files were staged or committed.

## Re-review follow-up: case-folded identity namespace

### Change

The prior cross-field check compared stored values case-sensitively, while
emails are normalized to lowercase. Registration now compares both proposed
identity values and every persisted username/email using Python `casefold()`
inside the same immediate SQLite write transaction. This prevents `Court`
from being registered as a username when `court` is already an email, and the
reverse direction. It does not alter the stored/display username or the
existing exact-match username login behavior.

### RED

Command (from repository root):

```powershell
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_passwords.py backend/tests/test_auth_storage.py -q
```

Result: exit 1; both new directional regression tests failed with
`Failed: DID NOT RAISE DuplicateIdentityError`:

- `test_registration_rejects_casefolded_username_as_an_email`
- `test_registration_rejects_casefolded_email_as_a_username`

### GREEN

Commands (from repository root):

```powershell
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_passwords.py backend/tests/test_auth_storage.py -q
& .\backend\.venv\Scripts\python.exe -m ruff check backend/app/auth backend/app/shiguan/db.py backend/tests/test_auth_passwords.py backend/tests/test_auth_storage.py
git diff --check
```

Results: `8 passed in 1.36s`; Ruff reported `All checks passed`; and
`git diff --check` exited 0. No files were staged or committed.
