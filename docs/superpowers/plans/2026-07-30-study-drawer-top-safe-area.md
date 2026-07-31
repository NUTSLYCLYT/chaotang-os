# Study Drawer Top Safe Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep both Study adviser drawer headers below the fixed 63px court navigation.

**Architecture:** Change only the shared drawer shell positioning. Preserve the existing bottom dock offset and all panel content behavior.

**Tech Stack:** Next.js, React, CSS Modules, Node test runner

## Global Constraints

- Both adviser drawers must remain visually identical at the shell level.
- Do not change Qintian data, model, or execution behavior.
- Preserve `bottom: 63px`.

---

### Task 1: Add and implement the top safe area

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`

**Interfaces:**
- Consumes: shared `.drawer` CSS class.
- Produces: a drawer viewport bounded by `top: 63px` and `bottom: 63px`.

- [ ] **Step 1: Write the failing test**

Assert that `.drawer` contains both `top: 63px` and `bottom: 63px`.

- [ ] **Step 2: Verify the test fails**

Run `npm test -- src/features/study-visual/StudySideDrawers.test.ts`.
Expected: failure because `.drawer` still contains `top: 0`.

- [ ] **Step 3: Implement the minimal CSS change**

Change the shared `.drawer` declaration from `top: 0` to `top: 63px`.

- [ ] **Step 4: Verify automated and visual behavior**

Run the focused test, typecheck, lint, and full frontend tests. Open `/study#qintian` and confirm the complete header is visible below the court navigation.
