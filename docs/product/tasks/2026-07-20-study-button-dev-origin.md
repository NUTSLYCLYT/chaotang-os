# 任务：修复上书房按钮在 127.0.0.1 下不可点击

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-20 通过“自动交付：上书房按钮无法点击”委托自动确认，并澄清目标是 `/study` 页面。
- 问题：用户从 `http://127.0.0.1:3000/study` 打开上书房时，输入合法旨意后“下旨”按钮仍为禁用状态。
- 目标用户：通过本地开发地址使用上书房的开发者与验收人员。
- 目标：`127.0.0.1:3000/study` 完成客户端交互接管；输入 1–2000 字非空旨意后按钮可点击。
- 非目标：不触发真实下旨、不调用 DeepSeek、不改变按钮业务校验、后端契约或页面视觉设计。

## Acceptance Criteria

- [x] 在 `127.0.0.1:3000/study` 输入合法旨意后，“下旨”按钮从 disabled 变为 enabled。
- [x] 空白旨意和 submitting 状态仍保持不可提交，现有纯函数行为不变。
- [x] Next.js 开发服务不再记录来自 `127.0.0.1` 的 dev resource cross-origin 拒绝。
- [x] 配置回归测试先失败后通过，前端 lint、typecheck、test、build 与根级 harness 通过。
- [x] 浏览器验收不点击“下旨”，不产生真实模型调用。

## Delivery Constraints

- 范围：只修复 `/study` 在本地开发源下的交互可用性与对应测试/任务证据。
- 兼容性：保留 `localhost:3000`、现有按钮校验、BFF/后端接口和生产构建行为。
- 风险与限制：运行中的前端需在配置修改后重启；不得提交、推送或部署。
- 技能计划：`product-flow`、`systematic-debugging`、`test-driven-development`、浏览器控制、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 `gstack-claude`。

## Affected Modules

- 模块：上书房本地开发运行配置与回归测试。
- 允许路径：`frontend/next.config.ts`、`frontend/next.config.test.ts`、本任务文件。
- 依赖模块：Next.js dev server 与 `/study` 客户端页面。

## Technical Plan

- 架构边界：Next.js 16.2.10 仅对开发资源校验来源；修复限定在 `allowedDevOrigins`，不改页面状态、业务 API 或生产 CORS。
- 接口与依赖：`allowedDevOrigins` 使用精确 hostname `127.0.0.1`，不含协议、端口、路径或通配符；`localhost` 保持 Next 默认允许。
- 实施顺序：复现并定位 → 配置回归测试 RED → 最小配置修复 GREEN → 重启服务 → 浏览器验收。
- 验证计划：前端定向/全量测试、lint、typecheck、build、harness、`127.0.0.1/study` 浏览器状态与开发日志。
- 技术风险：配置需重启 dev server 才生效；白名单扩大仅限单一 loopback hostname。只读架构复核结论 GO。

## Implementation Report

- 改动摘要：在 Next.js 配置中精确允许 `127.0.0.1` 开发来源，并新增配置契约回归测试；未修改 `/study` 页面业务逻辑。
- 自审：配置只包含单一 loopback hostname，不含协议、端口、路径、通配符或额外来源；变更范围仅配置、测试和任务证据。
- 验证：TDD RED 为实际值 `undefined`、期望 `['127.0.0.1']`、0 pass/1 fail；GREEN 为定向 1/1。独立 test-engineer 结论 GO。
- 实际使用的 skill：`product-flow`（Codex-only 角色链）、`systematic-debugging`、`test-driven-development`、`control-in-app-browser`、`verification-before-completion`。
- 验证命令与结果：定向测试 1/1、前端全量 79/79、lint/typecheck/build、harness 53 基线/22 自测/3 Hook 自测、`git diff --check` 均通过；浏览器在 `127.0.0.1/study` 输入“整饬吏治”后按钮 enabled。
- 未运行项与原因：真实“下旨”未运行，避免模型费用。
- 剩余风险：该配置只影响开发服务；第三方 Next.js 升级后需继续由测试和浏览器行为验证。

## Acceptance Review

- 验收结果：Accepted — 2026-07-20；独立 test-engineer 结论 GO。
- 验收证据：主任务最终复验 `127.0.0.1:3000/study`：空输入按钮 disabled，输入“整饬吏治”后 enabled；没有点击按钮。定向 1/1、全量 79/79、lint/typecheck/build、harness 53/22/3 均通过。
- 未通过项：无。
