# Task: 上书房最近三次下旨回奏

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Accepted

## Product Definition

- 用户确认：2026-07-28，左侧面板上半部分展示当前账号最近三次已归档下旨回奏，点击可在上书房内查看完整回奏。
- 问题：当前区域展示页面会话内存中的下旨尝试，刷新后清空，且不是史馆权威归档。
- 目标用户：登录后使用上书房并需要快速回看近期办理结果的用户。
- 目标：复用史馆只读接口加载最近三条 `REPLY`，以“奏牍叠卷”呈现；选择后关闭左侧面板，并在中央御前卷轴展示真实回奏的六个严格字段。
- 非目标：不新增历史分页、搜索、编辑、删除、复盘、模型调用或后端业务入口。

## Superseded Acceptance Criteria (pre-redesign; not current acceptance)

The checklist below describes the pre-redesign inline-disclosure interaction.
It is retained only for traceability and is not the acceptance source for the
approved “奏牍叠卷” redesign. In particular, inline expansion inside the left
drawer and preserving focus on the drawer trigger conflict with the confirmed
close-drawer, central-scroll, and focus-transfer design.

- [x] 页面初次加载和模块导入不自动读取；首次打开左抽屉才请求 `type=REPLY&limit=3`。
- [x] 列表仅展示当前账号最近三条已归档 `REPLY`，按后端权威顺序呈现。
- [x] 点击记录原位展开原旨、办理过程、参与部门、结论、时间与责任主体；再次点击收起，且一次只展开一条。
- [x] 加载、空、错误、401 与重试状态真实可辨，不显示模拟数据。
- [x] 成功下旨后列表标记为过期；若用户正在阅读不自动替换，下次打开时刷新。
- [x] 下半区丞相咨询、右侧空面板、当前宽度、配色、关闭与焦点行为保持不变。

以上勾选表示已由源码守卫、纯状态/契约测试、typecheck 与 production build 验证。尚未执行真实浏览器人工交互与视觉检查；实际焦点恢复、独立滚动、快速连续点击和真实视口表现列为残余人工 QA 风险，不伪称已验证。

## Acceptance Criteria

The checklist in this section is the authoritative acceptance source for the
approved redesign.

### Automated acceptance

- [x] The existing authenticated, owner-scoped read remains
  `GET /api/shiguan/archives?type=REPLY&limit=3`; no new API, backend read, mock
  archive, or automatic request on module import/initial render is introduced.
- [x] The left drawer presents at most three strict archived `REPLY` records as
  the approved A-style “奏牍叠卷” decree slips, preserving loading, empty,
  error, retry, and 401 handling.
- [x] Selecting a decree slip records the archive selection, closes the left
  drawer, and renders the complete archive in the central scroll rather than
  inline in the drawer or in a dialog.
- [x] The central archived scroll renders all six strict fields without
  inference: source text, handling process, participating departments,
  conclusion, reply time, and respondent.
- [x] Archive presentation is independent of `DecreeUiState`; selecting history
  does not fabricate or overwrite a current decree result. A valid new decree
  submission switches presentation back to `current` before the existing
  submission path, while an invalid submission does neither.
- [x] A successful current decree still invalidates the recent-reply list while
  preserving the visible archive until the next explicit drawer open refreshes
  it; stale in-flight reads cannot overwrite that invalidation.
- [x] Source guards preserve the lower chancellor-consultation area, blank right
  drawer, drawer background, responsive `44vw` / `260px` / `300px` widths,
  close/Escape behavior, reduced motion, and request-race handling.

### Manual browser acceptance — not yet verified

- [ ] In an authenticated real browser, selecting a decree slip visibly closes
  the left drawer, expands the central scroll, and transfers focus into the
  central archived-reply region.
- [ ] All six fields can be independently scrolled and read, and reopening the
  left drawer can switch the central scroll to another archive.
- [ ] At desktop and narrow viewports, neither the bottom dock nor drawer close
  control is obscured, and the A-style decree slips retain the approved visual
  hierarchy.

These unchecked items are residual manual QA risks, not automated PASS claims.
The local production check was blocked by authentication (`/study` returned a
307 redirect to `/login?next=%2Fstudy`).

