# Study Side Panels Dev Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/study` Chancellor and Qintian drawers visually match the `dev` Shangshufang side columns while preserving all current real data and API behavior.

**Architecture:** Keep `StudySideDrawers` as the stateful drawer controller and introduce a shared, presentational `AdvisorDrawerShell` for the dev-compatible glass panel, portrait header, scrolling body, and pinned footer. Chancellor and Qintian business components continue owning their current data and actions and render through the shell slots.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, CSS Modules, Node test runner.

## Global Constraints

- The `dev` branch is the single source of truth for panel dimensions, colors, spacing, typography, borders, shadows, motion, and responsive behavior.
- Preserve current real Chancellor and Qintian data, formal forecast, pending-trigger review, consultation, and error behavior.
- Do not copy `dev` static tutorials, mock replies, old API calls, or execution logic.
- Do not modify or bypass `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.
- Do not stage, commit, push, or deploy without separate user authorization.

---

### Task 1: Lock the shared dev-compatible drawer contract

**Files:**
- Create: `frontend/src/features/study-visual/AdvisorDrawerShell.tsx`
- Create: `frontend/src/features/study-visual/AdvisorDrawerShell.module.css`
- Create: `frontend/src/features/study-visual/AdvisorDrawerShell.test.ts`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`

**Interfaces:**
- Produces: `AdvisorDrawerShell(props: { side: "left" | "right"; portrait: string; name: string; duty: string; open: boolean; onClose(): void; children: ReactNode; footer?: ReactNode; testId?: string }): JSX.Element`
- Consumes: existing open/close state and content from `StudySideDrawers`.

- [ ] **Step 1: Write failing structure and parity tests**

Add tests that require both drawers to render `AdvisorDrawerShell`, require the shell to expose `data-advisor-side`, `header`, `body`, and optional `footer` regions, and require the CSS to include the exact `dev` glass background, border, shadow, header spacing, width tiers, transitions, and reduced-motion rule.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
cd frontend
npm test -- src/features/study-visual/AdvisorDrawerShell.test.ts src/features/study-visual/StudySideDrawers.test.ts
```

Expected: FAIL because `AdvisorDrawerShell` and its parity declarations do not exist.

- [ ] **Step 3: Implement the minimal shared shell**

Create the shell with one fixed portrait header, one `min-height: 0` scrolling body, and one non-shrinking footer. Move only presentation and layout declarations from `StudySideDrawers` into the shell. Keep Escape, hash opening, focus restoration, and consultation state in `StudySideDrawers`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
cd frontend
npm test -- src/features/study-visual/AdvisorDrawerShell.test.ts src/features/study-visual/StudySideDrawers.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 5: Review the diff without committing**

Confirm no fetch/API/state-machine code moved into the shell and no `dev` business constants were copied.

### Task 2: Move Chancellor presentation into the shared shell

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`

**Interfaces:**
- Consumes: `AdvisorDrawerShell` from Task 1.
- Preserves: recent archived replies, reply selection, retry, Chancellor consultation, Enter/Shift+Enter/IME behavior, and avatars.

- [ ] **Step 1: Write failing Chancellor parity tests**

Require the left drawer to pass the `dev` Chancellor portrait, name, duty, content region, and composer footer into `AdvisorDrawerShell`. Require archived reply cards and chat controls to retain their existing callbacks and accessibility labels.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cd frontend
npm test -- src/features/study-visual/StudySideDrawers.test.ts
```

Expected: FAIL because the left drawer still owns duplicated header/body/footer presentation.

- [ ] **Step 3: Implement the Chancellor migration**

Render existing archive/retry content as shell children and render the existing Chancellor chat composer as the shell footer. Replace duplicated header markup and layout CSS with shell props; do not alter request or persistence logic.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
cd frontend
npm test -- src/features/study-visual/StudySideDrawers.test.ts
```

Expected: PASS with zero failures.

### Task 3: Move Qintian presentation into the shared shell

