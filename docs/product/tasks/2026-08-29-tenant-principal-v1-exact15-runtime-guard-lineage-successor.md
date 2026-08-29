# Tenant Principal V1 Exact15 Runtime Guard Lineage Successor

任务 ID：`TENANT-PRINCIPAL-V1-EXACT15-RUNTIME-GUARD-LINEAGE-SUCCESSOR-20260829`

冻结基线：`origin/ext-dev@98428a17bf782f24c12b80a8c04568c85ea18f2f`

冻结 tree：`baeb703c499a80fbae201549f07232eac7e8e988`

Approval RFC 8785 canonical digest：`sha256:b14bc90be745d3c1b9bde4489f0cc8404567f558f49011bf84a8822d6f9a4411`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / READY_FOR_INDEPENDENT_REVIEW`

## Product Definition

本任务在已落地的 exact2 runtime-lock guard 基线上，前向重签 Tenant Principal V1 exact15。它不重新实现产品，也不继承任何旧 approval、authority、candidate、测试或审查身份；产品候选只能把冻结 donor 的十五个 blob byte-for-byte 重物化到新的唯一隔离工作区，再在当前机器验证合同下重新建立 RED/GREEN、完整 backend、Harness 与独立审查证据。

Tenant Principal V1 仍只建立个人租户 owner 身份与既有运行数据的可信绑定；不扩展公开 API、角色模型、多租户 UI、奖励/分享、SSO、生产数据迁移或发布能力。

## Lineage And Authority Disposition

- exact14 approval `1e7a5efed79c17b51010eac36d104c6229bb3de5` 曾返回 `GO / APPROVED_FOR_ONE_CHILD`，但未产生产品 child、未 verify、未 push；Owner 已将其处置为 `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`。不得消费、恢复、继承或 re-anchor。
- 旧 exact15 approval `b6ac2555cb8bd0a279d91eef06c2c26ff3b57ecc` 的尝试因 `VERIFICATION_ENVIRONMENT_CONTRACT_MISMATCH` 停止；没有产品 child、最终 verify 或 push。其未提交十五文件仅为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`。
- 旧 verification-environment corrective 三文件未提交草案绑定 `b6ac2555…`，现为 `REMOTE_BASE_DRIFT / BYTE_DONOR_ONLY / NO_REANCHOR / DO_NOT_COMMIT / DO_NOT_PUSH`。
- runtime-lock prerequisite approval `11151f1618aa2a7a216fccaa59b1764916a55ae5`、corrective approval `e5fc5595be6ae1fdef4dd888d08313185b6de745` 与产品 candidate `98428a17bf782f24c12b80a8c04568c85ea18f2f` 构成从 `b6ac2555…` 到本基线的精确单亲 lineage。
- 该 lineage 只触及六份 runtime-lock 治理文件、`backend/app/operations/runtime_lock.py` 和 `backend/tests/test_runtime_lock.py`，与本任务 exact15 产品路径集合交集精确为空。
- runtime-lock exact2 已是当前主线验证前置，不授予或替代本任务 one-child authority。

## Donor Identity Contract

冻结 donor 工作区：`/home/ubuntu/Projects/chaotang-os/.worktrees/tenant-principal-v1-exact15-authority-lineage-successor-candidate-20260829`

冻结 donor base：`b6ac2555cb8bd0a279d91eef06c2c26ff3b57ecc` / tree `49f7e16a9842435978aba6a5dc1311916a3e1524`

exact15 bundle（RFC 8785 canonical array of `{path,mode,bytes,rawSha256}`）：`sha256:cd217691fed12076033fd2d17153c9fc7f5280d7051666aae383dfd9e9ce01f5`

donor full-index diff：`sha256:21448715c24ce668e2f2bfd395d04180e181dd157ec8f938b36b50356e4d8d93`

