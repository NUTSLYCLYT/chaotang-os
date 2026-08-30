# Packet 10-B1 — Claim-Evidence Durable Commitment V1 Shadow Lineage Successor

任务 ID：`PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-LINEAGE-SUCCESSOR-20260830`

## Status

Draft

`NON_AUTHORIZING / SHADOW_BYTE_FREEZE_ONLY / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

P10-A pure kernel 已落入主线；本 successor 只在最新 `ext-dev` 上形成不可提交的 exact7 shadow，机械冻结 `decree_jobs` nullable commitment sidecar 的最终字节、新 schema digest、runtime fingerprint 与完整失败拓扑。它不产生 candidate、通过、验证继承、Tenant Principal 绑定或运行时 truth gate 激活。

唯一 durable control 事实源继续是现有 `decree_jobs` 行；锦衣卫继续拥有 evidence identity/source/adoption，史馆继续拥有 immutable adopted references。禁止新表、新数据库、第二 truth ledger、RuntimeBindingLedger 冒充 P10 truth、旧 `backend/src` runtime 或 final memorial 恢复。

### Frozen base and forward-only lineage

- base commit：`ed16947fa233a7753d03eca99bab0257edb50e2c`
- base tree：`4093980ccc86d664c38684d99f71a6c32db05515`
- predecessor shadow governance base：`f00a0d925e7df48b12cdcb57a03a3b915ebe0f3c / 5b9d8dcbfb9dc319ab0c16418d340c9dfb9bec5e`
- predecessor 三文件只有未跟踪草案，状态固定为 `BYTE_DONOR_ONLY / NON_AUTHORIZING / NO_IDENTITY_INHERITANCE`。
- 从 predecessor base 到当前 base 为 19 个单亲串行提交，exact7 七路径零重叠；旧 approval、authority、candidate、verification 与 review 身份不得继承或 re-anchor。

### Closed inert B1 commitment

新增列唯一为 `decree_jobs.claim_evidence_commitment_json TEXT NULL`。SQL NULL 是唯一 legacy 状态。B1 不写 non-null，不证明真实性，不激活生命周期。任何 B1-or-newer 进程遇到 non-null（合法、malformed 或 cross-row splice）必须在执行、authority、job mutation、数据库副作用、部门调用、任何成功或携带 sidecar 的公开响应与 archive/publish 前失败关闭并保持零写；只允许固定、脱敏、无 sidecar 的既有 unavailable error。

non-null JSON 若仅做结构解析，必须是 canonical UTF-8、`<=1024` bytes、duplicate-key-safe、无 NaN/Infinity、closed fields：

- `schema_version="claim-evidence-job-commitment.v1"`
- `state=PENDING|EVALUATED_NONE|SIDECAR_EXPECTED`
- `control_ref`
- `aggregate_digest`
- `candidate_digest`
- `evidence_snapshot_digest`
- `decision_digest`

`PENDING` 与 `EVALUATED_NONE` 的五个 digest 字段全为 null；`SIDECAR_EXPECTED` 全为 lowercase `sha256:<64 hex>`。解析成功也只能称为 `STRUCTURALLY_VALID_UNVERIFIED_SIDECAR`。

本 shadow 明确保持 P10-A v1 的 `courtos-single-tenant.v1 / OWNER_ONLY / tenant_id=null` 历史语义，但不声称已绑定 Tenant Principal。真实 tenant-aware durable commitment 必须在 P10-B2 使用新 schema/version，并从 `accept_decree(CurrentUser)` 固化 server-derived tenant、membership、role 与 principal digest；不得在本 exact7 内猜测、回查或放宽 v1。

### Exact schema expansion

当前 canonical DecreeJob old schema digest：`sha256:fa4e21efd694b2160197f9202419ed0889b83098e182932ec75231e78fd92b9d`。按唯一 `ALTER TABLE decree_jobs ADD COLUMN claim_evidence_commitment_json TEXT` 机械得到的 proposed new digest：`sha256:5d928d429bbc134125649a5cbafe320947e0b9150303304cb63186696607707c`；shadow 必须重新复算，不得只继承该观察值。

initializer 必须在任何 DDL/DML 前 `BEGIN IMMEDIATE` 并按 raw shape 精确 dispatch：exact-new 只校验零写；exact-old 计算旧列 logical preimage 后单列 ALTER；仅明确支持的 pre-old 且无 commitment 列才运行既有 migration，提交后另开事务重验 exact-old；unknown、partial-new、错误 column/index/FK/trigger shape 全部 rollback 零写。

旧列 logical preimage 使用 path-independent RFC8785 framing，按 binary 主键顺序绑定两表全部旧列、类型、NULL 与 row count。ALTER 后复算必须完全相同，首次 ALTER 的 non-null count 必须为 0；exact-new 重启允许未来 non-null，但绝不回填、清理或重写。

### Zero-write boundary

storage 是 authoritative pre-claim guard，worker 只 defense-in-depth。针对既有行的 accept/replay/recover、authority/acceptance mark、claim sweeps/SELECT、UPDATE/DELETE/lease CAS、cancel、renew、provider count、fail/checkpoint/result/archive/publish/complete/release 都必须在 SQL/CAS 中带 `claim_evidence_commitment_json IS NULL`，不得只在 Python 中先读后写；新 INSERT 必须显式写 SQL NULL。

`backend/app/api/decrees.py` 不在本 scope；测试可经真实 `accept_decree` 注入 registry/store spy，证明 future commitment 在 reserve/commit/release/restore、job/idempotency 写和业务副作用前受控停止。若闭合错误映射必须改该 API，立即 STOP 并改签 exact8。

### Required forward-only sequence

1. 本 shadow approval 落地并取得 machine GO 后，只物化 exact7 未提交字节。
2. full backend 首次运行后冻结全部失败节点；根因只允许 `RUNTIME_SCHEMA_CLOSED_DIGEST_MISMATCH` 与 `SIX_MINISTRY_CLOSED_PAIR_MISMATCH`，出现第三类立即 STOP。
3. 冻结 exact7 bundle、new schema digest、65-path runtime fingerprint 与 unchanged successor fingerprint；shadow 不 commit/push，并标记 `ABANDONED_UNCONSUMED / PREREQUISITE_REISSUE_REQUIRED`。
4. 基于届时最新 ext-dev 新签 exact6 compatibility prerequisite，路径精确为 `runtime_data_registry.py`、`sqlite_backup.py`、`test_readiness.py`、`test_sqlite_backup.py`、Python readiness validator 与 Node Harness validator。
5. exact6 只允许 DecreeJob old/new 两个有序闭合 digest，backup/restore 绑定实际观察 digest，并在现有 5 个 ordered pair 后原子 `+1/-0` 追加第 6 pair。
6. exact6 落地后再新签 final exact7，byte-for-byte 重物化；其 machine verification 必须包含冻结负向节点、POSIX backend-full、exact7结构、Harness与authority回归，三审和 machine candidate verification 全绿后才可落主线。
7. P10-B2 另行设计 tenant-aware schema/version、受信 principal 注入、同事务 lease/owner/state/commitment CAS 与 archive/publish activation。

## Acceptance Criteria

- [ ] Shadow 精确 `0 ADD + 7 MODIFY`、全部 `100644`、无第八路径、永不 commit/push。
- [ ] 旧列 logical values、两表 row count/digest、idempotency mappings 与 legacy public bytes保持不变；仅新增 nullable列。
- [ ] legal/malformed/cross-row non-null 对全部 mutation、claim、worker、owner API 与真实 accept route 零写失败关闭。
- [ ] legacy SQL NULL 路径的 replay、recovery、idempotency 与旧响应完全不变。
- [ ] 不宣称 Tenant Principal、最终 truth、Qualified Use、runtime report、Pilot 或 Release 已激活。
- [ ] targeted/focused/P10-A/Ruff/Harness 全绿；backend-full 仅有两类冻结 prerequisite 根因。
- [ ] Governance、Python Code 与 Security Review 均无 P0–P2。

## Delivery Constraints

- 单一 exact7 shadow 字节写入者；审查者只读。
- 不得修改 P10-A、runtime registry、readiness validators、锦衣卫、史馆、executor、graph、archive、runtime report、前端、Harness 或 authority。
- 不得新增表、索引、trigger、数据库、依赖、配置、环境 flag、客户端控制位或 non-null 写入。
- 需要第八路径、第三类 full-matrix 根因、第二 durable 事实源、Tenant Principal 声明或旧列投影不可证明时立即 STOP。
- 禁止 shadow candidate commit/push、force-push、merge、rebase、fetch、pull、Pilot、Release与部署。

## Affected Modules

- 模块：现有 DecreeJob model、SQLite expand/read/write guard、worker defense-in-depth、owner API fail-closed，以及三套现有测试。
- 允许路径：`backend/app/api/decree_jobs.py`、`backend/app/decree_jobs/models.py`、`backend/app/decree_jobs/storage.py`、`backend/app/decree_jobs/worker.py`、`backend/tests/test_decree_job_storage.py`、`backend/tests/test_decree_job_worker.py`、`backend/tests/test_decree_jobs_api.py`。

## Technical Plan

先在三个测试路径形成真实 RED，覆盖 exact old/new schema、logical preimage、closed decoder、legacy-null compatibility、所有 non-null storage mutation/claim/worker/API 零写；再仅修改四个 product paths完成单列 transactional expand、strict parser、SQL/CAS guard与 worker defense。GREEN 后运行 P10-A、focused、Ruff、完整 backend 与 Harness，冻结两类 prerequisite failure topology和最终字节身份后停止。

## Implementation Report

尚未实施。本轮只冻结 forward-only shadow lineage；predecessor 三草案与更早 final-memorial/truth-ledger 实现仅为语义 donor。

## Acceptance Review

待正式 approval、machine GO、shadow RED/GREEN、失败拓扑冻结和三路独立审查。任何 P0–P2、远端漂移、schema歧义、non-null 写入、Tenant Principal 冒认、第二 ledger 或范围扩大均 `STOP / NO_REANCHOR`。
