# Packet 10-B1 — Claim-Evidence Durable Commitment V1 Final Exact8 Product Successor

任务 ID：`PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-FINAL-EXACT8-PRODUCT-SUCCESSOR-20260830`

## Status

Draft

`NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / PRODUCT_STOP`

## Product Definition

本 forward-only successor 以 `536f4c00d5364664522956622eab7aed1d2b2cf9 / b799fc582db46197e70c3ed35bfe6fb3834089a8` 为唯一基线，在 exact6 compatibility prerequisite 已普通 fast-forward 落地后，重新签发 P10-B1 durable commitment exact8。它只补齐已有 `decree_jobs.sqlite3` 的 closed-schema 迁移、SQL NULL commitment 防线、staged authority handoff 和 worker/API fail-closed；不创建第二套 Claim-Evidence runtime、ledger、authority、数据库或非空 commitment writer。

前序 canonical-rebuild shadow 基线为 `642848e8bfc960c709372b2fa8c453f189a8ad61 / 6661fb313b52c4773cd67f8717996ddfa98019a7`，其八文件证据固定为 `SHADOW_EVIDENCE_FROZEN / NOT_A_CANDIDATE / ABANDONED_UNCONSUMED / BYTE_DONOR_ONLY`。从该基线到当前基线的 first-parent lineage 仅有 `9f528aeb794b2c0abf91824198770df3920bd670` 与 `536f4c00d5364664522956622eab7aed1d2b2cf9`；changed paths 精确为 runtime registry、SQLite backup、三份对应测试、Python readiness validator、Node Harness validator及 exact6 三份治理文件，与本 exact8 八路径零重叠。旧 approval、authority、candidate、验证和审查身份均不得继承或 re-anchor。

### Frozen byte donor

donor 工作区 `/home/ubuntu/Projects/chaotang-os/.worktrees/packet10b1-canonical-rebuild-successor-shadow-candidate-20260830` 只提供 byte-for-byte 重物化来源：

| path | bytes | raw SHA-256 | Git blob |
| --- | ---: | --- | --- |
| `backend/app/api/decree_jobs.py` | 7454 | `sha256:74bc75f564d61264786ab8d801834d78404dee2a97f1cd11333070f6b7319b72` | `3011ddfd01905cb24d520ae67cb22b049359cd06` |
| `backend/app/api/decrees.py` | 62679 | `sha256:762485814b6e8f175f687d14fcc82635a76acc9c26e02b0f784a8b38c7d43e8d` | `243bcee26aa2dc8e64ef886debd7bd46769c8c24` |
| `backend/app/decree_jobs/models.py` | 5195 | `sha256:513b7f37fdf8d314406a8875ea1c707f7562f152f236cd4f1fa3275850c45d69` | `5f751ac9488aaea041bbfc3a25615652c63f2ce2` |
| `backend/app/decree_jobs/storage.py` | 74161 | `sha256:7d6b960bf74380cedbf29482e9743ee39d65484f4eaa698b5eded877d0d96373` | `aa77a3485c1db51d64baa1dc3cda3848e7519e24` |
| `backend/app/decree_jobs/worker.py` | 13942 | `sha256:f9ac190e69fe74a013a91ef0bf245e1a097e99c44c1b27b2a3c5bb539a88a2af` | `b7d774a1f17d4f04ba6fe13acdd4d9409189e1a2` |
| `backend/tests/test_decree_job_storage.py` | 63772 | `sha256:5cec58d69f4c466e877ab4bde57e6b74d4a2acf9db57bdeccd8876b9fcc6c31d` | `4dc67d1350666bb3810d5d372d356ab70f34e6dc` |
| `backend/tests/test_decree_job_worker.py` | 42749 | `sha256:2543092c5d866e4765abd8374e1a9fd3aeb0038f562af7f9a58f3867e34aed51` | `c61b2aa154bd3649aaab3ac8619f5587bd42f890` |
| `backend/tests/test_decree_jobs_api.py` | 34115 | `sha256:e2411dc8343a1b9a72a398e09cf6f290e91c24e1022a5a9c12b94afafc436789` | `3044eced657ac5ea6e76b92aaac8eeece4736121` |

全部模式为 `100644`；按 `{path,mode,bytes,rawSha256}`、path 字典序和 RFC 8785 canonical array 计算的 bundle 为 `sha256:d750580bbc26138589367aba51710097f044c7193eff9ede097b5fc44c7c3b2f`；`git diff --full-index --binary --no-ext-diff HEAD -- <八路径>` 的 combined diff 为 `sha256:afce5a35187aaa5b7abfd09f7867e1ed8ea67e26937a151e0ce4e33de6e38c97`。任何 donor 或基线漂移立即 STOP。

