# Packet 10-B1 — Claim-Evidence Durable Commitment V1 Final Exact10 Compatibility Successor

任务 ID：`PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-FINAL-EXACT10-COMPATIBILITY-SUCCESSOR-20260831`

## Status

Draft

`NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION / PRODUCT_STOP`

## Product Definition

本 forward-only successor 以 `9e26f3e9de17d3862256936b2234b81f61e2a90f / bb79aab6667963f011f6a60b3cd6378fc419fe9a` 为唯一基线。该基线是已普通 fast-forward 落地的 exact8 approval commit；其 machine authority 曾返回 `GO / APPROVED_FOR_ONE_CHILD`，但 Owner 已明确处置为 `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`。旧 authority 不得消费、恢复、继承或 re-anchor。

exact8 产品尝试完成八文件 byte-for-byte 重物化和真实 RED→focused GREEN，但 backend-full 返回 `4521 passed, 4 skipped, 5 failed`。五项失败均来自 exact6 compatibility 测试夹具仍使用 `DecreeJobStore()` 表示“旧 schema”；exact8 initializer 会依法把旧 schema 迁移为新 schema，使 old/new 矩阵在测试准备阶段塌缩。相同五节点在干净 approval 基线上为 `5 passed`，因此 exact8 状态为 `STOP / APPROVAL_SCOPE_CONTRADICTION / UNCOMMITTED_BYTE_EVIDENCE_ONLY`。

本 successor 只将原 exact8 八路径与两个确定性兼容测试路径组成 exact10。原八文件必须 byte-for-byte 保持 frozen donor 身份；新增两条测试路径只能显式构造旧/新 schema 夹具并恢复原有 fail-closed 证明，不得修改 registry、backup 实现、readiness 实现、Harness、authority、运行时合同或产品语义。

### Frozen exact8 byte donor

donor 工作区：
`/home/ubuntu/Projects/chaotang-os/.worktrees/packet10b1-final-exact8-product-successor-candidate-20260830`

状态：
`BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / NO_AUTHORITY_INHERITANCE`

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

全部模式为 `100644`。八文件 bundle 必须保持 `sha256:d750580bbc26138589367aba51710097f044c7193eff9ede097b5fc44c7c3b2f`；相对 `9e26f3e9...` 的 full-index diff 必须保持 `sha256:afce5a35187aaa5b7abfd09f7867e1ed8ea67e26937a151e0ce4e33de6e38c97`。

### Compatibility fixture correction

`backend/tests/test_readiness.py` 与 `backend/tests/test_sqlite_backup.py` 必须先形成当前 exact8 字节的五项真实 RED，再进行最小测试夹具纠正：

- 旧 schema 必须由显式、冻结、确定性的 SQLite DDL/fixture 构造，不得再把会迁移的 `DecreeJobStore()` 当作旧 schema 工厂。
- 每个 old/new 分支必须在进入 backup、verify、splice 或 single-ALTER 行为前机械断言自身 schema digest。
- single-ALTER 负例必须从真实 exact-old 出发，观察到被冻结的 intermediate digest，并继续被 registry 拒绝。
- backup manifest 必须分别绑定真实 old/new digest；伪造允许但与实际文件不匹配的 digest 继续 fail-closed。
- source/snapshot splice 必须机械形成相反的 old/new schema，不能因构造器自动迁移而变成相同身份。
- 不得删除、跳过、xfail、改名逃逸或削弱原断言；只允许增加夹具、前置身份断言和必要调用替换。

RED 证据必须机器绑定到新 candidate，而不是只写过程说明。修改两个测试文件前，冻结其 base `mode/bytes/raw/blob`；运行以下五个失败族并记录完整 node IDs、非零 exit code、stdout/stderr SHA-256：

- `test_registry_mechanically_rejects_single_alter_decree_schema`
- `test_backup_manifest_binds_the_actual_allowed_decree_schema[False]`
- `test_verify_rejects_allowed_but_spliced_decree_manifest_digest[False-...]`
- `test_backup_rejects_allowed_but_spliced_source_and_snapshot_schemas[False]`
- `test_backup_rejects_allowed_but_spliced_source_and_snapshot_schemas[True]`

完成纠正后冻结两个 post-edit `mode/bytes/raw/blob`，并将 task ID、approval commit、candidate commit、pre/post identities、精确 node IDs、RED exit code及输出摘要组成 RFC 8785 canonical record 计算 RED evidence digest。不得伪造 RED，也不得用 predecessor 输出代替本轮证据。

manifest 的 `candidate-compatibility-red-evidence` verifier 必须从最终 candidate 的 `HEAD^` 在 `/tmp` 重建完整基线树，只覆盖 final `HEAD` 中冻结的 exact8 八文件、保留 `HEAD^` 两个兼容测试字节，再运行上述五个精确 node IDs。只有 exit code `1`、解析后的五条 FAILED node IDs 与冻结列表精确同序相等、无 `ERROR/XPASS/XFAIL/SKIPPED` summary、终态精确为仅 `5 failed` 时，才输出包含 pre/post `mode/bytes/raw/blob` 的 canonical RED record；临时树随后删除，不修改仓库、Git refs或配置。

### Runtime guarantees retained

