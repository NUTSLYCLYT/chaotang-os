# CANON-IDEMPOTENCY-01 — Tenant/Scope Request Replay Ledger

状态：`ARCHIVED_SPEC_EVIDENCE / HISTORICAL_DUAL_REVIEW_GO / NOT_ACTIVE_PRODUCT_SSOT / ABSENT_CURRENT / NOT_IMPLEMENTED / NOT_AUTHORIZED`

> 集成说明：远端已退役原 CANON readiness 产品文档。本文件由 P21 保留为历史治理规格
> 证据，不重新建立产品事实源；若未来恢复该方向，必须重新批准、重做现状 census 并另立
> 当前 SSOT 与 runtime change。

目标单一变化：request replay authority `ABSENT -> TENANT_SCOPE_FAIL_CLOSED`。

未来 owner：Backend Request Idempotency。业务 aggregate、Task/Court lifecycle、outbox、tool/provider receipt 仍归各自 owner；本 ledger 不是第二业务事实源。

本规格只冻结未来 contract、迁移边界、失败语义、验证门和回滚。它不授权修改 Python、schema、migration、数据库、provider、真实数据或既有 plaintext key。

## 冷启动事实

- 仓内没有统一 request replay ledger；现存至少 12 套局部机制，分布于 `backend/src/archive_outcomes.py`、`backend/src/chancellor/routing_service.py`、`backend/src/chancellor/decree_status.py`、`backend/src/court_state_store.py`、`backend/src/chaotang_launch_loop.py`、`backend/src/formal_memorial.py`、`backend/src/execution/outbox_worker.py`、`backend/src/jinyiwei_evidence_store.py`、direct cache、memory/KPI store 与前端 stable-ID upsert。它们用途、scope、tenant、payload binding、并发和存储语义不同，不能合计成 canonical authority。
- `ArchiveOutcomeEvent` 最接近 request replay：tenant + plaintext key + unkeyed payload SHA-256，并允许调用方传入 Unit of Work；但没有 operation scope、KMS keyed digest/key version 或确定的并发冲突 replay 语义，且保存完整 payload。
- Chancellor routing 以 `(task_id, plaintext idempotency_key)` 读后写；同 key、不同 `confirmed_edict_text` 会静默返回旧 decision，现有测试还冻结了该行为。这是 payload mismatch 假绿，不是合格幂等。
- Decree timeline 会比较 canonical payload 并拒绝 mismatch，但 tenant/key 可空、scope 隐含、key 为明文，且读后插入竞态仍可能落成数据库异常而非稳定 replay 结果。
- Court file store 用全局 raw key 保存完整业务 result；文件锁只覆盖单机多进程，不能证明跨实例一致，也没有 tenant/scope/payload digest/key version。
- Launch-loop JSONL 只扫描最近 500 条，采用 check-then-append、无原子 claim；并发或旧 replay 可重复执行。JSONL 还保存 raw key 和完整 command/result。
- Outbox worker 的 CAS claim 只防多个消费者同时领取同一 outbox row；worker crash/reaper 后仍可能重做外部蜂群副作用。它不是 ingress replay ledger。
- `FinalMemorial.task_id` 唯一、evidence `claim_key` 唯一和 frontend cache/SWR 去重都是 aggregate/cache 局部约束，不得登记成 canonical request replay。
- 当前静态 Alembic head 为 `016_schema_literal_contract_guard`；精确下一 revision 必须在未来获批实现 change 中重新读取。本文不创建 revision。

## 信任边界与唯一职责

未来 authority 只回答一个问题：在服务端确认的 tenant 和 operation scope 下，同一 opaque request key 是否已经以完全相同的语义 payload 被原子接受。

```text
authenticated ingress
  -> authorization / data-policy gate
  -> server-derived tenant + allowlisted operation scope
  -> keyed key/payload digest
  -> claim in caller Unit of Work
  -> domain aggregate and/or outbox write
  -> complete with opaque same-tenant result_ref
  -> commit once
```

它不得：

