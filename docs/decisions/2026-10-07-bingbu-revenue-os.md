# 决策 0011：兵部 Revenue OS P0 的 DeepSeek-first、Codex-gated、Provider-agnostic 实现

## Status

Accepted — 2026-10-08

## Context

兵部 Revenue OS 的 P0 目标是把已导入的客户事实、证据和销售机会组织成可审计的经营决策闭环：导入预览 → 归一化 → 总览 → 机会详情 → 战情室/DecisionPacket → ActionDraft → 人工审批。产品合同明确要求离线可验收、默认不调用真实模型、不写 CRM、不发送外部动作。

本次实现需要兼容朝堂既有的同源 BFF、FastAPI、CourtShell、租户隔离和治理门禁，同时保留未来接入 DeepSeek 的清晰边界。已批准产品路径由 .harness/approvals/BINGBU-REVENUE-OS-P0-20261007.json 冻结；本决策只记录实现选择，不扩大产品路径或非目标。

## Decision

### 1. 依赖方向

`
浏览器
  -> /api/bingbu/[...segments]（Next.js 同源 BFF）
  -> backendClient.requestBingbu（服务端客户端，转发 HttpOnly session）
  -> /api/v1/bingbu/*（FastAPI）
  -> BingbuService + owner-scoped in-memory storage
  -> DeterministicDecisionProvider（离线注入适配器）
`

BFF 只允许合同中的固定路径和查询字段，后端负责严格 Pydantic 输入校验、owner scope、稳定错误枚举和状态转换。ActionDraft 只允许人工 approve/reject；approve 不执行 CRM、邮件、消息或其他外部副作用。

### 2. DeepSeek-first，但 provider-agnostic

产品保留 provider_name、model_alias、skill_id/version、equest_id、	race_id 等审计字段，DecisionProvider 通过注入接口替换。P0 默认使用 deepseek-harness 的确定性离线实现，injected-fake 只作为模型别名；这样测试不消耗额度、不上传客户资料，未来可在明确授权后接入真实 deepseek-chat 或 deepseek-reasoner，而不改变 API、DecisionPacket 或审批边界。

不在本任务引入 LiteLLM、多供应商 fallback、真实网络调用、CRM 写入或自动发送动作。provider 变化只能发生在 provider adapter 层，业务服务不依赖具体 SDK。

### 3. 数据与幂等

Evidence 是一等对象，包含 claim、source、observed_at、freshness、quality、confidence 和 stance；Opportunity 保留 external source 与 source_updated_at。导入按 owner 和内容 fingerprint 幂等；ActionDraft 按 owner 和 idempotency key 幂等，状态机只允许 DRAFT -> APPROVED|REJECTED 一次终态转换。重复提交不会产生第二个导入或草稿。

### 4. 前端交互

所有页面沿用 CourtShell 和朝堂已有布局，采用暖纸色、墨色、玉色、朱砂色的编辑工业风。关键状态均有可见反馈：loading skeleton、unauthorized、error、empty、no-evidence、审批冲突、导入行级错误和 360px 响应式降级；prefers-reduced-motion 会关闭非必要动效。证据层先于模型建议显示，界面明确“DeepSeek-first · 人工审批”。

## Consequences

- P0 可在无外网、无 API key、无 CRM 的条件下完整验收，降低数据泄露和成本风险。
- 真实 DeepSeek 接入仍需要一次单独的、最小范围的 provider smoke，并必须保留 request/trace、预算、超时、脱敏和人工审批门禁。
- 当前 storage 是进程内实现，适合 P0 单实例验收；多实例生产化前必须迁移到 owner-scoped 持久化存储并增加迁移与并发测试。

## Verification evidence

- 产品 authority candidate verification：149a80d3063578eba0509b5bc2ce64e970f47f8，canAcceptProductCandidate=true。
- 远端 xt-dev 已通过无 rebase 的合并提交 3dd40cba59564642cb53b2f072b1e49820f5a94 集成。
- 离线测试、类型检查、lint、前端构建、Harness 检查均通过；具体数字见对应 review 记录。