- SQL NULL 仍是唯一 legacy commitment 状态；不得新增 non-null commitment writer。
- staged authority 顺序仍为 reserve → durable pending → process-local authority commit → durable marker → activation。
- 任一 boundary 观察到 non-null commitment 必须在业务副作用前 fail-closed。
- closed schema 唯一净 delta 仍是 `decree_jobs.claim_evidence_commitment_json TEXT NULL`；所有已冻结 schema identities 不得重定义。
- runtime registry ordered tuple、readiness 第六 ordered pair、四项 exclusions、69/65 文件计数及 P10-A 语义不得变化。

## Acceptance Criteria

- [ ] 正式 approval 以 `9e26f3e9... / bb79aab...` 为直接单亲基线，仅在 Owner canonical 确认后形成三文件 approval commit。
- [ ] exact8 authority 保持 `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`，不产生 child、candidate 或通过身份。
- [ ] 新 candidate 精确为 `0 ADD + 10 MODIFY`、全部 `100644`、无第十一条路径。
- [ ] 原 exact8 八路径 raw/blob/bytes 与 donor 一致，八文件 bundle和 donor full-index diff不变。
- [ ] 两个兼容测试文件先证明五项真实 RED，再只做显式 old/new fixture 和前置 digest 断言纠正。
- [ ] RED evidence 精确绑定本轮 approval、pre/post 两文件 identity、五个 node IDs、非零 exit code与 stdout/stderr digest。
- [ ] 两个兼容测试文件、P10-A、P10-B1 focused、Ruff、backend-full、readiness、Harness、doctor、hook、authority regression、V2 与 diff check 全绿。
- [ ] backend-full 不得缩小选择器、关闭 capture 或改变并发策略；临时目录只允许进程级归一化到 `/tmp`。
- [ ] Governance、Python 与 Security 独立审查均为 `GO / P0=0 / P1=0 / P2=0`，machine verify-candidate 通过后才可普通 fast-forward。

## Delivery Constraints

- 唯一产品字节写入者；审查者只读。
- 本治理阶段只允许三份新草案，不修改 donor、旧 exact8 approval、八文件候选或任何产品路径。
- 产品阶段只允许 manifest exact10；原八路径只能 byte-for-byte 重物化，实际新编辑只能发生于两个兼容测试文件。
- 禁止修改 runtime registry、SQLite backup 实现、readiness 实现、Harness、authority、P10-A、Tenant Principal、史馆、前端或数据库事实源。
- 禁止第二套 ledger、runtime、authority、数据库、依赖、环境 flag、non-null writer、测试放宽或无关重构。
- 远端漂移、machine STOP、donor 漂移、第十一条路径、失败拓扑变化、验证失败或独立审查 P0–P2 时立即 STOP。
- 本包不授权 Pilot、Release、发布或部署。

## Affected Modules

- 模块：P10-B1 exact8 frozen product bytes；readiness/SQLite backup old-new compatibility test fixtures。
- 允许路径：`backend/app/api/decree_jobs.py`、`backend/app/api/decrees.py`、`backend/app/decree_jobs/models.py`、`backend/app/decree_jobs/storage.py`、`backend/app/decree_jobs/worker.py`、`backend/tests/test_decree_job_storage.py`、`backend/tests/test_decree_job_worker.py`、`backend/tests/test_decree_jobs_api.py`、`backend/tests/test_readiness.py`、`backend/tests/test_sqlite_backup.py`。

## Technical Plan

1. 冻结三文件 canonical/raw/bundle，经 Owner确认后物化正式 approval；approval commit必须是 `9e26f3e9...` 的直接单亲子且仅含 manifest三路径。
2. 普通 fast-forward approval 后只运行一次 product authority；STOP 不重试，GO 只允许一个 exact10 child。
3. 从新 approval commit创建唯一 candidate工作区，先重物化 frozen exact8八文件并复核 identity。
4. 在两个 compatibility test paths 中重现五项 RED；显式构造 exact-old/exact-new并加入前置 digest 断言。
5. 运行 machine-bound `candidate-compatibility-red-evidence`、兼容测试、P10-B1 focused、P10-A、Ruff、POSIX backend-full、readiness和根级完整矩阵。
6. 三路独立审查 GO 后冻结 exact10 identity/evidence；machine verify-candidate GO 后才普通 fast-forward。

## Implementation Report

- exact8 approval commit：`9e26f3e9de17d3862256936b2234b81f61e2a90f`；旧 authority 已由 Owner 放弃且未消费。
- exact8 TDD RED：仅重物化三份测试时，因缺少 `ClaimEvidenceCommitmentUnavailable` 在收集阶段真实失败。
- exact8 focused GREEN：三文件 `161 passed`；完整 focused `274 passed`；P10-A `42 passed`；readiness `13 passed`；Ruff PASS。
- exact8 backend-full：`4521 passed, 4 skipped, 5 failed`；失败精确为一项 readiness single-ALTER 与四项 SQLite backup old/new/splice 参数节点。
- 相同五节点在干净 approval 基线上 `5 passed`，证明失败由 migration 改变测试夹具构造语义触发。

上述结果只作 predecessor evidence，不得继承为新 candidate 验证或通过结论。

## Acceptance Review

等待 strict JSON、重复键拒绝、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、完整 Harness、canonical/raw/bundle及 Governance/Python/Security 独立审查。本文件在 Owner canonical 确认与 machine GO 前不授权产品实施。
