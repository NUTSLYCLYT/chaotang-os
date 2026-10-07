# 任务：锦衣卫可回放证据工作流基础层（最新主线 successor5）

## Status

Approved for one child

## Product Definition

- 用户确认：用户于 2026-10-08 明确授权“全部授权批准”，要求最终看到完整可验收结果。
- 问题：当前锦衣卫能保存调查结果，但缺少不可变调查事件账本、确定性回放和可恢复长任务状态。
- 目标：在不破坏 ADR 0028 的前提下，建立回放内核和长任务状态基础，使后续新闻、地图和前端升级可以引用同一条审计链。
- 非目标：新闻抓取、地图 UI、外网开关、Temporal、OpenFGA、公开部署和前端路由改造。

## Acceptance Criteria

- [ ] 每个调查事件按 sequence 追加写入，并通过 previous_event_hash 形成链。
- [ ] 相同请求、证据快照、来源配置和规则版本能够得到相同的回放状态与 result_hash。
- [ ] 回放只读，不修改原始证据包、史馆数据或采用状态。
- [ ] 回放差异能够指出状态、事实、冲突、证据数量和版本变化。
- [ ] 长任务状态支持幂等创建、checkpoint、暂停、恢复、取消、超时和重试边界。
- [ ] 只有司级调用链可以创建调查，现有只读 HTTP 案牍台保持只读。
- [ ] 旧 schema v5 数据可读取，新迁移失败可以回滚。
- [ ] 新增后端测试、ruff 检查和 Harness 检查全部通过。

## Delivery Constraints

- 范围：仅允许修改 approval manifest 指定的 backend 锦衣卫文件和对应测试文件。
- 兼容性：保持 EvidencePack、EvidenceItem、SourceAttempt、McpCallAudit、DataGapRequest、ADR 0028 和现有史馆采纳边界。
- 风险与限制：数据库迁移和长时状态需要完整回滚；不得启用外网；不得保存来源正文或凭据。
- 技能计划：`pc-agent-design`、`systematic-debugging`、`verification-before-completion`、`git-workflow-and-versioning`。
- Codex-only：是；不得调用 Claude CLI、Claude runner 或 gstack-claude。

## Affected Modules

- 模块：锦衣卫证据模型、独立 SQLite 存储、调查协调器、只读 API、回放和长任务测试。
- 允许路径：见 approval manifest 的 productPaths。
- 依赖模块：司级证据协议、现有 Jinyiwei storage/db、ADR 0028。

## Technical Plan

- 架构边界：事件账本和回放属于锦衣卫独立证据域；回放只重算确定性核验，不调用外网、不重跑模型、不修改史馆。
- 接口与依赖：新增内部 replay/long-task contracts；现有 GET 案卷 API 只增加只读回放关联，不新增通用调查入口。
- 实施顺序：RED 测试 → 不可变事件模型 → schema 迁移 → 存储事务 → replay engine → long-task state machine → 只读 API 扩展 → 完整后端验证。
- 验证计划：针对模型、哈希链、幂等、迁移、回放一致性、回放差异、暂停恢复取消、owner 隔离和边界失败编写测试。
- 技术风险：旧 SQLite 数据兼容、并发追加顺序、重复恢复和取消竞态；所有风险用唯一约束、事务、版本检查和稳定错误码收口。

## Implementation Report

- 改动摘要：Pending
- 自审：Pending
- 验证：Pending
- 实际使用的 skill：Pending
- 验证命令与结果：Pending
- 未运行项与原因：Pending
- 剩余风险：Pending

## Acceptance Review

- 验收结果：Pending
- 验收证据：Pending
- 未通过项：Pending
