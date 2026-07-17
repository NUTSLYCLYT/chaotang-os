# 任务：修复上书房输入框被错误禁用

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-17 通过“自动交付：/study页面无法输入”委托自动确认与交付。
- 问题：`/study` 的旨意输入框初始为空时被禁用，用户无法输入任何内容，也无法完成下旨流程。
- 目标用户：在本地 `/study` 上书房页面输入旨意的朝堂 OS 用户。
- 目标：恢复旨意输入与编辑能力，同时保持非法内容不能提交、提交处理中不能重复编辑或提交。
- 非目标：不改变页面视觉、不改变下旨接口、LangGraph/DeepSeek 行为、错误文案或持久化边界。

## Acceptance Criteria

- [x] `/study` 初始加载后旨意输入框可聚焦、可输入、可修改，输入 1–2000 字符时内容与用户输入一致。
- [x] 空白内容时“下旨”按钮保持禁用；输入合法非空内容后按钮启用；提交处理中输入框和按钮均禁用。
- [x] 仅输入或修改文本不会调用 `/api/decrees/chancellor`，不会产生 DeepSeek API 用量。
- [x] 修复不改变 `/study` 既有费用提示、状态展示、BFF/FastAPI 契约、首页与后端行为。
- [x] 新增可离线重复执行的回归测试，能够防止输入框再次与“内容是否可提交”形成循环禁用。
- [x] frontend lint、typecheck、test、build 与 harness 通过；浏览器验收实际输入成功且不提交表单。

## Delivery Constraints

- 范围：优先只修改 `frontend/src/app/study/**`、本任务文件；若测试确需其它前端文件，须在技术计划中说明。
- 兼容性：保留现有 `/study` 路由、同源 BFF、`BACKEND_BASE_URL` 服务端边界及所有下旨响应状态映射。
- 风险与限制：不得读取私有环境文件，不得点击“下旨”或调用真实模型，不得修改上一轮其它未提交改动。
- 交付过程不得提交、推送、发布或创建外部资源。

## Affected Modules

- 模块：上书房旨意表单交互
- 允许路径：`frontend/src/app/study/page.tsx`、`frontend/src/app/study/decreeStatus.ts`、
  `frontend/src/app/study/decreeStatus.test.ts` 与本任务文件。
- 依赖模块：现有 `/study` 页面状态模型；只读依赖 Next.js Route Handler，不修改后端。

## Technical Plan

- 架构边界：保持既有页面、BFF 和后端契约不变，只修正 `/study` 表单控件可用性计算。
- 接口与依赖：把“输入可编辑”和“内容可提交”建模为两个独立布尔值；输入框只在 submitting
  阶段禁用，按钮还需满足去除首尾空白后的长度为 1–2000。
- 实施顺序：先用浏览器复现禁用状态，再提取纯函数、修改页面绑定、补离线回归测试，最后执行
  静态检查、测试、构建、Harness 与浏览器验收。
- 验证计划：运行 frontend lint/typecheck/test/build、Harness；浏览器实际输入但不点击下旨，
  并对比输入前后的前后端 POST 日志计数。
- 技术风险：纯函数与页面绑定仍需同时保持一致，已通过页面实际交互补足单元测试无法渲染 React
  DOM 的覆盖缺口。

## Implementation Report

- 改动摘要：Claude Code runner 因会话额度限制未进入实现；依据用户此前明确授权，Codex 切换为
  程序团队负责人完成交付。新增 `getDecreeFormAvailability()`，页面输入框改用 `canEdit`，提交
  按钮改用 `canSubmit`，从而解除初始空值导致的循环禁用。
- 自审：改动仅涉及候选的三个 `/study` 文件与本任务文件；未修改 BFF、后端、DeepSeek 配置或
  上一轮其它未提交代码。新增初始空值、合法内容、纯空白和 submitting 四类回归用例。
- 验证：frontend lint、typecheck、build 通过；`npm test` 为 `35 passed`；Harness 41 个基线文件
  通过；`git diff --check` 通过。浏览器验证初始输入框启用且按钮禁用，输入合法文字后内容保持、
  按钮启用；重载后恢复空白。一次隔离的纯输入验证期间，前后端下旨 POST 计数均保持 `1 → 1`，
  自动化没有点击按钮或触发新模型调用。前后端服务重启后 `/study` 返回 200。
- 剩余风险：没有与本缺陷直接相关的已知剩余风险；既有本地 MVP 风险仍以 ADR 0010 为准。

## Acceptance Review

- 验收结果：Accepted
- 验收证据：Codex 逐项核对 6 条标准；离线测试和真实浏览器均证明初始空输入可编辑、空内容
  不可提交、合法内容可提交。纯输入期间没有新增前后端 POST；费用提示、状态区和路由契约未改。
  lint、typecheck、35 项前端测试、build、Harness 和差异格式检查全部通过。
- 未通过项：无。
