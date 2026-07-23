# Authenticated User Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real local accounts, revocable sessions, protected business routes, and backend-enforced per-user isolation for decrees and archives.

**Architecture:** FastAPI owns users, password verification, opaque sessions, and every authorization decision. Next.js stores only the opaque session ID in a same-origin HttpOnly cookie and proxies authenticated browser calls through BFF Route Handlers. SQLite remains the persistence layer; the existing archive database gains user/session tables and a nullable `owner_user_id` so legacy rows remain inaccessible.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, stdlib `hashlib.scrypt`/`secrets`, SQLite, pytest, Next.js 16 App Router, React 19, TypeScript, Node `node:test`.

## Global Constraints

- Registration is open; usernames and normalized emails are unique; login accepts either username or email plus password.
- Use opaque, server-revocable session IDs only. Never issue JWTs, expose a token to JavaScript, store passwords in plaintext, or accept an owner ID from a request.
- The browser cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when `NODE_ENV === "production"`.
- `/`, `/health`, registration, login and invitation presentation remain public. `/study`, `/shiguan`, their BFF routes, FastAPI decree, and FastAPI archive routes require authentication.
- All archive operations, automatic decree archival, statistics, recall, and review updates must filter by authenticated `owner_user_id`; legacy rows with NULL owner remain invisible.
- Preserve the existing FastAPI health contract and the current public welcome page. Do not make real DeepSeek calls in tests.
- Create ADR 0019 and update architecture/run documentation in the same change. Do not commit, push, deploy, or read private environment files without separate user authorization.

---

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

### Task 2: Expose authentication endpoints and a reusable FastAPI dependency

**Files:**
- Create: `backend/app/api/auth.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_auth_api.py`

**Interfaces:**
- `POST /api/v1/auth/register` accepts `{ "username": string, "email": string, "password": string }`, returns `201 { "user": { "id", "username", "email" }, "session_id": string }`.
- `POST /api/v1/auth/login` accepts `{ "identifier": string, "password": string }`, returns the same successful shape or a generic `401` invalid-credentials error.
- `POST /api/v1/auth/logout` and `GET /api/v1/auth/me` consume `Authorization: Bearer <session_id>`; logout returns 204 and me returns the public user shape.
- Produces `require_current_user(authorization: str | None = Header(...)) -> AuthenticatedUser` for protected routers.

- [ ] **Step 1: Write failing endpoint tests**

```python
def test_register_login_me_and_logout(client):
    registration = client.post("/api/v1/auth/register", json={"username": "court", "email": "court@example.com", "password": "six-or-more"})
    assert registration.status_code == 201
    session_id = registration.json()["session_id"]
    headers = {"Authorization": f"Bearer {session_id}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401

def test_login_does_not_distinguish_unknown_account_from_wrong_password(client):
    unknown = client.post("/api/v1/auth/login", json={"identifier": "missing", "password": "six-or-more"})
    wrong = client.post("/api/v1/auth/login", json={"identifier": "court", "password": "wrong-pass"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["message"] == wrong.json()["message"]
```

- [ ] **Step 2: Verify RED**

Run: `backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth_api.py -q`.  
Expected: FAIL with 404 because the auth router is not mounted.

- [ ] **Step 3: Implement route validation and fail-closed authorization**

Use strict Pydantic request models (`extra="forbid"`), normalize email on registration/login, map duplicate identity to 409 without returning password details, and map all absent, malformed, expired, or revoked bearer credentials to one sanitized 401 JSON body. Mount the router from `app.main` without changing `/health`. Do not accept a session ID in query parameters or request JSON.

- [ ] **Step 4: Verify GREEN**

Run the Task 2 command.  
Expected: PASS for registration, both login identities, logout revocation, and indistinguishable credential failures.

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

### Task 4: Add same-origin Next authentication BFF and authenticated backend forwarding

**Files:**
- Create: `frontend/src/lib/session.ts`, `frontend/src/lib/session.test.ts`
- Create: `frontend/src/app/api/auth/register/route.ts`, `frontend/src/app/api/auth/login/route.ts`, `frontend/src/app/api/auth/logout/route.ts`, `frontend/src/app/api/auth/me/route.ts`
- Modify: `frontend/src/lib/backendClient.ts`, `frontend/src/lib/backendClient.test.ts`
- Modify: `frontend/src/app/api/decrees/chancellor/route.ts`, `frontend/src/app/api/shiguan/archives/route.ts`, `frontend/src/app/api/shiguan/archives/[id]/review/route.ts`, `frontend/src/app/api/shiguan/statistics/route.ts`, `frontend/src/app/api/shiguan/recall/route.ts`
- Test: `frontend/src/app/api/auth/authRoutes.test.ts`, affected existing Route Handler tests

**Interfaces:**
- `SESSION_COOKIE_NAME = "courtos_session"`; `readSessionId()`, `setSessionCookie(response, id)`, and `clearSessionCookie(response)` are server-only helpers.
- BFF auth endpoints return `{ user }` to the browser; they never return `session_id`.
- `backendClient` accepts an optional `sessionId` only in server-side options and emits `Authorization: Bearer <sessionId>` when present.

- [ ] **Step 1: Write failing BFF contract tests**

