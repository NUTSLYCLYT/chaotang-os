# G3 结果案例入口（2026-10-07）

## Status

Ready

## Product Definition

用户登录后首先看到可获得的结果案例，而不是只看到 Agent 名称或抽象场景。沿用现有大殿视觉和场景卡数据，把每张卡的标题、结果价值、真实/占位边界和下一步动作说清楚；点击仍进入原有场景执行页或样例输入，不改变后端执行能力。

## Acceptance Criteria

- [ ] 案例区使用“结果案例”语义，并说明用户将获得的结果。
- [ ] 每张卡同时展示价值、适用人群、真实链路/占位链路状态和明确动作。
- [ ] 真实链路卡的动作仍进入原场景，样例动作仍使用原 demo 入口。
- [ ] 不新增模型调用、网络访问、任务系统、权限、后端 API 或路由。
- [ ] 结果案例专项测试、前端全量测试、类型检查、lint 和根 Harness 通过。

## Delivery Constraints

只修改本任务列出的两个前端文件；保留 `SceneStrategyPanel` 既有数据、路由、视觉 token 和后端回退语义。占位链路必须继续显式标注，不得把 demo 或 stub 显示为真实能力。

## Affected Modules

- 模块：大殿结果案例入口。
- 允许路径：`frontend/src/features/scene-packs/SceneStrategyPanel.test.ts`、`frontend/src/features/scene-packs/SceneStrategyPanel.tsx`。
- 依赖模块：现有 scene-pack API、`/scene-pack/[slug]` 和 `?demo=1` 路由（保持不变）。

## Technical Plan

在现有 `SceneStrategyPanel` 中把区块标题和辅助文案改为结果导向；卡片增加“你将得到”标签和可读的状态/动作文案；补充源码级契约测试，锁定真实/占位边界、原路由和无空动作。测试不启动浏览器、不调用模型、不访问外网。

## Implementation Report

待产品子提交后填写实际改动、测试命令、开始/结束时间和未验证项。

## Acceptance Review

待翰林院复核；若任一结果标签与实际后端 `implementationStatus` 不一致，退回 Ready，不扩大范围。

## Rollback

回退到父提交 `f059404dd689d44b15e14e4c1184c833a618d0f6`；无数据迁移、无外部状态写入。
