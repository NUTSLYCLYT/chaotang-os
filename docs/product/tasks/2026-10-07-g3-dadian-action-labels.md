# G3 大殿席位动作文案（2026-10-07）

## Status

Ready

## Product Definition

客户从大殿进入朝堂功能时，必须能从席位文案直接理解点击后的结果。大殿席位继续沿用现有朝堂视觉和路由，只把模糊的“席位展示”改为目标明确的动作。

## Acceptance Criteria

- [ ] 每个席位显示与目标页面对应的动作文案。
- [ ] 按钮 `aria-label` 同时包含席位名称和动作。
- [ ] 原有路由、席位坐标和后端调用保持不变。
- [ ] 大殿专项测试、前端全量测试、类型检查和根 Harness 通过。

## Delivery Constraints

只修改本任务列出的两个前端文件；不改变后端 API、认证、权限、任务系统、模型调用、网络访问、视觉主题或桌面行为。

## Affected Modules

- 模块：大殿席位导航与可访问标签。
- 允许路径：`frontend/src/features/dadian-visual/DadianScene.test.ts`、`frontend/src/features/dadian-visual/DadianScene.tsx`。
- 依赖模块：现有 `/study`、六部、锦衣卫和史馆页面路由（保持不变）。

## Technical Plan

为 `DevHotspot` 增加动作标签；按席位用途配置“进入部堂”“前往上书房”“查阅案卷”“查阅归档”等文案；将文案同时用于可见辅助文本和按钮 `aria-label`。新增源码契约断言，确保九个席位均有明确动作且现有 href 不变。

## Implementation Report

待产品子提交后填写实际改动、测试命令、开始/结束时间和未验证项。

## Acceptance Review

待翰林院复核；未通过时退回 Ready，不扩大范围。

## Rollback

回退到父提交 `28bef27b5d030883fbd29100f3c045f3e434ed73`；本变更无数据迁移。