### Closed runtime and readiness binding

exact6 已把 runtime registry 切换为 plural `schemaContractDigests`，并为 `decree_jobs.sqlite3` 冻结 ordered tuple：旧 runtime digest `sha256:fa4e21efd694b2160197f9202419ed0889b83098e182932ec75231e78fd92b9d` 与 exact8 新 runtime digest `sha256:5372895aff08d4b39a19c4100b1b30ec8eaf7a9e597960425fee13c52552f5e3`。readiness Python/Node validators 已原子追加第六 ordered pair：runtime fingerprint `sha256:cc42339eaa423d71307ef96ff713ec095a89ba2cc4d4f6630ee1b40dec94d34d` 与 successor fingerprint `sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`。本 exact8 不得修改这些前置字节。

### Exact B1 guarantee

- SQL NULL 是唯一 legacy commitment 状态；B1 不写入非空 commitment。preexisting、malformed、spliced 或任一 storage boundary 观察到的 non-null commitment 必须在 authority commit、activation、claim、archive、publish及业务副作用前 fail-closed。
- same-owner changed-request 保持 `409 idempotency_conflict`；same-owner same-request 的 accept/GET/cancel 对不可用行返回脱敏 `503 {"status":"error","reason":"job_unavailable"}`；cross-owner 与 missing 的 GET/cancel 必须保持相同 HTTP status 与 canonical response body，逐字节等价且不泄露 raw/schema/digest。
- staged authority 状态顺序保持：reserve → durable pending → process-local authority commit → durable marker → activation。commit-before-marker 永不自动 promote；marker-before-activation 只允许既有安全 reconciliation。release false/exception 禁止后续 commit、marker和activation。
- 每个 storage transaction、worker execution/archive/publish boundary 都以 SQL NULL CAS 和 rowcount 失败关闭；新 INSERT 显式写 SQL NULL。不得以单一 SQLite transaction 包裹外部 authority 操作。

### Closed schema contract

唯一净 schema delta 是 `decree_jobs.claim_evidence_commitment_json TEXT NULL`。closed identity 使用 `sqlite_schema`、`table_xinfo`、`foreign_key_list`、`index_list/index_xinfo`、`application_id`、`user_version` 的 closed JSON record，经 RFC 8785 canonical UTF-8 SHA-256；冻结 raw identities 为：fresh empty `sha256:0c346e52fa80d30e8948d709d7e83d84389c51ec195a866f44bd874fb414fb51`、exact-new `sha256:8b38c49b719aa2a758ba037eb436d6fdf97db50e0a4b8cabd874b1a20f3059c2`、exact-old `sha256:aa2938733179612f5d4decd4f5e363be7dafaee5d38128273fef9f24eea3f027`、earliest parent-only `sha256:8632c03d798b1a3ac0e5e2774d8d64c4af7d1c734b0b95b2d2d3465b9b3e1124`、pre-authority parent-only `sha256:dbfd9074ca92d0538f97e63320360bff1ba38d634afa892e0bf5cb00d8d5cffc`。单 ALTER 中间形态和任何 unknown shape 永不进入 allowlist。

initializer 必须先对目标数据库及已存在 sidecar 做两次稳定纯文件快照，只在 POSIX 隔离副本上探测；unknown 直接零写拒绝，exact-new 稳定后零写返回。fresh 或 supported predecessor 才能打开无 WAL 的目标 validation connection，在首次目标 shape 读取前设置并读回 `foreign_keys=ON`、`legacy_alter_table=OFF`，取得 `BEGIN IMMEDIATE` 后从零复验。同一 connection/transaction 内完成 canonical rebuild、row/mapping/FK/typed metadata不变量及 exact-new 重验；persistent PRAGMA、DDL/DML 在 allowlist 与锁内复验前禁止。

exact-old 只能按 child→parent rename、canonical parent→child create、parent→child copy、temporary child→parent drop 的 `main.` 全限定顺序 transactional rebuild；临时保留名在 main/temp schema 开始前必须均不存在、提交前必须清除。所有旧列 projection、row counts、binary key order、markers、typed metadata、owner/key/request/job mapping逐字节保持，新增 commitment 全为 SQL NULL，`foreign_key_check` 为空，最终 identity 唯一为 exact-new。unknown DELETE/WAL 与 sidecar 存在/缺失矩阵拒绝前后 database、journal mode和 sidecar 集合/bytes/digest 均不变。

