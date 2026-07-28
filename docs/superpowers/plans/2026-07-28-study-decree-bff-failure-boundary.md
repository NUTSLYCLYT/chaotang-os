# 上书房下旨 BFF 故障边界 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure an unexpected BFF dependency rejection returns a stable, sanitized 503 JSON response instead of terminating the browser submission transport.

**Architecture:** Keep the existing browser → Next.js BFF → FastAPI flow. Wrap only the injected `submitDecree` call in the Route Handler so its unexpected reject becomes the existing `unknown` response envelope; normal result mapping is untouched.

**Tech Stack:** Next.js Route Handler, TypeScript, Node built-in `node:test`.

## Global Constraints

- Keep ADR 0028’s decree flow unchanged.
- Do not expose exception text, backend URLs, sessions, or keys.
- Do not change model invocation or timeout behavior.
- Browser continues to use only `/api/decrees/chancellor`.

---

### Task 1: Convert unexpected submit rejection into a stable BFF response

**Files:**
- Modify: `frontend/src/app/api/decrees/chancellor/route.test.ts`
- Modify: `frontend/src/app/api/decrees/chancellor/route.ts`

**Interfaces:**
- Consumes: `createPostHandler(submit, readSession)` and existing `ChancellorErrorResponseBody`.
- Produces: a 503 `{ status: "error", reason: "unknown", message: string }` response for rejected `submit` dependencies.

- [ ] **Step 1: Write the failing test**

Append this test to `frontend/src/app/api/decrees/chancellor/route.test.ts`:

```ts
test("POST：submit 依赖意外抛出时返回脱敏 503 JSON", async () => {
  const handler = createPostHandler(async () => {
    throw new Error("private backend detail");
  });

  const response = await handler(makeRequest({ decreeText: "测试" }));
  const text = await response.text();

  assert.equal(response.status, 503);
  assert.equal(text.includes("private backend detail"), false);
  assert.deepEqual(JSON.parse(text), {
    status: "error",
    reason: "unknown",
    message: "服务暂时不可用，请稍后重试。",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/app/api/decrees/chancellor/route.test.ts` from `frontend`.

Expected: FAIL because the injected dependency rejection escapes `createPostHandler`.

- [ ] **Step 3: Write minimal implementation**

In `createPostHandler`, replace the direct call:

```ts
const result = await submit(decreeText, { sessionId });
```

with:

```ts
let result: Awaited<ReturnType<typeof submitDecree>>;
try {
  result = await submit(decreeText, { sessionId });
} catch {
  return jsonResponse(
    { status: "error", reason: "unknown", message: FRIENDLY_MESSAGE_BY_KIND.unknown },
    HTTP_STATUS_BY_KIND.unknown,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/app/api/decrees/chancellor/route.test.ts` from `frontend`.

Expected: PASS with zero failures.

- [ ] **Step 5: Verify related quality gates**

Run from `frontend`:

```powershell
npm run lint
npm run typecheck
node --test src/app/study/studySubmission.test.ts src/app/api/decrees/chancellor/route.test.ts
```

Expected: each command exits 0.

