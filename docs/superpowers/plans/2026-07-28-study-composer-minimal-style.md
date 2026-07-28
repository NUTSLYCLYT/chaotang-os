# 上书房输入条极简样式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将底部中间的下旨输入条收束为纯深色、1px 金线和中文文字控件的极简样式。

**Architecture:** 只修改 `DevStudyWorkspace` 的附件标签文字，以及该组件 CSS 中与 composer 相关的视觉属性。继续使用隐藏的原生 file input 和现有 `handleFiles` 回调；不改变布局、状态、接口或提交语义。

**Tech Stack:** React, TypeScript, CSS Modules, Node built-in test runner.

## Global Constraints

- Composer uses a solid dark background and one 1px gold border only.
- Composer controls use no gradient, glow, blur, hover transform, or CSS transition.
- Attachment label is exactly `上传附件`; local file-selection behavior is unchanged.
- Do not modify the same-origin decree POST, fee disclosure, route, or `CourtQuickDock`.
- Do not create a Git commit.

---

### Task 1: Lock the minimal visual contract with a failing test

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css`

**Interfaces:**
- Consumes: `DevStudyWorkspace.tsx` source and CSS module source as UTF-8 text.
- Produces: source-contract assertions for the attachment label and composer-only visual restrictions.

- [ ] **Step 1: Write the failing test**

Add a test that reads both files and checks the attachment label, a 1px composer border, and absence of the former composer-specific visual effects:

```ts
test("study composer uses a minimal text-first visual treatment", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("./DevStudyWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("./DevStudyWorkspace.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, />上传附件<input type="file"/);
  assert.match(css, /\.composer \{[\s\S]*?border: 1px solid rgba\(240,198,106,\.42\);/);
  assert.doesNotMatch(css, /\.composer \{[\s\S]*?linear-gradient|\.composer \{[\s\S]*?box-shadow|\.composer \{[\s\S]*?backdrop-filter/);
  assert.doesNotMatch(css, /\.submit \{[^}]*linear-gradient|\.submit:not\(:disabled\):hover/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: FAIL because the label is an icon and composer CSS still contains gradients/effects.

### Task 2: Implement the text-first, single-line appearance

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css`

**Interfaces:**
- Consumes: current `handleFiles` callback, the hidden `<input type="file">`, and composer test IDs.
- Produces: a visible `上传附件` label and minimal composer controls while preserving the same callbacks and disabled attributes.

- [ ] **Step 1: Change the attachment label text**

Replace the visible attachment glyph in both composer source blocks while retaining the nested input unchanged:

```tsx
<label className={styles.attach} data-testid="decree-evidence-upload" title="选择本地补证附件（当前不会上传）">
  上传附件
  <input type="file" multiple onChange={handleFiles} disabled={!props.canEdit} />
</label>
```

- [ ] **Step 2: Simplify composer CSS**

Use solid fills and single borders for the composer and controls:

```css
.composer {
  border: 1px solid #f0c66a;
  border-radius: 8px;
  background: #0b0d12;
  box-shadow: none;
  backdrop-filter: none;
}
.composer::before { display: none; }
.submit {
  border: 1px solid #f0c66a;
  background: transparent;
  box-shadow: none;
  color: #f0c66a;
  text-shadow: none;
}
```

Remove the composer-specific hover transform, gradients, glows, and focus glow; keep a border-color-only focus indication.

- [ ] **Step 3: Run the focused test to verify it passes**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: PASS.

### Task 3: Verify the existing dock integration and record delivery evidence

**Files:**
- Modify: `docs/product/tasks/2026-07-28-study-composer-minimal-style.md`

**Interfaces:**
- Consumes: the focused tests and standard frontend validation commands.
- Produces: implementation evidence without changing unrelated repository work.

- [ ] **Step 1: Run scoped regression tests**

Run: `npm test -- src/features/study-visual/DevStudyWorkspace.test.ts src/features/court-visuals/courtVisuals.test.ts`

Expected: PASS.

- [ ] **Step 2: Run static verification**

Run: `npm run lint && npm run typecheck && npm run build`

Expected: all commands exit 0.

- [ ] **Step 3: Check only this task's diff**

Run: `git diff --check -- frontend/src/features/study-visual/DevStudyWorkspace.tsx frontend/src/features/study-visual/DevStudyWorkspace.module.css frontend/src/features/study-visual/DevStudyWorkspace.test.ts docs/product/tasks/2026-07-28-study-composer-minimal-style.md`

Expected: exit 0.

- [ ] **Step 4: Update the task record**

Set the task status to `Implemented`, mark every acceptance criterion complete, and record the focused/static verification evidence plus any unrelated global failures.
