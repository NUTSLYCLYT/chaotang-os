# 05 Role Agent Mapping

本文件目的：把前端朝堂角色和后端蜂群、flow、agent 对齐，避免产品信息架构和后端实现脱节。
优先级：P0/P1。P0 只要求丞相、军机处、史官、刑部、工部支撑裁决闭环；其余角色先作为 P1 展示入口。

前端展示的是朝堂角色；后端运行的是蜂群、flow、agent。上线前必须桥接，避免老板看到后台实现细节。

## 能做什么

- 建立前端展示名和后端职责的统一字典。
- 标注每个角色是否 P0 必需、是否已落地、缺什么。
- 指导前端不要把后台蜂群列表直接当产品导航。

## 不能做什么

- 不能把 17 个后台蜂群全部暴露给老板用户。
- 不能让前端角色名和后端 flow_id 各自演化。
- 不能把未落地 flow 包装成已可执行能力。

## 角色映射

| 前端角色 | 后端职责 | P0 必需 | 说明 |
|---|---|---|---|
| 丞相 | Orchestrator / Planner / Priority Judge | 是 | 总判、分流、减负 |
| 军机处 | Multi-Agent Council / Review Board | 是 | 多角色会审、分歧呈现 |
| 史官 | Archive / Audit / Memory | 是 | 归档、旧案引用、审计 |
| 锦衣卫 | Intelligence / Risk / External Signals | P1 | 情报与信源核验 |
| 钦天监 | Forecast / Trend / Prediction | P1 | 趋势与情景预测 |
| 太医署 | System Health / Ops Health / Asset Health | P1 | 系统与资产健康 |
| 户部 | Finance / Budget / ROI Agent | P1 | 财务边界 |
| 吏部 | HR / Org / Task Ownership Agent | P1 | 组织和责任人 |
| 礼部 | Brand / PR / Customer Relation Agent | P1 | 对外表达和审稿 |
| 兵部 | Security / Ops / Incident Agent | P1 | 运维、安全、应急 |
| 刑部 | Legal / Compliance / Risk Gate Agent | 是 | 高风险复核 |
| 工部 | Engineering / Release / Quality Agent | 是 | 质量、发布、工程验收 |

## 每个角色要补齐的字段

- `frontendName`
- `agentId`
- `flowId`
- `configPath`
- `isP0Required`
- `status`: `landed | partial | missing`
- `nextTask`

## 铁律

前台只暴露部门、圣旨、奏折、证据、风险和下一步；不把 17 个后台蜂群直接当成产品信息架构。

## 验收标准

- P0 角色都有明确后端职责和当前状态。
- 每个角色都能回答：前端显示什么、后端调用什么、缺口是什么、下一步做什么。
- 未落地能力在 UI 中只能显示为规划、入口或待接入，不能显示为已执行成功。

## 后续 Codex 可执行任务

```text
你是 CourtOS 角色与蜂群映射审查官。
只读检查前端角色/页面命名、后端 registry/flow 命名和 docs/courtos_launch/05_ROLE_AGENT_MAPPING.md。
输出一张 frontendName、agentId、flowId、configPath、isP0Required、status、nextTask 表。
不要修改代码，不要启动服务，不要触发真实蜂群。
```
