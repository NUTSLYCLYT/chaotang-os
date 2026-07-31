# Auth Entry Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make successful login enter `/dadian` by default while successful registration clears browser authentication and returns to a login page with a success notice.

**Architecture:** Separate login destination selection from registration destination selection in the pre-auth pure-function module. Keep the existing FastAPI registration contract, but make the registration BFF revoke the newly issued session on a best-effort basis and always expire the browser cookie before returning success.

**Tech Stack:** Next.js App Router, React, TypeScript, native `node:test`, existing `backendClient` and session-cookie helpers.

## Global Constraints

- Preserve exact safe login destinations `/dadian`, `/study`, and `/shiguan`; all other values fall back to `/dadian`.
- Registration success always returns `/login?registered=1` and never consumes `next`.
- Registration success never leaves a usable `courtos_session` in the browser.
- A failed best-effort revocation must not report an already-created account as a registration failure.
- Do not change ADR 0028, the Dadian business implementation, authentication fields, or FastAPI contracts.
- Codex-only: do not invoke Claude CLI, Claude runner, or `gstack-claude`.
- Git commits, staging, pushing, and deployment remain outside authorization.

---

### Task 1: Split Login and Registration Destinations

**Files:**
- Modify: `frontend/src/features/pre-auth/authForms.test.ts`
- Modify: `frontend/src/features/pre-auth/formValidation.ts`

**Interfaces:**
- Consumes: existing `submitLogin`, `submitRegister`, and `AuthSubmission`.
- Produces: login destinations `"/dadian" | "/study" | "/shiguan"` and registration destination `"/login?registered=1"`.

- [ ] **Step 1: Write failing destination tests**

Replace the old “defaults to study” assertions with explicit cases:

```ts
test("successful login defaults to dadian and preserves exact protected destinations", async () => {
  const request = async () => new Response("{}", { status: 200 });
  for (const [next, destination] of [
    [undefined, "/dadian"],
    ["/dadian", "/dadian"],
    ["/study", "/study"],
    ["/shiguan", "/shiguan"],
    ["https://attacker.example", "/dadian"],
    ["/unknown", "/dadian"],
  ] as const) {
    const result = await submitLogin({ username: "court", password: "six-or-more" }, next, request);
    assert.equal(result.ok && result.destination, destination);
  }
});

test("successful registration always returns to login with a success marker", async () => {
  const result = await submitRegister(
    { username: "court", email: "court@example.com", password: "six-or-more", confirm: "six-or-more" },
    "/shiguan",
    async () => new Response("{}", { status: 201 }),
  );
  assert.deepEqual(result, {
    ok: true,
    destination: "/login?registered=1",
    requestUrl: "/api/auth/register",
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
cd frontend
node --test src/features/pre-auth/authForms.test.ts
```

Expected: FAIL because login still defaults to `/study` and registration still shares the login destination.

- [ ] **Step 3: Implement separate destination policies**

Change the success type and helper boundary:

```ts
type LoginDestination = "/dadian" | "/study" | "/shiguan";
type RegistrationDestination = "/login?registered=1";

export type AuthSubmission =
  | { ok: true; destination: LoginDestination | RegistrationDestination; requestUrl: string }
  | { ok: false; message: string; requestUrl: string };

export function getSafeLoginDestination(next: string | null | undefined): LoginDestination {
  return next === "/study" || next === "/shiguan" || next === "/dadian" ? next : "/dadian";
}
```

Make `submitLogin` return `getSafeLoginDestination(next)` after a successful request. Make `submitRegister` ignore `next` after validation and return `"/login?registered=1"` after a successful request. Keep validation, request payloads, and failure mapping unchanged.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
cd frontend
node --test src/features/pre-auth/authForms.test.ts src/features/pre-auth/formValidation.test.ts
```

Expected: all focused tests PASS.

### Task 2: Remove Registration Auto-Login

**Files:**
- Modify: `frontend/src/app/api/auth/authRoutes.test.ts`
- Modify: `frontend/src/app/api/auth/register/route.ts`

**Interfaces:**
- Consumes: `registerUser`, `logoutUser`, `clearSessionCookie`.
- Produces: registration HTTP 201 with public user JSON and an expired `courtos_session` cookie.

- [ ] **Step 1: Write failing BFF tests**

Extend the auth stub to record every request authorization value and allow configurable logout status. Replace the old registration-cookie test with:

```ts
test("register BFF revokes the issued session and expires the browser cookie", async () => {
  const stub = await startAuthStub();
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      register(jsonRequest(
        "/api/auth/register",
        { username: "court", email: "court@example.com", password: "six-or-more" },
        "courtos_session=old-session",
      )),
    );
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { user });
    assert.deepEqual(stub.authorizations(), [undefined, "Bearer test-session"]);
    assert.match(response.headers.get("set-cookie") ?? "", /courtos_session=.*Max-Age=0/);
    assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /courtos_session=test-session/);
  } finally {
    await stub.close();
  }
});

