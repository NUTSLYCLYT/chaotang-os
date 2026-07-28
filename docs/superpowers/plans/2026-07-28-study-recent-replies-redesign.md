# 上书房最近回奏面板视觉重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将最近三条史馆回奏改造成上书房风格的奏牍列表，并在选择后关闭左侧面板、通过中央御前卷轴展示完整历史回奏。

**Architecture:** 保留现有最近回奏请求与严格解析模块；新增独立的卷轴展示来源状态，避免历史档案污染 `DecreeUiState`。侧栏只负责奏牍列表和选择意图，`DevStudyWorkspace` 负责在当前下旨结果与所选史馆档案之间选择中央卷轴内容。

**Tech Stack:** Next.js App Router、React、TypeScript、CSS Modules、Node `node:test`。

## Global Constraints

- 继续使用 `GET /api/shiguan/archives?type=REPLY&limit=3`，不新增或修改后端 API。
- 不修改、绕过或替代 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。
- 历史回奏与当前 `DecreeUiState` 分离，不把史馆档案伪装成本次下旨结果。
- 左侧面板保留现有 `44vw`、`260px`、`300px` 响应式宽度及与底栏一致的背景。
- 保留下半区丞相咨询、右侧暂未开放面板、401、重试和请求竞态行为。
- 不使用弹窗，不在左侧面板内展开完整回奏。
- 仅使用已严格解析的真实 `REPLY` 字段，不补全、不推断。
- 所有实现采用 RED → GREEN；未获用户单独授权不得暂存、提交、推送或部署。

---

### Task 1: 独立卷轴展示来源状态

**Files:**
- Create: `frontend/src/app/study/studyReplyPresentation.ts`
- Create: `frontend/src/app/study/studyReplyPresentation.test.ts`

**Interfaces:**
- Consumes: `ShiguanArchive` from `frontend/src/lib/backendClient.ts`
- Produces:
  - `type StudyReplyPresentation = { source: "current" } | { source: "archive"; archiveId: string }`
  - `CURRENT_REPLY_PRESENTATION`
  - `selectArchivedReply(archiveId: string): StudyReplyPresentation`
  - `resetToCurrentReply(): StudyReplyPresentation`
  - `resolveSelectedArchive(presentation, archives): ShiguanArchive | null`

- [ ] **Step 1: 写失败测试，锁定独立状态和严格选择**

```ts
test("selected archive remains separate from decree state and resolves only from the current strict list", () => {
  const presentation = selectArchivedReply("reply-2");
  assert.deepEqual(presentation, { source: "archive", archiveId: "reply-2" });
  assert.equal(resolveSelectedArchive(presentation, [REPLY_ONE, REPLY_TWO]), REPLY_TWO);
  assert.equal(resolveSelectedArchive(presentation, [REPLY_ONE]), null);
  assert.deepEqual(resetToCurrentReply(), { source: "current" });
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
cd frontend
node --test src/app/study/studyReplyPresentation.test.ts
```

Expected: FAIL，因为 `studyReplyPresentation.ts` 尚不存在。

- [ ] **Step 3: 实现最小纯状态模块**

```ts
import type { ShiguanArchive } from "../../lib/backendClient.ts";

export type StudyReplyPresentation =
  | { source: "current" }
  | { source: "archive"; archiveId: string };

export const CURRENT_REPLY_PRESENTATION: StudyReplyPresentation = {
  source: "current",
};

export function selectArchivedReply(archiveId: string): StudyReplyPresentation {
  return { source: "archive", archiveId };
}

export function resetToCurrentReply(): StudyReplyPresentation {
  return CURRENT_REPLY_PRESENTATION;
}

export function resolveSelectedArchive(
  presentation: StudyReplyPresentation,
  archives: ShiguanArchive[],
): ShiguanArchive | null {
  if (presentation.source !== "archive") return null;
  return archives.find((archive) => archive.id === presentation.archiveId) ?? null;
}
```

- [ ] **Step 4: 运行 Task 1 测试、typecheck 和 lint**

Run:

