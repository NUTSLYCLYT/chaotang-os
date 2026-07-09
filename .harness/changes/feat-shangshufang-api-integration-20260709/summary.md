# 变更摘要：feat-shangshufang-api-integration-20260709

| 字段 | 值 |
| --- | --- |
| Change ID | feat-shangshufang-api-integration-20260709 |
| 类型 | feat |
| 状态 | IMPLEMENTED |
| Owner | Project Agent |
| 创建日期 | 20260709 |

## 范围

- 主线：上书房页面后端 API 对接
- 事实源：`backend/web/routers/shangshufang.py`
- 前端边界：仅校正上书房接口口径、契约注释与 endpoint 展示，不改 UI 布局、视觉、组件结构或交互入口
- 后端范围：补齐上书房页面已有动作需要的 P0/P1/P2/P3 API，并追加回归测试

## 关键结果

- `home` 作为上书房首屏事实源，前端文案不再指向未实现的 `/briefing` endpoint。
- `home` 返回 200 但今日无待办时不再误标为 unavailable；401 登录态失效时不再误报为接口不可用，并会跳转到登录页后回到原上书房路径。
- `/swarm/sessions` 等蜂群读取统一走 `fetchLocalCourtApi`，复用 Bearer token 与 401 refresh/retry 链路。
- 裁决 action 兼容 `adopt`、`followup`、`recheck` 等前端既有动作，不再因 action 字面量不一致返回 422。
- 补齐 `swarm-deepen`、`pack-swarm-loop`、`finance-intel-loop`、`brief decision`、`polish-edict`、`im`、`edict-return`、`finance-status-memorial`、`research-budget-loop` 等页面调用 API。
- 后端测试和前端 TypeScript 校验已通过；Playwright 针对既有 3002 服务执行时命中 404 路由环境问题，未进入页面断言。
