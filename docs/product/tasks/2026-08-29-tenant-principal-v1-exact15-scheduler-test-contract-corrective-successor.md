# Tenant Principal V1 Exact15 Scheduler Test Contract Corrective Successor

任务 ID：`TENANT-PRINCIPAL-V1-EXACT15-SCHEDULER-TEST-CONTRACT-CORRECTIVE-SUCCESSOR-20260829`

冻结基线：`origin/ext-dev@0631ac0d5e14a71121d6077c3d73e105c15e2bb9`

冻结 tree：`a5d1cb57d803dcab19901df07273f2937bb1dda5`

Approval RFC 8785 canonical digest：`sha256:522df0c020970dd31575b1c7c8abc1e9914951c823bc348235b2a96f54e6dfdd`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / APPROVAL_SCOPE_CONTRADICTION_CORRECTIVE_SUCCESSOR`

## Product Definition

本任务是 Tenant Principal V1 exact15 的 forward-only scheduler test-contract 纠偏后继。前序 authority 已返回 `GO / APPROVED_FOR_ONE_CHILD`，但未形成 product child；其候选在 focused 验证中因冻结测试 helper 与安全调度合同冲突而停止：生产查询正确地仅枚举 active `OWNER/PERSONAL` principal，而旧 `test_daily_memorial_storage.py` helper 只创建无 tenant membership 的裸 user。

修复生产查询以接受裸 user 会重新打开“撤销 membership 后仍可创建 run、读取私有事实、调用模型并写草稿”的 P1 越权路径。本轮因此冻结前序已经关闭两个 P1 的十四条产品/测试字节，只允许一条测试 fixture 路径形成新 blob，为测试用户建立合法 PERSONAL tenant 与 active OWNER membership。

## Predecessor Disposition

- predecessor approval：`0631ac0d5e14a71121d6077c3d73e105c15e2bb9` / tree `a5d1cb57d803dcab19901df07273f2937bb1dda5`。
- predecessor machine authority 曾返回 `GO / APPROVED_FOR_ONE_CHILD`，但没有 candidate commit、machine verify 或 product push。
- disposition：`STOP / APPROVAL_SCOPE_CONTRADICTION / ABANDONED_UNCONSUMED / REISSUE_REQUIRED / NO_REANCHOR`。
- predecessor uncommitted exact15 工作区 HEAD/tree 仍为上述 approval；其字节身份冻结如下，但仅为 donor evidence，不继承 candidate、验证、审查、通过或 authority 身份。
- 本 successor 普通快进离开 predecessor approval 是显式生命周期处置，不构成旧 one-child authority 消费。

## Frozen Donor Identity

前序未提交 exact15 donor 结构为 `15 MODIFY / 100644`，无第十六路径。

- exact15 donor bundle：`sha256:89d38102cc9c326b95882c110ab2b4e812e7057a60c707de975dca0b369d7bd7`
- combined binary full-index diff：`sha256:c9f2e0a251f334b66e15ca00ac366f592212c2a46db7cf133f49472eec34e4eb`
- bundle 算法：按 path 字典序，为每条记录构造 `{path, mode:"100644", bytes, rawSha256}`，对 RFC 8785 canonical JSON array 的 UTF-8 bytes 计算 SHA-256。

| Path | Git blob | Raw SHA-256 | Bytes |
| --- | --- | --- | ---: |
| `backend/app/api/auth.py` | `513a7e64c34e10f7cbdc17c537b957c87edbe2c6` | `sha256:2d9a78aaad0d8f95a8b91383d3c179a3a6b00a15b9df8e2b36854571f26140df` | 5138 |
| `backend/app/auth/models.py` | `d5eaf6f3775f37bf47466b15fa8536efbbd08e41` | `sha256:57650b32a38141846e88e6089c956110ae173fcc413ade9b623a796231ea7a12` | 896 |
| `backend/app/auth/storage.py` | `d5bd080af7828e29fbffaf1349cdaab98d760164` | `sha256:d7257cb4421270e12930a2b355b9ab9aa6d049daead13e86cf843d3205ceab0f` | 14859 |
| `backend/app/operations/runtime_data_registry.py` | `a5f2aac19a0d4f4a737b227f39f9e8c29b48d9af` | `sha256:fa0aa51ac828750da007aefa5f10779c899ab04b67aaa8a7055f6985110a4323` | 15824 |
| `backend/app/operations/sqlite_backup.py` | `8990f5509f860a1da72250242d8e8ad6dda0e1b6` | `sha256:591a212e2253e2fa707986a6645b2bedc7a49ba5cc370dbb46b7cd954d002f98` | 106793 |
| `backend/app/shiguan/db.py` | `9221ff071c2667188293a939f82ac7ab8e940b3a` | `sha256:5e478d3bedacd3b8150919b90032025a546f7843009b8c849f8d40fe54e6468b` | 41828 |
| `backend/app/shiguan/maintenance.py` | `e6b70a925f22d2775590d06f367d3f41aed7af10` | `sha256:95caff2f901d2b065790baa24ca2b3d7d5a0bcf6606724067692f548088f13c8` | 26649 |
| `backend/tests/test_auth_api.py` | `5d138da8ea28c2334b4eed1b76ac2ecd72f45d23` | `sha256:e8b669db8f56d808d14e70dc74eac813a04960ffc70d8f3544bd7db530f9aba2` | 6741 |
| `backend/tests/test_auth_storage.py` | `d799e808f9214d4f28c94ebb02c815665bd00d99` | `sha256:91a9807f335e53e9a3c2c3d1fc9fa1e1239e27e2f3278a39094deb7eceb0c977` | 10294 |
| `backend/tests/test_daily_memorial_scheduler.py` | `1155363f5f2fbf924bb56197b74e66a3d70ea6d6` | `sha256:428d35906eafc90faac590837a32aefa0c96f5d22343c25cdddc7e8569d1f445` | 23548 |
| `backend/tests/test_daily_memorial_storage.py` | `4cf9c04e8b5caa0c433172914ad1f9199ea97b56` | `sha256:996bfa4a4e1acb20f53c1503fb201c0a46bee0659e85b2cde36d8b6df020cc01` | 21075 |
| `backend/tests/test_readiness.py` | `c1204ea41f382e68a6094f96dce693174ee214da` | `sha256:2aa88c2acf0407dba704745dabc1864394a11168027b9cb294f3b2d938d21f95` | 17572 |
| `backend/tests/test_shiguan_adopted_evidence.py` | `43b108d1e716696370f2d5647d8e47a5afe2d84a` | `sha256:80d6e08e42b34352eaaeaa07f469534128df90f63d3cec49271e9ddfa9c8669f` | 46604 |
| `backend/tests/test_shiguan_migrations.py` | `a1cc05c9a153fc90119672d554a3d9271f42feae` | `sha256:1527ff599dc28c27feeb810080e24d4a81331caad915bb9c0c7a2979e06451a6` | 57906 |
| `backend/tests/test_sqlite_backup.py` | `01c23f4687b90bb68328655ed86cfbdde52f8833` | `sha256:f07cf7bf68b896f2104e2cf645f18656887d9a9f68fb3e6bff50bae6fd043c07` | 50888 |

前十四条（除 `backend/tests/test_daily_memorial_storage.py` 外）为 fixed14，最终 candidate blob 必须精确相等。唯一 corrective path 为 `backend/tests/test_daily_memorial_storage.py`，最终 blob 必须不同于 `4cf9c04e…`。任何其他 blob 漂移、ADD/DELETE、mode 变化或第十六路径立即 STOP。

## Affected Modules

- 模块：Tenant Principal V1、scheduler principal selection、daily memorial storage test fixture、schema-v5→v6 identity migration preflight。
- 允许路径：`backend/app/api/auth.py`, `backend/app/auth/models.py`, `backend/app/auth/storage.py`, `backend/app/operations/runtime_data_registry.py`, `backend/app/operations/sqlite_backup.py`, `backend/app/shiguan/db.py`, `backend/app/shiguan/maintenance.py`, `backend/tests/test_auth_api.py`, `backend/tests/test_auth_storage.py`, `backend/tests/test_daily_memorial_scheduler.py`, `backend/tests/test_daily_memorial_storage.py`, `backend/tests/test_readiness.py`, `backend/tests/test_shiguan_adopted_evidence.py`, `backend/tests/test_shiguan_migrations.py`, `backend/tests/test_sqlite_backup.py`。

## Technical Plan

1. approval 落地并取得本任务唯一 machine GO 后，从新 approval 创建唯一 candidate 工作区。
2. 从上述 frozen donor identity byte-for-byte 重物化完整 exact15；不继承旧测试或审查结论。
3. 运行 focused 集合，精确复现 `test_scheduled_user_enumeration_is_sorted_and_internal` 单一失败，其余 268 项通过。
4. 只修改 `test_daily_memorial_storage.py` fixture/helper，为该测试用户创建合法 PERSONAL tenant 与未撤销 OWNER membership；不得修改 fixed14 或放宽生产查询。
5. 重新运行 RED/GREEN、focused、Ruff、backend-full、根矩阵、三路独立审查并冻结全新 exact15 身份。
6. 创建唯一 candidate commit，machine verify-candidate 全绿后才普通 fast-forward push；不部署。

## RED And Security Negatives

- membershipless user 不得被生产 scheduler 当成 principal；只有测试显式建立 PERSONAL/OWNER 关系后正向枚举才 GREEN。
- revoked membership 后 targets 不含该 user，owners_seen/run/model/fact/draft/database 副作用均为零。
- active PERSONAL/OWNER 正常且去重调度；跨 tenant、非 OWNER、非 PERSONAL、revoked 或 membershipless 均 fail-closed。
- 跨 user 的 username/email strip+casefold 冲突必须在 backup 和任何迁移写入前拒绝；同 user 同 key 必须允许。
- import、环境、metadata、tempdir 或 wheelhouse 失败不得冒充 RED。

## Delivery Constraints

- 不修改 fixed14、scheduler orchestration、公开 API、schema-v6、runtime-lock、Harness、authority、CI、ADR、前端或 exact15 外路径。
- 不新增 membershipless/revoked user 的生产 fallback。
- 不删除、跳过或放宽既有安全断言。
- 验证只使用临时数据；禁止 provider、secret、生产数据、网络副作用、Pilot、发布或部署。

## Acceptance Criteria

- [ ] 本 successor approval 是 `0631ac0d…` 的直接单亲子；旧 one-child authority 明确 abandoned 且未消费。
- [ ] 新 candidate 机械匹配冻结 donor，再复现单一 focused failure。
- [ ] 最终候选精确 `15 MODIFY / 100644`；fixed14 blob 全部相等，唯一 fixture blob 变化。
- [ ] scheduler 撤销/active 对照、migration ambiguity/same-user 对照、focused、Ruff、backend-full 与根矩阵全绿。
- [ ] Code/Python-Database/Security 独立审查均 GO 且 P0–P2 为零。
- [ ] machine verify-candidate PASS 后才普通 fast-forward push；不部署。

## Implementation Report

前序 candidate 已关闭 scheduler revoked-principal 与 legacy ambiguity 两个 P1；targeted 为 `8 passed`。随后 focused 为 `268 passed, 1 failed`，唯一失败是冻结 fixture 创建 membershipless user，而安全生产查询正确拒绝。该证据只证明范围矛盾与 donor 字节，不构成本 successor 的验证继承。

## Acceptance Review

待新 successor 的全新 RED/GREEN、完整矩阵、三路独立审查与 machine verify-candidate 完成后填写。

## Stop Conditions

远端漂移、machine STOP、donor 身份不一致、focused 失败拓扑变化、需第十六路径、fixed14 任一 blob 漂移、唯一 fixture blob 未变化、生产安全门放宽、验证失败或独立审查出现 P0–P2，立即停止。禁止 force-push、Pilot、发布与部署。
