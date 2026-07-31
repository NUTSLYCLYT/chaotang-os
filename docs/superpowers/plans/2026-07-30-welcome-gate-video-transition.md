# Welcome Gate Direct Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Navigate directly to `/register` when the welcome background video ends or fails, without rendering the open-door image or waiting one second.

**Architecture:** Reduce the welcome transition to the two phases `closed` and `opening`. Keep the pure helper only for the idempotent start transition; handle video completion and failure through one `router.replace("/register")` callback in `WelcomeGate`. Remove the unused open-door scene and asset.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS Modules, Node.js built-in test runner.

## Global Constraints

- Preserve `welcome-gate-closed.png` as the initial background.
- Preserve `welcome-gate-opening.mp4` as a non-interactive background video.
- Video completion and playback failure both immediately call `router.replace("/register")`.
- Do not render `welcome-gate-open.png`, an `opened` state, a one-second timer, or a transition-time `/login` route.
- Header, hero copy, and action area remain visible during video playback.
- “跳过仪式” and “已有朝堂？登录” continue to navigate directly to `/login`.
- Do not modify registration, login, authentication, backend APIs, or ADR 0028 governance behavior.
- Do not commit, push, publish, or deploy without separate explicit user authorization.

---

### Task 1: Specify the direct-registration transition

**Files:**
- Modify: `frontend/src/features/welcome/welcomeTransition.test.ts`
- Modify: `frontend/src/features/welcome/welcomeContent.test.ts`

**Interfaces:**
- Consumes: current `WelcomeGate.tsx` and `welcomeTransition.ts`.
- Produces: failing tests requiring two phases and immediate `/register` history replacement.

- [ ] **Step 1: Replace the state test with the desired two-phase contract**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { nextWelcomePhase } from "./welcomeTransition.ts";

test("attend starts the background opening video only once", () => {
  assert.equal(nextWelcomePhase("closed", "attend"), "opening");
  assert.equal(nextWelcomePhase("opening", "attend"), "opening");
});
```

- [ ] **Step 2: Add source-contract assertions before implementation**

In `welcomeContent.test.ts`, require:

```ts
assert.match(component, /router\.replace\("\/register"\)/);
assert.match(component, /onEnded=\{completeOpening\}/);
assert.match(component, /onError=\{completeOpening\}/);
assert.doesNotMatch(component, /\bopened\b/);
assert.doesNotMatch(component, /welcome-gate-open\.png/);
assert.doesNotMatch(component, /setTimeout/);
assert.doesNotMatch(component, /router\.(?:push|replace)\("\/login"\)/);
assert.doesNotMatch(css, /welcome-gate-open\.png/);
```

Keep the existing checks for two direct `href="/login"` links, the non-interactive video attributes, and foreground responsive behavior.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- src/features/welcome/welcomeContent.test.ts src/features/welcome/welcomeTransition.test.ts`

Working directory: `frontend`

Expected: FAIL because the source still contains `opened`, `welcome-gate-open.png`, `setTimeout`, and the delayed `/login` navigation.

### Task 2: Implement immediate registration navigation

**Files:**
- Modify: `frontend/src/features/welcome/welcomeTransition.ts`
- Modify: `frontend/src/features/welcome/WelcomeGate.tsx`
- Modify: `frontend/src/features/welcome/welcome.module.css`
- Delete: `frontend/public/assets/v5-pre-auth/welcome-gate-open.png`

**Interfaces:**
- Consumes: `WelcomePhase = "closed" | "opening"` and event `"attend"`.
- Produces: video completion/failure callback `completeOpening(): void` that invokes `router.replace("/register")`.

- [ ] **Step 1: Reduce the pure state helper**

```ts
export type WelcomePhase = "closed" | "opening";

export function nextWelcomePhase(current: WelcomePhase, event: "attend"): WelcomePhase {
  if (current === "closed" && event === "attend") return "opening";
  return current;
}
```

- [ ] **Step 2: Replace delayed navigation with direct history replacement**