```powershell
cd frontend
node --test src/app/study/studyReplyPresentation.test.ts
npm run typecheck
npm run lint
```

Expected: 全部 PASS。

- [ ] **Step 5: 审查边界**

确认模块不引用 React、DOM、网络或 `DecreeUiState`，且档案不存在时返回 `null`，不保留脱离当前严格列表的副本。

---

### Task 2: 奏牍叠卷侧栏与选择后关闭

**Files:**
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.module.css`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.test.ts`

**Interfaces:**
- Consumes: 现有 `StudyRecentRepliesState`
- Produces: `onSelectRecentReply(archiveId)` 在关闭左侧面板前触发；侧栏不再渲染完整回奏详情

- [ ] **Step 1: 写失败测试，锁定奏牍结构和无内联详情**

在 `StudySideDrawers.test.ts` 增加源码守卫：

```ts
test("recent replies render as archived decree slips without inline reply details", () => {
  assert.match(source, /className=\{styles\.decreeSlip\}/);
  assert.match(source, /className=\{styles\.bindingLine\}/);
  assert.match(source, /className=\{styles\.replySeal\}/);
  assert.match(source, /展卷阅奏/);
  assert.doesNotMatch(source, /className=\{styles\.recordDetail\}/);
  assert.doesNotMatch(source, /aria-expanded=/);
});
```

并增加选择顺序守卫：

```ts
assert.match(
  source,
  /props\.onSelectRecentReply\(archive\.id\);[\s\S]*close\("left", false\)/,
);
```

- [ ] **Step 2: 运行侧栏测试并确认 RED**

Run:

```powershell
cd frontend
node --test src/features/study-visual/StudySideDrawers.test.ts
```

Expected: FAIL，因为仍使用普通记录卡和侧栏内联详情。

- [ ] **Step 3: 改造 JSX 为奏牍列表**

每条记录使用真实按钮，结构固定为：

```tsx
<article className={styles.decreeSlip} key={archive.id}>
  <span className={styles.bindingLine} aria-hidden="true" />
  <button
    type="button"
    className={styles.decreeSlipButton}
    aria-label={`展卷阅奏：${archive.sourceText}`}
    onClick={() => {
      props.onSelectRecentReply(archive.id);
      close("left", false);
    }}
  >
    <span className={styles.recordMeta}>
      {archive.replyTime} · {archive.participatingDepartments!.join("、")}
    </span>
    <strong className={styles.recordSummary}>{archive.sourceText}</strong>
    <span className={styles.openReply}>展卷阅奏</span>
    <span className={styles.replySeal} aria-hidden="true">回奏</span>
  </button>
</article>
```

删除侧栏中的 `recordDetail`、`aria-expanded` 与六字段详情 JSX；加载、空、错误和重试分支保持不变。

- [ ] **Step 4: 实现方案 A 的 CSS**

新增并使用以下视觉规则，不修改 `.drawer` 的背景和宽度断点：

```css
.decreeSlip {
  position: relative;
  margin-top: 10px;
  border: 1px solid rgba(167, 124, 53, .3);
  background: linear-gradient(100deg, rgba(198, 156, 76, .12), rgba(255, 255, 255, .025));
  box-shadow: inset 3px 0 #9f7130;
}
.bindingLine {
  position: absolute;
  inset: 8px auto 8px 8px;
  width: 1px;
  background: rgba(240, 198, 106, .28);
}
.decreeSlipButton {
  position: relative;
  display: grid;
  width: 100%;
  gap: 7px;
  box-sizing: border-box;
  border: 0;
  padding: 13px 46px 13px 18px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.openReply { color: #c99b4c; font-size: 11px; }
.replySeal {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid #8d3028;
  color: #b94c3d;
  font-size: 10px;
  transform: rotate(-7deg);
}
```

保留 `.recordSummary` 两行截断、可见焦点、reduced-motion 与窄屏规则。

- [ ] **Step 5: 运行 Task 2 定向验证**

Run:

```powershell
cd frontend
node --test src/features/study-visual/StudySideDrawers.test.ts
npm run typecheck
npm run lint
```

