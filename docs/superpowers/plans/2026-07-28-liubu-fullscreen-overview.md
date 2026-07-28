# 六部总览全屏展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the selection-triggered department overlay from `/liubu` while retaining the full overview canvas and direct department navigation.

**Architecture:** Simplify `MinistryOverviewScene` into a read-only overview with a single interactive path: each ministry card's existing link opens `/liubu/[code]`. Delete the local selection state, its overlay component, and CSS that exists solely to position that overlay. Keep reply projection and explicit read-state rendering unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Node built-in test runner.

## Global Constraints

- Preserve the read-only archive data contract and all ADR 0028 business-flow boundaries.
- Do not modify `/liubu/[code]`, `/liubu/[code]/[office]`, BFF routes, or backend code.
- Keep six card links keyboard-accessible and preserve loading, empty, error, and ready read states.
- Do not make a Git commit without the current user's explicit authorization.

---

### Task 1: Remove the `/liubu` selection overlay

**Files:**
- Modify: `frontend/src/features/ministries-visual/MinistryOverviewScene.tsx:1-226`
- Modify: `frontend/src/features/ministries-visual/ministries.module.css:1-72, 151-157`
- Test: `frontend/src/features/ministries-visual/ministriesVisual.test.ts:58-80`

**Interfaces:**
- Consumes: `DEPARTMENT_DIRECTORY`, `projectMinistryReplies`, `projectMinistryMetrics`, and the existing `/liubu/[code]` route format.
- Produces: `MinistryOverviewScene` with no selected-ministry state, no overlay rail, and six direct department links.

- [ ] **Step 1: Write the failing regression test**

In the existing `overview locks the dev canvas, hotspots and selected office rail` test, replace the selected-rail assertion with assertions that the source has no rail or selected-state implementation and still has direct department links:

```ts
  assert.doesNotMatch(source, /SelectedMinistryRail|selectedCode|selectMinistry|data-selected-ministry-rail|cardSelect/);
  assert.match(source, /href=\{`\/liubu\/\$\{department\.code\}`\}/);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/features/ministries-visual/ministriesVisual.test.ts`

Expected: FAIL because `MinistryOverviewScene.tsx` still contains `SelectedMinistryRail`, `selectedCode`, and `data-selected-ministry-rail`.

- [ ] **Step 3: Write the minimal implementation**

In `MinistryOverviewScene.tsx`:

```tsx
function MinistryCard({
  department,
  view,
  index,
}: {
  department: DepartmentDirectoryEntry;
  view: MinistryReplyProjection;
  index: number;
}) {
  const style = {
    ...MINISTRY_BOXES[department.code],
    "--card-color": DEV_COLORS[department.code],
    "--card-delay": `${120 + index * 80}ms`,
  } as CSSProperties;
  return (
    <article className={styles.ministryHotspot} data-ministry-hotspot={department.code} style={style}>
      <div className={styles.cardTitle}>
        <Link className={styles.cardMark} href={`/liubu/${department.code}`} aria-label={`前往${department.name}部门页面`}>
          <MinistryGlyph code={department.code} />
        </Link>
        <strong>{MINISTRY_TITLES[department.code]}</strong>
      </div>
      <span className={styles.readonlyBadge}>只读目录</span>
      <dl className={styles.cardMetrics}>
        {projectMinistryMetrics(view).map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <span className={styles.cardRule} aria-hidden="true" />
      <span className={styles.cardStamp} aria-hidden="true">览</span>
    </article>
  );
}
```

Remove the `SelectedMinistryRail` component, the `selectedCode` state, the derived `selected` value, `viewsByDepartment`, and the conditional rail render. Keep the existing `overviewView` projection and card metrics projection.

In `ministries.module.css`, delete the following rules and nothing else:

