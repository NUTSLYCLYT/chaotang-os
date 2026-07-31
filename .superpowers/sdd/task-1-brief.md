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

