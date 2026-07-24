# 任务：六部视觉演示展示恢复

> 所有任务必须阅读并遵循 `docs/decisions/0020-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Ready

## Product Definition

- 用户确认：当前用户于 2026-07-24 确认仅恢复旧 `dev` 中六部的视觉展示；不接入旧接口、旧模拟业务逻辑或旧数据链路。
- 问题：六部、部门和属署页面目前仅有占位内容，无法呈现原有的部门场景、信息层级和导航。
- 目标用户：已登录并浏览朝堂工作区的用户。
- 目标：在 `/liubu`、六个部门页及其属署页提供静态、可浏览的六部演示展示，并明确标记为“演示展示”。
- 非目标：恢复旧 `dev` 的 SWR、API 请求、业务操作、模拟业务数据事实、认证变更，或修改下旨/证据/史馆业务基线。

## Acceptance Criteria

- [ ] `/liubu` 展示六部总览和六个部门入口。
- [ ] 六个部门各自展示对应背景、职责概览、司局卡片和演示待办信息。
- [ ] 属署页面展示所属部门与司局的静态说明，且可返回部门总览。
- [ ] 所有新增信息都清晰标记为“演示展示”，不请求旧版接口或后端业务接口。
- [ ] 无效部门或属署路由返回 404。

## Delivery Constraints

- 范围：`frontend/src/app/liubu/**`、`frontend/src/features/department-demo/**`、`frontend/public/assets/six-ministries/**` 及相关测试。
- 兼容性：保持既有登录保护和 `CourtShell`；不改动 BFF、后端或 ADR 0020。
- 风险与限制：旧 `dev` 内容不可被作为当前业务事实；仅复用已获用户授权的视觉资产与静态展示层级。
- 技能计划：`codex-engineering-workflow`、`brainstorming`、`writing-plans`、`test-driven-development`、`verification-before-completion`。
- Codex-only：否。

## Affected Modules

- 模块：六部视觉演示展示。
- 允许路径：见 Delivery Constraints。
- 依赖模块：现有 `CourtShell`、`requireUser`。

## Technical Plan

- 架构边界：以纯静态、类型化的部门演示配置驱动页面；路由层只读取本地配置，不发起网络调用。
- 接口与依赖：不新增接口；只使用 Next.js 路由参数、现有鉴权和本地公共图片资产。
- 实施顺序：先写配置与路由边界测试；导入六张已授权背景图；实现总览、部门、属署展示组件和样式；完成验证。
- 验证计划：`npm test`、`npm run lint`、`npm run typecheck`、`npm run build`，并检查不含网络调用。
- 技术风险：静态展示不得暗示为实时业务状态；通过显著“演示展示”标签限制误解。

## Implementation Report

- 改动摘要：待实现。
- 自审：待实现。
- 验证：待实现。
- 实际使用的 skill：待实现。
- 验证命令与结果：待实现。
- 未运行项与原因：待实现。
- 剩余风险：待实现。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待实现。
- 未通过项：待实现。
