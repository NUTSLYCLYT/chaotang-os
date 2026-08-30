# Packet 10-B1 — Claim-Evidence Durable Commitment V1 Exact8 Scope Corrective Successor

任务 ID：`PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-EXACT8-SCOPE-CORRECTIVE-SUCCESSOR-20260830`

## Status

Draft

`NON_AUTHORIZING / SHADOW_BYTE_FREEZE_ONLY / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 forward-only successor 纠正前序 exact7 的真实入口范围矛盾。前序 authority 已取得 `GO / APPROVED_FOR_ONE_CHILD`，但真实 `POST /api/v1/decrees/chancellor` RED 证明：合法 non-null commitment 的同键请求会被 replay 为 `202`；若 storage 仅抛错，未修改的入口只能成为未映射 `500`。固定脱敏 `503 {"status":"error","reason":"job_unavailable"}` 必须在 `backend/app/api/decrees.py` 显式处理，因此 exact7 状态固定为 `STOP / APPROVAL_SCOPE_CONTRADICTION / ABANDONED_UNCONSUMED / BYTE_DONOR_ONLY / REISSUE_REQUIRED`。

本 successor 在相同最新基线 `789586467c70fd6d2f784e2343e4c5f4427e62cf / 71e470018cf105d58c6c592d683abe92d203a89d` 上将范围精确扩为 exact8，仅增加 `backend/app/api/decrees.py`。前序未提交四路径和真实 RED 只作 byte donor/evidence，不继承 candidate、verification、review 或 authority 身份；必须在新 machine GO 后 byte-for-byte 选择性重物化并重新验证。

### Donor identity contract

前序 donor 工作区为 `/home/ubuntu/Projects/chaotang-os/.worktrees/packet10b1-claim-evidence-durable-commitment-shadow-candidate-20260830`，HEAD/tree 精确为上述 `789586467... / 71e470018...`。其冻结状态为 `BYTE_DONOR_ONLY / NO_CANDIDATE_OR_VERIFICATION_INHERITANCE`，精确四路径且模式均为 `100644`：

- `backend/app/decree_jobs/models.py`
- `backend/app/decree_jobs/storage.py`
- `backend/tests/test_decree_job_storage.py`
- `backend/tests/test_decree_jobs_api.py`

donor bundle 算法为：每条记录 `{path,mode:"100644",bytes,rawSha256:"sha256:<hex>"}`，按 path 字典序形成 array，对 RFC8785 canonical UTF-8 bytes 计算 SHA-256；结果为 `sha256:dcb9b300d9c0053618a5c4e83ce685bff88af6ec40fe10fbe38763d0ada2b40c`。ordinary combined diff 精确取 `/usr/bin/git diff --binary --no-ext-diff HEAD -- <四路径>` 的原始 stdout bytes 计算 SHA-256，结果为 `sha256:319ce7da4828b28510c78a9a3925bd62d575939ac89964df832d17d63c857f90`；该值不得称为 full-index diff。任一 donor path、mode、bytes、bundle 或 diff 漂移都不得重物化。

唯一 durable control 事实源继续是现有 `decree_jobs` 行。新增列唯一为 `decree_jobs.claim_evidence_commitment_json TEXT NULL`；B1 永不写 non-null。锦衣卫继续拥有 evidence identity/source/adoption，史馆继续拥有 immutable adopted references。禁止新表、新数据库、第二 truth ledger、RuntimeBindingLedger 冒充 P10 truth、旧 `backend/src` runtime 或 final memorial 恢复。

### Closed inert commitment and fixed HTTP boundary

SQL NULL 是唯一 legacy 状态。任何 legal、malformed 或 spliced non-null 都必须在执行、authority reserve/commit/release/restore、job mutation、数据库副作用、部门调用、archive/publish 和任何携带 sidecar 的响应前失败关闭。真实 accept route 只允许固定、脱敏、无 sidecar 的 `503 job_unavailable`；idempotency conflict 仍为既有固定 409，legacy NULL replay 仍为 202。不得把 private parser/storage detail写入响应。

non-null decoder 必须接收唯一 JSON 值，其 raw UTF-8 bytes 必须精确等于 RFC8785 canonical JSON bytes且 `<=1024`，拒绝重复键、NaN、Infinity、extra与missing。closed fields 精确为：`schema_version=claim-evidence-job-commitment.v1`、`state=PENDING|EVALUATED_NONE|SIDECAR_EXPECTED`、`control_ref`、`aggregate_digest`、`candidate_digest`、`evidence_snapshot_digest`、`decision_digest`。PENDING/EVALUATED_NONE 的五个值全 null；SIDECAR_EXPECTED 五值全为 lowercase `sha256:<64hex>`。解析成功只称 `STRUCTURALLY_VALID_UNVERIFIED_SIDECAR`。

storage 是 authoritative guard，worker 是 defense-in-depth。全部 existing-row mutation、DELETE、CAS与claim selection必须含 SQL `claim_evidence_commitment_json IS NULL` 并核对 rowcount；INSERT显式SQL NULL。检测型 recover/lookup/owner GET/preflight必须读取 commitment并在发现non-null时抛专用 unavailable，绝不能以 `IS NULL` 过滤后把危险行当作 absent。真实accept route在authority reserve前调用同时绑定 owner、idempotency key、request hash与draft fingerprint的只读preflight，只捕获专用commitment-unavailable并映射固定503；同键及不同键同draft都必须受控停止，其他store error不得泛化吞掉。专用异常直接从已允许的 `app.decree_jobs.storage` 导入；不得为re-export修改 `backend/app/decree_jobs/__init__.py`，否则第九路径STOP。

### Schema and forward-only sequence

old schema digest 观察值为 `sha256:fa4e21efd694b2160197f9202419ed0889b83098e182932ec75231e78fd92b9d`，单列 expand 后 proposed new digest 为 `sha256:5d928d429bbc134125649a5cbafe320947e0b9150303304cb63186696607707c`。initializer 必须 `BEGIN IMMEDIATE` 后 raw-shape closed dispatch，unknown/partial/index/FK/trigger drift 全部 rollback 零写；exact-old 只做单列 ALTER并证明旧逻辑 preimage 不变；exact-new重启零写。

本 exact8 仍只形成不可提交 shadow：full backend 只允许 runtime schema closed-digest mismatch 与 readiness ordered-pair mismatch 两类 prerequisite 根因。冻结新 schema/runtime identities后放弃本 shadow authority，再基于最新 ext-dev签发 exact6 compatibility prerequisite；exact6落地后重新签发 final exact8并重物化、全矩阵、三审和 machine candidate verification。

## Acceptance Criteria

- [ ] Shadow 精确 `0 ADD + 8 MODIFY`、全部 `100644`、无第九路径、永不 commit/push。
- [ ] 真实 accept route 的 legal/malformed/spliced non-null 在同键、不同键同draft、changed-request与cross-owner边界下均维持规定的503/409/404优先级、零泄漏、零authority/job/DB/业务副作用。
- [ ] legacy SQL NULL replay/recovery/idempotency/public bytes 不变；cross-owner仍保持既有404边界。
- [ ] schema expand只新增 nullable列，旧两表 logical preimage、row count和idempotency mapping不变。
- [ ] 全部 existing-row mutation/claim/worker/API 对 non-null 在 SQL/CAS边界失败关闭。
- [ ] targeted/focused/P10-A/Ruff/Harness全绿；backend-full只含两类冻结 prerequisite根因。
- [ ] Governance、Python Code与Security Review均无P0–P2。

## Delivery Constraints

- 只能有一个 exact8 shadow字节写入者；审查者只读。
- 不修改 P10-A、runtime registry、readiness validators、锦衣卫、史馆、executor、graph、archive、runtime report、前端、Harness或authority。
- 不新增表、索引、trigger、数据库、依赖、配置、环境flag、客户端控制位或non-null写入。
- 需要第九路径、第三类full-matrix根因、第二事实源、Tenant Principal声明或旧列投影不可证明时立即STOP。
- 禁止shadow candidate commit/push、force-push、merge、rebase、fetch、pull、Pilot、Release与部署。

## Affected Modules

- 模块：真实旨意接受API、owner DecreeJob API、model、SQLite expand/read/write guard、worker defense-in-depth及三套测试。
- 允许路径：`backend/app/api/decree_jobs.py`、`backend/app/api/decrees.py`、`backend/app/decree_jobs/models.py`、`backend/app/decree_jobs/storage.py`、`backend/app/decree_jobs/worker.py`、`backend/tests/test_decree_job_storage.py`、`backend/tests/test_decree_job_worker.py`、`backend/tests/test_decree_jobs_api.py`。

## Technical Plan

先在允许测试路径保留并扩展真实RED：同键与不同键同draft的accept route legal/malformed/spliced non-null固定503，changed-request保持既有冲突优先级，cross-owner不形成oracle，且registry/store/DB零写；再覆盖initializer closed shape、decoder、所有storage mutation/claim/CAS、worker和owner API。仅在八个product paths实现专用exception、检测型读取、SQL mutation guards、worker defense和accept route精确映射。GREEN后运行P10-A、focused、Ruff、POSIX backend-full和Harness，冻结两类prerequisite失败拓扑及所有字节身份后停止。

## Implementation Report

前序 exact7 只形成四路径未提交 donor 和一个真实 accept-route RED；没有 product child、candidate commit或push。该 donor不得直接提交。exact8尚未实施。

## Acceptance Review

待本 successor治理三审、approval落地、machine GO、exact8 shadow RED/GREEN、失败拓扑冻结和三路独立审查。任何P0–P2、远端漂移、schema歧义、non-null写入、Tenant Principal冒认、第二ledger或范围扩大均 `STOP / NO_REANCHOR`。
