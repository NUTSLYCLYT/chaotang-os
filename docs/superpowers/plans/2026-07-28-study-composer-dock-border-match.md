# 上书房输入条复用底栏边线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让输入条外边框精确复用底部快捷栏的边线颜色。

**Architecture:** 只替换 `.composer` 的 border 声明；内部控件的暗金色保持不变。

**Tech Stack:** CSS Modules, Node built-in test runner.

## Global Constraints

- Composer outer border is `1px solid rgba(240, 198, 106, 0.28)`.
- Internal controls retain `#a77c35` dark gold.
- No behavior, layout, route, or API change; no Git commit.

---

### Task 1: Test and implement the shared border value

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css`

- [ ] **Step 1: Write the failing assertion**

Replace the composer border assertion with:

```ts
assert.match(composerRule, /border: 1px solid rgba\(240, 198, 106, 0\.28\);/);
assert.match(css, /\.submit \{[^}]*border-color: #a77c35;[^}]*color: #a77c35;/);
```

- [ ] **Step 2: Verify red**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: FAIL because `.composer` still uses `#a77c35`.

- [ ] **Step 3: Apply the minimal CSS change**

```css
.composer { border: 1px solid rgba(240, 198, 106, 0.28); }
```

- [ ] **Step 4: Verify green**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts && npm run lint && npm run build`

Expected: all commands exit 0.

### Task 2: Record delivery evidence

**Files:**
- Modify: `docs/product/tasks/2026-07-28-study-composer-dock-border-match.md`

- [ ] **Step 1: Check scoped diff**

Run: `git diff --check -- frontend/src/features/study-visual/DevStudyWorkspace.module.css frontend/src/features/study-visual/DevStudyWorkspace.test.ts docs/product/tasks/2026-07-28-study-composer-dock-border-match.md`

Expected: exit 0.

- [ ] **Step 2: Update task status and evidence**

Set status to `Implemented`, check both acceptance criteria, and record command outcomes.
