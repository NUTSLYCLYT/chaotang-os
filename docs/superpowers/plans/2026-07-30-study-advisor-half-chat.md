# Study Advisor Half-Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both adviser conversations half of the available drawer space, reduce portraits to 90×96px, and remove Qintian’s decree-prefill button.

**Architecture:** Keep the shared `AdvisorDrawerShell` as the only owner of portrait sizing and body/footer proportions. Remove only the Qintian conversion control from `QintianPanel`; preserve all chat, forecast, trigger-review, and adviser data flows.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, CSS Modules, Node test runner.

## Global Constraints

- Body and footer must each use the same flex ratio and `min-height: 0`.
- Portrait image must be exactly `90px × 96px`, with tighter header spacing.
- Qintian’s “转为拟旨” button and its layout space must not render.
- Preserve drawer width, bounds, animation, glass styling, input styling, business APIs, and execution-authority boundaries.
- Do not stage, commit, push, or deploy.

---

### Task 1: Shared 1:1 layout and compact portrait

**Files:**
- Modify: `frontend/src/features/study-visual/AdvisorDrawerShell.module.css`
- Modify: `frontend/src/features/study-visual/AdvisorDrawerShell.test.ts`

**Interfaces:**
- Consumes: existing `.body`, `.footer`, `.portrait`, and `.portraitImage` shell classes.
- Produces: one shared 1:1 body/footer contract and exact 90×96 portrait dimensions.

- [ ] **Step 1: Add failing contract assertions**

Assert that `.body` and `.footer` each contain `flex: 1 1 0` and `min-height: 0`,
that `.portrait` is `width: 90px; height: 96px`, and that header padding is smaller
than the current declaration.

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd frontend
npm test -- src/features/study-visual/AdvisorDrawerShell.test.ts
```

Expected: FAIL on the current 2:1 ratio and current portrait dimensions.

- [ ] **Step 3: Implement minimal shared CSS**

Set body and footer to identical `flex: 1 1 0`, retain `min-height: 0`, set the
portrait to exactly `90px × 96px`, and reduce only portrait-header vertical spacing.

- [ ] **Step 4: Verify GREEN**

Run the same focused test and expect all assertions to pass.

### Task 2: Remove Qintian decree-prefill presentation

**Files:**
- Modify: `frontend/src/features/study-visual/QintianPanel.tsx`
- Modify: `frontend/src/features/study-visual/QintianPanel.module.css`
- Modify: `frontend/src/features/study-visual/QintianPanel.test.ts`

**Interfaces:**
- Preserves: forecast creation, review submission, consultation, scenario rendering, and all existing error states.
- Removes: rendered button text `转为拟旨`/`转为拟旨输入` and now-unused `.secondary` presentation.

- [ ] **Step 1: Add a failing removal test**

Assert that `QintianPanel.tsx` does not contain the conversion button copy or a click
handler that calls `onPrefillDecree` from the conversation footer, while continuing
to assert the consultation and formal forecast entry points.

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd frontend
npm test -- src/features/study-visual/QintianPanel.test.ts
```

Expected: FAIL because the button is still rendered.

- [ ] **Step 3: Remove the control**

Delete the conditional conversion button and its unused `.secondary` CSS. Keep the
existing prop/API shape if it is still required by the surrounding workspace contract;
do not alter backend or decree execution paths.

- [ ] **Step 4: Verify GREEN**

Run the same focused test and expect all assertions to pass.

### Task 3: Regression and browser acceptance

**Files:**
- Modify only if a scoped verification failure exposes a regression.

- [ ] **Step 1: Run frontend gates**

```powershell
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits `0`.

- [ ] **Step 2: Browser-check both drawers**

At `http://127.0.0.1:3010/study`, verify the left and right drawers each show equal
upper/lower regions, 90×96 portraits, independently scrolling content, fixed composers,
and no Qintian conversion button.

- [ ] **Step 3: Inspect the diff**

Confirm the change is limited to the shared layout, Qintian presentation, tests, and
approved design/plan docs. Do not stage or commit.