## Delivery Constraints

- 范围：上书房最近回奏请求/状态模块、StudyClient、工作台 props、侧抽屉 UI 与相关测试。
- 兼容性：复用现有 `/api/shiguan/archives`，保持认证、owner 范围和 ADR 0028 不变。
- 风险与限制：保留工作区已有侧抽屉配色/宽度改动和无关后端改动；不得整体覆盖文件。
- 技能计划：`using-superpowers`、`brainstorming`、`writing-plans`、`test-driven-development`、`codex-engineering-workflow`、`verification-before-completion`。
- Codex-only：否；本任务尚未授权自动交付或 Claude runner。

## Affected Modules

- 模块：上书房最近三次下旨回奏读取与左侧抽屉展示。
- 允许路径：`frontend/src/app/study/studyRecentReplies.ts`,
  `frontend/src/app/study/studyRecentReplies.test.ts`,
  `frontend/src/app/study/StudyClient.tsx`,
  `frontend/src/app/study/StudyClient.test.ts`,
  `frontend/src/features/study-visual/DevStudyWorkspace.tsx`,
  `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`,
  `frontend/src/features/study-visual/StudySideDrawers.tsx`,
  `frontend/src/features/study-visual/StudySideDrawers.module.css`,
  `frontend/src/features/study-visual/StudySideDrawers.test.ts`,
  本任务、规格与实施计划文件。
- 依赖模块：现有史馆档案 BFF 与 `ShiguanArchive` 契约（只读，不修改）。

## Technical Plan

- 架构边界：请求/严格解析/状态转换放在独立纯模块；StudyClient 编排失效与认证跳转；侧抽屉只渲染 props。
- 接口与依赖：固定同源 GET `/api/shiguan/archives?type=REPLY&limit=3`，消费 `{status:"ok", archives: ShiguanArchive[]}`。
- 实施顺序：先完成最近回奏状态模块 TDD，再接入 StudyClient 与抽屉 UI TDD，最后全量验证。
- 验证计划：专项 node:test、lint、typecheck、全量测试、production build、harness、`git diff --check`。
- 技术风险：成功下旨和史馆自动归档之间可能存在极短时序差；本设计只标记过期并在下次打开读取，避免轮询与竞态。

## Implementation Report

### Final implementation and verification evidence (2026-07-28)

- Change summary: added a strict, same-origin recent-reply request/state module and connected it to the Study left drawer and central imperial scroll. The drawer reads only `GET /api/shiguan/archives?type=REPLY&limit=3` after an explicit open/retry and renders at most three archived `REPLY` records as decree slips. Selecting a slip closes the left drawer and presents the selected archive's six strict fields in the central scroll. Archive presentation remains separate from current decree state, and preserved recent-reply data is invalidated only after a successful decree.
- Self-review: the scoped implementation is limited to the task's registered frontend files. It does not change the existing Shiguan backend/BFF, backend code, ADR 0028, or the right drawer. The previously present drawer width/background and chancellor-consultation presentation changes were preserved rather than overwritten or attributed to this task.
- Acceptance review:
  1. Import and initial render perform no recent-reply request; the executable loader is called only by open/retry callbacks and uses the fixed query.
  2. Strict archive parsing rejects non-`REPLY`, malformed, extra-field, and more-than-three results; owner scoping and ordering remain the responsibility of the existing authenticated BFF/backend contract.
  3. The drawer renders concise decree-slip summaries only. Selection closes the drawer; the central imperial scroll renders source text, handling process, participating departments, conclusion, reply time, and respondent for the selected archive ID.
  4. Loading, empty, error, retry, and 401 login redirect paths are covered; no mock archives are rendered.
  5. A successful decree invalidates while preserving the visible archive and selection; an in-flight stale response cannot overwrite the invalidation, and the next open refreshes.
  6. Source guards preserve the consultation area, right unavailable drawer, responsive drawer widths, background, close/focus behavior, and reduced-motion behavior.