Expected: 全部 PASS；测试继续证明咨询区、右侧面板、背景和宽度未回退。

---

### Task 3: 中央御前卷轴展示历史回奏

**Files:**
- Modify: `frontend/src/app/study/StudyClient.tsx`
- Modify: `frontend/src/app/study/StudyClient.test.ts`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.module.css`

**Interfaces:**
- Consumes: Task 1 的 `StudyReplyPresentation` 与 `resolveSelectedArchive`
- Produces:
  - `DevStudyWorkspaceProps.selectedArchivedReply: ShiguanArchive | null`
  - `DevStudyWorkspaceProps.onReturnToCurrentReply(): void`
  - 中央 `EdictStage` 的历史回奏分支

- [ ] **Step 1: 写失败测试，锁定历史选择不污染当前下旨状态**

在 `StudyClient.test.ts` 增加守卫，要求：

```ts
assert.match(source, /useState<StudyReplyPresentation>/);
assert.match(source, /selectArchivedReply\(archiveId\)/);
assert.match(source, /resolveSelectedArchive\(replyPresentation, recentReplies\.archives\)/);
assert.match(source, /setReplyPresentation\(resetToCurrentReply\(\)\)/);
```

并验证重置发生在提交开始之前，而不是通过修改 `uiState` 模拟历史成功。

- [ ] **Step 2: 写失败测试，锁定中央卷轴六字段与无弹窗**

在 `DevStudyWorkspace.test.ts` 增加：

```ts
assert.match(source, /selectedArchivedReply/);
assert.match(source, /bodyLabel="史馆归档回奏"/);
assert.match(source, /原旨正文/);
assert.match(source, /办理过程/);
assert.match(source, /参与部门/);
assert.match(source, /回奏结论/);
assert.match(source, /回奏时间/);
assert.match(source, /责任主体/);
assert.doesNotMatch(source, /role="dialog"[\s\S]*selectedArchivedReply/);
```

- [ ] **Step 3: 运行两个测试并确认 RED**

Run:

```powershell
cd frontend
node --test src/app/study/StudyClient.test.ts src/features/study-visual/DevStudyWorkspace.test.ts
```

Expected: FAIL，因为展示来源状态和历史卷轴分支尚未接入。

- [ ] **Step 4: 在 StudyClient 接入展示来源**

新增：

```ts
const [replyPresentation, setReplyPresentation] =
  useState<StudyReplyPresentation>(CURRENT_REPLY_PRESENTATION);

