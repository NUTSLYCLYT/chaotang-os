# Chancellor Draft Timeout Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the Chancellor draft BFF to wait for the existing bounded three-attempt backend synthesis by changing its default timeout from 30 seconds to 120 seconds.

**Architecture:** Define one draft-specific timeout constant in `frontend/src/lib/backendClient.ts` and use it only as the default for `chancellorDraft()`. Preserve injected `timeoutMs`, the AbortController behavior, response parsing, HTTP mappings, and all backend behavior.

**Tech Stack:** TypeScript, Node.js native test runner, Next.js server-side BFF client.

## Global Constraints

- Preserve ADR 0028 without modification.
- Default Chancellor draft timeout is exactly `120000` milliseconds.
- Caller-provided `timeoutMs` must continue to override the default.
- Do not change backend retries, model settings, HTTP contracts, error copy, or unrelated clients.
- Preserve all unrelated working-tree changes.
- Do not stage, commit, push, deploy, or publish without separate authorization.

---

### Task 1: Raise only the Chancellor draft default timeout

**Files:**
- Modify: `frontend/src/lib/backendClient.test.ts`
- Modify: `frontend/src/lib/backendClient.ts`

**Interfaces:**
- Consumes: `chancellorDraft(messages, version, options)` and `ChancellorConsultOptions.timeoutMs`
- Produces: a 120000 ms default scheduling delay while preserving explicit timeout overrides

- [ ] **Step 1: Write a failing default-timeout test**

Add a deterministic test that injects `scheduleTimeout`, captures its `delay`, returns an in-memory valid draft response through `fetchImpl`, and asserts the captured delay equals `120000`. Do not wait on a real clock or start an HTTP server.

- [ ] **Step 2: Run the focused test and verify RED**

Run from `frontend/`:

```powershell
node --test src/lib/backendClient.test.ts --test-name-pattern="chancellor draft uses 120 second default timeout"
```

Expected: FAIL because the actual delay is `30000`.

- [ ] **Step 3: Implement the minimal production change**

Add near the existing timeout constants:

```typescript
const CHANCELLOR_DRAFT_TIMEOUT_MS = 120000;
```

Change only the `chancellorDraft()` scheduling expression to:

```typescript
options.timeoutMs ?? CHANCELLOR_DRAFT_TIMEOUT_MS
```

- [ ] **Step 4: Verify GREEN and override compatibility**

Run from `frontend/`:

```powershell
node --test src/lib/backendClient.test.ts
npm run typecheck
npm run lint
```

Expected: every command exits 0; existing injected short-timeout test remains passing.

- [ ] **Step 5: Review scope**

Run:

```powershell
git diff --check -- frontend/src/lib/backendClient.ts frontend/src/lib/backendClient.test.ts
git diff -- frontend/src/lib/backendClient.ts frontend/src/lib/backendClient.test.ts
```

Expected: only the new test, timeout constant, and one default expression changed. Do not commit without separate authorization.
