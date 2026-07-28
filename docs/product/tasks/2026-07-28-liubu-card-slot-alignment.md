# 任务：六部总览卡片对齐到背景框位

> 本任务遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；不改变下旨、证据、回奏和归档主流程。

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-28 通过“自动交付”委托完成；并在 Harness 预检阻断后，明确授权补齐无关任务的允许路径。
- 问题：`/liubu` 的六张部门卡片没有落入背景图中对应的六个暗色框位；此前为消除双层背景而移除场景图层后，背景与卡片使用了不同坐标系。
- 目标用户：在桌面端浏览六部政务分域的朝堂 OS 用户。
- 目标：仅在 `/liubu` 让单一背景图、暗色框位与六张部门卡片共享同一布局坐标；卡片分别进入左上、左中、左下、右上、右中、右下框位，并保持无居中弹窗、无额外蒙层、无悬停时滚动条切换造成的页面抖动。
- 非目标：不改变六部数据、路由、认证/BFF、下旨和史馆业务契约；不重新生成背景图；不引入第二张背景图或独立的 `sceneMap` 图层。

## Acceptance Criteria

- [ ] 在 1920×912 浏览器视口的 `/liubu` 页面中，吏部、兵部、工部卡片分别进入左上、左中、左下暗色框位；户部、礼部、刑部卡片分别进入右上、右中、右下暗色框位，卡片边框不越出各自暗色框。验收以背景图可见发光边界内的实际安全槽位为准，而非只验证旧的人工坐标公式。
- [ ] 页面只渲染一层六部背景图；`ministries-module__x_2v1W__sceneMap` 不存在，背景图无额外蒙层。
- [ ] 鼠标移入/移出页面不新增或移除垂直滚动条，内容区宽度不发生跳变。
- [ ] 相关自动化测试、lint、类型检查和 Harness 通过；在浏览器中实际截图/DOM 验收布局。

## Delivery Constraints

- 范围：仅限六部视觉场景、其共享沉浸壳的最小必要代码、对应测试与本任务文件。
- 兼容性：保留现有 `/liubu` 六部目录、只读回奏投影、顶部导航和底部快捷栏。
- 风险与限制：共享 `ImmersiveCourtShell` 被其他页面复用，任何改动必须由测试证明不改变非六部页面默认表现；不访问真实模型、不创建外部资源、不提交或推送。
- 技能计划：`systematic-debugging`、`test-driven-development`、`verification-before-completion`、`codex-engineering-workflow`、`product-flow`。
- Codex-only：否。

## Affected Modules

- 模块：六部总览单背景布局与卡片框位。
- 允许路径：`frontend/src/features/ministries-visual/**`、`frontend/src/features/court-visuals/ImmersiveCourtShell.tsx`、`frontend/src/features/court-visuals/ImmersiveCourtShell.module.css`、`frontend/src/features/court-visuals/types.ts`、`frontend/src/features/court-visuals/courtVisuals.test.ts`、`frontend/public/assets/zhuangyuan/04-zhuangyuan-liubu-routes.png`、`docs/product/tasks/2026-07-28-liubu-card-slot-alignment.md`。
- 依赖模块：`ImmersiveCourtShell`、既有六部目录与只读回奏投影（只读）。

## Technical Plan

- 架构边界：背景仍仅由 `ImmersiveCourtShell` 渲染；六部场景新增透明坐标平面，尺寸复刻背景图在 viewport 中 `cover` 后的尺寸，卡片仍以源图坐标百分比定位。
- 接口与依赖：不改数据、路由或共享 Shell 的默认行为；`ImmersiveCourtShell` 仅作为现有单背景提供者。
- 实施顺序：先新增会失败的源码守护断言；实现坐标平面和 `border-box` 热点；运行目标测试与前端质量检查；最后以 1920×912 浏览器 DOM/截图验收位置与滚动条稳定性。
- 验证计划：目标 `node:test`、`npm run lint`、`npm run typecheck`、Harness；浏览器比较六卡 `getBoundingClientRect()` 与按 cover 公式计算的框位，容差不超过 1px。
- 技术风险：小屏布局按现有媒体查询保持；坐标平面不含 `<img>`、`background-image` 或 `sceneMap`，避免重现双层背景。

### Rework 2 — visual-slot correction

