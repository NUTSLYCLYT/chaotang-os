# 任务：迁移上书房视觉外壳与通用 Header

## Status

Ready

## Product Definition

- 用户确认：2026-07-23；将 `dev` 的上书房视觉外壳迁入现有 `/study`，选择“视觉外壳复用 + 保留现有下旨逻辑”。
- 问题：当前 `/study` 已具备可靠的登录保护和下旨反馈，但界面仍是简版表单，无法呈现 `dev` 上书房的三栏工作台与统一导航体验。
- 目标用户：已登录、需要拟旨并查看丞相回奏的朝堂用户。
- 目标：在不改变 `/study` 的身份验证、BFF 请求和下旨结果契约的前提下，迁入 `dev` 的公共头部、实体卷轴和场景背景图；下旨输入与回奏置于卷轴内。
- 非目标：复制 `dev` 的旧鉴权、SWR、Tailwind、旧 API、会审/群集工作流、三栏工作台或底部 Dock；新增后端接口、依赖或业务行为；新增第二个上书房路由。

## Acceptance Criteria

- [ ] 受保护的 `/study` 保持现有登录跳转与 `POST /api/decrees/chancellor` 下旨行为不变。
- [ ] `/study` 展示与 `dev` 对齐的朝堂公共 Header、实体卷轴和场景背景；输入、下旨按钮和回奏均在卷轴内，窄屏可纵向使用。
- [ ] 旨意输入、处理中、成功和失败状态继续可用，并保留现有 `data-testid` 契约。
- [ ] 新 UI 不调用 `dev` 的旧认证或业务 API，不新增运行时依赖。
- [ ] 前端 lint、typecheck、测试、构建和 `/study` 的生产入口烟雾验证通过。

## Delivery Constraints

- 范围：仅 `frontend/src/app/study/**`、`frontend/src/components/chaotang/**`、`frontend/src/features/study/**`、必要的本地静态资源、对应测试、任务与设计/计划文档。
- 兼容性：Next.js App Router、React、TypeScript、现有 `node:test`；保留 `requireUser`、下旨 BFF 与后端响应格式。
- 风险与限制：`dev` 的上书房入口约 300 KB，深度耦合已移除的认证和 API；本任务只迁移视觉结构，不复制不可兼容逻辑。
- 技能计划：`brainstorming`、`writing-plans`、`test-driven-development`、`verification-before-completion`。
- Codex-only：是；不使用 Claude CLI、Claude runner 或 `gstack-claude`。

## Affected Modules

- 模块：上书房背景、共享朝堂 Header、实体卷轴、现有下旨表单及回奏渲染。
- 允许路径：`frontend/src/app/study/**`、`frontend/src/components/chaotang/**`、`frontend/public/shangshufang/bg-shangshufang-full.webp`、对应测试、`docs/product/tasks/2026-07-23-study-shangshufang-ui-migration.md`、`docs/superpowers/specs/2026-07-23-study-shangshufang-ui-migration-design.md`、`docs/superpowers/plans/2026-07-23-study-shangshufang-ui-migration.md`。
- 依赖模块：`frontend/src/lib/requireUser.ts`、`frontend/src/app/api/decrees/chancellor/route.ts`、`frontend/src/app/study/decreeStatus.ts`（只读契约依赖）。

## Technical Plan

- 架构边界：修订设计待重新规划；展示层与下旨状态映射分离，展示层不得直接访问后端。
- 接口与依赖：复用当前 `StudyClient` 的 `fetch('/api/decrees/chancellor')` 和 `DecreeUiState`；不引入 `dev` 依赖。
- 实施顺序：先锁定展示状态和 DOM 契约测试，再实现 Header、视觉壳和响应式布局，最后把现有表单接入中心工作区。
- 验证计划：定向测试、全量前端 lint/typecheck/test/build，以及构建后的 `/study` HTTP 200 烟雾检查；不点击下旨，避免真实模型调用。
- 技术风险：视觉复刻可能挤压已有结果内容；通过中心区域可滚动、侧栏在窄屏折叠和仅使用本地 CSS 降低风险。

## Implementation Report

- 改动摘要：迁入 `dev` 的 `bg-shangshufang-full.webp` 原始背景资产；以 `ChaotangTopNav` 的纯视觉结构重建公共 Header（完整导航节奏、团龙徽记、74px/88px 槽位）；以 `EdictStage` 的纯视觉结构实现外置金木轴、玉端帽、纸面纹理、云纹、钤印与动效。现有输入、下旨与回奏置入卷轴。
- 自审：仅 `/study` 和 `/shiguan` 是可用链接；其他 dev 导航为 `aria-disabled` 静态视觉项，未新增路由或业务行为。未引入旧认证、API、SWR、Tailwind、lucide、三栏、Dock 或侧栏。前一版无用状态模型已移除。
- 验证：多 Agent 视觉、契约与最终复核均通过；最终复核没有未解决的 Critical 或 Important 问题。
- 实际使用的 skill：`brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`verification-before-completion`。
- 验证命令与结果：`npm run lint` 通过；`npm run typecheck` 通过；`npm test` 107/107 通过；`npm run build` 通过；`node scripts/check_harness.mjs` 通过（53 个基线文件）；`git diff --check` 通过。卷轴与 Header 的定向 TDD 测试均经过 RED/GREEN。
- 未运行项与原因：未提交旨意，避免真实模型调用；最终独立端口入口烟雾启动受本机已有服务/端口环境影响，未将其视作页面缺陷；此前构建产物的未登录 `/study` 已验证为 307 重定向至 `/login?next=%2Fstudy`。
- 剩余风险：没有真实会话可用于浏览器截图，受保护路由下的最终视觉仍需在登录后人工确认；所有样式与构建验证均已完成。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待实施。
- 未通过项：待实施。
