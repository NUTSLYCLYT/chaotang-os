# Study Reply After Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a successful `/study` decree replace its confirmed draft with the real chancellor reply while preserving the draft after failed submissions.

**Architecture:** Keep the existing backend, BFF, response contract, and `DevStudyWorkspace` rendering branches unchanged. Add one small state-commit function in `StudyClient.tsx`; it always installs the returned `DecreeUiState`, and only on `phase: "success"` clears the draft and invalidates recent replies.

**Tech Stack:** Next.js App Router, React, TypeScript, Node `node:test`.

## Global Constraints

- Preserve `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.
- Do not modify backend APIs, Shiguan contracts, or the response parser.
- Preserve all pre-existing uncommitted changes, especially the readable-draft work in `chancellorDraft.*` and `DevStudyWorkspace.*`.
- A failed decree submission must retain the confirmed draft for retry.
- A successful decree submission must clear the confirmed draft so the current reply owns the central scroll.
- Do not commit, stage, push, or deploy without separate user authorization.

---

### Task 1: Add an executable state-transition regression

**Files:**
- Modify: `frontend/src/app/study/StudyClient.test.ts`
- Modify: `frontend/src/app/study/StudyClient.tsx`

**Interfaces:**
- Consumes: `DecreeUiState` from `frontend/src/app/study/decreeStatus.ts`.
- Produces: `commitStudyDecreeUiState(options): void`, an exported pure orchestration function callable from tests and `StudyClient`.

- [ ] **Step 1: Write the failing test**

Extend the executable test loader with:

```ts
type DecreeUiStateCommitter = (options: {
  state: { phase: "success" } | { phase: "error"; message: string };
  setUiState(state: { phase: string }): void;
  clearDraft(): void;
  invalidateRecentReplies(): void;
}) => void;