- 保存 request/response、业务 payload、标题、query、external ID、candidate、approval、Task/Court/outcome 状态或 provider body；
- 代替 aggregate 唯一约束、authorization、state machine、outbox、receipt 或审计事件；
- 把 DB claim 描述成外部 tool/provider exactly-once；
- 允许客户端选择 tenant、operation scope、digest algorithm、key version 或 result-ref type。

## 目标 contract

### 逻辑记录

未来逻辑 ledger 由一个 authoritative `RequestReplayClaimV1` 与其纯索引 `RequestReplayKeyAliasV1` 组成。alias 不持有 state、payload digest、result ref 或业务字段，因此不是第二 replay ledger；物理表名和是否能用单表/索引等价实现由未来 schema Packet 证明。

`RequestReplayClaimV1` 最小逻辑字段冻结为：

| 字段 | 规则 |
| --- | --- |
| `claim_id` | 服务端生成的随机 opaque ID，仅用于受控关联；不得从 key/payload 派生 |
| `tenant_id` | 只从已认证 server context 派生，非空，不信任 request body/header 自报 tenant |
| `operation_scope` | 服务端选择的 immutable version-qualified ID，例如 `court.confirm_edict@v1`；客户端不能提供 |
| `registry_revision` | claim 时事务内校验的 authoritative scope/keyset registry revision；stale writer 不得写 |
| `payload_digest_keyset_version` | 生成 payload digest 的 immutable digest-keyset generation |
| `keyed_payload_digest` | 对该 scope 的 canonical semantic bytes 做 tenant/domain-separated HMAC |
| `state` | 只允许基础设施态 `CLAIMED`（仅 transaction-local）、`COMPLETED`、`TOMBSTONED`；不得复制业务状态 |
| `result_ref` | server-only、随机、typed opaque pointer；只引用同 tenant aggregate，不保存 response/payload |
| `retention_policy_ref` | 该 row 接受时已获批、不可变的 retention/tombstone policy version |
| `retention_control_ref` | 可空；指向独立 Data Governance hold/release control，不保存法律/业务正文 |
| `tombstone_after` / `purge_after` | 由 policy 解析出的服务端时间；legal hold 只能延后，不能由 ledger 自行臆造 |
| `claimed_at` / `completed_at` / `tombstoned_at` | 服务端时间；不参与业务排序或生命周期裁决 |

`RequestReplayKeyAliasV1` 只含 `claim_id / tenant_id / operation_scope / key_version / keyed_idempotency_digest`。数据库必须以 composite FK 或等价强约束保证 alias 的 `(claim_id, tenant_id, operation_scope)` 与 claim 完全一致；lookup 命中后再次校验 exact tenant/scope，禁止只靠应用约定或单列 `claim_id` 形成 cross-tenant/scope misbinding。不一致时 fail closed，并只发不含 digest/ref/tenant secret 的安全 reason event。正式 MAC 必须经 KMS MAC API 或隔离 crypto adapter 完成，普通业务模块不能取得原始 key material。逻辑 `key_version` 定义为一个不可拆分的 digest-keyset generation：它原子引用 key-digest 与 payload-digest 两把独立逻辑 key（或经批准的独立 derived subkeys），两类 MAC 使用长度前缀的不可混淆 domain encoding，不做字符串拼接。

物理表名、ORM 名称和列类型留给未来 schema Packet；本文只冻结语义。每个 alias 的 non-deferrable 唯一性必须等价于：

```text
(tenant_id, operation_scope, keyed_idempotency_digest, key_version)
```

新 claim 必须在同一 Unit of Work 为 active 与全部 retained lookup generations 计算并插入 aliases；任一 alias 冲突都解析到同一个 authoritative claim。这样 rolling deploy 中旧实例写 v1、新实例写 v2 时仍会在双方共有的 retained alias 上仲裁。claim transaction 必须锁定/原子读取 authoritative persisted registry revision，校验 caller generation 与完整 retained set 后再插 alias；不能信任进程缓存“自知最新”。rotation 切换/移除旧 generation 使用同一 revision fence，先排空/拒绝旧 writer；stale revision write=`0`。

