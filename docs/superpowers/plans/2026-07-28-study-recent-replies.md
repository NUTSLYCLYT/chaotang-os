# 上书房最近三次下旨回奏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在上书房左侧抽屉展示当前账号最近三条史馆回奏，并支持原位展开完整内容。

**Architecture:** 复用现有受认证史馆 BFF，不新增后端端点。新增一个纯 TypeScript 状态模块负责固定查询、严格解析、加载/失效/选择状态；`StudyClient` 负责触发请求与登录跳转，抽屉组件保持展示层。

**Tech Stack:** Next.js App Router、React、TypeScript、CSS Modules、Node.js `node:test`

## Global Constraints

- 仅消费当前账号的 `REPLY`，固定查询 `type=REPLY&limit=3`。
- 页面初次加载和模块导入零请求；只有用户打开左抽屉或明确重试才读取。
- 不新增后端端点，不触发模型、下旨、锦衣卫或史馆写入。
- 保留当前面板宽度、底栏同色背景、丞相咨询、右侧空面板和可访问性行为。
- 未获单独授权，不提交、推送或部署。

---

### Task 1: 最近回奏请求与状态模块

**Files:**
- Create: `frontend/src/app/study/studyRecentReplies.ts`
- Create: `frontend/src/app/study/studyRecentReplies.test.ts`

**Interfaces:**
- Consumes: `ShiguanArchive` from `../../lib/backendClient` and same-origin `fetch`.
- Produces:
  - `StudyRecentRepliesState`
  - `EMPTY_STUDY_RECENT_REPLIES_STATE`
  - `requestStudyRecentReplies(fetchImpl): Promise<StudyRecentRepliesResult>`
  - `beginStudyRecentRepliesLoad(state)`
  - `resolveStudyRecentReplies(state, result)`
  - `invalidateStudyRecentReplies(state)`
  - `toggleStudyRecentReply(state, archiveId)`

- [ ] **Step 1: Write failing request-contract tests**

测试注入内存 `fetchImpl`，断言实际 URL 严格为
`/api/shiguan/archives?type=REPLY&limit=3`、method 为 `GET`，成功 envelope
只接受 `status: "ok"` 和最多三条完整 `REPLY`；`MEMORIAL`、额外字段、
第四条记录和畸形嵌套字段均返回稳定 `unknown`。

- [ ] **Step 2: Run request tests and verify RED**

Run: `node --test src/app/study/studyRecentReplies.test.ts`

Expected: FAIL because `studyRecentReplies.ts` and its exports do not exist.

- [ ] **Step 3: Implement the strict request boundary**

定义：

```ts
export type StudyRecentRepliesResult =
  | { ok: true; archives: ShiguanArchive[] }
  | { ok: false; kind: "unauthenticated" | "network" | "unknown"; message: string };
```

请求固定同源 URL；401 映射 `unauthenticated`；非 200、非法 JSON 或不完整
envelope 映射为脱敏错误。复用史馆现有严格 payload parser，而不是重新放宽契约。

- [ ] **Step 4: Run request tests and verify GREEN**

Run: `node --test src/app/study/studyRecentReplies.test.ts`

Expected: request-contract tests PASS.

- [ ] **Step 5: Write failing state-transition tests**

覆盖：

- 初始 `idle/stale=true/archives=[]/selectedArchiveId=null`；
- 首次打开从 idle 进入 loading；
- ready 且未过期时重复打开不请求；
- 成功下旨后 `stale=true`，但保留 archives 和 selection；
- 下一次打开进入 loading；
- empty、error、401；
- 同一 ID 展开/收起，切换 ID 时只保留一个选择。

- [ ] **Step 6: Run state tests and verify RED**

Run: `node --test src/app/study/studyRecentReplies.test.ts`

Expected: FAIL on missing state transition functions.

- [ ] **Step 7: Implement minimal state transitions**

使用判别联合：

```ts
type StudyRecentRepliesPhase = "idle" | "loading" | "ready" | "empty" | "error";

interface StudyRecentRepliesState {
  phase: StudyRecentRepliesPhase;
  archives: ShiguanArchive[];
  stale: boolean;
  selectedArchiveId: string | null;
  message: string | null;
}
```

纯函数不得访问 DOM、网络或 React。

