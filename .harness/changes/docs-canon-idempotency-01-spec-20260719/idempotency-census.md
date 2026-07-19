# CANON-IDEMPOTENCY-01 当前机制 census

日期：2026-07-19

基线：`7daf36ba42b5266a338b128abf055e164657ac9a`

结论：仓内没有统一 request replay authority、scope registry、keyed digest/KMS keyring、shared ledger model 或 migration。至少 12 套局部机制不能合计成 `TENANT_SCOPE_FAIL_CLOSED`。

## 分类清单

| 当前实现 | 实际类别 | Tenant | 显式 scope | payload bind | key version | 同目标 UoW | 裁决 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `backend/src/archive_outcomes.py::record_archive_outcome` | request-like aggregate replay | 是 | 隐式 | 普通 SHA-256 | 否 | caller-owned | 最接近目标，但仍不是 canonical |
| `backend/src/chancellor/decree_status.py::record_timeline_event` | event + replay 混合 | 间接 | 隐式 task | 逐字段比较 | 否 | caller-owned | 局部可拒绝 mismatch |
| `backend/src/chancellor/routing_service.py::decide` | routing replay | 未进 unique | 隐式 task | 否 | 否 | caller-owned | 同 key 异 payload 假绿 |
| `backend/src/formal_memorial.py::formalize_memorial` | aggregate uniqueness | lineage | task identity | 普通 SHA-256 | 否 | caller-owned | 不是 request replay |
| `backend/src/jinyiwei_evidence_store.py::upsert_evidence` | mutable content dedup | 是 | claim pool | 否 | 否 | SAVEPOINT | 命中后覆盖，不是 replay |
| `backend/src/execution/outbox_worker.py::_claim_event` | consumer delivery claim | event 间接 | event ID | 否 | 否 | claim 先 commit | 不保证 external exactly-once |
| `backend/src/court_state_store.py` | 单机文件 claim/result cache | 否 | 否 | 否 | 否 | 否 | 跨实例失效，保存完整结果 |
| `backend/src/chaotang_launch_loop.py` | JSONL check/append | slug | 否 | 否 | 否 | 否 | 只扫末 500，无原子 claim |
| `backend/src/direct_cache.py::DirectCache` | result cache | 否 | 否 | MD5(command) | 否 | 否 | 陈旧结果缓存，不是 replay |
| `backend/src/memory_store.py::save_run` | identity insert-ignore | 否 | run ID | 否 | 否 | 单表 | 异 payload 静默吞掉 |
| `backend/src/kpi_tracker.py::record` | mutable identity upsert | 否 | run ID | 否 | 否 | 单表 | 异 payload覆盖旧事实 |
| frontend stable IDs/upserts | mutable identity/cache | 部分 | identity | 否 | 否 | 单表/无 | 不可进入 replay coverage |

## 关键证据

