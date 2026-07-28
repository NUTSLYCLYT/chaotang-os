# 上书房底部输入区置中 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Render the decree input between 问丞相 and 问钦天监 in the bottom Dock.

**Architecture:** Keep the composer’s state and markup in `DevStudyWorkspace`; pass its JSX through the existing `quickDockCenter` prop to `ImmersiveCourtShell` and `CourtQuickDock`. The shared dock owns three-column placement.

**Tech Stack:** Next.js, React, TypeScript, CSS Modules, Node `node:test`.

## Global Constraints

- Preserve the existing decree submission behavior and all current test IDs.
- Use existing `quickDockCenter?: ReactElement | null`; no new network logic.
- Keep the two adviser links, their wording, and their responsive behavior.
- Keep the cost warning visible; do not commit without user authorization.

---

### Task 1: Add a failing composition test

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`

**Interfaces:**
- Consumes: `ImmersiveCourtShellProps.quickDockCenter?: ReactElement | null`.
- Produces: a test that requires the actual composer JSX be passed to the dock.

- [ ] **Step 1: Add this test**

```ts
test("study places the decree composer in the quick dock center slot", async () => {
  const source = await readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /const composer = \(/);
  assert.match(source, /<ImmersiveCourtShell[\s\S]*?quickDockCenter=\{composer\}/);
  assert.match(source, /<section className=\{styles\.composer\}[\s\S]*?data-testid="decree-textarea"/);
  assert.match(source, /data-testid="submit-decree-button"/);
  assert.doesNotMatch(source, /<div className=\{styles\.stage\}>[\s\S]*?<section className=\{styles\.composer\}/);
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts` from `frontend/`.

Expected: FAIL because the composer currently renders directly in the study stage.

### Task 2: Move the composer into the existing center slot

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css`
- Test: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`

**Interfaces:**
- Consumes: `<ImmersiveCourtShell quickDockCenter={composer}>`.
- Produces: exactly one composer render, in `CourtQuickDock`’s center column.

- [ ] **Step 1: Extract the existing composer section before `return`**

```tsx
const composer = (
  <section className={styles.composer} data-mode={mode} aria-label="御前下旨">
    {/* Move the current local notice, composerRow, controls, textarea, submit button and fee notice unchanged. */}
  </section>
);
```

- [ ] **Step 2: Add the center-slot prop to the existing shell**

```tsx
<ImmersiveCourtShell
  currentLabel="上书房"
  currentPath="/study"
  backgroundImage="/shangshufang/bg-shangshufang-scene.webp"
  quickDockCenter={composer}
  scene="study"
>
```

- [ ] **Step 3: Delete the old in-stage composer section**

Delete the former `<section className={styles.composer}>` immediately after `edictSlot`; do not add a redirect, duplicate, or second mount.

- [ ] **Step 4: Replace the composer root positioning rule**

```css
.composer {
  position: static;
  display: grid;
  width: 100%;
  height: 48px;
  box-sizing: border-box;
  border: 1px solid rgba(240,198,106,.3);
  border-radius: 10px;
  background: linear-gradient(0deg, rgba(10,8,4,.97), rgba(14,12,8,.94));
  color: #f5e9c9;
}
```

Remove `right`, `bottom`, `z-index`, `transform`, and viewport-width sizing. Compact `composerRow` within the 48px slot, and place the existing visible cost warning in a non-overlapping element directly above the dock if it cannot fit inside the slot.

- [ ] **Step 5: Run focused checks**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts src/features/court-visuals/courtVisuals.test.ts` from `frontend/`.

Expected: PASS.

### Task 3: Validate and record evidence

**Files:**
- Modify: `docs/product/tasks/2026-07-28-study-composer-dock-center.md`

**Interfaces:**
- Consumes: completed UI composition and existing protected `/study` route.
- Produces: fresh test evidence in the task record.

- [ ] **Step 1: Run frontend validation**

Run from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits `0`.

- [ ] **Step 2: Run repository checks**

Run from the repository root:

```powershell
node scripts/check_harness.mjs
git diff --check
```

Expected: both commands exit `0`.

- [ ] **Step 3: Update task evidence**

Record these commands and results under `Implementation Report`; after all checks pass, set the task to `Implemented` and leave acceptance pending.

## Plan self-review

- Task 1 proves the desired composition before code changes.
- Task 2 uses the existing center-slot interface and preserves the decree controls.
- Task 3 verifies lint, types, unit tests, build, and repository policy checks.