```css
.ministryHotspot[data-selected] { outline: 3px solid var(--card-color); }
.cardSelect { position: absolute; inset: 0; border: 0; background: transparent; cursor: pointer; }
.selectedMinistryRail { position: absolute; z-index: 4; top: 16px; right: 16px; width: 250px; max-height: calc(100% - 32px); overflow: auto; padding: 14px; border: 1px solid var(--accent); background: rgba(13, 14, 16, .94); }
.railEyebrow { color: var(--accent); font-size: 10px; }
.railTitle, .railSummary { display: flex; align-items: center; justify-content: space-between; }
.railTitle p, .railTitle h2 { margin: 3px 0; }
.selectedMinistryRail ul { padding: 0; list-style: none; }
.selectedMinistryRail li a { display: grid; grid-template-columns: 26px 1fr auto; gap: 8px; padding: 8px 0; color: inherit; text-decoration: none; border-bottom: 1px solid #ffffff18; }
.railBoundary { color: #b9ad96; font-size: 11px; line-height: 1.55; }
@media (max-width: 767px) { .selectedMinistryRail { position: sticky; left: 8px; right: auto; width: min(82vw, 280px); } }
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/features/ministries-visual/ministriesVisual.test.ts`

Expected: PASS; all assertions in `ministriesVisual.test.ts` succeed.

- [ ] **Step 5: Run frontend validation**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: each command exits with code 0.

- [ ] **Step 6: Run repository checks and inspect the diff**

Run:

```powershell
node ..\scripts\check_harness.mjs
node ..\scripts\check_harness.mjs --self-test
git diff --check
git diff -- frontend/src/features/ministries-visual/MinistryOverviewScene.tsx frontend/src/features/ministries-visual/ministries.module.css frontend/src/features/ministries-visual/ministriesVisual.test.ts
```

Expected: harness checks and `git diff --check` exit with code 0; the diff affects only the overview selection overlay and its regression coverage.

## Self-review

- Spec coverage: Task 1 removes the overlay, retains direct links and explicit read states, and validates focused plus full frontend behavior.
- Placeholder scan: no unfinished implementation markers or unspecified test behavior remain.
- Type consistency: all retained types and projections are existing imports; removal requires no new exported interface.

### Task 2: Fill the content viewport with the overview canvas

**Files:**
- Modify: `frontend/src/features/court-visuals/types.ts:6-14`
- Modify: `frontend/src/features/court-visuals/ImmersiveCourtShell.tsx:6-24`
- Modify: `frontend/src/features/court-visuals/ImmersiveCourtShell.module.css:21-31`
- Modify: `frontend/src/features/ministries-visual/MinistryOverviewScene.tsx:151-203`
- Modify: `frontend/src/features/ministries-visual/ministries.module.css:1-45, 119-121`
- Test: `frontend/src/features/court-visuals/courtVisuals.test.ts:17-45`
- Test: `frontend/src/features/ministries-visual/ministriesVisual.test.ts:68-88`

**Interfaces:**
- Consumes: `ImmersiveCourtShellProps` and its existing persistent header/dock grid.
- Produces: optional `fullBleedContent?: boolean` shell prop. Only `/liubu` overview passes `true`; department and office pages leave it unset.

- [ ] **Step 1: Write failing visual-source assertions**

Add these assertions to the existing shell and overview tests:

```ts
assert.match(typesSource, /fullBleedContent\?: boolean;/);
assert.match(shellSource, /fullBleedContent/);
assert.match(css, /\.contentFullBleed\s*\{[^}]*width:\s*100%/);
assert.match(source, /fullBleedContent/);
assert.match(css, /\.canvasViewport\s*\{[^}]*inset:\s*0;[^}]*height:\s*auto;[^}]*margin:\s*0/);
assert.doesNotMatch(css, /\.canvasViewport\s*\{[^}]*72vh|\.canvasViewport\s*\{[^}]*790px/);
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- src/features/court-visuals/courtVisuals.test.ts src/features/ministries-visual/ministriesVisual.test.ts`

Expected: FAIL because the shell has no `fullBleedContent` prop or full-bleed content class and the overview canvas still uses the height cap.

