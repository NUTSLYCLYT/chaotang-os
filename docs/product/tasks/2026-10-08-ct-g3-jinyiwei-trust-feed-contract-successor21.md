# 任务：锦衣卫真实度分级与 Feed 注册合同（successor21）

## Status

In Progress

## Product Definition

- 为锦衣卫建立可解释、可回放、非模型单独决定的真实性评估合同。
- 建立 RSS、Atom、JSON Feed 的批准来源注册协议，但本阶段不启用外网抓取。
- 为后续新闻事件、地图点位和前端可信度徽章提供稳定数据结构。

## Delivery Constraints

- 只修改 manifest 指定路径。
- 评估必须由确定性规则完成，保留来源、时间、支持与反向证据及不得推断原因。
- Feed 注册默认拒绝未知来源、危险 URL、登录绕过和无限域名抓取。

## Acceptance Criteria

- [ ] 真实度分级包含来源级别、证据状态、维度分数、可信度区间和决策/史馆准入。
- [ ] 同一输入得到相同评估结果和摘要哈希。
- [ ] Feed 注册验证 HTTPS、固定 host、许可、速率与 robots 约束。
- [ ] 未注册来源、重定向、内网地址和空许可被拒绝。
- [ ] API 只读返回评估合同，不打开外网能力。

## Affected Modules

- 模块：锦衣卫真实性评估、Feed 来源注册、只读 API 合同与离线回归测试。
- 允许路径：见 `.harness/approvals/CT-G3-JINYIWEI-TRUST-FEED-CONTRACT-SUCCESSOR21-20261008.json` 的 `productPaths`。

## Technical Plan

1. 复用确定性真实性模型和来源注册服务，保持 owner 与证据边界。
2. 以固定输入覆盖来源级别、证据状态、危险 URL 和许可校验。
3. 运行 manifest 中的 Ruff 与 pytest 验证，不启用外网抓取。

## Implementation Report

- 改动摘要：Pending
- 验证：Pending
- 剩余风险：UI、地图和受控采集在后续独立阶段。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待 manifest 验证矩阵与 Harness 通过后补充。
- 未通过项：当前治理门禁尚未完成。
