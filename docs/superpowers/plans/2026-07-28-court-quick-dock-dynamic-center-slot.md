# Court Quick Dock Dynamic Center Slot Implementation Plan

> **For Codex:** Execute task-by-task with `subagent-driven-development`; keep tests RED before production edits and run fresh verification before completion.

**Goal:** Make the shared bottom dock fill the viewport, keep “问钦天监” aligned to the right edge, and reserve a center column only when a module is actually supplied.

**Architecture:** `ImmersiveCourtShell` exposes one optional `ReactElement | null` slot and forwards it to `CourtQuickDock`. A small pure layout resolver maps slot presence to a CSS modifier. CSS owns the two-column and three-column layouts, including compact behavior below 960px and safe-area-aware edge padding.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, Node test runner.

**Scope constraint:** Do not stage or commit in this plan. Preserve all unrelated working-tree changes.

---

### Task 1: Add failing behavior and source-contract tests

**Files:**
- Create: `frontend/src/features/court-visuals/courtQuickDockLayout.test.ts`
- Modify: `frontend/src/features/court-visuals/courtVisuals.test.ts`
- Modify: `frontend/src/app/court-migration-assets.test.ts`

**Step 1: Write the failing layout-resolver test**

Use a guarded dynamic import so the missing production module produces an assertion failure. Assert that `undefined` and `null` select the two-column layout while a React-element-shaped value selects the three-column layout.

**Step 2: Write failing component and CSS contract tests**

Assert:

- `ImmersiveCourtShellProps` contains `quickDockCenter?: ReactElement | null`.
- `ImmersiveCourtShell` forwards `quickDockCenter` to `CourtQuickDock`.
- `CourtQuickDock` renders a center wrapper only in center mode.
- no-center mode uses two equal columns.
- center mode uses `1fr / minmax(240px, 40vw) / 1fr`.
- the right entry stretches its grid cell, aligns content right, and uses safe-area-aware right padding.
- center mode switches to `1fr / minmax(84px, 28vw) / 1fr` below 960px and hides secondary text.

**Step 3: Run focused tests and confirm RED**

Run:

```powershell
node --test --experimental-strip-types src/features/court-visuals/courtQuickDockLayout.test.ts src/features/court-visuals/courtVisuals.test.ts
```

Expected: FAIL for missing resolver and missing dynamic-layout contracts.

### Task 2: Implement the minimal dynamic layout

**Files:**
- Create: `frontend/src/features/court-visuals/courtQuickDockLayout.ts`
- Modify: `frontend/src/features/court-visuals/types.ts`
- Modify: `frontend/src/features/court-visuals/ImmersiveCourtShell.tsx`
- Modify: `frontend/src/features/court-visuals/CourtQuickDock.tsx`
- Modify: `frontend/src/features/court-visuals/CourtQuickDock.module.css`

**Step 1: Implement the pure resolver**

Return `"without-center"` for `null`/`undefined` and `"with-center"` for a supplied `ReactElement`.

**Step 2: Wire the shell slot**

Add `quickDockCenter?: ReactElement | null`, destructure it, and pass it to `<CourtQuickDock centerSlot={quickDockCenter} />`.

**Step 3: Render the conditional center wrapper**

Give `CourtQuickDock` an optional `centerSlot` prop. Apply explicit modifier classes from the resolver and render the center wrapper only in center mode.

**Step 4: Implement responsive CSS**

- no center: two equal full-width columns.
- center present at 960px and above: `minmax(0, 1fr) minmax(240px, 40vw) minmax(0, 1fr)`.
- center present below 960px: `minmax(0, 1fr) minmax(84px, 28vw) minmax(0, 1fr)`.
- right entry: second column by default, third column with center; `justify-self: stretch`; `justify-content: flex-end`.
- right padding: `max(16px, env(safe-area-inset-right))` on larger screens and `max(8px, env(safe-area-inset-right))` on mobile.
- remove the legacy mobile `.dock` grid template and the 420px right-padding override so they cannot defeat modifier layouts or safe-area padding.
- give dock entries `box-sizing: border-box` and explicit grid columns; do not rely on grid auto-placement.

**Step 5: Run focused tests and confirm GREEN**

Run the same focused test command from Task 1.

Expected: PASS.

### Task 3: Verify behavior and prevent regressions

**Files:**
- Review only unless a test exposes a defect.

**Step 1: Run frontend quality gates**

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all PASS.

**Step 2: Verify both rendered states**

Use the running local app for the default no-center state. Exercise a temporary or existing fixture that supplies `quickDockCenter` for the three-column state. Check desktop and mobile widths, with special attention to the right edge and center-module crowding.

**Step 3: Run repository harness**

```powershell
node scripts/check_harness.mjs
```

Expected: PASS, or report an unrelated pre-existing blocker with exact evidence.

**Step 4: Independent review**

Have a fresh review Agent inspect only the scoped diff for requirement coverage, responsive CSS specificity, type correctness, accessibility, and regression risk. Address actionable findings and rerun affected checks.