1. Archive outcome：`backend/src/archive_outcomes.py:41-117` 以 `(tenant_id, raw idempotency_key)` 查询、普通 payload SHA-256 比较；模型/唯一约束在 `backend/src/db/models.py:203-245`，migration 在 `backend/alembic/versions/011_archive_outcome_events.py:27-53`。保存 raw key、payload、hash，且 SELECT→INSERT 竞态无 deterministic replay recovery。
2. Decree timeline：`backend/src/chancellor/decree_status.py:32-139` 以 `(task_id, raw key)` 比较业务 event payload；约束在 `backend/src/db/models.py:689-724`。tenant/key 可空，业务 ledger 与 replay 事实混表。
3. Chancellor routing：`backend/src/chancellor/routing_service.py:130-214` 不比较 confirmed text；`backend/tests/test_chancellor_routing_service.py:52-80` 把同 key、不同正文仍返回旧 decision 冻结为预期。唯一键只含 task+raw key，见 `backend/src/db/models.py:636-659`。
4. Formal memorial：`backend/src/formal_memorial.py:30-124` 以 task 唯一与普通 content SHA-256 守 aggregate invariant；这是业务唯一性，不是 caller request replay。
5. Jinyiwei evidence：`backend/src/jinyiwei_evidence_store.py:33-137` 的 `(tenant_id, normalized raw claim_key)` + SAVEPOINT 处理并发最成熟，但命中会覆盖 grade/decision/trust/source，且保存 claim/query/source；属于 mutable dedup。
6. Outbox：`backend/src/execution/outbox_worker.py:304-507` 原子领取后先 commit，再执行外部蜂群；stale reaper 会重放。外部成功但 completion 未提交时仍可能二次执行。
7. Court：`backend/src/court_state_store.py:39-40,106-156` 用全局 raw key 和本机文件锁，完整 result 落 `court_idempotency.json`；claim 与状态在不同文件，跨机失效。
8. Launch loop：`backend/src/chaotang_launch_loop.py:276-342` 把 raw key/完整 case 写 JSONL，只读末 500 条且 check/append 无锁；入口在 `backend/web/routers/chaotang.py:994-1053`。
9. Direct cache：`backend/src/direct_cache.py:22-75` 用 `MD5(command)` 缓存完整 result，无 tenant/mode/provider/logic version；它只能证明缓存命中。
10. Standalone stores：`backend/src/memory_store.py:45-56,105-137` 用 `INSERT OR IGNORE`，`backend/src/kpi_tracker.py:111-121,359-370` 用 `INSERT OR REPLACE`；一个吞冲突、一个覆盖事实。
11. Frontend：`frontend/src/lib/db/primary-store.ts:98-152` 的 stable task ID 在 tenant 缺失时回退 `global`，命中后覆盖；department flywheel 的 dedupe 与 ledger 分两次写，无共享 Unit of Work。
12. 仓内没有 `operation_scope/keyed_idempotency_digest/keyed_payload_digest/result_ref` 这一组生产实现字段；现有 HMAC 用途不构成 idempotency KMS/keyring。
13. `backend/src/chancellor/decree_status.py:105-130` 使用 `MAX(sequence)+1`，但模型没有 `(task_id, sequence)` 唯一约束；并发 session 可产生重复 timeline sequence。这是业务 event sequencing 缺口，不能靠 request key 唯一键抵扣。
14. `backend/src/db/models.py:252-443,636-724` 显示 DecisionTask/CourtReview/EmperorDecision/ShiguanArchive/outbox/timeline 的 cardinality、CAS 与 raw payload 分布问题；这些归各自 canonical writer Packet，不得由 Idempotency ledger 接管。

## 不得混算的五种语义

| 语义 | 能证明什么 | 不能证明什么 |
| --- | --- | --- |
| cache hit | 一段时间内可复用计算结果 | 请求已原子接受、payload 相同 |
| identity unique | 同 identity 至多一行 | 同 request key、同语义 payload |
| mutable upsert/dedup | 合并/覆盖相似内容 | immutable replay、冲突 fail closed |
| worker claim | 同一时刻一个 consumer | crash 后外部副作用 exactly-once |
| request replay | tenant/scope/key/payload 绑定且目标写原子 | provider receipt、业务生命周期正确性 |

## 当前高风险假绿

- routing 的同 key 异正文静默回旧结果；
- launch-loop 的 `LIMIT 500 + check/append` 被称为 exactly-once；
- Court 文件锁被误解为分布式 claim；
- outbox CAS 被误解为外部副作用 exactly-once；
- DirectCache/SWR/unique/upsert 被计入 idempotency coverage；
- 普通 SHA/MD5 直接处理低熵 command/query/claim，形成字典/hash-oracle 面；
- key rotation 后若只查 active version，唯一键含 version 反而允许同 raw key 新建第二行。

## 实现前必须 refreeze

未来 `01A` 必须用 AST/结构扫描重新冻结：raw idempotency key reader/writer、普通 digest、cache/dedup/upsert、unique constraint、outbox claim、外部 side-effect call site 和所有声称 exactly-once 的测试/文档。当前 census 是 docs-only 基线，不替代执行时 inventory。