const selectedArchivedReply = resolveSelectedArchive(
  replyPresentation,
  recentReplies.archives,
);
```

选择回奏时只更新展示来源：

```ts
onSelectRecentReply={(archiveId) => {
  commitRecentReplies((state) => toggleStudyRecentReply(state, archiveId));
  setReplyPresentation(selectArchivedReply(archiveId));
}}
```

调用 `submitStudyDecree` 前执行：

```ts
setReplyPresentation(resetToCurrentReply());
```

把 `selectedArchivedReply` 传给 `DevStudyWorkspace`，不得构造伪造的 `DecreeUiState`。

- [ ] **Step 5: 在 DevStudyWorkspace 接入历史卷轴**

扩展 props：

```ts
selectedArchivedReply: ShiguanArchive | null;
```

展示优先级：

```ts
const archivedReply = props.selectedArchivedReply;
const showScroll = expanded || archivedReply !== null || props.uiState.phase !== "idle";
const hasReplyContent = archivedReply !== null || props.uiState.phase === "success";
```

历史分支使用现有 `EdictStage`：

```tsx
{archivedReply ? (
  <EdictStage
    document={{
      id: `study-archive-${archivedReply.id}`,
      kicker: "史馆留痕 · 上书房阅奏",
      title: "回奏",
      issuer: `${archivedReply.respondent} · ${archivedReply.replyTime}`,
    }}
    theme="imperial"
    bodyLabel="史馆归档回奏"
  >
    <section className={styles.archivedReply} tabIndex={-1} data-testid="archived-reply-scroll">
      <p><strong>原旨正文</strong>{archivedReply.sourceText}</p>
      <p><strong>办理过程</strong>{archivedReply.replyProcess}</p>
      <p><strong>参与部门</strong>{archivedReply.participatingDepartments!.join("、")}</p>
      <p><strong>回奏结论</strong>{archivedReply.replyConclusion}</p>
      <p><strong>回奏时间</strong>{archivedReply.replyTime}</p>
      <p><strong>责任主体</strong>{archivedReply.respondent}</p>
    </section>
  </EdictStage>
) : props.uiState.phase === "success" ? (
  /* 保留现有本次下旨回奏 */
) : (
  /* 保留现有 idle/submitting/error */
)}
```

使用 effect 在 `archivedReply.id` 变化后设置 `expanded=true`，并将焦点移入带 `tabIndex={-1}` 的历史卷轴容器。不得引入 dialog。

- [ ] **Step 6: 增加历史卷轴的最小样式**

```css
.archivedReply {
  min-width: 0;
  color: #33230f;
  overflow-wrap: anywhere;
}
.archivedReply p {
  margin: 0 0 14px;
  line-height: 1.8;
}
.archivedReply strong {
  margin-right: .7em;
  color: #734516;
}
.archivedReply:focus { outline: none; }
.archivedReply:focus-visible {
  outline: 2px solid #8b2a20;
  outline-offset: 4px;
}
```

- [ ] **Step 7: 运行 Task 3 定向验证**

Run:

```powershell
cd frontend
node --test src/app/study/StudyClient.test.ts src/features/study-visual/DevStudyWorkspace.test.ts src/features/study-visual/StudySideDrawers.test.ts src/app/study/studyReplyPresentation.test.ts
npm run typecheck
npm run lint
```

Expected: 全部 PASS。

---

### Task 4: 全量回归、视觉核对与任务证据

**Files:**
- Modify: `docs/product/tasks/2026-07-28-study-recent-replies.md`
- Create: `.superpowers/sdd/study-recent-replies-redesign-report.md`

**Interfaces:**
- Consumes: Tasks 1–3 的完整实现
- Produces: 可追溯的验证证据、残余风险和产品验收状态

- [ ] **Step 1: 自审相关 diff**

只审查本计划列出的文件，确认没有归因或覆盖共享工作区中无关的 backend、docs 或其他前端改动。特别核对：

- 无新 API 或后端读取；
- 无弹窗与侧栏内联详情；
- 咨询区、右侧面板、背景和宽度保持；
- 选择历史档案不写入 `DecreeUiState`；
- 新下旨开始切回当前展示来源。

- [ ] **Step 2: 运行前端全量验证**

Run:

```powershell
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: 全部 exit 0，测试 0 fail，Next.js production build 成功。

- [ ] **Step 3: 运行仓库验证**

Run:

```powershell
cd ..
node scripts/check_harness.mjs
git diff --check
```

Expected: harness PASS；`git diff --check` exit 0。行尾转换 warning 可记录，但不得存在 whitespace error。

- [ ] **Step 4: 视觉与交互核对**

在不点击“下旨”、不触发真实模型调用的前提下检查：

- 三条记录呈现为奏牍叠卷；
- 点击后左侧面板关闭，中央卷轴展开；
- 焦点进入中央卷轴；
- 六字段可滚动阅读；
- 重新打开左侧面板可切换另一条；
- 桌面和窄屏不遮挡底栏或关闭按钮。

若无法运行真实浏览器，必须在报告和产品任务中明确标记为未验证的人工 QA 风险，不得伪称 PASS。

- [ ] **Step 5: 更新任务证据**

在产品任务中登记：

- 实现文件；
- RED/GREEN 证据；
- lint、typecheck、test、build、harness、diff-check 的真实结果；
- 浏览器视觉核对结果或残余风险；
- 未执行暂存、提交、推送或部署。

在 `.superpowers/sdd/study-recent-replies-redesign-report.md` 写入同一事实源的详细证据。