Keep the `opening` playback effect, but change its rejection path and completion callback:

```tsx
useEffect(() => {
  if (phase !== "opening") return;

  void videoRef.current?.play().catch(() => {
    router.replace("/register");
  });
}, [phase, router]);

function completeOpening() {
  router.replace("/register");
}
```

Remove the effect that watches `phase === "opened"`, its `setTimeout`, and its timer cleanup. Remove:

```tsx
{phase === "opened" && <div className={`${styles.backdrop} ${styles.opened}`} />}
```

- [ ] **Step 3: Remove the unused open-door style**

Delete:

```css
.opened {
  background-image: url("/assets/v5-pre-auth/welcome-gate-open.png");
}
```

- [ ] **Step 4: Remove the unused open-door binary**

Delete only:

```text
frontend/public/assets/v5-pre-auth/welcome-gate-open.png
```

Verify the resolved absolute target remains inside `D:\workspace\chaotang-os-harness-only\frontend\public\assets\v5-pre-auth\` before deleting it.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/features/welcome/welcomeContent.test.ts src/features/welcome/welcomeTransition.test.ts`

Working directory: `frontend`

Expected: PASS with 2 tests and 0 failures.

### Task 3: Full verification and evidence

**Files:**
- Modify: `docs/product/tasks/2026-07-30-v5-pre-auth-implementation.md`
- Modify: `docs/superpowers/specs/2026-07-30-welcome-gate-video-transition-design.md`
- Modify: `docs/superpowers/plans/2026-07-30-welcome-gate-video-transition.md`

**Interfaces:**
- Consumes: the implemented two-stage transition.
- Produces: fresh test, build, harness, and browser evidence.

- [ ] **Step 1: Run all frontend checks**

Working directory: `frontend`

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: every command exits 0; the test suite reports 0 failures.

- [ ] **Step 2: Run repository checks**

Working directory: repository root.

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
git diff --check -- frontend/src/features/welcome frontend/public/assets/v5-pre-auth docs/product/tasks/2026-07-30-v5-pre-auth-implementation.md docs/superpowers/specs/2026-07-30-welcome-gate-video-transition-design.md docs/superpowers/plans/2026-07-30-welcome-gate-video-transition.md
```

Expected: every command exits 0; `git diff --check` may print only existing LF→CRLF warnings.

- [ ] **Step 3: Verify browser behavior**

At `/`:

1. Confirm the closed-door background is visible.
2. Click “上朝” and confirm the video layer appears while foreground content remains visible.
3. Confirm the video has no controls and the button is disabled.
4. Confirm video completion navigates directly to `/register`.
5. Block or fail the video request and confirm the same immediate `/register` navigation.
6. Confirm no open-door image appears between playback and navigation.

- [ ] **Step 4: Record fresh evidence**

Append exact commands, PASS/FAIL outcomes, browser limitations, unrun items, and remaining risks to `docs/product/tasks/2026-07-30-v5-pre-auth-implementation.md`.

- [ ] **Step 5: Commit only if separately authorized**

Before any Git write, print and verify:

```powershell
Resolve-Path .
git branch --show-current
git rev-parse HEAD
git status --short
```

If and only if the user separately authorizes committing:

```powershell
git add frontend/src/features/welcome/WelcomeGate.tsx frontend/src/features/welcome/welcome.module.css frontend/src/features/welcome/welcomeContent.test.ts frontend/src/features/welcome/welcomeTransition.ts frontend/src/features/welcome/welcomeTransition.test.ts frontend/public/assets/v5-pre-auth/welcome-gate-closed.png frontend/public/assets/v5-pre-auth/welcome-gate-opening.mp4 docs/product/tasks/2026-07-30-v5-pre-auth-implementation.md docs/superpowers/specs/2026-07-30-welcome-gate-video-transition-design.md docs/superpowers/plans/2026-07-30-welcome-gate-video-transition.md
git commit -m "feat: route welcome video to registration"
```