| Path | Bytes | Raw SHA-256 | Git blob |
| --- | ---: | --- | --- |
| `backend/app/api/auth.py` | 5138 | `sha256:2d9a78aaad0d8f95a8b91383d3c179a3a6b00a15b9df8e2b36854571f26140df` | `513a7e64c34e10f7cbdc17c537b957c87edbe2c6` |
| `backend/app/auth/models.py` | 896 | `sha256:57650b32a38141846e88e6089c956110ae173fcc413ade9b623a796231ea7a12` | `d5eaf6f3775f37bf47466b15fa8536efbbd08e41` |
| `backend/app/auth/storage.py` | 14487 | `sha256:96b0ab505b27a1c0b78522baa05f8651c86f0410045e62d8f89d384cf68f1592` | `ad576ae43750c837b7931e6d513e01e99a3ff8db` |
| `backend/app/operations/runtime_data_registry.py` | 15824 | `sha256:fa0aa51ac828750da007aefa5f10779c899ab04b67aaa8a7055f6985110a4323` | `a5f2aac19a0d4f4a737b227f39f9e8c29b48d9af` |
| `backend/app/operations/sqlite_backup.py` | 106793 | `sha256:591a212e2253e2fa707986a6645b2bedc7a49ba5cc370dbb46b7cd954d002f98` | `8990f5509f860a1da72250242d8e8ad6dda0e1b6` |
| `backend/app/shiguan/db.py` | 40923 | `sha256:8342855f78f68c3bdadd1f8a48948cc1bff4a4b13c6005151bcf3195785ca212` | `b0e231efa59264586a5c8b23f291a9b5d004949d` |
| `backend/app/shiguan/maintenance.py` | 26590 | `sha256:af14db220110914e4f25a29413cc1f0bc4142c188a9ab982353c428baf6dd0ef` | `6e216dbaaf97cc2d7e4fef93aa3f65ba68563aa5` |
| `backend/tests/test_auth_api.py` | 6741 | `sha256:e8b669db8f56d808d14e70dc74eac813a04960ffc70d8f3544bd7db530f9aba2` | `5d138da8ea28c2334b4eed1b76ac2ecd72f45d23` |
| `backend/tests/test_auth_storage.py` | 10294 | `sha256:91a9807f335e53e9a3c2c3d1fc9fa1e1239e27e2f3278a39094deb7eceb0c977` | `d799e808f9214d4f28c94ebb02c815665bd00d99` |
| `backend/tests/test_daily_memorial_scheduler.py` | 22036 | `sha256:7cc51238a065b481ebdc491e08116c29e66781006d026edc7ba471101ce53df1` | `94afb09db9223c0c29cc38831ddaa835b951fe0f` |
| `backend/tests/test_daily_memorial_storage.py` | 21075 | `sha256:996bfa4a4e1acb20f53c1503fb201c0a46bee0659e85b2cde36d8b6df020cc01` | `4cf9c04e8b5caa0c433172914ad1f9199ea97b56` |
| `backend/tests/test_readiness.py` | 17572 | `sha256:2aa88c2acf0407dba704745dabc1864394a11168027b9cb294f3b2d938d21f95` | `c1204ea41f382e68a6094f96dce693174ee214da` |
| `backend/tests/test_shiguan_adopted_evidence.py` | 46604 | `sha256:80d6e08e42b34352eaaeaa07f469534128df90f63d3cec49271e9ddfa9c8669f` | `43b108d1e716696370f2d5647d8e47a5afe2d84a` |
| `backend/tests/test_shiguan_migrations.py` | 54467 | `sha256:5c90ad6e6e68b92139cd1b255486c7a8e0addb469cd64ea8f5af5d602adeb587` | `f857e19aace4e5ef63f80abfb1080d81047e497e` |
| `backend/tests/test_sqlite_backup.py` | 50888 | `sha256:f07cf7bf68b896f2104e2cf645f18656887d9a9f68fb3e6bff50bae6fd043c07` | `01c23f4687b90bb68328655ed86cfbdde52f8833` |

全部模式冻结为 `100644`；最终 candidate 必须精确为十五个既有文件的 `M`，无第十六路径、无 mode 变化、无未跟踪文件。

## Affected Modules

