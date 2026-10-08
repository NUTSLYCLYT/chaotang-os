# 任务：兵部 Revenue OS 业务 P1：CRM 只读适配器

## Status

Implemented

## Product Definition

P0 已经能够处理 CSV/JSON 销售事实。业务 P1 把 Twenty 作为可替换的只读事实源接入兵部：读取 Account、Contact、Opportunity、Activity，保留来源和更新时间，经过确定性映射后复用现有 Opportunity、Overview 和证据边界。

本任务只实现 CRM 只读适配与本地同步预览/提交，不执行任何 CRM 写入、邮件、消息、报价或 ActionDraft。

## Acceptance Criteria

- [x] 定义 provider-agnostic `CrmReadAdapter` 协议和严格的 Account/Contact/Opportunity/Activity 读取模型。
- [x] Twenty adapter 支持分页、增量 cursor、来源保留和稳定字段映射；默认禁用且不在测试中访问网络。
- [x] CRM 记录可经过 preview → commit 写入现有 owner-scoped 销售事实存储，重复同步幂等，不覆盖更新较新的本地事实。
- [x] owner、external_source、external_id 和 source_updated_at 全部由服务端控制；跨 owner 读取和提交失败关闭。
- [x] 冲突、缺字段、分页错误和不可用 provider 映射为稳定脱敏错误，不泄露上游响应或凭据。
- [x] P0 的 overview、opportunity detail、DecisionPacket 和 ActionDraft 行为保持兼容；不产生外部副作用。
- [x] 新增 RED→GREEN 测试、Ruff、Harness 和 diff 检查通过，离线 fake transport 覆盖分页、增量、幂等、冲突和 owner 隔离。

## Delivery Constraints

- 只允许修改 approval manifest 指定的后端 adapter、同步服务、兵部 API、相关测试和本任务文档。
- 不新增 CRM SDK、队列、Temporal、模型 provider 或前端路由；Twenty 通过注入的 HTTP transport 协议隔离。
- 测试不得访问公网、读取私有 dotenv、发送 CRM 写入或调用真实 DeepSeek/LiteLLM。
- 不修改 ADR 0028、现有认证边界、P0 ActionDraft 状态机和长时 Graph/P2 worker 契约。

## Affected Modules

- 模块：兵部 CRM read adapter、事实同步、分页/增量 cursor、owner-scoped 冲突处理和只读 API。
- 允许路径：见 `.harness/approvals/BINGBU-REVENUE-OS-BUSINESS-P1-20261008.json` 的 `productPaths`。
- 依赖模块：`backend/app/bingbu/models.py`、`storage.py`、`service.py`、现有认证和 P0 API。

## Technical Plan

1. 先写 RED：覆盖严格响应解析、分页、cursor、字段缺失、跨 owner、重复同步和新旧时间冲突。
2. 新增 `CrmReadAdapter`、Twenty mapping 和注入式 transport；禁止业务服务依赖供应商 SDK。
3. 新增 owner-scoped sync preview/commit 服务，复用现有 Opportunity storage 和 fingerprint/idempotency 语义。
4. 在兵部 API 暴露只读的 sync preview/commit 契约；浏览器和 P0 页面保持不变。
5. 运行 focused pytest、Ruff、Harness 和 diff 检查，再由独立 review 核对无外部副作用。

## Implementation Report

- 改动摘要：新增注入式 Twenty 只读 adapter、四类 CRM 读模型、分页 cursor、owner-scoped preview→commit 同步与稳定错误边界；未新增 SDK、网络客户端或前端路由。
- 自审：服务端注入 owner、provider 默认 disabled；commit 只写本地事实存储，不调用 CRM 写入、模型或外部动作。
- 验证：目标 CRM/API 测试 6 passed；兵部既有测试 15 passed；Ruff、Harness check 和 diff check 通过。
- 实际使用的 skill：pc-agent-design、verification-before-completion、git-workflow-and-versioning
- 验证命令与结果：`uv run --project backend pytest -q backend/tests/test_bingbu_crm_adapter.py backend/tests/test_bingbu_crm_sync.py backend/tests/test_bingbu_api.py`；`uv run --project backend ruff check ...`；`node scripts/check_harness.mjs --check`。
- 未运行项与原因：未访问真实 Twenty、真实模型或公网；这些是本任务明确 non-goals。
- 剩余风险：真实 Twenty schema、权限和生产网络延迟不在本任务离线验证范围。

## Acceptance Review

- 验收结果：Accepted for offline candidate
- 验收证据：6 个 CRM/API focused tests、15 个兵部回归测试、Ruff、Harness 159 基线文件和 diff check 均通过。
- 未通过项：真实 CRM 网络连通性与生产权限未验证，按合同保留为后续集成验收。

