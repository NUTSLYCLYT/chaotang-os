# Study Drawer Jade Pivot Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace both Study drawer edge toggles with the approved A「玉衡扣」control while preserving the existing synchronized drawer lifecycle.

**Architecture:** Keep `StudySideDrawers` as the lifecycle owner and preserve its `data-drawer-side` and `data-drawer-phase` contract. Replace text arrows with semantic decorative spans, then implement all geometry, mirroring, focus, active glow, and reduced-motion behavior in the existing CSS module without adding assets or dependencies.

**Tech Stack:** React, TypeScript, CSS Modules, Node.js `node:test`.

## Global Constraints

- Base toggle size is exactly `35px × 68px`; the center jade icon is `15px`.
- Left and right controls use one component structure and mirrored CSS.
- The button remains attached to the drawer throughout opening and closing with a visual gap no greater than `1px`.
- No text, image asset, SVG file, third-party icon dependency, header close control, or second animation clock.
- Preserve native `button`, `aria-label`, `aria-expanded`, `aria-controls`, keyboard operation, and reduced-motion support.
- Do not modify drawer content, widths, chat proportions, data requests, business state, execution authority, or ADR 0028.

---

### Task 1: Lock the Jade Pivot Contract with Tests

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`

**Interfaces:**
- Consumes: existing `data-drawer-side` and `data-drawer-phase` attributes.
- Produces: source-contract assertions for `.triggerIcon`, `.triggerArrow`, accessibility state, exact geometry, mirrored radii, jade focus treatment, and reduced motion.

- [ ] **Step 1: Add the failing structure and style test**

```ts
test("edge toggles render the approved jade pivot without text glyphs", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./StudySideDrawers.tsx", import.meta.url), "utf8"),
    readFile(new URL("./StudySideDrawers.module.css", import.meta.url), "utf8"),
  ]);
  assert.equal((source.match(/className=\{styles\.triggerIcon\}/g) ?? []).length, 2);
  assert.equal((source.match(/className=\{styles\.triggerArrow\}/g) ?? []).length, 2);
  assert.equal((source.match(/aria-hidden="true"/g) ?? []).length >= 2, true);
  assert.match(source, /aria-expanded=\{leftActive\}/);
  assert.match(source, /aria-expanded=\{rightActive\}/);
  assert.match(source, /aria-controls="chancellor-advisor-drawer"/);
  assert.match(source, /aria-controls="qintian-advisor-drawer"/);
  assert.doesNotMatch(source, />\{leftActive \?/);
  assert.doesNotMatch(source, />\{rightActive \?/);

  assert.match(css, /\.trigger\s*\{[^}]*width:\s*35px;[^}]*height:\s*68px;/);
  assert.match(css, /\.triggerIcon\s*\{[^}]*width:\s*15px;[^}]*height:\s*15px;/);
  assert.match(css, /\.leftTrigger\s*\{[^}]*border-radius:\s*0 18px 18px 0;/);
  assert.match(css, /\.rightTrigger\s*\{[^}]*border-radius:\s*18px 0 0 18px;/);
  assert.match(css, /\.trigger:focus-visible\s*\{[^}]*outline:\s*none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*\.01ms !important/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --test-name-pattern="approved jade pivot"` from `frontend/`.

Expected: FAIL because `triggerIcon`, `triggerArrow`, `aria-expanded`, and jade geometry are absent.

- [ ] **Step 3: Confirm the failure is requirement-related**

Run: `npm test -- --test-name-pattern="edge toggles"` from `frontend/`.

Expected: existing lifecycle tests PASS while the new jade-pivot test FAILS.

---

### Task 2: Implement the Shared Jade Pivot Structure

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`
- Test: `frontend/src/features/study-visual/StudySideDrawers.test.ts`

**Interfaces:**
- Consumes: `leftActive`, `rightActive`, `phase`, `close()`, `openDrawer()`, and existing animation-end lifecycle.
- Produces: identical decorative markup for both triggers and phase-driven mirrored styling.

- [ ] **Step 1: Replace both text glyphs with decorative jade markup**

Use this exact child structure in both buttons:

```tsx
<span className={styles.triggerIcon} aria-hidden="true">
  <span className={styles.triggerArrow} />
</span>
```

Add the exact state/control attributes:

```tsx
aria-expanded={leftActive}
aria-controls="chancellor-advisor-drawer"
```

and:

```tsx
aria-expanded={rightActive}
aria-controls="qintian-advisor-drawer"
```

- [ ] **Step 2: Replace only the trigger visual rules**

Implement these declarations while retaining the existing positioning and keyframes:

```css
.trigger {
  position: fixed;
  z-index: 225;
  top: 50%;
  display: grid;
  width: 35px;
  height: 68px;
  place-items: center;
  border: 1px solid #856a38;
  background: linear-gradient(90deg, #151612, #23271d 52%, #11130f);
  color: #f0d58e;
  cursor: pointer;
  transform: translateY(-50%);
  box-shadow: 5px 0 20px rgba(0,0,0,.66), inset 1px 0 rgba(212,178,100,.26);
  animation-duration: var(--advisor-drawer-open-duration);
  animation-timing-function: var(--advisor-drawer-easing);
  animation-fill-mode: forwards;
}
.trigger::before,
.trigger::after {
  position: absolute;
  left: 50%;
  width: 9px;
  height: 1px;
  content: "";
  transform: translateX(-50%);
  background: linear-gradient(90deg, transparent, #997b45, transparent);
}
.trigger::before { top: 10px; }
.trigger::after { bottom: 10px; }
.triggerIcon {
  position: relative;
  display: block;
  width: 15px;
  height: 15px;
  border: 1px solid #b89a58;
  border-radius: 50%;
  background: #172018;
  box-shadow: 0 0 9px rgba(197,166,92,.22), inset 0 0 0 3px #283328;
  transition: box-shadow 160ms ease, border-color 160ms ease;
}
.triggerArrow {
  position: absolute;
  top: 4px;
  left: 3px;
  width: 4px;
  height: 4px;
  border-top: 1px solid currentColor;
  border-right: 1px solid currentColor;
  transform: rotate(45deg);
  transition: transform 160ms ease;
}
.leftTrigger { left: 0; border-radius: 0 18px 18px 0; }
.rightTrigger {
  right: 0;
  border-radius: 18px 0 0 18px;
  background: linear-gradient(270deg, #151612, #23271d 52%, #11130f);
  box-shadow: -5px 0 20px rgba(0,0,0,.66), inset -1px 0 rgba(212,178,100,.26);
}
.rightTrigger .triggerArrow { left: 6px; transform: rotate(-135deg); }
.leftTrigger[data-drawer-phase="opening"] .triggerArrow,
.leftTrigger[data-drawer-phase="closing"] .triggerArrow {
  left: 6px;
  transform: rotate(-135deg);
}
.rightTrigger[data-drawer-phase="opening"] .triggerArrow,
.rightTrigger[data-drawer-phase="closing"] .triggerArrow {
  left: 3px;
  transform: rotate(45deg);
}
.trigger:not([data-drawer-phase="closed"]) .triggerIcon {
  border-color: #d0b36d;
  box-shadow: 0 0 13px rgba(197,166,92,.38), inset 0 0 0 3px #283328;
}
.trigger:focus-visible { outline: none; }
.trigger:focus-visible .triggerIcon {
  border-color: #f0d58e;
  box-shadow: 0 0 0 2px #172018, 0 0 0 4px #f0c66a, 0 0 14px rgba(240,198,106,.5);
}
```

Keep the other focus-visible controls in their existing gold outline rule.

- [ ] **Step 3: Run the focused tests and verify GREEN**

Run: `npm test -- --test-name-pattern="edge toggles|drawer controller|closing retention"` from `frontend/`.

Expected: all selected tests PASS.

- [ ] **Step 4: Run TypeScript and lint**

Run: `npm run typecheck && npm run lint` from `frontend/`.

Expected: both commands exit `0`.

---

### Task 3: Visual and Full Regression Verification

**Files:**
- Modify only if verification reveals a defect:
  - `frontend/src/features/study-visual/StudySideDrawers.tsx`
  - `frontend/src/features/study-visual/StudySideDrawers.module.css`

**Interfaces:**
- Consumes: the completed jade-pivot toggle.
- Produces: fresh automated and browser evidence that behavior and appearance satisfy the spec.

- [ ] **Step 1: Run the complete frontend suite**

Run from `frontend/`:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits `0`; no pre-existing test regresses.

- [ ] **Step 2: Run repository harness verification**

Run from the worktree root:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 3: Inspect `/study` in the browser**

At desktop width, verify both closed controls and then open/close each drawer:

- exact black-jade form, no text glyph;
- left/right shapes and arrows mirror;
- control center remains vertically stable;
- control remains attached during the entire animation with gap `≤ 1px`;
- open state points toward closing direction and has slightly stronger jade glow;
- no header close button appears.

- [ ] **Step 4: Verify keyboard and reduced-motion behavior**

Tab to each control, confirm the jade/gold focus ring is visible, press Enter/Space, then emulate `prefers-reduced-motion: reduce` and repeat.

Expected: both controls remain operable; no default blue outline; reduced-motion reaches correct final positions.

- [ ] **Step 5: Report evidence without committing**

List changed files, exact test totals, command exit results, and browser measurements. Do not stage, commit, push, or include unrelated dirty-worktree files without explicit user authorization.
