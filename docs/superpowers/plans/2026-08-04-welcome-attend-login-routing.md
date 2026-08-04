# Welcome Attend Login Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the welcome gate opening video and route the “上朝” flow to `/login` instead of `/register`.

**Architecture:** Keep the existing two-phase `WelcomeGate` state machine. Change only the shared completion navigation so natural completion, media errors, and rejected playback all converge on the login page.

**Tech Stack:** Next.js App Router, React, TypeScript, Node.js test runner.

## Global Constraints

- Do not change `welcomeTransition.ts`, visual assets, authentication APIs, or ADR 0028.
- Do not add timers, state phases, backend requests, or dependencies.
- Preserve both existing direct `/login` links.
- Do not commit without separate user authorization.
- The same final version must pass the complete acceptance workflow 10 consecutive times; restart at round 1 after any failure or material change.

---

### Task 1: Route the welcome ceremony to login

**Files:**
- Modify: `frontend/src/features/welcome/welcomeContent.test.ts`
- Modify: `frontend/src/features/welcome/WelcomeGate.tsx`
- Modify: `docs/product/tasks/2026-08-04-welcome-attend-login-routing.md`

**Interfaces:**
- Consumes: `useRouter().replace(destination)` and the existing `completeOpening()` media event handler.
- Produces: all ceremony completion paths call `router.replace("/login")`; no new exported API.

- [x] **Step 1: Write the failing contract test**

Replace the old register-navigation assertions in `welcomeContent.test.ts` with:

```ts
assert.equal(component.match(/href="\/login"/g)?.length, 2);
assert.equal(component.match(/router\.replace\("\/login"\)/g)?.length, 2);
assert.doesNotMatch(component, /router\.(?:push|replace)\("\/register"\)/);
```

The two `router.replace("/login")` occurrences cover the rejected `video.play()` path and the shared `completeOpening()` handler used by both `onEnded` and `onError`.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
Set-Location frontend
node --test src/features/welcome/welcomeContent.test.ts
```

Expected: FAIL because `WelcomeGate.tsx` still contains two `router.replace("/register")` calls and no ceremony `router.replace("/login")` call.

- [x] **Step 3: Implement the minimal production change**

In `WelcomeGate.tsx`, preserve the state machine and replace only the two ceremony destinations:

```tsx
void videoRef.current?.play().catch(() => {
  router.replace("/login");
});

function completeOpening() {
  router.replace("/login");
}
```

- [x] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
Set-Location frontend
node --test src/features/welcome/welcomeContent.test.ts src/features/welcome/welcomeTransition.test.ts
```

Expected: PASS with 0 failed tests.

- [x] **Step 5: Self-review the scoped diff**

Run:

```powershell
git diff -- frontend/src/features/welcome/WelcomeGate.tsx frontend/src/features/welcome/welcomeContent.test.ts docs/product/tasks/2026-08-04-welcome-attend-login-routing.md
git diff --check
```

Confirm the diff changes no styles, assets, state-machine code, authentication code, or unrelated user edits.

- [x] **Step 6: Run one complete verification round**

From `frontend/` run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

From the repository root run:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: every command exits 0.

- [x] **Step 7: Repeat the unchanged complete verification round 9 more times**

Record rounds 1–10, each command, exit status, and PASS/FAIL in the product task Implementation Report. If any command fails, or code/configuration/acceptance commands materially change, restart the count at round 1.

- [x] **Step 8: Complete the implementation report**

Replace `Pending` under `Implementation Report` with the changed behavior, TDD RED/GREEN evidence, self-review result, all 10 acceptance rounds, unrun checks, and residual risks. Leave `Acceptance Review` pending for product acceptance.
