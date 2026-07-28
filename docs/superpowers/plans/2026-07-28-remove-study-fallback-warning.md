# Remove Study Fallback Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the local-fallback warning from the Shangshufang workspace without changing its data or interaction behavior.

**Architecture:** Keep the existing `DevStudyWorkspace` structure and remove only the warning node. Update its source-contract test first, then remove the now-unreferenced warning CSS rules.

**Tech Stack:** React 19, TypeScript 5.9, CSS Modules, Node.js `node:test`

## Global Constraints

- Do not change fallback data, decree submission behavior, or ADR 0028.
- Do not add dependencies.
- Do not commit, push, or publish without separate user authorization.

---

### Task 1: Remove the fallback warning and its styles

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts:39`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx:226`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css:14`

**Interfaces:**
- Consumes: Existing `DevStudyWorkspace` source-contract tests.
- Produces: A workspace with no fallback-warning node or `.warning` CSS rule.

- [ ] **Step 1: Write the failing contract assertions**

Replace the positive warning assertions with:

```ts
assert.doesNotMatch(source, /真实任务库暂不可读/);
assert.doesNotMatch(source, /styles\.warning/);
assert.doesNotMatch(css, /\.warning(?:\s|\{)/);
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```powershell
node --test src/features/study-visual/DevStudyWorkspace.test.ts
```

from `frontend/`.

Expected: FAIL because the source still contains `真实任务库暂不可读` and `styles.warning`, and the stylesheet still defines `.warning`.

- [ ] **Step 3: Remove the minimal production code**

Delete this node from `DevStudyWorkspace.tsx`:

```tsx
<div className={styles.warning} role="status">
  <span aria-hidden="true">△</span>
  真实任务库暂不可读 · 当前为本地兜底骨架，请勿当作最终裁决依据。
</div>
```

Delete the complete `.warning` and `.warning span` rules near the top of `DevStudyWorkspace.module.css`, plus the `.warning` override inside `@media (max-width: 700px)`.

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run:

```powershell
node --test src/features/study-visual/DevStudyWorkspace.test.ts
```

Expected: PASS with zero failed tests.

- [ ] **Step 5: Run proportional frontend verification**

Run from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
```

Expected: all commands exit successfully with zero failures.