Backend Request Idempotency 只拥有 registry mechanics、immutable publication、MAC/digest execution 与 claim arbitration。各 domain aggregate owner 编写并批准 material-field contract、canonicalizer 与 typed result-ref resolver；Security/Data Governance 批准 auth inputs、key policy、retention/tombstone policy。Registry 只登记这些已批准、不可变、带 owner ref 的 artifacts，不重新解释领域 payload。

每项 `operation_scope` 必须是 immutable version-qualified identifier，并冻结 canonicalizer byte contract、material fields、result-ref resolver、retention policy 与 owner refs。任一语义变化必须注册新 scope version，不得原地修改旧 entry；旧 entry、test vectors 和 key generation 的保留期不得短于 replay/tombstone retention。未知 scope/version 一律拒绝，不能回退到通用 JSON hash。

### Key 与 payload digest

- 外部 HTTP 只从专用敏感 header 接收 raw key；禁止放 path/query/body。内部 adapter 只用 typed sensitive carrier 传到 crypto boundary，MAC 后立即丢弃，不复制进 DTO、context dump 或 exception。
- wire token 固定为 case-sensitive canonical base64url（无 padding）、解码后至少 16 个 CSPRNG bytes、编码长度 22—128；禁止 trim/Unicode normalization。strict decoder 必须拒绝非法长度模数、非零 unused bits 与宽松替代表达，并以“decode 后再无 padding re-encode 与原串 exact 相等”验证；key MAC 的 preimage 是 decoded bytes，不是可变 textual encoding。blank、非允许字符、控制字符、过长或解码不足 128 bit 的 token 在 MAC 前拒绝。
- CSPRNG/entropy 是 issuer SDK contract，服务端只能验证 canonical encoding 与长度，不能把 SDK 名称或内容扫描当安全边界；idempotency key 永远不是 authentication/authorization credential。邮箱、手机号、标题、URL、query、external ID 等业务值不得进入该 carrier。edge proxy、WAF、APM、access log、exception middleware、support/crash dump 必须按敏感 header 名 redact；否则 surface 不得接线。
- 正式数据使用 KMS 管理、tenant-scoped、domain-separated keyed HMAC；普通 SHA/MD5 只允许不可回推 synthetic fixture，不能进入正式 ledger。
- key digest 与 payload digest 使用 keyset 中不同逻辑 key/subkey 与不同 domain，并绑定 environment/service namespace；非生产环境不能 resolve 生产 KMS alias。不得复用输入空间。KMS access/cache/audit 和 provisioning/rotation 另需 security Packet 批准。
- canonical payload 必须覆盖所有会改变业务效果的字段，包括目标 aggregate identity、command/intent、expected version，以及会改变效果或审计归属的稳定 actor/subject/delegation/purpose/policy identity。per-attempt authorization decision ID、evaluation timestamp、trace span、retry counter 与 request correlation 不进入 digest；当前 authorization 仍在每次 replay 时独立重验。
- canonicalizer 冻结语言无关 bytes，至少裁定 Unicode normalization、missing/null、map ordering、list/set、integer/decimal/float、timezone、duplicate JSON keys、unknown fields 与 version/domain framing。未知字段/版本、非有限数字或无法 canonicalize 时 fail closed，不可丢字段后继续；客户端提供的 digest 永不可信。
- rotation lookup 必须尝试 active 与 retention 内全部 prior aliases；新 claim 为所有 retained generations 建 alias，并以 active generation 生成 payload digest。命中既有 claim 后，必须使用该 row 的 `payload_digest_keyset_version` 重新计算 payload HMAC，并以 constant-time compare 判 same/conflict；绝不能用当前 active version直接与历史 digest 比。引用 generation/keyset 不可用时拒绝处理，不能改用普通 hash。generation/key material 的保留期不得短于 ledger/tombstone retention 与批准的 backup-clearance window。

### 原子 claim 协议

