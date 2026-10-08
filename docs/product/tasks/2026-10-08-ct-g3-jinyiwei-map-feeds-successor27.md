# 任务：锦衣卫全球证据地图与受控 Feed 目录（successor27）

## Status

In Progress

## Product Definition

- 将跨案卷证据 `coverage` 聚合为只读全球证据覆盖投影。
- 将批准来源注册表以只读目录提供给锦衣卫前端，默认空注册、默认不抓取。
- 在现有真实性案牍台中展示区域、证据数量、来源状态、冲突和来源许可边界。

## Delivery Constraints

- 只修改 manifest 指定路径。
- 地图只展示证据声明的区域名称，不推断经纬度或个人位置。
- Feed 目录只读，不启用网络抓取、重定向跟随、登录绕过或未知域名。
- 所有聚合结果必须保留调查 ID、证据 ID、时间、可信度和冲突状态。
- 不改变 ADR 0028、史馆采纳链路和外网默认关闭边界。

## Acceptance Criteria

- [ ] 所有者只能看到自己调查的覆盖点。
- [ ] 区域聚合可追溯到调查 ID 和证据 ID。
- [ ] Feed 目录能展示许可、robots、速率限制和来源指纹。
- [ ] 默认注册表为空时前端明确显示“未启用外部 Feed”。
- [ ] 地图不显示未声明的坐标或模型推测。
- [ ] 后端 API、BFF、前端 build/lint/test/typecheck 全部通过。

## Implementation Report

- 改动摘要：Pending
- 验证：Pending
- 剩余风险：真实 Feed 采集与新闻事件聚类需另行审批，不在本阶段启用。
