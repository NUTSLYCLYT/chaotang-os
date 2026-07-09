# 任务：feat-shangshufang-api-integration-20260709

## 任务 1：P0 主闭环对齐

- 目标：修通上书房首屏与裁决主链路。
- 输入：`home/briefing` 口径差异、裁决 action 字面量差异。
- 输出：前端 endpoint 展示统一到 `home`，后端裁决 API 兼容页面既有 action。
- 验收：`adopt`、`followup`、`recheck` 等 action 不返回 422；`home` 能读到待裁决和待补证任务。

## 任务 2：补齐页面已有增强 API

- 目标：让页面上已有按钮背后有真实后端路由。
- 输入：`swarm-deepen`、`pack-swarm-loop`、finance-intel、brief decision、polish、IM、edict-return 等调用。
- 输出：新增/补齐对应后端 endpoint，返回页面可消费的结构。
- 验收：测试覆盖新增路由，能力不足时如实返回 `FALLBACK` 或 `MIXED`。

## 任务 3：验证与审计记录

- 目标：证明跨前后端对接可回归。
- 输入：后端 pytest、前端 tsc、Playwright、根级 harness doctor。
- 输出：`ci_result/ci_summary.md` 与本 change 记录。
- 验收：已通过命令记录清楚；未通过命令说明真实阻塞原因。
