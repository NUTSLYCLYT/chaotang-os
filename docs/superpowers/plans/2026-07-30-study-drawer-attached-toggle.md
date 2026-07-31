# Study Drawer Attached Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each edge toggle move with its drawer and become the sole visible drawer close control.

**Architecture:** `StudySideDrawers` remains the single owner of open/closing state and renders one toggle per side in closed, opening, open, and closing states. Toggle position and direction are derived from the same drawer width tiers and phase as `AdvisorDrawerShell`; the shell becomes presentation-only and contains no close button.

**Tech Stack:** React 19, TypeScript 5.9, CSS Modules, Node test runner.

## Global Constraints

- Toggle and drawer share the same opening/closing phase, durations, easing, and responsive width values.
- Opening uses `720ms cubic-bezier(0.16, 1, 0.3, 1)`; closing uses `420ms` with the same easing.
- Remove the shell header close button and its props/styles.
- Preserve edge-toggle, backdrop, and Escape closing; restore focus to the edge toggle after closing.
- Preserve drawer content, 1:1 layout, portrait size, width, dynamic bounds, and business behavior.
- Do not stage, commit, push, or deploy.

---

### Task 1: Remove the duplicate shell close control

**Files:**
- Modify: `frontend/src/features/study-visual/AdvisorDrawerShell.tsx`
- Modify: `frontend/src/features/study-visual/AdvisorDrawerShell.module.css`
- Modify: `frontend/src/features/study-visual/AdvisorDrawerShell.test.ts`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`

- [ ] **Step 1: Write failing tests**

Require `AdvisorDrawerShellProps` and markup to contain no `onClose`,
`closeButtonRef`, header close button, or `.close` styles. Require both shell call sites
to omit those props while Escape/backdrop closing assertions remain.

- [ ] **Step 2: Verify RED**

```powershell
cd frontend
npm test -- src/features/study-visual/AdvisorDrawerShell.test.ts src/features/study-visual/StudySideDrawers.test.ts
```

Expected: FAIL on existing close-button props, markup, styles, and call sites.

- [ ] **Step 3: Remove the duplicate control**

Delete the shell props, button markup, CSS rules, `closeRef`, and focus-on-open effect.
Keep focus restoration after the 420ms close lifecycle.

- [ ] **Step 4: Verify GREEN**

Run the same focused command; expect zero failures.

### Task 2: Attach each edge toggle to the animated drawer

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`

- [ ] **Step 1: Write failing lifecycle and position tests**

Require toggles to expose side and phase data attributes, consume `open`, `closing`,
`rendered`, and `phase`, reverse their arrow/accessible label while open, and remain
rendered through closing. Require CSS to use one shared drawer-width variable with
44vw/260px/300px tiers and matching 720/420ms directional keyframes.

- [ ] **Step 2: Verify RED**

Run the focused `StudySideDrawers.test.ts`; expect failures because current toggles are
static viewport-edge buttons.

- [ ] **Step 3: Implement the shared toggle state**

Render one button per side whose state is `closed`, `opening`, `open`, or `closing`.
Closed buttons sit at the viewport edge. Active buttons move to the corresponding panel
outer edge, flip arrow, and call `close(side)`. Use the same responsive width custom
property and phase timings as the shell; prevent a separate close timer or position source.

- [ ] **Step 4: Verify GREEN**

Run focused shell/drawer tests; expect zero failures.

### Task 3: Full and visual verification

- [ ] **Step 1: Run frontend gates**

```powershell
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

- [ ] **Step 2: Run harness**

```powershell
node scripts/check_harness.mjs
```

- [ ] **Step 3: Browser animation acceptance**

For both sides, measure at closed, approximately mid-opening, open, mid-closing, and
closed states. The toggle’s inner edge must remain attached to the drawer outer edge
without a visible gap. Confirm arrows and accessible labels reverse, header has no close
button, backdrop/Escape still close, and focus returns to the toggle.
