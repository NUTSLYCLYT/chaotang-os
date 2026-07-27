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