- 已确认根因：旧 `MINISTRY_BOXES` 假设三排卡片高度相近，导致顶部（约 60px）、中部（约 92px）和底部（约 147px）的真实暗框被卡片越界覆盖；`cover` 坐标平面本身保持不变。
- 方案：改用六个图像空间安全槽位，并按 top/middle/bottom 三种信息密度渲染；顶部仅保留标题与只读标识，中部紧凑指标，底部保留完整指标。所有卡片边界必须留在亮线路径围出的暗框内。
- 回归测试：先写会失败的源图槽位/密度守护测试，再实现；浏览器以坐标反算及截图双重验收，并复测悬停前后的滚动条稳定性。

## Implementation Report

- 改动摘要：六张卡片移入透明 `.sceneCoordinates` 坐标平面；该平面以整个 viewport 居中，并按 1672×941 源图的 `cover` 尺寸计算。热点继续使用源图坐标百分比，且采用 `box-sizing: border-box`，因此和 shell 唯一背景图使用同一坐标系。
- 自审：未新增 `<img>`、`background-image`、`sceneMap` 或额外蒙层；`ImmersiveCourtShell` 仍是唯一背景提供者。保留现有六部数据、路由、顶栏和快捷栏。
- 验证：目标源码测试、共享 Shell 测试、lint、类型检查和 Harness 均通过；浏览器在 1920×912 下逐卡比对 cover 公式，六卡最大误差小于 0.02px；鼠标移入/移出前后 `innerWidth`、`clientWidth`、`scrollHeight` 和所有卡片矩形完全一致。
- 实际使用的 skill：`using-superpowers`、`product-flow`（Codex 接力）、`systematic-debugging`、`test-driven-development`、`codex-engineering-workflow`、`verification-before-completion`、浏览器验收技能。
- 验证命令与结果：`node --test --test-name-pattern="overview uses the shell background only" src/features/ministries-visual/ministriesVisual.test.ts`（1/1 通过）；`node --test src/features/court-visuals/courtVisuals.test.ts`（6/6 通过）；`npm run lint`（通过）；`npm run typecheck`（通过）；`node scripts/check_harness.mjs`（通过）；`git diff --check -- src/features/ministries-visual docs/product/tasks/2026-07-28-liubu-card-slot-alignment.md`（通过）。
- 未运行项与原因：全量 `npm test` 有两项既存/并行失败，均不在允许路径内：陈旧迁移测试仍要求旧六部背景图，以及跨模块断言错误要求 `JunjichuScene.tsx` 直接包含实际位于 `junjichuProjection.ts` 的符号。
- 剩余风险：当前浏览器验收覆盖 1920×912 桌面视口；小屏仍遵循既有媒体查询，未在本任务中改变。

### Rework 2 acceptance

- Result: Accepted.
- The prior uniform card heights crossed the visible glowing boundaries. The six cards now use the actual source-image safe slots with compact, condensed, and full densities.
- At 1920×912, fresh browser screenshot and DOM coordinate checks show all six cards within their respective dark slots; there is one background layer, no veil, and no `sceneMap`.
- Fresh checks passed: targeted regression 1/1, shell tests 6/6, lint, typecheck, Harness 72/72, and scoped `git diff --check`.
- Browser dimensions remained stable: `innerWidth/clientWidth=1920`, `scrollHeight/clientHeight=912`; no vertical scrollbar or layout jump.

## Acceptance Review

- 验收结果：Reopened — 用户在上一轮“Accepted”后明确反馈页面仍未修复。此前验收只证明卡片与人工填写的源图坐标公式一致，不能证明卡片视觉上完整落入背景中实际可见的六个暗色框位；该验收结论作废。
- 验收证据：
  - [x] 1920×912 浏览器实测六张卡片全部命中对应背景框位；坐标误差小于 0.02px。
  - [x] DOM 实测 `.sceneCoordinates` 数量为 1，`img[src*="liubu-routes"]` 数量为 0；源码守护同时确认无 `sceneMap`、额外背景或蒙层。
  - [x] 悬停前后视口和六张卡片矩形完全一致，`scrollHeight` 等于 `clientHeight`，未出现纵向滚动条切换。
  - [x] 目标测试、共享 Shell 测试、lint、类型检查和 Harness 均有本次通过证据。
- 未通过项：全量前端测试的两项既存/并行失败已记录在 Implementation Report，未影响本任务允许路径内的验证。