## Acceptance Criteria

- [ ] 正式 approval 基于 `536f4c00... / b799fc58...` 形成直接单亲三文件治理提交，取得新的 `GO / APPROVED_FOR_ONE_CHILD` 后才允许 exact8。
- [ ] 新 candidate 只从 frozen donor byte-for-byte 重物化八路径，精确 `0 ADD + 8 MODIFY`、全部 `100644`、无第九路径；旧身份不继承。
- [ ] donor bundle 与 combined diff、逐文件 raw/blob/bytes 全部机械复核一致。
- [ ] runtime registry 的旧/新 ordered tuple与 readiness第六 ordered pair保持不变，exact8 完成后 runtime fingerprint精确转为 `cc42339e...`。
- [ ] preexisting/boundary-observed non-null、malformed、spliced、cross-owner、release false/exception、commit-before-marker及 marker-before-activation 全部 fail-closed。
- [ ] exact-old canonical rebuild 输入 `aa293...`、唯一输出 `8b38...`；单 ALTER intermediate 与 unknown schema 永不持久允许。
- [ ] fresh、exact-new、两种 parent-only predecessor、DELETE/WAL sidecar、rollback/restart、row/mapping/FK/typed metadata矩阵全绿。
- [ ] P10-A、focused、Ruff、backend-full、readiness、Harness、doctor、hook、authority regression、V2与 diff check 全绿。
- [ ] Governance、Python与Security独立审查均为 `GO / P0=0 / P1=0 / P2=0`，machine candidate verification通过后才可请求普通 fast-forward push。

## Delivery Constraints

- 唯一产品字节写入者；所有审查者只读。
- 不修改第九路径、exact6、P10-A、readiness validators、Harness、authority、Tenant Principal、锦衣卫、史馆、executor、graph、archive、runtime report或前端。
- 不新增第二 ledger、authority、runtime、数据库、持久对象、依赖、环境 flag 或 non-null writer；不删除、跳过或放宽测试。
- 实时远端漂移、machine STOP、donor漂移、第九路径、验证失败、需要扩大范围或任一独立审查 P0–P2 时立即 STOP。
- 本包不授权 Pilot、Release、发布或部署。

## Affected Modules

- 模块：真实旨意接受 API、owner DecreeJob API、model、SQLite closed schema/migration/read-write guard、worker defense-in-depth和三套现有测试。
- 允许路径：`backend/app/api/decree_jobs.py`、`backend/app/api/decrees.py`、`backend/app/decree_jobs/models.py`、`backend/app/decree_jobs/storage.py`、`backend/app/decree_jobs/worker.py`、`backend/tests/test_decree_job_storage.py`、`backend/tests/test_decree_job_worker.py`、`backend/tests/test_decree_jobs_api.py`。

## Technical Plan

1. Owner 确认三文件 canonical digest 后，物化正式 approval、创建直接单亲 approval commit并普通 FF 到 ext-dev。
2. 在 clean approval worktree 运行一次 product authority；STOP 不重试，GO 也只授权一个 exact8 child。
3. 从 approval commit 创建唯一 candidate worktree，先复核 donor identity与基线零重叠，再 byte-for-byte 重物化八文件。
4. 重新执行全部 schema/commitment/crash/fail-closed 负向测试与完整冻结矩阵；不继承 shadow 结果。
5. 三路独立审查无 P0–P2 后冻结 candidate bundle、full-index diff、verification evidence和candidate evidence。
6. 仅在 Owner/机器边界均满足时创建一个直接单亲 candidate commit，运行 machine verify-candidate，通过后普通 FF；不部署。

## Implementation Report

前序 shadow 在 exact6 尚未落地时得到 focused `274 passed`、P10-A `42 passed`、Ruff PASS，backend-full 为 `4467 passed, 4 skipped, 45 failed`，失败精确为 44 个 registry digest prerequisite 与 1 个 readiness closed-pair prerequisite。exact6 已在当前基线落地并全矩阵通过；这些旧结果只证明 prerequisite 拓扑，不作为本 successor 的验证继承。

## Acceptance Review

等待 strict JSON、重复键拒绝、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、完整 Harness、canonical/raw/bundle与 Governance/Python/Security 三路独立审查。本文件在 Owner确认与 machine GO 前不授权产品实施。