1. 先完成 authentication、tenant derivation、route/command scope resolution 及当前 authorization/data-policy validation；失败时不得创建 claim。
2. claim arbitration 是 caller Unit of Work 的第一项 durable mutation；claim 前不得执行领域逻辑/写入。实现只能使用受支持方言的 atomic insert-on-conflict/returning，或围绕 claim insert 的 nested SAVEPOINT + non-deferrable alias uniques，禁止裸 `SELECT -> INSERT`。
3. 新 key：在同一 Unit of Work 插入 transaction-local `CLAIMED` 与全部 aliases，写目标 aggregate 和/或 outbox，再写 `COMPLETED + result_ref`，最后一次 commit。`CLAIMED` 不得单独 commit；任一步失败整体 rollback 到 `ABSENT`。
4. Alias lookup 命中后，先读取 authoritative claim，并用该 row 的 `payload_digest_keyset_version` + immutable scope canonicalizer 重算 candidate payload MAC、constant-time compare；只有全部 retained aliases 都未命中才允许按 active generation 新建。同一 raw key 的 aliases 若解析到不同 `claim_id`，返回 `IDEMPOTENCY_ALIAS_DIVERGENCE`、write=`0` 并发受限无敏感安全告警，不得任选一行。确认同 key/同 digest/`COMPLETED` 后，从 authoritative DB 读取目标 tenant/type，和当前 auth tenant/权限比较，再从 canonical aggregate/projection replay；不能只信 token claim、传入 object ID 或 ledger 缓存。
5. 同 key、不同 payload digest：稳定返回 `IDEMPOTENCY_PAYLOAD_CONFLICT`（HTTP adapter 建议 409），业务写和 outbox 写均为 0。
6. concurrent contender 等待 alias unique 仲裁：winner commit 后读取 `COMPLETED`；winner rollback 后重新竞争。超过 adapter lock-wait 上限时只返回无持久状态、不可枚举的 `IDEMPOTENCY_IN_FLIGHT`，不得以读取到已提交 `CLAIMED` 为前提。
7. race loser 只回滚 claim SAVEPOINT；winner commit 后用 clean transaction/session 读取 authoritative row并按第 4—6 条裁决。不得泄漏 IntegrityError、不得回滚 caller 既有业务写（按第 2 条本来就不应存在）、不得重做领域逻辑。

任何需要 durable/leased `CLAIMED` 的长任务必须另立 lease/Receipt contract。跨事务任务拆成“request claim + durable outbox”同事务；worker 侧必须有 persisted lease owner、monotonic fencing generation 和 receipt CAS，lease 失效的旧 worker晚到写入为 0。provider token 必须 tenant+operation+effect scoped，不能暴露 raw request key；provider 不支持可靠 token/状态查询时，不得自动执行不可逆 effect。效果未知时进入 receipt 侧 `AMBIGUOUS` 并停止盲重试，交 provider query 或人工 reconciliation。上述状态都不进入本 ledger。

### Replay、retention 与删除

- `COMPLETED -> TOMBSTONED` 是唯一 retention transition。Tombstone 保留 tenant/scope/aliases/key versions/payload digest/policy ref/completion time，清除 `result_ref`；same-payload replay 返回与“撤权/ref 缺失”相同的不可枚举失败响应族，different-payload 仍 conflict，业务/outbox write 都为 0，绝不重新 claim。
- replay 每次先做当前 authorization，再从 authoritative aggregate 读取 tenant/type。撤权、跨 tenant、ref 缺失、已删除或 resolver 失败时 claim 保持 `COMPLETED/TOMBSTONED`，返回同一个不可枚举失败；不删除 claim、不重新执行业务写。`result_ref` 不序列化给客户端，禁止 sequential ID、external ID 或可猜 URL；拒绝码/响应体/普通日志不区分“历史存在但无权”“ref 缺失”“类型不符”。
- 每行固定 `retention_policy_ref/tombstone_after/purge_after`，policy 原地更新不改写历史 row。独立 Data Governance `RetentionHoldV1` 至少含 hold ref、owner、scope、expiry、release ref 与 preservation class，并由 `retention_control_ref` 关联；默认 `REPLAY_GUARD_ONLY` 不延长 result ref，只有具名更高批准才可保留 result ref。Hold 只能延后 tombstone/purge，并传播到主库、索引、缓存、备份和 processor evidence；ledger 不能自行创建、延长或解除。
- keyed digest 仍是 pseudonymous data，不得无限保留。每个 immutable scope 在发布前必须由 Domain + Security + Data Governance 二选一裁定 purge safety：`SCOPE_RETIRED_BEFORE_PURGE`（到 accept-until 后该 tenant/scope 永久 fail closed，再清 tombstone），或 `DOMAIN_REUSE_PROVEN_SAFE`（由独立 aggregate invariant 证明 purge 后不会重复不可逆效果）。两者均未获批时 surface 不得上线，不能以无限 tombstone 或允许 key 重用兜底。tenant decommission 是另一条安全 purge 路径，要求不可复用 deny marker；tenant ID 永不复用。tenant crypto-erasure 后 KMS 不可用时，所有该 tenant claim/replay fail closed，禁止静默创建新 keyset。精确期限、scope retirement、reuse proof、删除传播和真实数据处理仍需 PRIV/Data Packet 批准。
- 观测只允许低基数 reason code、scope、state transition、latency 和受控 claim correlation。`claim_id` 只进入受限、批准 retention 的审计关联，不得作为 metric label、跨系统业务 ID 或外部 API 字段。raw key、digest、payload、result ref、tenant secret 不进入普通 log/metric/trace/APM/support dump；trace 中也不得把 digest 当业务 ID。

