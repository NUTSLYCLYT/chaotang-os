# 任务：钦天监决策雷达

## Status

Ready

## Product Definition

- 用户确认：2026-07-30，当前对话确认“有当前奏折时，系统教程退出主区域，只保留在帮助入口”，并要求新建 worktree 处理。
- 问题：上书房右抽屉仍为空白，无法围绕当前旨意提示时机、风险、未知与下一步验证。
- 目标用户：在 `/study` 拟旨、下旨或查看回奏的登录用户。
- 目标：把右抽屉改为状态驱动的钦天监决策雷达；无任务时提供使用帮助，有任务时只展示与当前决策有关的辅助信息。
- 非目标：不迁移 `feature-chaotang-ext` 的旧后端、mock 路由、预测概率、触发器持久化或独立钦天监聊天。

## Acceptance Criteria

- [ ] 无当前旨意时，右抽屉显示系统使用指导、示例问法，并清楚标记为“导览”。
- [ ] 输入旨意、生成拟旨、提交中、成功回奏或失败时，右抽屉切换为对应决策状态，教程不占据主区域。
- [ ] 有当前旨意时显示天时判断、关键未知、风险红线、改变判断的信号、最低成本验证与复核建议。
- [ ] 页面不伪造概率、外部事实、正式预测或执行状态。
- [ ] “问钦天监”入口打开右抽屉；移动端和键盘关闭行为保持可用。

## Delivery Constraints

- 范围：`frontend/`、本任务文件、对应设计与计划文档。
- 兼容性：保持 ADR 0028 的唯一执行入口；不得从钦天监直接下旨或触发调查。
- 风险与限制：本轮只有页面事实投影，不声称已接入正式预测服务。
- 技能计划：`using-git-worktrees`、`writing-plans`、`test-driven-development`、`verification-before-completion`、`codex-engineering-workflow`。
- Codex-only：是。

## Affected Modules

- 模块：上书房右侧钦天监决策辅助区。
- 允许路径：`frontend/src/app/study/`、`frontend/src/features/study-visual/`、上述文档路径。
- 依赖模块：现有 `DecreeUiState`、`ChancellorDraftResult`。

## Technical Plan

- 架构边界：用纯函数把页面事实投影为雷达视图模型；React 组件只渲染和处理抽屉交互。
- 接口与依赖：不新增网络端点；只消费现有旨意文本、拟旨结果和下旨 UI 状态。
- 实施顺序：先投影测试与实现，再接入抽屉，再补样式与集成守卫。
- 验证计划：目标 `node:test`、全量前端 test/typecheck/lint/build、harness。
- 技术风险：当前页面没有正式钦天监数据，因此所有未确认内容必须显示为问题或观察建议，而非结论。

## Implementation Report

- 改动摘要：新增纯函数决策雷达投影；右抽屉按导览、界定、拟旨、办理、回奏、阻断六种状态渲染；共享 Dock 的“问钦天监”通过 `/study#qintian` 打开雷达。
- 自审：未新增网络调用、概率、实时信号或执行入口；未修改 ADR 0028；左侧丞相咨询保持原契约。
- 验证：409 项前端测试、TypeScript、ESLint、Next.js production build 和 harness 均通过。
- 实际使用的 skill：`using-superpowers`、`brainstorming`、`using-git-worktrees`、`writing-plans`、`test-driven-development`、`verification-before-completion`、`codex-engineering-workflow`。
- 验证命令与结果：
  - `npm test`：PASS，409/409。
  - `npm run typecheck`：PASS。
  - `npm run lint`：PASS。
  - `npm run build`：PASS，`/study` production route 构建成功。
  - `node scripts/check_harness.mjs`：PASS，72 个基线文件。
  - `git diff --check`：PASS（仅 Windows 行尾提示）。
- 未运行项与原因：未运行真实模型、外部网络或生产部署；本切片不新增这些能力。
- 剩余风险：正式三情景推演、触发器持久化、到期复核和独立钦天监问策 API 尚未实现，必须在后续任务中建立后端契约后接入。

## Acceptance Review

- 验收结果：PASS（本任务定义的第一条可独立验收切片）。
- 验收证据：六态投影单测、右抽屉源码与样式守卫、Dock 锚点入口测试及全量门禁。
- 未通过项：无。
