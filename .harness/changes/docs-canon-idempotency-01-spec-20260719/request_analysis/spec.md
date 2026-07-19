# 规格说明：docs-canon-idempotency-01-spec-20260719

## 背景

ABS-02 与 CANON Phase-A 对抗复审确认：TRACE、TASK-STATE、COURT-01B 及所有 durable capability adapter 共同依赖一个 tenant/scope request replay authority。仓内却只有分散的 raw-key SQL、JSON/JSONL、cache、unique/upsert 和 outbox consumer claim；它们的信任边界不一致，部分还把同 key 异 payload 静默当成功。

业主批准保留这份治理成果，但最新远端已经退役原 CANON 产品文档。本 change 只把
未集成的原子规格、census 与双审历史归档为可审计证据；不恢复产品 SSOT，不执行目标
runtime 状态变化。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 无 shared replay ledger；至少 12 套局部 cache/dedup/claim/upsert/replay | `idempotency-census.md`，2026-07-19 双路只读 census | Backend Request Idempotency / 已验证 | 是，阻塞 durable runtime |
| 已确认事实 | routing 同 key 异正文返回旧结果；launch-loop 末500 check/append；Court 文件锁跨机失效 | 生产路径与对应 tests，见 census | Architecture review | 是 |
| 已确认事实 | raw keys、普通 SHA/MD5、完整 payload/result 分散落 SQL/JSONL/file | `backend/src`、`backend/web`、`frontend/src` census | Privacy/security review | 是 |
| 已确认事实 | static migration head=`016`，remote target 已移动 | `git rev-parse`、versions inventory，2026-07-19 | Project owner | 合入/实现前重基线 |
| 推测 | 未来物理表/ORM/API 名称 | 本规格仅给逻辑候选 | 执行 Packet 裁定 | 否，本轮不实现 |
| 未知问题 | 生产 KMS/key retention、tenant erasure/legal hold、各 scope canonical material fields | 当前无已批准 production policy | Security/privacy/data owners | 是，阻塞真实实现/数据 |

## 数据流与调用链

```text
auth ingress
  -> authorization/data-policy
  -> server tenant + allowlisted scope
  -> tenant/domain-separated keyed key + payload digests
  -> claim + aggregate/outbox + result_ref in one Unit of Work
  -> commit
  -> replay re-authorizes opaque result_ref and hydrates canonical aggregate
```

外部 provider/tool 调用不得被数据库 claim 冒充 exactly-once；应由同事务 outbox 接受请求，再由 CANON-RECEIPT-01、provider token 与 crash recovery 证明外部效果。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `RequestReplayClaimV1` 逻辑记录 | Backend Request Idempotency | 获批的 domain adapters | tenant/scope/key/payload bind + unique race tests |
| versioned operation-scope registry | Backend Request Idempotency | canonicalizers/adapters | unknown/version mismatch fail closed |
| opaque typed `result_ref` | target aggregate owner | replay hydrator | same-tenant + current authorization recheck |
| external effect receipt | CANON-RECEIPT-01 / provider | async worker/reconciliation | 不属于本 ledger，独立 crash/replay L3 |

## 范围

- 冻结 current facts、唯一职责、逻辑字段、state、key/digest/rotation、同 UoW claim、replay/retention、负例、候选路径、实现拆包、验证、rollback 与 STOP。
- 更新 canonical readiness 与 parent plan 的规格状态。
- 记录诚实综合治理分数。

## 非目标

- 不实现 ledger/service/schema/migration/KMS/provider token。
- 不改任何 runtime caller/test expectation 或数据库。
- 不 backfill、复制、删除或加密已有 raw keys/payload。
- 不决定生产 retention/legal hold/tenant erasure 数值。
- 不声称 request ledger 能证明 business correctness 或 external exactly-once。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| same tenant/scope/key + same payload | 同 result ref，target count=1；每次重新鉴权 | contract/concurrency tests |
| same key + different payload | stable conflict，write=0 | mismatch negative |
| concurrent duplicate | unique winner 1；loser re-read，不泄漏 IntegrityError、不重复 target | temp-DB race |
| claim 或 target 失败 | 整个 Unit of Work rollback | failure injection |
| missing/cross-tenant/unknown scope/version | fail closed，claim/write=0 | trust-boundary negatives |
| key rotation | new claim 为 active + 全 retained generations 插 alias，payload digest 单用 active generation；stale registry revision 拒绝 | fake-KMS vectors |
| raw/low-entropy digest/logging | 拒绝或 privacy tripwire 失败 | static + log/DB inspection |
| external side effect | 只创建一次 outbox aggregate；provider effect 等 Receipt Packet | outbox/receipt L3 |

## 风险与回滚边界

本轮只有 change 内文档，可删除本 change 证据。未来一旦产生 accepted replay claims，不得 downgrade 丢失历史或恢复 plaintext local authority；只能停止新 ingress、fail closed、保留 readers 并 forward-fix。key rotation、retention、scope canonicalizer 与历史数据迁移均属于新批准点。

## 计划确认记录

- 批准人：业主
- 批准日期：2026-07-19
- 批准范围：继续综合治理；本 change 解释为 CANON-IDEMPOTENCY-01 docs-only atomic spec。
- 明确未批准：代码、schema、migration、数据库、KMS、provider、真实数据、backfill、deployment/cutover。

## 验收标准

1. 一份 fresh agent 可读取的自包含历史原子规格，含当时的 current facts、owner、逻辑 contract、候选路径、依赖、负例、验证、exit/rollback/STOP，并明确不得直接执行。
2. 明确区分 cache、identity unique、mutable dedup、worker claim 与 request replay。
3. ledger 不保存业务 payload/state，tenant/scope 服务端派生，正式 digest 使用 tenant/domain-separated KMS HMAC + key version。
4. claim、target aggregate/outbox、result ref 在同 Unit of Work；异步外部效果另归 receipt/provider token。
5. rotation、retention/tombstone、replay re-authorization 与 hash-oracle privacy 边界明确。
6. 历史架构与隐私/安全对抗复审保持原样留证；当前集成必须另经固定 SHA 复审，且只可写 `ARCHIVED_SPEC_EVIDENCE`；runtime 始终 `NOT_IMPLEMENTED / NOT_AUTHORIZED`。

## 验证计划

- 运行 focused 现有事实测试，证明文档引用的局部机制仍与 HEAD 一致；不把通过结果计作 CANON 实现。
- 两名只读 census；draft 后独立架构/隐私对抗 review。
- root/backend doctor、`git diff --check`、退役 SSOT 零恢复检查。
- 合入前因 remote drift 重新读取目标 HEAD、migration head 和 overlap；禁止静默 rebase。
