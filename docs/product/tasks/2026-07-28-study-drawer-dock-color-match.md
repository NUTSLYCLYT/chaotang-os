# Task: 上书房侧抽屉与底部栏配色一致

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。

## Status

Ready

## Product Definition

- 用户确认：2026-07-28，左右侧抽屉面板颜色需要与底部栏保持一致。
- 目标：左右侧抽屉复用底部栏当前的深蓝黑渐变背景。
- 非目标：不修改抽屉内容、布局、遮罩、透明度、动画、交互或业务流程。

## Acceptance Criteria

- [ ] 左右侧抽屉使用与底部栏完全一致的背景渐变。
- [ ] 自动化测试锁定侧抽屉与底部栏的背景值一致。
- [ ] 现有侧抽屉测试、前端 lint、typecheck 与 harness 校验通过。

## Delivery Constraints

- 允许路径：
  - `frontend/src/features/study-visual/StudySideDrawers.module.css`
  - `frontend/src/features/study-visual/StudySideDrawers.test.ts`
  - 本任务文档与对应实施计划
- 不修改 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。
- 不执行真实模型调用。
- 未获用户单独授权，不提交、推送或部署。

## Technical Plan

- 使用 `node:test` 读取侧抽屉与底部栏 CSS，断言 `.drawer` 与 `.dock` 的 `background` 声明完全一致。
- 先运行新增测试取得预期失败，再将 `.drawer` 背景替换为底部栏当前渐变并复验。

## Affected Modules

- 模块：上书房左右侧抽屉视觉样式。
- 允许路径：`frontend/src/features/study-visual/StudySideDrawers.module.css`,
  `frontend/src/features/study-visual/StudySideDrawers.test.ts`,
  `docs/product/tasks/2026-07-28-study-drawer-dock-color-match.md`,
  `docs/superpowers/plans/2026-07-28-study-drawer-dock-color-match.md`。
- 依赖模块：公共底部快捷栏视觉样式（只读）。

## Implementation Report

- 将左右侧抽屉的纯色背景替换为底部栏现有的深蓝黑渐变。
- 新增跨 CSS Module 的回归断言，直接比较 `.drawer` 与 `.dock` 的
  `background` 值。
- TDD 证据：新增断言首次运行时因 `#10100e` 与底栏渐变不一致而失败；
  修改后专项测试 3/3 通过。
- 前端 lint、typecheck 与全量测试通过；全量测试为 300/300。
- 未执行真实模型调用、提交、推送或部署。

## Acceptance Review

- 验收状态：Accepted
- 左右侧抽屉与底部栏背景值由自动化测试锁定为完全一致。
- 抽屉内容、布局、遮罩、动画和交互未修改。
