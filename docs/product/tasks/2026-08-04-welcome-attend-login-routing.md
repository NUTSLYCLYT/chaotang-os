# 任务：欢迎页“上朝”动画后进入登录页

## Status

Ready

## Product Definition

- 用户确认：2026-08-04 明确选择“保留开门动画，播放后跳到登录页”。
- 问题：欢迎页“上朝”当前在动画结束或播放失败后进入 `/register`，与期望入口不一致。
- 目标：所有“上朝”过场完成出口统一进入 `/login`。
- 非目标：不修改登录、注册、认证、视觉样式或不可变业务流基线。

## Acceptance Criteria

- [ ] 点击“上朝”后继续播放现有开门动画。
- [ ] 动画自然结束后通过历史替换进入 `/login`。
- [ ] 视频加载、播放或自动播放失败时同样进入 `/login`。
- [ ] 两个现有直接登录入口保持不变。
- [ ] 欢迎页相关测试、前端检查、build 与仓库 harness 通过。
- [ ] 同一最终版本连续通过 10 轮完整最终验收。

## Delivery Constraints

- 允许路径：`frontend/src/features/welcome/WelcomeGate.tsx`、`frontend/src/features/welcome/*.test.ts`、本任务文档、对应设计与实施计划文档。
- 保持 `welcomeTransition.ts`、视觉资源、认证 API 和 ADR 0028 不变。
- 技能计划：`brainstorming`、`writing-plans`、`test-driven-development`、`codex-engineering-workflow`、`verification-before-completion`。
- 不调用 Claude CLI、Claude runner 或 `gstack-claude`。

## Affected Modules

- 模块：欢迎页开门过场与入口导航。
- 允许路径：`frontend/src/features/welcome/WelcomeGate.tsx`、`frontend/src/features/welcome/*.test.ts`、本任务文档、对应设计与实施计划文档。
- 依赖模块：Next.js `useRouter` 与现有欢迎页状态机；仅复用，不修改其公共接口。

## Technical Plan

- 先将欢迎页契约测试改为期待 `/login` 并确认 RED。
- 再让自然结束、视频错误和播放拒绝复用同一登录导航入口并确认 GREEN。
- 自审后执行定向测试、前端全量检查、build、harness 与连续 10 轮最终验收。

## Implementation Report

- 改动摘要：欢迎页“上朝”仍先进入 `opening` 并播放现有视频；自然结束、`onError` 和 `video.play()` 拒绝现在都通过 `router.replace("/login")` 进入登录页。状态机、样式、资源、认证接口和两个直接登录链接未修改。
- TDD：RED 时定向测试 0/1 PASS、1 FAIL，失败原因为组件没有过场 `/login` 导航；最小实现后 GREEN 为 2/2 PASS。
- 验收过程修正：首次第 1 轮在前端 lint、typecheck、test、build 通过后，harness 因本任务文档缺少 `## Affected Modules` 失败；补齐模板必填章节并单独确认 harness 通过后，按规则从第 1 轮重新计数。
- 最终验收命令集：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`node scripts/check_harness.mjs`、`node scripts/check_harness.mjs --self-test`、`node .agents/hooks/check-harness.mjs --self-test`、`node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`、`git diff --check`。

| 轮次 | lint | typecheck | test | build | harness | harness self-test | hook self-test | runner self-test | diff check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 |
| 2 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 |
| 3 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 |
| 4 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 |
| 5 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 |
| 6 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 |
| 7 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 |
| 8 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 |
| 9 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 |
| 10 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 | PASS/0 |

- 自审：限定 diff 只含欢迎页两个导航字面量、对应契约断言和本任务文档；未覆盖工作区已有并行后端改动。
- 未运行项：未执行浏览器人工点击验收；自动化契约测试覆盖动画事件绑定和三个失败/完成出口的统一目的地。
- 剩余风险：静态源码契约测试未模拟浏览器媒体事件的真实时序，但现有 `onEnded`、`onError` 与播放拒绝绑定保持不变。

## Acceptance Review

- 验收结果：Pending
- 验收证据：实现与自动化验证证据见 `Implementation Report`。
- 未通过项：等待产品验收；未执行浏览器人工点击验收。
