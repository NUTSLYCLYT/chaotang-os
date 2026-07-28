# 上书房输入条暗金色统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将下旨输入条所有亮金强调统一替换为暗金 `#a77c35`，而不改变已确认的极简结构。

**Architecture:** 只修改 composer 相关 CSS 颜色和一条源码契约测试。页面其他区域（包括开朝仪式）保留现有配色，避免扩大到用户未要求的范围。

**Tech Stack:** CSS Modules, TypeScript, Node built-in test runner.

## Global Constraints

- Composer borders, controls, focus state and notices use `#a77c35` or its transparent equivalent.
- Composer selectors retain solid dark backgrounds, 1px borders, no gradients, glows, blur, or hover motion.
- Do not modify JSX behavior, submission, attachment selection, route, or `CourtQuickDock`.
- Do not create a Git commit.

---

### Task 1: Add the failing dark-gold source contract

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css`

**Interfaces:**
- Consumes: composer CSS source as UTF-8 text.
- Produces: an assertion for dark-gold use in the composer-specific rule block.

- [ ] **Step 1: Write the failing test**

Extend the minimal composer test with:

```ts
assert.match(composerRule, /border: 1px solid #a77c35;/);
assert.doesNotMatch(composerRule, /#f0c66a/);
assert.match(css, /\.submit \{[^}]*border-color: #a77c35;[^}]*color: #a77c35;/);
```

- [ ] **Step 2: Run the test and observe failure**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: FAIL because composer selectors still use `#f0c66a`.

### Task 2: Replace composer highlights with dark gold

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css`

**Interfaces:**
- Consumes: existing `.composer`, `.polish`, `.attach`, `.submit`, `.feeNotice`, and `.localNotice` selectors.
- Produces: consistent `#a77c35` accents without changing selector ownership or behavior.

- [ ] **Step 1: Replace opaque composer gold values**

Use `#a77c35` for the composer border, active polish text, input focus border, and submit border/text:

```css
.composer { border: 1px solid #a77c35; }
.polish[data-active="true"] { color: #a77c35; }
.composer textarea:focus { border-color: #a77c35; }
.submit { border-color: #a77c35; color: #a77c35; }
```

- [ ] **Step 2: Replace transparent bright-gold accents**

Change composer-control and notice `rgba(240,198,106,...)` values to `rgba(167,124,53,...)`; keep each existing alpha value unchanged.

- [ ] **Step 3: Run the focused test and observe pass**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: PASS.

### Task 3: Verify and record evidence

**Files:**
- Modify: `docs/product/tasks/2026-07-28-study-composer-antique-gold.md`

**Interfaces:**
- Consumes: focused study test, lint, build, and scoped diff check output.
- Produces: task evidence for the color-only adjustment.

- [ ] **Step 1: Run validation**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts && npm run lint && npm run build`

Expected: all commands exit 0.

- [ ] **Step 2: Check scoped whitespace/errors**

Run: `git diff --check -- frontend/src/features/study-visual/DevStudyWorkspace.module.css frontend/src/features/study-visual/DevStudyWorkspace.test.ts docs/product/tasks/2026-07-28-study-composer-antique-gold.md`

Expected: exit 0.

- [ ] **Step 3: Update the task record**

Set status to `Implemented`, check all acceptance criteria, and record the verification results or any unrelated blockers.