- Skills used: `using-superpowers` preflight, `codex-engineering-workflow`, and `verification-before-completion`. No repair was required, so no debugging or TDD modification cycle was started in Task 3.
- Fresh commands and results:
  - `frontend> npm run lint` — PASS, exit 0.
  - `frontend> npm run typecheck` — PASS, exit 0.
  - `frontend> npm test` — PASS, exit 0; 326 passed, 0 failed, 0 skipped.
  - `frontend> npm run build` — PASS, exit 0; Next.js production build compiled, typechecked, and generated 30/30 static pages.
  - `repo> node scripts/check_harness.mjs` — PASS, exit 0; 72 baseline files checked.
  - `repo> git diff --check` — PASS, exit 0; only line-ending conversion warnings were printed.
- External side effects: none. Tests use injected in-memory fetches/source guards; the build does not start the app. No real model call, decree submission, archive write, staging, commit, push, or deployment was performed.
- Not run: browser/manual interaction QA, because it is not required by the Task 3 brief and the repository's current strategy uses `node:test` source/contract guards plus typecheck/build.
- Residual risk: focus, independent scrolling, rapid physical clicks, and the visual result at actual viewport sizes remain unverified in a real browser. The full working tree also contains unrelated backend and documentation changes; they were excluded from scoped attribution and left untouched.

## Acceptance Review

### Final acceptance (2026-07-28)

- Result: Accepted
- Evidence: automated criteria in the authoritative redesign checklist were
  reviewed against the scoped diff and fresh verification; all required Task 3
  commands exited 0.
- Unpassed automated items: none.
- Unverified items: the three explicitly unchecked authenticated real-browser
  criteria remain residual manual QA risks. They are not optional PASS items
  and are not covered by the `Accepted` automated status.

### Visual redesign Task 4 verification (2026-07-28)

- Automated result: PASS. Fresh commands completed with exit 0:
  - `frontend> npm run lint`
  - `frontend> npm run typecheck`
  - `frontend> npm test` — 342 passed, 0 failed, 0 skipped
  - `frontend> npm run build` — Next.js 16.2.10 production build, 30/30 static pages
  - `repo> node scripts/check_harness.mjs` — 72 baseline files checked
  - `repo> git diff --check` — no whitespace errors; LF-to-CRLF warnings only
- Redesign implementation files:
  - `frontend/src/app/study/studyReplyPresentation.ts`
  - `frontend/src/app/study/studyReplyPresentation.test.ts`
  - `frontend/src/app/study/StudyClient.tsx`
  - `frontend/src/app/study/StudyClient.test.ts`
  - `frontend/src/features/study-visual/StudySideDrawers.tsx`
  - `frontend/src/features/study-visual/StudySideDrawers.module.css`
  - `frontend/src/features/study-visual/StudySideDrawers.test.ts`
  - `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
  - `frontend/src/features/study-visual/DevStudyWorkspace.module.css`
  - `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- RED/GREEN traceability: Task 1 recorded missing-module RED then 1/1 GREEN;
  Task 2 recorded 15 pass / 3 fail RED then 18/18 GREEN; Task 3 recorded
  29 pass / 2 fail initial RED and 21 pass / 3 fail review RED, then 43/43
  final focused GREEN. Task 4 reran the complete current suite rather than
  recreating historical RED states.
- Scoped review: no new API/backend read was introduced; the feature keeps the
  existing authenticated `GET /api/shiguan/archives?type=REPLY&limit=3`.
  Archive selection remains separate from `DecreeUiState`, details are rendered
  only in the central scroll, and a valid new decree resets the presentation to
  `current` before the existing submission path runs.
- Shared dirty-tree note: unrelated backend, docs, court-shell, and
  chancellor-consultation changes were preserved and excluded from this
  feature's attribution, including unrelated changes that share frontend files.
- Browser/manual QA: NOT VERIFIED. The local production server started
  successfully, but an unauthenticated read-only request to `/study` returned
  `307` with `Location: /login?next=%2Fstudy`. No session was fabricated.
  Desktop/narrow visual appearance, focus transfer, independent scrolling, and
  rapid archive switching remain residual manual QA risks.
- Side effects: no decree submission, real model call, archive write, staging,
  commit, push, or deployment was performed. The temporary local server was
  stopped after the read-only authentication check.
- Detailed evidence:
  `.superpowers/sdd/study-recent-replies-redesign-report.md`.