## 候选实现路径

未来获批实现 Packet 可考虑：

- 新增 `backend/src/request_idempotency.py`：authority、scope registry、canonicalizer interface、claim/replay result types；
- 修改 `backend/src/db/models.py`：仅新增 shared ledger 物理模型；
- 新增 `backend/alembic/versions/<execution-time-next-revision>_request_replay_claim.py`；
- 新增 `backend/tests/test_request_idempotency_contract.py`、`test_request_idempotency_concurrency.py`、`test_request_idempotency_writer_inventory.py`；
- 对 routing、decree、Court、launch-loop、archive、Task/Court writer 逐 surface 建独立 adapter/cutover Packet，先禁止新局部 replay store，再迁移；
- tool/provider side effects 另接 CANON-RECEIPT-01/outbox/provider token，不合并进本表。

以上路径均为候选，不表示已创建、已授权或允许在同一 change 大爆炸迁移。既有 plaintext keys/full payload 不自动 backfill；任何读写兼容、历史清理或真实数据迁移必须另有 schema/data change 批准。

## 实现分解

1. `01A inventory/refreeze`：冻结所有 raw key、digest、cache、unique constraint、outbox claim 与 external side-effect call sites；把 request replay、aggregate uniqueness、consumer claim、content dedup、cache 分开分类。
2. `01B contract/schema`：先写 RED 合同、并发和 hash-oracle tests，再以执行时 migration head 建 shared ledger；只使用 synthetic/temp DB；完成态只能是 `CONTRACT_SCHEMA_VERIFIED / NO_RUNTIME`。
3. `01C first atomic adapter`：选择一个无外部副作用、低风险 aggregate，在同一 Unit of Work 证明 claim + 一个 canonical durable target 的原子性和 replay authorization；只有 outbox 本身就是验收的 durable acceptance target 且 consumer 默认关闭时才可选 outbox。完成态只能是 `FIRST_SURFACE_FAIL_CLOSED`。
4. `01D-n surface migrations`：每个 request-replay ingress 一包，证明同 key/diff payload、跨 tenant、并发 race、rollback、rotation 与 old-path zero-call 后再退休局部 authority；cache/unique/dedup/consumer claim 必须显式分类为非 request replay。
5. `01E external-effect bridge`：仅在 CANON-RECEIPT-01 就绪后，对 provider token scope、persisted lease/fence、`AMBIGUOUS`、receipt 和 crash recovery 做端到端验证；其状态不计入本 Packet 的 request-ledger Exit。

任一 Packet 只允许一个状态变化；不得在 `01B` 顺手改写所有 caller。

## 必须失败