```ts
test("login BFF sets an HttpOnly same-site cookie and omits the backend session id", async () => {
  const response = await POST(loginRequest({ identifier: "court", password: "six-or-more" }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /courtos_session=.*HttpOnly.*SameSite=Lax/);
  assert.equal((await response.json()).session_id, undefined);
});

test("protected BFF sends its cookie session to the backend and rejects no-cookie callers", async () => {
  assert.equal((await protectedRequestWithoutCookie()).status, 401);
  assert.equal(await capturedBackendAuthorization(), "Bearer test-session");
});
```

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm test -- src/lib/session.test.ts src/app/api/auth/authRoutes.test.ts`.  
Expected: FAIL because the session helpers and auth BFF routes do not exist.

- [ ] **Step 3: Implement server-only cookie and proxy behavior**

Route handlers call FastAPI through `backendClient`, set the session cookie only after successful register/login, revoke then clear it on logout, and return 401 with a stable JSON error when no cookie is present. Update every existing decree/shiguan BFF handler to read the cookie server-side and pass the session to `backendClient`; forward 401 without converting it into a network error. Do not add session access to client components or `NEXT_PUBLIC_` backend configuration.

- [ ] **Step 4: Verify GREEN**

Run the Task 4 command and `npm test`.  
Expected: auth endpoints do not leak session IDs, protected BFF routes require a cookie, and existing backend JSON contracts remain mapped correctly.

### Task 5: Make login/register real and protect business pages

**Files:**
- Create: `frontend/src/lib/requireUser.ts`, `frontend/src/features/pre-auth/authForms.test.ts`
- Modify: `frontend/src/features/pre-auth/LoginForm.tsx`, `frontend/src/features/pre-auth/RegisterForm.tsx`, `frontend/src/features/pre-auth/formValidation.ts`
- Modify: `frontend/src/app/study/page.tsx`, `frontend/src/app/shiguan/page.tsx`
- Create: `frontend/src/app/study/StudyClient.tsx`, `frontend/src/app/shiguan/ShiguanClient.tsx`
- Test: `frontend/src/lib/requireUser.test.ts`, existing study/shiguan tests

**Interfaces:**
- `requireUser(nextPath: "/study" | "/shiguan") -> Promise<PublicUser>` reads the HttpOnly cookie server-side, validates it through the BFF/backend, and redirects to `/login?next=<encoded-path>` on 401.
- Page default exports are server components calling `requireUser`; existing interactive UI moves unchanged into the named client components.
- Successful forms call same-origin BFF routes and navigate only to an allowlisted `next` path (`/study` or `/shiguan`), otherwise `/study`.

- [ ] **Step 1: Write failing route and form tests**

```ts
test("requireUser redirects an absent or rejected session to the safe login next URL", async () => {
  await assert.rejects(() => requireUser("/shiguan"), /\/login\?next=%2Fshiguan/);
});

test("successful registration uses the BFF and never renders the former unavailable-service message", async () => {
  const result = await submitRegister({ username: "court", email: "court@example.com", password: "six-or-more", confirm: "six-or-more" });
  assert.equal(result.destination, "/study");
  assert.equal(result.requestUrl, "/api/auth/register");
});
```

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm test -- src/lib/requireUser.test.ts src/features/pre-auth/authForms.test.ts`.  
Expected: FAIL because protected page wrappers and real form submit behavior do not exist.

- [ ] **Step 3: Implement protected rendering and client states**

Move the current `"use client"` study and shiguan implementations into their client component files; make the route files server wrappers that call `requireUser`. Replace demo-only form submit handlers with BFF calls, display backend validation/conflict/credential failures accessibly, and navigate after success using an allowlist rather than arbitrary `next` URLs. On BFF 401 from business interactions, show a session-expired message and navigate to the matching safe login URL. Keep invitation code display-only because registration is open.

- [ ] **Step 4: Verify GREEN**

Run the Task 5 command plus `npm run lint && npm run typecheck && npm test`.  
Expected: protected routes redirect without a valid session, real registration/login call only same-origin BFF endpoints, and old UI validation remains intact.

### Task 6: Record the architecture and complete end-to-end verification

**Files:**
- Create: `docs/decisions/0019-authenticated-user-isolation.md`
- Modify: `ARCHITECTURE.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`, `docs/product/tasks/2026-07-23-authenticated-user-isolation.md`
- Test: `backend/tests/test_auth_api.py`, `frontend/src/app/api/auth/authRoutes.test.ts`, all existing suites

**Interfaces:**
- ADR records FastAPI as identity authority, opaque cookie-backed sessions, same-origin BFF, and owner-scoped SQLite data.
- Run documentation includes public and protected routes, required local services, and safe two-account verification without a real model request.

- [ ] **Step 1: Write the ADR and documentation assertions**

Document the rejected JWT and frontend-only alternatives, cookie flags, session revocation behavior, legacy-data treatment, and the explicit rule that clients never select an owner. Add a documentation test or source assertion that verifies the public `/health` route stays unauthenticated while protected FastAPI routes use `require_current_user`.

- [ ] **Step 2: Verify documentation assertions fail before the guarded contract is present**

Run the focused assertion command added in Step 1.  
Expected: FAIL before the protection annotations and documentation are complete.

- [ ] **Step 3: Finish the end-to-end test scenario**

Start FastAPI on `127.0.0.1:8000` and Next.js in production mode. Register account A and account B through Next BFF; with A create a decree using a fake/injected graph response and verify its archive appears for A; with B verify list/statistics/recall are empty and direct review/read of A's ID returns 404; logout A then verify `/study`, `/shiguan`, and all protected BFF routes deny access. Do not invoke a real model.

- [ ] **Step 4: Run complete verification**

Run from repository root:

```powershell
backend\.venv\Scripts\python.exe -m ruff check backend
backend\.venv\Scripts\python.exe -m pytest backend/tests
cd frontend; npm run lint; npm run typecheck; npm test; npm run build
cd ..; node scripts/check_harness.mjs; git diff --check
```

Expected: every command exits 0; evidence records the two-user isolation result, protected-route results, and the fact that no real model was called.
