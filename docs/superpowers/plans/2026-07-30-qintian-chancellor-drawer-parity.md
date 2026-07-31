# Qintian and Chancellor Drawer Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Qintian right drawer use the same two-zone shell and conversation visual language as the Chancellor left drawer while preserving Qintian-specific decision content.

**Architecture:** `StudySideDrawers` owns a shared header and a 38/62 work/chat shell. `QintianPanel` renders a compact notebook workspace in the upper zone and an independent avatar conversation in the lower zone. Existing Qintian browser clients, state reducers, and backend contracts remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, CSS Modules, Node `node:test`.

## Global Constraints

- ADR 0028 remains the only execution authority.
- Do not modify backend, BFF, forecast, trigger, review, or consult wire contracts.
- Chancellor and Qintian message state remain independent.
- Desktop drawer widths remain 300px at ≥1024px and 260px at ≥640px; mobile remains full width.
- Qintian cyan is a restrained provenance accent; the shared shell remains gold and near-black.
- No staging, commit, push, PR, or deployment without separate user authorization.

---

### Task 1: Shared two-zone drawer shell

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`

**Interfaces:**
- Consumes: existing `StudySideDrawersProps`.
- Produces: `.drawerHeader`, `.drawerWorkspace`, and `.drawerConversation` structural classes used by both drawer sides.

- [ ] **Step 1: Write failing structural and style assertions**

Add assertions that both left and right `<aside>` render the shared header class, that each side contains upper and lower zones, and that CSS contains:

```css
.drawerWorkspace { height: 38%; flex: 0 0 38%; }
.drawerConversation { min-height: 0; flex: 1; }
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```text
cd frontend
node --test src/features/study-visual/StudySideDrawers.test.ts
```

Expected: FAIL because the shared zone class names are absent.

- [ ] **Step 3: Introduce the shared shell**

Use the same structure on both sides:

```tsx
<header className={styles.drawerHeader}>...</header>
<section className={styles.drawerWorkspace}>...</section>
<section className={styles.drawerConversation}>...</section>
```

Keep existing close, Escape, hash, backdrop, focus restoration, recent-reply callbacks, and Chancellor message rendering unchanged.

- [ ] **Step 4: Implement shared CSS tokens**

Move common horizontal padding into the header and zones. Preserve the existing responsive drawer widths and bottom safe area. The upper zone scrolls independently and the lower zone keeps its composer pinned to the bottom.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run the focused test again. Expected: PASS.

---

### Task 2: Compact Qintian notebook and collapsible forecast

**Files:**
- Modify: `frontend/src/features/study-visual/QintianPanel.tsx`
- Modify: `frontend/src/features/study-visual/QintianPanel.module.css`
- Modify: `frontend/src/features/study-visual/QintianPanel.test.ts`

**Interfaces:**
- Consumes: `QintianDecisionRadarView`, `QintianContext`, existing Qintian workspace reducer and browser clients.
- Produces: upper-zone notebook cards and a local `forecastExpanded: boolean` presentation state.

- [ ] **Step 1: Write failing source/style assertions**

Assert the component contains:

```tsx
<section className={styles.notebook} aria-label="钦天监札记">
<button aria-expanded={forecastExpanded}>展开正式推演</button>
```

Assert the six radar sections render as `.noteCard`, the forecast form is absent while collapsed, and `.notebook` fills the upper zone without controlling the drawer width.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```text
node --test src/features/study-visual/QintianPanel.test.ts
```

Expected: FAIL because the notebook and disclosure state do not exist.

- [ ] **Step 3: Implement compact notebook cards**

Render the radar summary first, followed by compact cards:

```tsx
<article className={styles.noteCard} key={section.label}>
  <h4>{section.label}</h4>
  <ul>{section.items.slice(0, 2).map(...)}</ul>
</article>
```

Do not truncate formal forecast evidence or trigger data; truncation applies only to the default page-fact notebook cards.

- [ ] **Step 4: Implement the forecast disclosure**

Add local presentation state:

```tsx
const [forecastExpanded, setForecastExpanded] = useState(false);
```

The disclosure remains expanded while a forecast is pending, failed, or available. Group completed forecast details into semantic `<details>` sections for scenarios, assumptions/evidence, and triggers.

- [ ] **Step 5: Preserve due-review priority**

When `mode === "TRIGGER_DUE"`, show the review card before notebook cards. Keep the existing trigger ID, observation, invalidation, and review submission contract unchanged.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run the focused Qintian panel test. Expected: PASS.

---

### Task 3: Qintian conversation parity

**Files:**
- Modify: `frontend/src/features/study-visual/QintianPanel.tsx`
- Modify: `frontend/src/features/study-visual/QintianPanel.module.css`
- Modify: `frontend/src/features/study-visual/QintianPanel.test.ts`
- Reuse: `frontend/public/shangshufang/portrait-wang.webp`
- Reuse or select from existing assets: `frontend/public/shangshufang/portrait-qintianjian.webp`

**Interfaces:**
- Consumes: local Qintian `messages`, `chatDraft`, `chatPending`, and `chatError`.
- Produces: the same message-row/avatar/author/bubble/composer semantics as the Chancellor chat without sharing state.

- [ ] **Step 1: Confirm the Qintian portrait asset**

Run:

```text
rg --files frontend/public/shangshufang | rg "qintian|portrait"
```

Use an existing repository asset. Do not add an unrelated generated image.

- [ ] **Step 2: Write failing chat parity assertions**

Assert Qintian renders:

```tsx
<Image alt="钦天监" ... />
<span className={styles.messageAuthor}>钦天监</span>
<div className={styles.messageRow} data-role={message.role}>
```

Also assert a paper-plane SVG send button, empty state, pending assistant row, and that “转为拟旨输入” only invokes `onPrefillDecree`.

- [ ] **Step 3: Verify RED**

Run the focused Qintian panel test. Expected: FAIL because the current chat uses plain paragraphs without avatars.

- [ ] **Step 4: Implement avatar conversation**

Use the Chancellor visual grammar:

```tsx
<div className={styles.messageRow} data-role={message.role}>
  <Image className={styles.avatar} ... />
  <div className={styles.messageContent}>
    <span className={styles.messageAuthor}>...</span>
    <p className={styles.messageBubble}>{message.content}</p>
  </div>
</div>
```

Implement Enter to send, Shift+Enter to insert a newline, and IME composition protection by reusing `shouldSubmitConsultKey`.

- [ ] **Step 5: Implement the pinned composer**

Use the same 36px composer height, transparent paper-plane button, focus ring, disabled color, and border treatment as the Chancellor composer.

- [ ] **Step 6: Verify GREEN**

Run both focused component tests. Expected: PASS.

---

### Task 4: Full verification and visual comparison

**Files:**
- Modify: `docs/product/tasks/2026-07-30-qintian-decision-radar-full-loop.md`

**Interfaces:**
- Consumes: final implementation and fresh command output.
- Produces: reproducible acceptance evidence.

- [ ] **Step 1: Run frontend gates**

```text
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run repository gates**

```text
cd ..
node scripts/check_harness.mjs
git diff --check
```

Expected: harness and diff check pass.

- [ ] **Step 3: Inspect the running app**

Reload `http://127.0.0.1:3010/study#qintian`, compare left and right drawers at desktop width, then inspect mobile width. Verify the right drawer has the shared 38/62 structure, compact notebook, collapsible forecast, avatar messages, pinned composer, Escape close, and zero console errors.

- [ ] **Step 4: Record final evidence**

Append exact PASS counts, visual findings, and any remaining limitation to the product task. Do not claim provider-backed forecast success without a configured provider.
