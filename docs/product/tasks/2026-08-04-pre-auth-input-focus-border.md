# 任务：登录前输入框焦点仅改变边框颜色

## Status

Ready

## Product Definition

- 用户确认：2026-08-04 明确要求全部登录前输入框获取焦点后去掉外侧焦点框，仅改变输入框自身边框颜色。
- 问题：共享输入框当前在焦点时同时显示金棕色边框和 2px 外轮廓。
- 目标：登录、注册和邀请码输入框统一只显示金棕色焦点边框。
- 非目标：不修改按钮、链接、表单逻辑、认证接口或业务流基线。

## Acceptance Criteria

- [ ] 所有登录前输入框焦点时保留 1px 边框并变为 `#c38b4b`。
- [ ] 输入框焦点样式不显示外侧 outline，且没有 outline offset 或新增阴影。
- [ ] 邀请码输入框通过共享输入样式获得相同行为。
- [ ] 按钮与其他控件的焦点样式保持不变。
- [ ] 前端检查、build、harness 与连续 10 轮最终验收通过。

## Delivery Constraints

- 允许路径：`frontend/src/features/pre-auth/preAuth.module.css`、对应 `pre-auth` 视觉契约测试、本任务文档、对应设计与实施计划文档。
- 不修改 React 组件、认证 API、依赖或 ADR 0028。
- 技能计划：`brainstorming`、`writing-plans`、`test-driven-development`、`codex-engineering-workflow`、`verification-before-completion`。
- 不调用 Claude CLI、Claude runner 或 `gstack-claude`。

## Affected Modules

- 模块：登录前共享输入框视觉样式。
- 允许路径：`frontend/src/features/pre-auth/preAuth.module.css`、相关测试与本任务文档。
- 依赖模块：登录、注册和邀请码表单通过 CSS Module 共享 `.input`；公共接口不变。

## Technical Plan

- 先为共享输入框焦点块增加失败的 CSS 契约测试。
- 再删除外轮廓与偏移，只保留金棕色边框变化。
- 自审后执行定向测试、前端全量检查、build、harness 与连续 10 轮最终验收。

## Implementation Report

- 改动摘要：共享 `.input:focus-visible` 保留 `border-color: #c38b4b`，将外轮廓改为 `outline: none` 并移除 `outline-offset`；登录、注册及组合 `.input` 的邀请码输入框统一生效。按钮焦点轮廓保持不变。
- TDD：RED 为 0/1 PASS、1 FAIL，失败内容明确显示旧的 `outline: 2px` 与 `outline-offset: 2px`；最小 CSS 修改后 GREEN 为 1/1 PASS。
- 自审：限定 diff 仅含共享焦点 CSS 与视觉契约断言；没有修改组件、认证逻辑或工作区已有并行改动。
- 最终验收：同一最终版本连续 10 轮运行 lint、typecheck、全量 test、build、harness、harness self-test、hook self-test、delivery runner self-test 与 `git diff --check`；第 1–10 轮所有命令均 PASS/exit 0。
- 未运行项：未执行浏览器人工焦点切换验收。
- 剩余风险：自动化测试验证 CSS 源码契约，未对不同浏览器的最终像素渲染做截图比对。

## Acceptance Review

- 验收结果：Pending
- 验收证据：实现与自动化验证证据见 `Implementation Report`。
- 未通过项：等待产品验收；未执行浏览器人工验收。
