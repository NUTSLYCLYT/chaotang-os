# 军机处无案卷完整主舞台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在无军机处案卷时保留三栏会审主舞台，并只显示事实为空的内容。

**Architecture:** 保持 controller 对成功空数组的 `empty` 状态不变；由 `JunjichuScene` 将该状态渲染为左栏空账册、中央等待下旨舞台和右栏六部未参与目录，而非整页空态卡片。加载和错误分支不变，且空态不引入任何业务写入或模拟案卷。

**Tech Stack:** Next.js App Router、React、TypeScript、CSS Modules、node:test。

## Global Constraints

- 只消费同源只读 `GET /api/junjichu/cases`；不得新增写入路由或浏览器 owner 参数。
- 仅在读取成功且案卷数组为空时显示完整空态；加载、错误和筛选无匹配保留既有语义。
- 中央空态不得显示模拟处理路径、部门意见、会审结论、回奏或史馆入口。
- 右栏六部固定目录全部显示“未参与”。
- 仅改动 `frontend/src/features/junjichu-visual/` 及其测试；保留用户已有背景和响应式改动。

---

### Task 1: 渲染完整空案卷主舞台并锁定回归

**Files:**

- Modify: `frontend/src/features/junjichu-visual/JunjichuScene.tsx`
- Modify: `frontend/src/features/junjichu-visual/JunjichuScene.module.css`
- Modify: `frontend/src/features/junjichu-visual/JunjichuScene.test.ts`
- Modify: `frontend/src/features/junjichu-visual/junjichuController.test.ts`

**Interfaces:**

- Consumes: `JunjichuSceneProps.activeCases`, `archivedCases`, `failedCases`, `departments`; successful empty results are three empty arrays and `selectedId === null`.
- Produces: the existing `JunjichuScene` with an `empty` branch that renders the same three-column shell without a selected `JunjichuCaseView`.

- [ ] **Step 1: Write failing source and controller assertions**

Add an empty-result fixture test that waits for a controller backed by `{ status: "ok", cases: [] }`, then asserts three empty arrays, `selectedId === null`, and `status === "empty"`. Add scene source assertions for the labels `等待下旨后进入会审`, `没有进行中案卷`, `没有已归档案卷`, `没有办理失败案卷`, and six occurrences of `未参与` in the empty rendering helper.

- [ ] **Step 2: Verify the test is red**

Run:

```powershell
cd frontend
npm test -- --test-name-pattern="junjichu"
```

Expected: FAIL because the current `cases.length === 0` branch returns the whole-page `data-junjichu-state="empty"` card and does not contain the required central/department empty-stage content.

- [ ] **Step 3: Implement the minimal empty-stage branch**

Replace only the `cases.length === 0` branch with the normal `<section className={styles.layout}>` shell:

```tsx
<aside className={styles.ledger}>…three empty case lists…</aside>
<main className={styles.stage} data-junjichu-state="empty">
  <section className={styles.emptyStage}>
    <h2>暂无会审案卷</h2>
    <p>等待下旨后进入会审。</p>
  </section>
</main>
<aside className={styles.ministryProjection}>{FIXED_MINISTRIES.map((name) => <li key={name}>{name}<span>未参与</span></li>)}</aside>
```

Use the existing filter callbacks and CSS layout classes. Do not call `CaseCard`, `currentStage`, archive-link rendering, or detail rendering when no case exists. Add only CSS required to make `.emptyStage` readable within existing breakpoints.

- [ ] **Step 4: Verify green and quality gates**

Run:

```powershell
cd frontend
npm test -- --test-name-pattern="junjichu"
npm run lint
npm run typecheck
npm run build
git diff --check -- src/features/junjichu-visual/JunjichuScene.tsx src/features/junjichu-visual/JunjichuScene.module.css src/features/junjichu-visual/JunjichuScene.test.ts src/features/junjichu-visual/junjichuController.test.ts
```

Expected: all commands exit `0`; the targeted tests prove the empty result retains the module shell and no generated business data.

## Self-Review

- Coverage: Task 1 implements every approved surface: left empty ledger, central waiting stage, six empty ministry projections, and preservation of non-empty/load/error semantics.
- Scope: no backend, BFF, persistence, owner, route, or archive behavior changes.
- Type consistency: it uses existing `JunjichuSceneProps` and no new transport or domain types.
