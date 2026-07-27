# 上书房 `/study` UI 迁移设计

## 范围

以当前受保护的 `/study` 为唯一入口，只迁入 `dev` 上书房的三项真实视觉元素：公共头部、实体卷轴和场景背景图。当前下旨表单、`DecreeUiState` 状态映射、BFF 路由和登录保护全部保留，并在实体卷轴内呈现。

## 方案选择

选择“真实视觉元素迁移 + 保留现有下旨逻辑”。

- 不复制 `dev` 的 `ShangshufangPage` 或完整 `MemorialScroll`：二者依赖旧认证、SWR、Tailwind、lucide、多个已不存在的 API 和业务流程。
- 不新增 `/shangshufang`：避免产生两个不同行为的上书房入口。
- 不再重建三栏工作台、Dock 或侧栏：它们不在本次用户确认的范围内。

## 页面结构

`StudyPage` 继续在服务端调用 `requireUser('/study')`，然后渲染客户端的 `StudyClient`。`StudyClient` 将使用三个展示责任明确的单元：

1. `ChaotangHeader`：从 `dev` 的 `ChaotangTopNav` 抽取其徽记、深色玻璃背景、中央导航和金色活动态的视觉结构；只保留静态 `Link`，不读取或写入鉴权状态，也不保留旧 API、时钟、弹层和通知行为。
2. `EdictScrollShell`：从 `dev` 的 `EdictStage` 抽取卷轴轴、云纹边、纸张纹理和印章式标题的呈现结构；仅接受 React children，不了解旨意数据或后端。
3. `StudyDecreeWorkspace`：作为卷轴 children 承载原有 textarea、提交按钮和所有 `DecreeUiState` 展示。现有 `data-testid`、请求体、错误处理与结果字段不变。

页面不再渲染侧栏、Dock 或模拟数据。背景使用 `dev` 的 `bg-shangshufang-full.webp` 本地资产，以覆盖层保证卷轴正文可读；窄屏中卷轴可自然纵向滚动。

## 数据流与错误处理

浏览器仍只在用户点击时调用同源 `POST /api/decrees/chancellor`。加载、成功和失败状态完全继续由 `decreeStatus.ts` 映射。Header 和视觉壳无网络、副作用或本地存储；401 的既有跳转保持原样。

## 样式与资产

将 `dev` 的 `frontend/public/shangshufang/bg-shangshufang-full.webp` 复制为当前工作区的本地资源，并用组件本地 CSS（CSS Module）实现 Header 和卷轴，避免污染欢迎页、登录页和其他业务页面。不引入外部资源或新包。

## 验收与验证

- 保留 `/study` 登录保护、下旨请求和全部既有测试选择器。
- 页面包含真实背景图路径、朝堂 Header 和卷轴结构；输入、按钮与回奏均位于卷轴内。
- 页面 HTML 含“上书房”、下旨按钮和费用提示；构建后 `/study` 返回 200（在提供有效会话的合适验证环境中，或通过服务端页面契约验证登录保护）。
- 运行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。
- 不在烟雾验证中提交旨意，避免模型调用费用。

## 非目标

本次不会复制 `dev` 的旧 Header 行为、账号状态、SWR 数据加载、会审、群集进度、资源库、弹窗、旧 API、Tailwind 类名、三栏工作台或底部 Dock；不会修改后端或认证语义。
