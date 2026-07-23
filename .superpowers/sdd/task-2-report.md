# Task 2 implementation report: authentication HTTP contract

## Scope and assumptions

- Task type: FastAPI HTTP-contract implementation over the existing `app.auth`
  domain from Task 1.
- Allowed implementation paths were limited to `backend/app/api/auth.py`,
  `backend/app/main.py`, and `backend/tests/test_auth_api.py`; this report is
  the required task evidence artifact.
- No archive/decree authorization was introduced. `GET /health` was retained
  unchanged.
- No private environment files were read, and no staging, commit, push, or
  deployment action was performed.

## Files changed

- Created `backend/app/api/auth.py`
  - Strict Pydantic registration/login bodies (`extra="forbid"`).
  - Register, login, logout, and current-user endpoints under
    `/api/v1/auth`.
  - `require_current_user(authorization: str | None = Header(default=None))`
    reusable FastAPI dependency.
  - Uniform sanitized bearer-credential `401 {"message":"invalid credentials"}`
    mapping and duplicate-identity `409` mapping.
- Modified `backend/app/main.py`
  - Mounted the authentication router and its exception handlers without
    modifying the existing health route.
- Created `backend/tests/test_auth_api.py`
  - Isolated-database HTTP tests for registration, username/email login,
    `me`, logout revocation, generic credential failures, strict request
    bodies, and malformed/missing bearer credentials.

## TDD evidence

### RED

Command run from the repository root:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_api.py -q
```

Result before adding the router implementation: `3 failed`.

- `test_register_login_me_and_logout`: expected `201`, got `404 Not Found`.
- `test_login_does_not_distinguish_unknown_account_from_wrong_password`:
  expected `401`, got `404 Not Found`.
- `test_rejects_unrecognized_fields_and_malformed_bearer_credentials`:
  expected `422`, got `404 Not Found`.

This was the expected failure mode: the auth router had not yet been mounted.

### GREEN

Commands run from the repository root:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_api.py -q
backend\.venv\Scripts\python.exe -m ruff check backend/app/api/auth.py backend/app/main.py backend/tests/test_auth_api.py
```

Results:

- `3 passed, 1 warning in 0.85s` for the focused API tests. The warning is
  the existing FastAPI/Starlette TestClient deprecation warning about HTTPX.
- `All checks passed!` from Ruff.

Full backend regression verification:

```powershell
Push-Location backend; .venv\Scripts\python.exe -m pytest; Pop-Location
```

Result: `490 passed, 1 warning in 22.18s`; the same pre-existing TestClient
deprecation warning was emitted.

## Self-review

- Successful responses expose only `id`, `username`, and normalized `email`;
  neither password nor password hash is present in response schemas.
- Login delegates username/email normalization to `app.auth.authenticate` and
  maps both unknown-user and wrong-password outcomes to the identical 401
  body.
- Missing, malformed, revoked, and expired session IDs fail closed through
  the common `require_current_user` path. Logout revokes the parsed bearer
  session only after that dependency has resolved it as active.
- The only session input accepted by protected endpoints is the
  `Authorization: Bearer <session_id>` header; no query or JSON session input
  is modeled.
- `git status --short` still shows unrelated pre-existing work (including
  Task 1's untracked `backend/app/auth/`); no such files were edited by this
  task.

## Remaining concerns

- Focused and full test runs emit a dependency deprecation warning from
  FastAPI's TestClient/HTTPX integration. It is outside this task's allowed
  paths and has no failing behavior.
- Authentication storage availability errors retain their Task 1 domain
  behavior; this task only maps the specified public contract errors and does
  not add broader authorization policy.
