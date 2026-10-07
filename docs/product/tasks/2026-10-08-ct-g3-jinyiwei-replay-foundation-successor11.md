# 任务：锦衣卫可回放证据工作流基础层（successor11）

## Status

In Progress

## Product Definition

- 用户已明确授权“全部授权批准”，要求最终看到完整可验收结果。
- 目标：建立不可变调查事件账本、确定性离线回放、解释性 replay diff 和可恢复长任务 graph 基础，同时保持 ADR 0028 边界。
- 非目标：新闻抓取、地图 UI、外网开关、Temporal、OpenFGA、公开部署和前端路由改造。

## Delivery Constraints

- 仅修改 approval manifest 指定的锦衣卫后端和新增测试路径。
- 主 jinyiwei.sqlite3 schema/fingerprint 保持兼容；回放和长任务使用同域 sidecar。
- 不启用外网，不保存正文或凭据，不新增通用调查入口。

## Affected Modules

- 锦衣卫模型、存储、协调器、只读 API、离线回放和 graph 状态机。
- 依赖 ADR 0028、司级证据协议和现有史馆采纳链路。

## Technical Plan

- RED 测试 → 事件账本 → sidecar schema → deterministic replay → replay diff → long-task graph → 只读 API → 回归验证。
- 回放不调用网络、MCP 或模型；长任务用幂等键、checkpoint 和 optimistic version 收口并发。

## Acceptance Review

- 验收结果：Pending
- 验收证据：Pending
- 未通过项：Pending
