# G3 锦衣卫透明分发视图 successor（2026-10-07）

## Status

Ready

## Product Definition

在既有真实只读调查数据上展示“事实 → 证据 → 回奏”的透明分发视图，并为目录读取失败提供明确的重新读取入口。视图只读取服务端校验的案卷详情，不新增调查、写入、模型调用或权限入口。

## Acceptance Criteria

- [ ] 仅由真实 JinyiweiDetail 的 equiredFacts、videnceByFact、esolvedFacts 和 doptions 计算展示行。
- [ ] 每个事实明确显示证据数量、核验状态和关联回奏数量；没有证据时显示“尚无证据”，不得推断结论。
- [ ] 目录读取失败时提供明确的“重新读取案卷目录”操作，并显示加载反馈。
- [ ] 未选案卷、详情加载中或详情失败时不显示伪造分发数据。
- [ ] 组件契约测试、前端全量测试、构建、类型检查、lint 和根 Harness 通过。

## Delivery Constraints

只修改本任务登记的锦衣卫前端组件和测试；沿用现有只读 API 与结果契约，不新增 API、路由、权限、数据库、模型调用、外部网络或桌面窗口操作。

## Affected Modules

- 模块：锦衣卫只读案卷台、事实分发展示与对应契约测试。
- 允许路径：rontend/src/features/jinyiwei-visual/JinyiweiScrollDesk.tsx、rontend/src/features/jinyiwei-visual/JinyiweiScrollDesk.module.css、rontend/src/features/jinyiwei-visual/jinyiweiDispatch.ts、rontend/src/features/jinyiwei-visual/JinyiweiScrollDesk.test.ts。

## Technical Plan

1. 保持现有纯函数，补充稳定的状态文案函数并由组件复用。
2. 在案卷目录请求失败态提供一次明确、可重复的重新读取入口。
3. 用测试锁定空证据、未解决事实、重复回奏和状态文案边界。

## Implementation Report

待产品子提交后填写实际改动、测试命令、开始/结束时间和未验证项。

## Acceptance Review

翰林院需确认：展示值全部来自现有只读案卷契约；重试只重新读取目录，不改变调查状态；视图不写入结果账，也不把“有页面”当成真实调查执行。

## Rollback

回退产品子提交到批准父提交 d863b3e88f0fe8d60e0ab40fd54ba7591087ca9b；无数据迁移和外部状态写入。