**Files:**
- Modify: `frontend/src/features/study-visual/QintianPanel.tsx`
- Modify: `frontend/src/features/study-visual/QintianPanel.module.css`
- Modify: `frontend/src/features/study-visual/QintianPanel.test.ts`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`

**Interfaces:**
- Consumes: shell body/footer slots provided by `StudySideDrawers`.
- Preserves: `QintianPanelProps`, formal forecast, scenarios, assumptions, evidence, triggers, review submission, chat, and `onPrefillDecree`.

- [ ] **Step 1: Write failing Qintian parity and behavior-preservation tests**

Require Qintian to use the same shell header/body/footer rhythm as Chancellor, require its composer to use the shared dev-compatible input class, and retain assertions for every real forecast/review/chat action.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
cd frontend
npm test -- src/features/study-visual/QintianPanel.test.ts src/features/study-visual/StudySideDrawers.test.ts
```

Expected: FAIL because Qintian still defines a second panel and composer layout.

- [ ] **Step 3: Implement the Qintian migration**

Keep the forecast/review/notebook content in the shell body. Move the conversation history and composer into the shared footer rhythm while allowing the message list to flex and scroll. Remove only redundant container and input styling from `QintianPanel.module.css`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
cd frontend
npm test -- src/features/study-visual/QintianPanel.test.ts src/features/study-visual/StudySideDrawers.test.ts
```

Expected: PASS with zero failures.

### Task 4: Prove focus, responsive, and visual parity

**Files:**
- Modify: `frontend/src/features/study-visual/AdvisorDrawerShell.module.css`
- Modify: `frontend/src/features/study-visual/AdvisorDrawerShell.test.ts`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`
- Modify: `frontend/src/features/study-visual/QintianPanel.test.ts`

**Interfaces:**
- Consumes: completed shared shell and both adviser integrations.
- Produces: regression coverage for default, hover, focus, focus-visible, disabled, desktop, mobile, and reduced-motion states.

- [ ] **Step 1: Write failing exact-state tests**

Require explicit declarations for composer `border`, `outline`, and `box-shadow` in both `:focus` and `:focus-visible`; require desktop widths `260px` and `300px`, mobile `100vw` maximum, the `dev` vertical bounds, and a fixed header/footer with only body scrolling.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
cd frontend
npm test -- src/features/study-visual/AdvisorDrawerShell.test.ts src/features/study-visual/StudySideDrawers.test.ts src/features/study-visual/QintianPanel.test.ts
```

Expected: FAIL on any missing or mismatched state declaration.

- [ ] **Step 3: Apply the minimal CSS corrections**

Copy the relevant values from `dev` exactly and remove competing selectors from the current CSS modules. Do not add one-off `!important` rules except where `dev` itself uses them for `focus-visible`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
cd frontend
npm test -- src/features/study-visual/AdvisorDrawerShell.test.ts src/features/study-visual/StudySideDrawers.test.ts src/features/study-visual/QintianPanel.test.ts
```

Expected: PASS with zero failures.

### Task 5: Full verification and browser acceptance

**Files:**
- No production files unless a failing verification exposes a scoped regression.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: fresh automated and browser evidence.

- [ ] **Step 1: Run all frontend gates**

Run:

```powershell
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits `0`; tests report zero failures.

- [ ] **Step 2: Run repository harness gates**

Run from the worktree root:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
```

Expected: both commands exit `0`.

- [ ] **Step 3: Verify the live page**

At `http://127.0.0.1:3010/study`, open the left drawer and then
`http://127.0.0.1:3010/study#qintian`. Verify header text and close controls are unobscured,
only the body scrolls, both composers retain the dev focus state, the layout works at desktop
and mobile widths, and Qintian real consultation/formal forecast controls remain available.

- [ ] **Step 4: Inspect the final diff**

Confirm changes are limited to the approved visual shell, integrations, tests, and design/plan documentation. Report all commands, PASS/FAIL results, any unrun checks, and residual risks without staging or committing.