- tenant 缺失、自报 tenant 与 auth tenant 不同、跨 tenant result ref。
- scope 缺失/未知/由客户端自由指定，或 canonicalizer/version 不存在。
- raw key/canonical payload/digest 被写入 replay ledger、辅助表、log、metric、trace、APM、异常或 support dump；低熵值用普通 SHA/MD5。获 PRIV/source/purpose 独立批准的 aggregate 只能保存其最小业务字段，本规格不批准也不禁止该领域持久化。
- 同 key、不同语义 payload 返回旧成功；canonicalizer 漏掉 material field。
- 先查后做、并发两次执行、unique race 暴露 500/IntegrityError。
- claim 成功而 aggregate/outbox rollback，或 aggregate 成功而 claim 未完成。
- `CLAIMED` 被单独 commit 或当作 completed；ledger 保存业务 response/status/approval/outcome。
- result ref 跨 tenant、类型不符、被撤权后仍 replay 历史内容。
- rolling deploy 的 v1/v2 实例对同 raw key 各插一行；retained aliases/key generation 缺失后静默换 hash；过期/tombstoned row 使同 key重新执行。
- replay 命中旧 claim 却用 active payload keyset 比较而产生假冲突；alias tenant/scope 与 claim 不一致；non-canonical base64url 文本映射到同一 decoded key。
- 活跃 tenant 的 tombstone 到 purge 时间却既不能安全删除也没有 scope-retirement/domain-reuse 裁决；legal hold 默认保留 result ref 或无法追踪 release。
- DB claim 被宣传为外部 provider exactly-once；crash/reaper 后重复外部副作用却无 receipt/token 证据。
- worker lease 失效后旧 worker 仍能晚到提交，或外部效果未知时自动盲重试；这些必须由 Receipt/fencing Packet 阻断，不能塞进 request ledger 假装解决。
- 既有 plaintext/full-payload 记录未经单独数据批准自动 backfill 或复制进新 ledger。

## 验证门

未来实现至少执行：

```bash
cd backend && python3 -m pytest -q tests/test_request_idempotency_contract.py tests/test_request_idempotency_concurrency.py tests/test_request_idempotency_writer_inventory.py
cd backend && python3 -m pytest -q tests/test_core_tenant_lineage_contract.py tests/test_outbox_worker.py
cd backend && python3 scripts/harness_doctor.py
node scripts/harness-doctor.mjs
git diff --check
```

实现时还必须：

- 在隔离临时 DB 上跑 migration upgrade/downgrade/upgrade 与真实 unique-race；
- 使用 deterministic fake KMS 验证 key/payload 独立 MAC、active/prior/missing generation、v1/v2 并发与 stale-writer fence，不读取生产 key；
- 证明 raw key/canonical payload/digest 不进入 replay/aux 持久化、edge/app log、metric、trace、APM 或 dump fixture；领域 aggregate 只按独立批准检查最小字段；
- 为每个迁移 surface 运行 old-path writer inventory 与同 tenant/scope replay E2E；
- 外部副作用只在 receipt/provider-token Packet 中做 crash-before/after-receipt L3，不能由本 Packet 抵扣。

## Exit / rollback / STOP

- Exit：`TENANT_SCOPE_FAIL_CLOSED` 只在 census 内所有 request-replay ingress 已逐 surface 迁移或明确分类为 non-request-replay，且旧 authority reader/writer zero-call tripwire 全绿后授予。`01B` 只能写 `CONTRACT_SCHEMA_VERIFIED / NO_RUNTIME`，`01C` 只能写 `FIRST_SURFACE_FAIL_CLOSED`；两者都不能代表全仓完成。外部 provider/tool exactly-once 不计入本 Packet Exit，另由 CANON-RECEIPT-01/01E 验收。
- Rollback：文档 Packet 删除本 change 证据即可。未来 schema 一旦产生 accepted claim，不允许 downgrade 丢失 replay history 或恢复 raw-key store；运行回滚只能关闭新 ingress 写入/adapter 并 fail closed，保留 ledger/readers，采用 forward-fix。迁移前 rehearsal 必须证明不会双写两个 replay authority。
- STOP：HEAD/remote、migration head、scope registry owner、writer census、KMS/retention policy或 Unit of Work 边界改变；需要读取/迁移真实 key/payload；无法把 target write 放入同一事务；需要 external exactly-once；同一验收连续三次失败。出现任一条件时更新 spec 并重新批准。

执行权限：`NOT_AUTHORIZED`。