- [ ] **Step 3: Add the opt-in content mode and full-height overview CSS**

Add the optional prop and class selection:

```tsx
export interface ImmersiveCourtShellProps {
  // existing props
  fullBleedContent?: boolean;
}

<main className={`${styles.content}${fullBleedContent ? ` ${styles.contentFullBleed}` : ""}`}>
  {children}
</main>
```

Use the mode only for `MinistryOverviewScene`:

```tsx
<ImmersiveCourtShell
  currentLabel="六部"
  currentPath="/liubu"
  backgroundImage="/assets/zhuangyuan/04-zhuangyuan-new.webp"
  scene="liubu"
  fullBleedContent
>
```

Add `.contentFullBleed { width: 100%; }` to the shell CSS. Make the overview fill its parent and make the canvas fill it:

```css
.overview { position: relative; min-height: 100%; height: 100%; padding: 0; }
.canvasViewport { position: absolute; inset: 0; height: auto; margin: 0; overflow: hidden; }
.overviewHeading { position: absolute; z-index: 3; top: 18px; left: 24px; right: 24px; pointer-events: none; }
```

Move loading, error, and empty status elements into an absolutely positioned status overlay so they do not consume canvas height. Preserve their existing text, retry button behavior, and accessible live/alert semantics. At `max-width: 767px`, retain the full-height canvas with `inset: 0` and adjust only the heading inset; do not restore a `vh` height cap.

- [ ] **Step 4: Run focused tests and verify success**

Run: `npm test -- src/features/court-visuals/courtVisuals.test.ts src/features/ministries-visual/ministriesVisual.test.ts`

Expected: PASS; the overview opts into full-width content while normal shell content stays capped for other scenes.

- [ ] **Step 5: Run complete frontend checks**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: each command exits with code 0.

- [ ] **Step 6: Inspect task-scope diff**

Run:

```powershell
git diff --check -- frontend/src/features/court-visuals/types.ts frontend/src/features/court-visuals/ImmersiveCourtShell.tsx frontend/src/features/court-visuals/ImmersiveCourtShell.module.css frontend/src/features/ministries-visual/MinistryOverviewScene.tsx frontend/src/features/ministries-visual/ministries.module.css frontend/src/features/court-visuals/courtVisuals.test.ts frontend/src/features/ministries-visual/ministriesVisual.test.ts
```

Expected: exit code 0 with no whitespace errors in the full-screen canvas change.

## Revision self-review

- Task 2 preserves the top navigation and bottom quick dock because it changes only the middle content grid cell.
- The optional shell prop limits full-width behavior to the overview; department and office pages retain their current layout.
- No business API, route, or archive data contract changes are introduced.

### Task 3: Render the overview image as a fixed scene background

**Files:**
- Modify: `frontend/src/features/ministries-visual/MinistryOverviewScene.tsx`
- Modify: `frontend/src/features/ministries-visual/ministries.module.css`
- Test: `frontend/src/features/ministries-visual/ministriesVisual.test.ts`

**Interfaces:**
- Consumes: the existing overview section, the six department card links, and `/assets/zhuangyuan/04-zhuangyuan-new.webp`.
- Produces: a fixed, non-scrolling overview scene whose background image is painted by CSS; card positions use percentage coordinates within that scene.

- [ ] Write a failing source test proving the overview has no `ResizeObserver`, no scale state, no canvas wrapper, and uses `background-image` with `background-size: cover`.
- [ ] Replace the image/canvas DOM with a background-painted `.overview` section and map each existing card rectangle to percentage custom properties.
- [ ] Keep the heading, read-state overlays, and direct card links unchanged in behavior.
- [ ] Run focused ministry and shell tests, lint, and typecheck; inspect the scoped diff.

## Background-scene revision self-review

- The background is restricted to `/liubu`; department and office pages are unaffected.
- Removing the resizable canvas removes the layout overflow path that toggled the browser scrollbar.
- The card layer remains accessible links above the image and has no dependency on a viewport observer.