- [ ] **Step 8: Run Task 1 tests**

Run: `node --test src/app/study/studyRecentReplies.test.ts`

Expected: all Task 1 tests PASS.

---

### Task 2: StudyClient 编排与抽屉交互

**Files:**
- Modify: `frontend/src/app/study/StudyClient.tsx`
- Modify: `frontend/src/app/study/StudyClient.test.ts`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`

**Interfaces:**
- Consumes: Task 1 的状态、请求和纯转换函数。
- Produces: 左抽屉首次打开/重试读取、成功下旨后失效、最多三条回奏和一次展开一条的 UI。

- [ ] **Step 1: Write failing StudyClient orchestration tests**

源码守卫与纯编排测试必须证明：

- 导入/渲染入口不直接调用最近回奏请求；
- `onOpenRecentReplies` 才请求；
- `requestStudyRecentReplies` 使用绑定的 `window.fetch`；
- 401 只跳转 `/login?next=%2Fstudy`；
- 下旨终态仅在 `success` 时调用失效函数，`error` 不伪造档案。

- [ ] **Step 2: Run StudyClient tests and verify RED**

Run: `node --test src/app/study/StudyClient.test.ts`

Expected: FAIL because recent-reply state and callbacks are absent.

- [ ] **Step 3: Implement StudyClient orchestration**

用一个 `useState<StudyRecentRepliesState>` 保存状态；打开时若
`state.stale` 才加载；请求完成后严格映射 ready/empty/error；成功下旨后只
invalidate。通过 props 将 state、open/retry/select callbacks 传给
`DevStudyWorkspace`。

- [ ] **Step 4: Run StudyClient tests and verify GREEN**

Run: `node --test src/app/study/StudyClient.test.ts`

Expected: all StudyClient tests PASS.

- [ ] **Step 5: Write failing drawer UI tests**

断言左侧上半区：

- 标题为“最近三次下旨回奏”；
- 不再引用 `DecreeSessionRecord` 或“本次页面会话”；
- 只遍历 `recentReplies.archives.slice(0, 3)`；
- loading/empty/error/retry 文案存在；
- 记录按钮具备 `aria-expanded`；
- 展开时渲染 `sourceText`、`replyProcess`、`participatingDepartments`、
  `replyConclusion`、`replyTime`、`respondent`；
- 下半区咨询与右侧“暂未开放”仍存在。

- [ ] **Step 6: Run drawer tests and verify RED**

Run:

`node --test src/features/study-visual/StudySideDrawers.test.ts src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: FAIL because the old session-record UI remains.

- [ ] **Step 7: Implement the drawer UI**

将上半区改为真实档案列表和原位 disclosure；每条记录使用 button，选中 ID
决定唯一展开项。为 `.recordButton`、`.recordMeta`、`.recordDetail` 和
状态/重试控件增加最小样式；不得改变 `.drawer` 的既有宽度、背景与断点。

- [ ] **Step 8: Run Task 2 tests**

Run:

`node --test src/app/study/StudyClient.test.ts src/app/study/studyRecentReplies.test.ts src/features/study-visual/StudySideDrawers.test.ts src/features/study-visual/DevStudyWorkspace.test.ts`

Expected: all selected tests PASS.

---

### Task 3: Full verification and acceptance evidence

**Files:**
- Modify: `docs/product/tasks/2026-07-28-study-recent-replies.md`

**Interfaces:**
- Consumes: Task 1 and Task 2 implementation.
- Produces: reproducible verification evidence and final task status.

- [ ] **Step 1: Run frontend verification**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits 0; no real model or write endpoint is called.

- [ ] **Step 2: Run repository verification**

Run from repository root:

```powershell
node scripts/check_harness.mjs
git diff --check
```

Expected: harness and diff check exit 0.

- [ ] **Step 3: Self-review the scoped diff**

确认没有修改现有史馆后端/BFF、ADR 0028、面板宽度/背景，且无关工作区改动
未被覆盖或归因。

- [ ] **Step 4: Update the product task report**

将真实命令、测试数量、未运行项目与剩余风险写入 Implementation Report；只有
逐条验收通过后才将状态更新为 `Accepted`。

- [ ] **Step 5: Leave Git unchanged**

本计划不创建提交、推送或部署；这些动作需要用户单独授权。