test("register BFF still reports created account when session revocation fails", async () => {
  const stub = await startAuthStub(503);
  try {
    const response = await withBackendBaseUrl(stub.baseUrl, () =>
      register(jsonRequest("/api/auth/register", {
        username: "court",
        email: "court@example.com",
        password: "six-or-more",
      })),
    );
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { user });
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  } finally {
    await stub.close();
  }
});
```

- [ ] **Step 2: Run the auth route test and verify RED**

Run:

```powershell
cd frontend
node --test src/app/api/auth/authRoutes.test.ts
```

Expected: FAIL because registration currently sets `courtos_session=test-session` and does not call logout.

- [ ] **Step 3: Implement best-effort revocation and cookie expiry**

Update the success branch in `register/route.ts`:

```ts
import { logoutUser, registerUser } from "../../../../lib/backendClient.ts";
import { clearSessionCookie } from "../../../../lib/session.ts";

// after result.ok has been established
if (result.sessionId) {
  await logoutUser({ sessionId: result.sessionId });
}
return clearSessionCookie(json({ user: result.user }, result.status));
```

Do not convert `logoutUser` failure into an HTTP failure. Do not include `sessionId` in the JSON response.

- [ ] **Step 4: Run auth route tests and verify GREEN**

Run:

```powershell
cd frontend
node --test src/app/api/auth/authRoutes.test.ts
```

Expected: all auth route tests PASS.

### Task 3: Show Registration Success and Close Verification

**Files:**
- Modify: `frontend/src/features/pre-auth/authForms.test.ts`
- Modify: `frontend/src/features/pre-auth/LoginForm.tsx`
- Modify if needed: `frontend/src/features/pre-auth/preAuth.module.css`
- Modify: `docs/product/tasks/2026-07-30-auth-entry-routing.md`

**Interfaces:**
- Consumes: `useSearchParams().get("registered")`.
- Produces: non-sensitive success notice only when `registered === "1"`.

- [ ] **Step 1: Write the failing login-notice contract test**

Add source-contract assertions:

```ts
test("login shows a registration success notice only for the exact marker", async () => {
  const login = await readFile(new URL("./LoginForm.tsx", import.meta.url), "utf8");
  assert.match(login, /searchParams\.get\("registered"\) === "1"/);
  assert.match(login, /注册成功，请登录/);
  assert.match(login, /role="status"/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cd frontend
node --test src/features/pre-auth/authForms.test.ts
```

Expected: FAIL because the login form has no registration-success notice.

- [ ] **Step 3: Add the success notice**

In `LoginForm`, derive:

```ts
const registered = searchParams.get("registered") === "1";
```

Render before the form:

```tsx
{registered ? (
  <p className={`${styles.message} ${styles.success}`} role="status">
    注册成功，请登录
  </p>
) : null}
```

If `.success` does not exist, add a focused rule that uses the existing V5 gold/green palette and preserves contrast without changing layout.

- [ ] **Step 4: Run focused and full verification**

Run:

```powershell
cd frontend
node --test src/features/pre-auth/authForms.test.ts src/features/pre-auth/formValidation.test.ts src/app/api/auth/authRoutes.test.ts
npm run lint
npm run typecheck
npm test
npm run build
cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
git diff --check
```

Expected: every command exits 0; all tests PASS; build completes.

- [ ] **Step 5: Update delivery evidence**

Replace the pending implementation fields in `docs/product/tasks/2026-07-30-auth-entry-routing.md` with exact changed behavior, commands, PASS counts, unrun items, and remaining risk. Keep product acceptance `Pending` until the user accepts the result.

No Git write step is included because this task has no authorization to stage, commit, push, merge, or deploy.
