# 任务拆解

## 任务 1：统一任务身份

- 目标：下旨成功后绑定真实 task_id。
- 输入：draft/confirm 回执。
- 输出：URL、active memorial、合同面板使用同一 task_id。
- 验收：真实 E2E 断言 URL 与 data-task-id。
- 依赖：上书房 confirm-edict API。

## 任务 2：canonical 展示优先级

- 目标：正式回奏优先于草拟/PACK 临时覆盖。
- 输入：canonical EdictView 与旧展示状态。
- 输出：标题、状态、来源一致。
- 验收：canonical kind/source 单测与浏览器回归。
- 依赖：canonical memorial projection。

## 任务 3：测试隔离

- 目标：真实 E2E 默认不运行、不污染共享后端。
- 输入：显式 RUN_REAL_LOOP=1 与可配置 URL。
- 输出：opt-in real-loop spec。
- 验收：默认收集时 skip，显式运行时通过。
- 依赖：隔离本地 3002/8081。