async function loadExecutableDecreeUiStateCommitter(): Promise<DecreeUiStateCommitter> {
  const source = await readFile(new URL("./StudyClient.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    },
  }).outputText;
  const compiledModule = { exports: {} as Record<string, unknown> };
  Function("require", "module", "exports", compiled)(
    () => ({}),
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports.commitStudyDecreeUiState as DecreeUiStateCommitter;
}
```

Add behavior tests:

```ts
test("successful decree state clears the draft so the reply can own the scroll", async () => {
  const commitState = await loadExecutableDecreeUiStateCommitter();
  const events: string[] = [];

  commitState({
    state: { phase: "success" },
    setUiState: (state) => events.push(`state:${state.phase}`),
    clearDraft: () => events.push("clear-draft"),
    invalidateRecentReplies: () => events.push("invalidate-replies"),
  });

  assert.deepEqual(events, [
    "state:success",
    "clear-draft",
    "invalidate-replies",
  ]);
});

test("failed decree state preserves the confirmed draft for retry", async () => {
  const commitState = await loadExecutableDecreeUiStateCommitter();
  const events: string[] = [];

  commitState({
    state: { phase: "error", message: "failed" },
    setUiState: (state) => events.push(`state:${state.phase}`),
    clearDraft: () => events.push("clear-draft"),
    invalidateRecentReplies: () => events.push("invalidate-replies"),
  });

  assert.deepEqual(events, ["state:error"]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test --test-name-pattern="successful decree state|failed decree state" src/app/study/StudyClient.test.ts
```

Expected: FAIL because `commitStudyDecreeUiState` is not exported and the test attempts to call `undefined`.

- [ ] **Step 3: Implement the minimal state commit**

Add to `frontend/src/app/study/StudyClient.tsx`:

```ts
interface StudyDecreeUiStateCommitOptions {
  state: DecreeUiState;
  setUiState(state: DecreeUiState): void;
  clearDraft(): void;
  invalidateRecentReplies(): void;
}

export function commitStudyDecreeUiState({
  state,
  setUiState,
  clearDraft,
  invalidateRecentReplies,
}: StudyDecreeUiStateCommitOptions): void {
  setUiState(state);
  if (state.phase !== "success") return;
  clearDraft();
  invalidateRecentReplies();
}
```

Replace the inline submission state callback with:

```ts
setUiState: (state) => commitStudyDecreeUiState({
  state,
  setUiState,
  clearDraft: () => setDraftResult(null),
  invalidateRecentReplies: () =>
    commitRecentReplies(invalidateStudyRecentReplies),
}),
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
node --test --test-name-pattern="successful decree state|failed decree state" src/app/study/StudyClient.test.ts
```

Expected: both new tests PASS.

- [ ] **Step 5: Run the complete StudyClient test file**

Run:

```powershell
node --test src/app/study/StudyClient.test.ts
```

Expected: all `StudyClient` tests PASS.

### Task 2: Record the user-visible false green

**Files:**
- Create: `docs/failures/2026-07-30-study-reply-hidden-after-draft.md`

**Interfaces:**
- Consumes: the root-cause evidence and regression test from Task 1.
- Produces: a reusable failure memory with the five harness-required sections.

- [ ] **Step 1: Write the failure record**

Create:

```markdown
# 拟旨下旨后回奏被草案遮挡

## Summary

用户完成拟旨并成功下旨后，中央卷轴仍显示拟旨草案，没有显示已经返回的真实回奏。

## Root Cause

成功响应把 `uiState` 更新为 `success`，但没有清除 `draftResult`。中央卷轴优先渲染仍存在的拟旨分支，因此真实回奏状态虽已到达浏览器却不可见。既有测试只匹配源码结构，没有执行“草案存在到成功回奏”的状态转换，形成假绿。

## Prevention

把提交结果的页面状态更新、成功后草案清理和最近回奏缓存失效收敛到同一个可执行状态提交函数。失败状态只更新错误，不销毁可重试草案。

## Detection

`frontend/src/app/study/StudyClient.test.ts` 执行成功与失败两种状态转换：成功必须依次安装回奏状态、清理草案、失效最近回奏；失败只能安装错误状态。`npm test` 和 `node scripts/check_harness.mjs` 作为完成门禁。

## Evidence

- `frontend/src/app/study/StudyClient.tsx`
- `frontend/src/app/study/StudyClient.test.ts`
- `docs/superpowers/specs/2026-07-30-study-reply-after-draft-design.md`
- `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
```

- [ ] **Step 2: Run the harness structure check**

Run:

```powershell
node scripts/check_harness.mjs
```

Expected: PASS, including the five required failure-record sections.

### Task 3: Verify the complete fix

**Files:**
- Verify only: `frontend/src/app/study/StudyClient.tsx`
- Verify only: `frontend/src/app/study/StudyClient.test.ts`
- Verify only: `docs/failures/2026-07-30-study-reply-hidden-after-draft.md`

**Interfaces:**
- Consumes: the completed implementation and failure record.
- Produces: fresh validation evidence; no new runtime interface.

- [ ] **Step 1: Run all frontend tests**

Run:

```powershell
npm test
```

Working directory: `frontend`

Expected: PASS with no failed tests.

- [ ] **Step 2: Run frontend static checks**

Run:

```powershell
npm run typecheck
npm run lint
```

Working directory: `frontend`

Expected: both commands PASS.

- [ ] **Step 3: Build the frontend**

Run:

```powershell
npm run build
```

Working directory: `frontend`

Expected: Next.js production build PASS.

- [ ] **Step 4: Run repository harness checks**

Run:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
```

Working directory: repository root.

Expected: all three commands PASS.

- [ ] **Step 5: Inspect only the intended diff**

Run:

```powershell
git diff --check
git diff -- frontend/src/app/study/StudyClient.tsx frontend/src/app/study/StudyClient.test.ts docs/failures/2026-07-30-study-reply-hidden-after-draft.md docs/superpowers/specs/2026-07-30-study-reply-after-draft-design.md docs/superpowers/plans/2026-07-30-study-reply-after-draft.md
```

Expected: `git diff --check` reports no whitespace errors; the scoped diff contains only the approved state transition, its tests, and documentation. Do not stage or commit.
