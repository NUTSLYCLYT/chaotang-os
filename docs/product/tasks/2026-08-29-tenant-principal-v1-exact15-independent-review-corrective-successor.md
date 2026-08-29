# Tenant Principal V1 Exact15 Independent Review Corrective Successor

任务 ID：`TENANT-PRINCIPAL-V1-EXACT15-INDEPENDENT-REVIEW-CORRECTIVE-SUCCESSOR-20260829`

冻结基线：`origin/ext-dev@9f2ab34015c09ea75be8565cc44694fdfc86cf32`

冻结 tree：`33aa61b127c8684792f13d6e0af22abc11f6fb43`

Approval RFC 8785 canonical digest：`sha256:3d6e416b0d572f0945132cd0790672892947f052c1662a20eaddc3fd9910ecdb`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / INDEPENDENT_REVIEW_CORRECTIVE_SUCCESSOR`

## Product Definition

本任务是 Tenant Principal V1 exact15 的 forward-only 独立审查纠偏后继。前序 exact15 未提交候选已通过功能矩阵，但因独立 Code Review 和 Security Review 各发现一个 P1 而停止；它仅为十五文件 byte donor，不具有 candidate、通过、验证、审查或 authority 可继承身份。

本轮仍交付同一 exact15 产品范围，精确关闭：

1. membership 撤销后后台 scheduler 仍枚举该用户并创建 run/读取事实/调用模型/写草稿的授权绕过；
2. schema-v5 允许跨用户 `username`/`email` casefold key 冲突，迁移却将其标记为 schema-v6 `VERIFIED`，导致同一登录 identifier 非确定性映射 principal。

## Predecessor Disposition

- predecessor approval：`9f2ab34015c09ea75be8565cc44694fdfc86cf32` / digest `sha256:b14bc90be745d3c1b9bde4489f0cc8404567f558f49011bf84a8822d6f9a4411`。
- predecessor machine authority 曾返回 `GO / APPROVED_FOR_ONE_CHILD`，但没有产品 child、没有 machine verify、没有 candidate push。
- disposition：`ABANDONED_AFTER_INDEPENDENT_REVIEW_NO_GO / REISSUE_REQUIRED / NO_REANCHOR`。
- predecessor uncommitted candidate：`STOP / NO_GO_BY_INDEPENDENT_DOUBLE_REVIEW / BYTE_DONOR_ONLY / NO_VERIFICATION_INHERITANCE`。
- 本 successor approval 普通快进离开 predecessor approval 是显式生命周期处置，不构成旧 one-child authority 消费。

## Frozen Exact15 Boundary

最终 candidate 仍精确为 predecessor Task 的十五个既有文件 `15 MODIFY / 100644`。原 donor bundle 为 `sha256:cd217691fed12076033fd2d17153c9fc7f5280d7051666aae383dfd9e9ce01f5`，原 full-index diff 为 `sha256:21448715c24ce668e2f2bfd395d04180e181dd157ec8f938b36b50356e4d8d93`；它们只标记被拒绝候选的 byte donor 身份。

十条只读重物化路径必须保持 predecessor donor blob：

- `backend/app/api/auth.py` → `513a7e64c34e10f7cbdc17c537b957c87edbe2c6`
- `backend/app/auth/models.py` → `d5eaf6f3775f37bf47466b15fa8536efbbd08e41`
- `backend/app/operations/runtime_data_registry.py` → `a5f2aac19a0d4f4a737b227f39f9e8c29b48d9af`
- `backend/app/operations/sqlite_backup.py` → `8990f5509f860a1da72250242d8e8ad6dda0e1b6`
- `backend/tests/test_auth_api.py` → `5d138da8ea28c2334b4eed1b76ac2ecd72f45d23`
- `backend/tests/test_auth_storage.py` → `d799e808f9214d4f28c94ebb02c815665bd00d99`
- `backend/tests/test_daily_memorial_storage.py` → `4cf9c04e8b5caa0c433172914ad1f9199ea97b56`
- `backend/tests/test_readiness.py` → `c1204ea41f382e68a6094f96dce693174ee214da`
- `backend/tests/test_shiguan_adopted_evidence.py` → `43b108d1e716696370f2d5647d8e47a5afe2d84a`
- `backend/tests/test_sqlite_backup.py` → `01c23f4687b90bb68328655ed86cfbdde52f8833`

五条 corrective paths 必须从 donor 字节产生真实 RED，再形成新 blob：

- `backend/app/auth/storage.py`
- `backend/app/shiguan/db.py`
- `backend/app/shiguan/maintenance.py`
- `backend/tests/test_daily_memorial_scheduler.py`
- `backend/tests/test_shiguan_migrations.py`

任何第十六路径、ADD/DELETE、mode 变化或十条冻结 blob 漂移立即 STOP。

## Affected Modules

- 模块：Tenant Principal V1、scheduler principal selection、schema-v5→v6 migration preflight。
- 允许路径：`backend/app/api/auth.py`, `backend/app/auth/models.py`, `backend/app/auth/storage.py`, `backend/app/operations/runtime_data_registry.py`, `backend/app/operations/sqlite_backup.py`, `backend/app/shiguan/db.py`, `backend/app/shiguan/maintenance.py`, `backend/tests/test_auth_api.py`, `backend/tests/test_auth_storage.py`, `backend/tests/test_daily_memorial_scheduler.py`, `backend/tests/test_daily_memorial_storage.py`, `backend/tests/test_readiness.py`, `backend/tests/test_shiguan_adopted_evidence.py`, `backend/tests/test_shiguan_migrations.py`, `backend/tests/test_sqlite_backup.py`。

## Technical Plan

1. approval 落地并取得本任务唯一 machine GO 后，从新 approval 创建唯一 candidate 工作区。
2. 先重物化完整 predecessor exact15 donor；不得继承旧测试结果。
3. 只在两条测试 corrective paths 增加负例并证明真实 RED。
4. 最小修改三条生产 corrective paths：scheduler 查询只接受 active `OWNER/PERSONAL` membership；v5 migration 在任何 backup 或 mutation 前建立规范化 identifier key 到 user_id 的唯一映射，同一 key 只有在指向不同 user_id 时才稳定 fail-closed。
5. 运行新增测试、focused、Ruff、完整 backend、根矩阵和三路独立审查；冻结全新十五文件身份。
6. 创建唯一 candidate commit，machine verify-candidate 全绿后才普通快进 push。

## RED And Security Negatives

- 撤销 membership 后：session 不可解析、scheduler targets 不含该 user、owners_seen=0、run/model/fact/draft/database 副作用均为零。
- active PERSONAL/OWNER 仍正常调度；不同用户和租户保持隔离。
- 精确 schema-v5 中同一规范化 identifier key 映射到不同 user_id（包括 A.username 与 B.email 相同、大小写变体或 Unicode casefold 等价）时，迁移必须在 backup 与任何写入前失败。
- 同一 user_id 的 username 与 email 规范化为同一 key 时仍是唯一 principal，必须保留可迁移、可登录的正向语义。
- 歧义失败后：源数据库 bytes/schema/rows/user_version 不变、无 `.v5-backup`、无 tenant/membership/session 新身份、运行库不 ready。
- 唯一且无歧义的 v5 仍能迁移、readback、backup 并变为 VERIFIED。

## Delivery Constraints

- 不修改 scheduler orchestration、公开 API、schema-v6 结构、runtime-lock、Harness、authority、CI、ADR、前端或 exact15 外路径。
- 不把撤销 membership 当作删除 user，不自动恢复或替换 principal。
- 不用 SQL `fetchone()`、排序或密码匹配掩盖身份歧义；歧义必须在迁移前整体拒绝。
- 所有数据库验证只使用临时数据；禁止 provider、secret、生产数据、网络、部署、发布或 Pilot。

## Acceptance Criteria

- [ ] 本 successor approval 是 `9f2ab340…` 的直接单亲子，machine authority 仅授权本任务 one child。
- [ ] 两个独立审查 P1 均先形成真实 RED，再由三条生产 corrective paths 关闭。
- [ ] 最终候选精确 `15 MODIFY / 100644`；十条 frozen donor blob 不变，五条 corrective blob 全部变化。
- [ ] 新增负例、focused、Ruff、backend-full、三路 machine shard、Harness/Doctor/Authority/V2 全绿。
- [ ] Code/Python-Database/Security 独立审查均 GO 且 P0–P2 为零。
- [ ] machine verify-candidate PASS 后才可普通 fast-forward push；不部署。

## Implementation Report

被拒绝 predecessor candidate 的有效保全证据：真实 RED→GREEN、focused `261 passed`、backend-full `4422 passed, 4 skipped, 3 warnings`、Ruff 与根矩阵全绿；Python/Database Review GO。Code Review 发现 v5 登录标识歧义 P1；Security Review 发现 membership 撤销未传递到 scheduler P1。全部旧候选证据不得继承为本 successor 通过结论。

## Acceptance Review

待本 successor 的全新 RED/GREEN、完整矩阵、三路独立审查与 machine verify-candidate 完成后填写。

## Stop Conditions

远端漂移、machine STOP、RED 不真实、需第十六路径、十条 frozen blob 漂移、corrective 路径未变化、任何验证失败或独立审查出现 P0–P2，立即停止。禁止 force-push、部署、发布与 Pilot。
