# 任务：锦衣卫可回放证据工作流基础层（readiness successor9）

## Status

In Progress

## Product Definition

- 用户已明确授权“全部授权批准”，要求最终看到完整可验收结果。
- 目标：在不破坏 ADR 0028 的前提下，建立不可变调查事件账本、确定性离线回放、解释性 replay diff 和可恢复长任务 graph 基础。
- 非目标：新闻抓取、地图 UI、外网开关、Temporal、OpenFGA、公开部署和前端路由改造。

## Acceptance Criteria

- [ ] 调查事件按 sequence 追加并通过 previous_event_hash 形成链。
- [ ] 相同请求、证据快照和规则版本回放得到相同 result_hash。
- [ ] 回放不修改原始证据包、史馆数据或采用状态。
- [ ] replay diff 能指出状态、事实、冲突和证据数量变化。
- [ ] 长任务 graph 支持幂等、checkpoint、暂停、恢复、取消和重试边界。
- [ ] 主 jinyiwei.sqlite3 schema/fingerprint 保持兼容，新增状态写入 replay sidecar。
- [ ] 六部 readiness fingerprint 与当前实现绑定，Harness 检查通过。

## Governance Binding

本候选同步更新六部 readiness fingerprint allowlist，使产品代码变更可被现有 Harness 独立复审；不改变外网、司级调查和史馆采纳边界。

## Implementation Report

- 改动摘要：Pending
- 自审：Pending
- 验证：Pending
- 验证命令与结果：Pending
- 剩余风险：Pending