- 模块：Tenant Principal V1、个人租户身份绑定、运行数据 registry、SQLite backup、史馆数据库与 maintenance、daily memorial storage 验证。
- 允许路径：`backend/app/api/auth.py`, `backend/app/auth/models.py`, `backend/app/auth/storage.py`, `backend/app/operations/runtime_data_registry.py`, `backend/app/operations/sqlite_backup.py`, `backend/app/shiguan/db.py`, `backend/app/shiguan/maintenance.py`, `backend/tests/test_auth_api.py`, `backend/tests/test_auth_storage.py`, `backend/tests/test_daily_memorial_scheduler.py`, `backend/tests/test_daily_memorial_storage.py`, `backend/tests/test_readiness.py`, `backend/tests/test_shiguan_adopted_evidence.py`, `backend/tests/test_shiguan_migrations.py`, `backend/tests/test_sqlite_backup.py`。

## Technical Plan

1. 三文件 approval 以本基线的直接单亲子落地，并获得本任务独有的 machine `GO / APPROVED_FOR_ONE_CHILD`。
2. 在唯一隔离工作区先 byte-for-byte 重物化前十四 donor 文件，第十五路径保持基线字节，复现 `test_daily_memorial_storage.py` 的真实 RED；环境/import/metadata 错误不得充当 RED。
3. 再 byte-for-byte 重物化冻结的第十五 blob，取得目标 GREEN 与 strict schema-drift 负例 GREEN。
4. 运行 exact15 focused、exact15 Ruff、根级矩阵及 Python/Security/Database 独立只读审查；P0–P2 立即 STOP。
5. 冻结十五文件身份后创建唯一 candidate commit。只有 committed/clean candidate 可运行 machine `--verify-candidate`。
6. 当前 `runtime_lock.py verify-candidate` 以 `/tmp`、离线 root-owned wheelhouse、候选第一方 wheel、三路 shard 验证完整 backend 与 Ruff；全部 PASS 后才允许普通 fast-forward push。

## Delivery Constraints

- approval 与 product 是两个连续、单亲、范围精确的提交。
- approval 未落地且 machine authority 未 GO 前不得写产品字节。
- 所有 SQLite 验证只使用临时数据；不得访问真实运行库、provider、secret 或生产网络。
- 不修改 runtime-lock、wheelhouse、lockfile、Harness、authority、CI、ADR、前端或公开 API。
- 禁止 force-push、部署、发布与 Pilot；远端漂移、机器 STOP、验证失败、范围扩大或 P0–P2 立即 STOP。

## Acceptance Criteria

- [ ] 三文件 approval 是 `98428a17…` 的直接单亲子，且普通 fast-forward 落地未漂移 `origin/ext-dev`。
- [ ] 本任务 machine authority 返回 `GO / APPROVED_FOR_ONE_CHILD` 后才物化 exact15。
- [ ] 前十四 donor + 基线第十五路径形成真实 RED；完整 exact15 donor 形成 GREEN，旧证据不继承。
- [ ] candidate 仅含十五个 `100644` 的 `M`，raw/blob/bundle 与冻结身份一致。
- [ ] focused、exact15 Ruff、三路 backend shard、Harness、Doctor、Authority regression、V2 与 diff check 全部通过。
- [ ] Python、Security、Database 独立审查均为 GO 且 P0–P2 为零。
- [ ] machine verify-candidate PASS 后才可普通 fast-forward push；不部署。

## Implementation Report

前序未提交 exact15 已形成目标 `2 passed`、focused `261 passed` 与 exact15 Ruff PASS；旧完整 backend 的四项 `/health` 失败由未安装第一方 `chaotang-os-backend` wheel 的环境合同缺口导致。该证据仅用于说明旧 STOP 根因，不授予新候选任何身份。runtime-lock exact2 已在 `98428a17…` 落地并以两个 cold cycle、三路 shard 和 machine verify 证明候选 wheel 验证合同可用。

## Acceptance Review

待本 successor 独立治理审查、machine authority、exact15 全新 RED/GREEN、完整矩阵、三路产品审查与 machine verify-candidate 完成后填写。任何旧 authority、nonce、candidate、测试或审查结论均不得复用。

## Stop Conditions

实时远端离开冻结基线、machine authority/verify STOP、donor 任一字节漂移、出现第十六路径、runtime-lock 或 schema-drift 门槛需修改、测试/审查失败，立即停止并保全证据。本任务不授权部署、发布、Pilot 或《朝堂能力协议 V1》产品实施。
