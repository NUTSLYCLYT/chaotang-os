# Chancellor WeChat Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render chancellor consultation messages as avatar bubbles while keeping a compact composer fixed at the bottom.

**Architecture:** Keep the existing `ConsultMessage[]` and submission flow unchanged. Change only the drawer markup and its CSS layout, with source-contract tests guarding the approved visual structure and removed copy.

**Tech Stack:** React, TypeScript, CSS Modules, Node.js `node:test`.

## Global Constraints

- Do not modify the consultation API or DeepSeek call behavior.
- Preserve current drawer width tiers and recent-replies behavior.
- Reuse the existing chancellor and emperor portrait assets.
- Do not commit without separate Git authorization.

---

### Task 1: WeChat-style consultation UI

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`

**Interfaces:**
- Consumes: `ConsultMessage { role, content }` and existing `pending`, `error`, `onSend` props.
- Produces: accessible message rows with `data-role`, avatar images, bubbles, and a bottom composer.

- [ ] **Step 1: Write the failing source-contract tests**

Assert that the component references both portrait assets, renders message row/bubble classes, removes the disclaimer, and that CSS separates scrollable messages from a non-growing composer with a compact textarea.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test src/features/study-visual/StudySideDrawers.test.ts`

Expected: FAIL because avatar markup and bubble/composer rules do not exist and the disclaimer remains.

- [ ] **Step 3: Implement the minimal JSX and CSS**

Map each message to a role-specific row with avatar, label, and bubble. Use `flex: 1; overflow-y: auto` for messages and `flex: 0 0 auto` for the form. Reduce textarea height and remove vertical resizing.

- [ ] **Step 4: Verify GREEN and regressions**

Run:

```text
node --test src/features/study-visual/StudySideDrawers.test.ts
npm test
npm run lint
npm run typecheck
```

Expected: all commands PASS without new warnings.

### Task 2: Compact typography and dock-border overlap

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`

**Interfaces:**
- Consumes: the existing chat CSS classes and the dock heights defined by `CourtQuickDock.module.css`.
- Produces: 12px message/input text, 10px author labels, and a drawer bottom offset that overlaps only the dock top border.

- [ ] **Step 1: Add failing CSS contract tests**

Assert `.messageBubble` and `.chat textarea` use `font-size: 12px`, `.messageAuthor` uses `font-size: 10px`, the desktop drawer stops at `bottom: 63px`, and the mobile drawer stops at `calc(55px + env(safe-area-inset-bottom))`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="compact consultation typography|overlap only the dock border" src/features/study-visual/StudySideDrawers.test.ts`

Expected: FAIL because the current drawer reaches `bottom: 0` and message/input typography is not fully specified.

- [ ] **Step 3: Apply the minimal CSS change**

Set exact font sizes on the existing chat selectors. Offset the drawer above the 64px desktop dock by 63px and above the 56px mobile dock by 55px plus the safe-area inset, producing exactly 1px overlap.

- [ ] **Step 4: Verify focused tests and frontend checks**

Run the focused test, then `npm run lint`, `npm run typecheck`, and `npm run build`. Do not alter unrelated concurrent failures.

### Task 3: Remove excess composer-area padding

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`

**Interfaces:**
- Consumes: the existing 40px consultation textarea and drawer padding rules.
- Produces: zero drawer bottom padding and a form whose block size is exactly the textarea height.

- [ ] **Step 1: Add a failing CSS contract test**

Assert desktop padding is `18px 18px 0`, mobile padding is `12px 12px 0`, and the chat form has no padding or border while centering its controls.

- [ ] **Step 2: Verify RED**

Run: `node --test --test-name-pattern="composer area keeps only the input height" src/features/study-visual/StudySideDrawers.test.ts`

Expected: FAIL against the current four-sided drawer padding and form top spacing.

- [ ] **Step 3: Apply minimal CSS**

Change only the drawer padding shorthand, compact mobile override, and form padding/border/alignment declarations.

- [ ] **Step 4: Verify**

Run the focused drawer tests, lint, typecheck, and build.
