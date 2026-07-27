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
