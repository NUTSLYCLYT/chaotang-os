# 任务：上书房下旨入口仅保留一个可提交实例

> 本任务遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`，不改变下旨业务流。

## Status

In Progress

## Product Definition

- 用户确认：用户于 2026-07-28 以“请使用自动交付实现”授权自动交付，并在同日反馈“上书房页面点击下旨按钮后接口都没触发”；按 product-flow 自动确认 Ready。
- 问题：上书房当前同时渲染两套同 ID 的旨意输入框和“下旨”按钮，用户点击后没有可观察到的下旨请求。
- 目标用户：已登录、在上书房提交旨意的用户。
- 目标：页面只保留一套可编辑的旨意输入和“下旨”按钮；填写有效旨意并点击该按钮时，必须经既有 `StudyClient` 提交边界发出同源 `POST /api/decrees/chancellor` 请求。
- 非目标：不修改 ADR 0028 业务链路、不更改后端接口、认证、模型调用策略、超时配置或成功响应契约；不发送真实下旨请求。

## Acceptance Criteria

- [ ] `/study` 只渲染一个 `decree-textarea` 和一个 `submit-decree-button`，避免重复 DOM id 与重复交互入口。
- [ ] 唯一“下旨”按钮仍由 `StudyClient` 传入的提交回调驱动，且有效输入时不被错误禁用。
- [ ] 自动化回归测试覆盖唯一提交入口和既有回调绑定；先证明旧实现不满足该断言，再验证修复。
- [ ] 相关前端测试、lint、typecheck 产生新鲜验证证据；验证不触发真实下旨请求。

## Delivery Constraints

- 范围：仅上书房提交 UI、其测试和本任务记录。
- 兼容性：浏览器只调用同源 BFF；保持 `StudyClient` → `studySubmission` → `/api/decrees/chancellor` 的既有责任边界。
- 风险与限制：工作区存在用户未提交改动；不得覆盖无关变更，也不得移除首朝引导或快捷栏。
- 技能计划：`systematic-debugging`、`test-driven-development`、`verification-before-completion`、`product-flow`。
- Codex-only：否。

## Affected Modules

- 模块：上书房旨意提交入口。
- 允许路径：`frontend/src/features/study-visual/DevStudyWorkspace.tsx`、`frontend/src/features/study-visual/DevStudyWorkspace.test.ts`、本任务文件。
- 依赖模块：`frontend/src/app/study/StudyClient.tsx`、`frontend/src/app/study/studySubmission.ts`（只读，除非架构复核证明必须修改）。

## Technical Plan

- 根因（solution-architect 只读分析确认）：`DevStudyWorkspace.tsx` 存在两份结构几乎相同的
  “御前下旨” composer 区块，均带相同的 `id="decree-text"`、`data-testid="decree-textarea"`、
  `data-testid="submit-decree-button"`。实例 A（第 199-215 行，`const composer = (...)`）经
  `quickDockCenter={composer}` 渲染进快捷栏，是浏览器中唯一可见可点击的实例，绑定的是真实的
  `props.onSubmit`/`props.canSubmit`（→ `StudyClient.handleSubmitDecree` →
  `studySubmission.submitStudyDecree` → `POST /api/decrees/chancellor`）。实例 B（第 314-351
  行，直接写在 `<div className={styles.stage}>` 内）是历史遗留的复制粘贴，逻辑上同样绑定了
  `props.onSubmit`，并未“绑定错误逻辑”，但 `DevStudyWorkspace.module.css` 用
  `.stage > .composer { display: none; }` 把它在视觉上隐藏。两份 DOM 节点共享相同 `id`/
  `data-testid` 是无效 HTML 且违反验收标准第 1 条；对以 `data-testid` 做唯一匹配的自动化/
  校验工具（如 strict-mode locator）会因命中两个节点而拒绝派发点击，这与用户反馈“点击下旨
  按钮后接口都没触发”的症状吻合。修复只需删除实例 B 整段，保留实例 A。
- 架构边界：改动完全封闭在 `DevStudyWorkspace.tsx` 一个展示组件内部；不触碰 `StudyClient` →
  `studySubmission` → `/api/decrees/chancellor` 的既有责任边界，不涉及 ADR 0028 业务流，
  无需新增 ADR。“快捷栏”（`CourtQuickDock`，承载实例 A）与“首朝引导”
  （`FirstCourtRitual`，只通过 `onUseDraft` 回调写草稿文本）均不依赖实例 B，删除后不受影响。
- 接口与依赖：`DevStudyWorkspaceProps` 不变；`StudyClient.tsx`、`studySubmission.ts` 确认
  无需改动，保持只读，不扩大允许路径。`DevStudyWorkspace.module.css` 第 108 行
  `.stage > .composer { display: none; }` 删除实例 B 后成为无害死代码，超出当前允许路径，
  默认不清理（非阻塞，不影响验收）。
- 实施顺序（TDD）：
  1. 在 `DevStudyWorkspace.test.ts` 新增断言——源码中 `data-testid="decree-textarea"`、
     `data-testid="submit-decree-button"`、`aria-label="御前下旨"` 各恰好出现 1 次；先运行
     确认在当前实现下该断言失败（证明重复问题真实存在）。
  2. 删除 `DevStudyWorkspace.tsx` 第 314-351 行的重复 `<section className={styles.composer}
     aria-label="御前下旨">…</section>` 整段，只保留经 `quickDockCenter={composer}` 渲染的
     实例 A。
  3. 重跑新断言确认转绿，同时确认既有测试（含“study places the decree composer in the
     quick dock center slot”）仍通过。
  4. 运行相关前端验证。
- 验证计划：`cd frontend && node --test src/features/study-visual/DevStudyWorkspace.test.ts`、
  `npm test`（全量回归，确认 `StudyClient` 相关测试不受影响）、`npm run lint`、
  `npm run typecheck`；沿用本文件既有测试方法论（纯 `readFile` + 源码文本断言，不需要 jsdom
  渲染、不需要登录会话或路由 mock），不点击下旨、不触发真实模型调用。
- 技术风险：极低，单文件纯删除重复渲染，不涉及状态管理或业务逻辑变化；无登录会话时
  `/study` 会重定向登录页，验证策略用源码级断言规避该问题，不做浏览器级点击验证。

## Implementation Report

- 改动摘要：待交付负责人填写。
- 自审：待交付负责人填写。
- 验证：待交付负责人填写。
- 实际使用的 skill：待交付负责人填写。
- 验证命令与结果：待交付负责人填写。
- 未运行项与原因：待交付负责人填写。
- 剩余风险：待交付负责人填写。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待 Codex 逐条核对。
- 未通过项：无。
