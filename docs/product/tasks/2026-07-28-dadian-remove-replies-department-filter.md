# 任务：大殿移除回奏与部门筛选展示

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。

## Status

Implemented

## Product Definition

- 用户确认：当前用户于 2026-07-28 明确要求移除大殿中的“最新真实回奏”和“参与部门”。
- 问题：大殿当前同时承载概览、部门筛选和回奏列表，页面焦点过散。
- 目标用户：已登录的朝堂用户。
- 目标：大殿不再展示最新回奏列表或参与部门筛选；保留只读概览、真实状态提示和朝堂席位视觉。
- 非目标：不改变上书房、军机处、史馆职责；不删除后端概览 API、史馆归档数据或数据契约。

## Acceptance Criteria

- [ ] 大殿页面不出现“最新真实回奏”区块及其空态、列表内容。
- [ ] 大殿页面不出现“参与部门”筛选控件，且不再因页面交互发起部门筛选请求。
- [ ] 只读概览的加载、错误与已加载状态仍可用；不伪造新的数据或状态。
- [ ] 桌面端“丞相 · 今日要务”面板距窗口左侧 20px；移动端全宽布局不变。
- [ ] 大殿内容区使用全宽画布，不受共享壳层的 1600px 内容上限限制。

## Delivery Constraints

- 范围：仅大殿前端展示、控制器输入与关联测试；允许新增此任务记录。
- 兼容性：保持 `/dadian` 的登录保护和 BFF/后端概览契约不变。
- 风险与限制：工作区存在用户的未提交改动，不得修改无关文件。
- 技能计划：`brainstorming`、`test-driven-development`、`verification-before-completion`、`codex-engineering-workflow`。
- Codex-only：否。

## Affected Modules

- 模块：大殿只读概览。
- 允许路径：`frontend/src/app/dadian/`、`frontend/src/features/dadian-visual/`、`docs/product/tasks/2026-07-28-dadian-remove-replies-department-filter.md`。
- 依赖模块：史馆只读概览 BFF（保持不变）。

## Technical Plan

- 架构边界：仅移除前端消费和交互；不调整 `/api/v1/shiguan/dadian-overview`。
- 接口与依赖：保留现有概览读取，移除页面端部门参数和最近回奏渲染依赖。
- 实施顺序：先写展示边界测试并验证失败，再最小化移除页面组件、控制器与视图模型的未用数据，最后执行前端验证。
- 验证计划：目标测试、`npm test`、lint、typecheck、build。
- 技术风险：现有以源码守卫形式编写的视觉测试需同步更新，避免保留已删除 UI 的断言。

## Implementation Report

- 改动摘要：移除大殿部门筛选、最近回奏列表及其样式；移除页面端对应的 props 和视图模型投影。朝堂席位保留为不含统计与筛选的定位展示；桌面端“丞相 · 今日要务”面板定位为距左侧 20px；大殿通过既有 `fullBleedContent` 使用全宽内容区。
- 自审：未改动后端概览 API、BFF、登录保护或史馆归档契约；变更限于允许路径。
- 验证：目标测试、lint、构建和差异空白检查通过。
- 实际使用的 skill：`using-superpowers`、`brainstorming`、`test-driven-development`、`codex-engineering-workflow`、`verification-before-completion`。
- 验证命令与结果：`npm test -- src/features/dadian-visual/DadianScene.test.ts src/features/dadian-visual/dadianViewModel.test.ts`（6/6 通过）；`npm test -- src/features/dadian-visual/DadianScene.test.ts`（4/4 通过，含 20px 定位断言）；`npm run lint`（通过）；`npm run build`（通过）；`git diff --check -- frontend/src/app/dadian frontend/src/features/dadian-visual`（通过）。
- 未运行项与原因：全量 `npm test` 失败于用户既有的 `DevStudyWorkspace` 密旨模式残留测试；全量 `npm run typecheck` 同样失败于该文件的未定义 `mode`，均不在本任务允许路径内。
- 剩余风险：待上书房既有故障修复后再运行全量测试与类型检查。

## Follow-up: Dadian entry actions

- Confirmed on 2026-07-28: remove the Dadian-only `展开辅政` quick-dock handle while retaining it in other court scenes.
- Confirmed on 2026-07-28: make `殿前发令` enabled and route its click to `/study`; it does not submit an edict from Dadian.
- Confirmed on 2026-07-28: remove `钦天监`; retain nine seat modules and align each module center to a visible figure in `hall-stage-tang.webp`.
- Confirmed on 2026-07-28: position each retained module above the corresponding figure's head rather than over the figure's center.
- Corrected on 2026-07-28: use each figure's head as the hotspot anchor and let CSS position the card above that anchor; the arrow returns to the head position.
- Confirmed on 2026-07-28: move every retained head anchor down 1.5 percentage points (about 12px in the supplied 1920×911 view) so the arrow tip touches the corresponding head without changing horizontal alignment.
- Additional allowed paths: `frontend/src/features/court-visuals/` and `frontend/src/app/court-migration-assets.test.ts`.

## Follow-up implementation plan: asset-aligned seat anchors

**Goal:** Keep every Dadian seat-card arrow attached to the matching figure's hat top in the rendered hall background.

**Architecture:** The seat map will be a fixed, full-viewport overlay so its coordinate box is the same viewport used by the shell background. Its nine coordinates are calibrated from the background asset's visible hat positions at the desktop reference viewport; the existing arrow transform remains the card-local geometry that maps each coordinate to the arrow tip.

### Task 1: Capture the alignment contract

- [ ] Update `frontend/src/features/dadian-visual/DadianScene.test.ts` to require the fixed viewport asset stage and the nine calibrated anchors.
- [ ] Run `npm test -- src/features/dadian-visual/DadianScene.test.ts`; expected result before implementation: the asset-stage assertion fails.

### Task 2: Put hotspots in the background coordinate system

- [ ] Update `frontend/src/features/dadian-visual/DadianScene.module.css` so `.courtMap` is fixed to the viewport and `.hotspots` share that full viewport box, while remaining beneath the header and dock interaction layers.
- [ ] Update `frontend/src/features/dadian-visual/DadianScene.tsx` with the nine independent hat-top anchor coordinates; do not change the arrow transform.
- [ ] Re-run the Dadian test; expected result: all assertions pass.

### Task 3: Independent acceptance

- [ ] Run lint and production build.
- [ ] Independently inspect the changed CSS coordinate chain and compare a 1920×911 screenshot with the hat-top acceptance rule.

## Acceptance Review

- 验收结果：Pending
- 验收证据：目标测试、lint、构建和变更自审已完成；等待用户确认页面效果。
- 未通过项：全量测试与类型检查受上书房既有故障阻断。
