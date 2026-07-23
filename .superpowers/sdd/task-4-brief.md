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
