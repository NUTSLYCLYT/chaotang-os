# Tenant Principal V1 Exact15 Credential Guard Corrective Successor

任务 ID：`TENANT-PRINCIPAL-V1-EXACT15-CREDENTIAL-GUARD-CORRECTIVE-SUCCESSOR-20260829`

冻结基线：`origin/ext-dev@291733a874ffa441949c74ce56fe5f83753689c4`

冻结 tree：`033b2c4557b21dc9a49ea4f6b76c5815ff0cb5b8`

Approval RFC 8785 canonical digest：`sha256:e66e50aca5113d4a225b070260165a085dba432c295b161ca710f457b23dab7d`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / COMMIT_GUARD_CONTRACT_CORRECTIVE_SUCCESSOR`

## Product Definition

本任务是 Tenant Principal V1 exact15 的 forward-only 凭据守卫合同纠偏后继。前序 scheduler-contract authority 已返回 GO，候选也通过完整测试与三审，但普通 candidate commit 被既有 credential-leak hook 正确 fail-closed：migration 正向测试把一个硬编码登录值直接传给 `hash_password`，被语法守卫判为疑似真实凭据。

禁止跳过 hook、放宽守卫或修改 Git 配置。本轮冻结前序最终 candidate 的十四条 blob，只允许 `backend/tests/test_shiguan_migrations.py` 使用 `secrets.token_urlsafe(32)` 生成进程级、非持久的测试 credential，并以同一局部 `login_value` 同时完成 `hash_password(login_value)` 与登录正例。不得读取真实环境 secret，不得记录、输出或持久化明文。

## Predecessor Disposition

- predecessor approval：`291733a874ffa441949c74ce56fe5f83753689c4` / tree `033b2c4557b21dc9a49ea4f6b76c5815ff0cb5b8`。
- predecessor authority：`GO / APPROVED_FOR_ONE_CHILD`，digest `sha256:522df0c020970dd31575b1c7c8abc1e9914951c823bc348235b2a96f54e6dfdd`。
- 普通 commit 尝试被 hook 阻断；没有 candidate commit、machine verify 或 push。暂存 exact15 仅为 donor evidence。
- disposition：`STOP / COMMIT_GUARD_CONTRACT_CONTRADICTION / ABANDONED_UNCONSUMED / REISSUE_REQUIRED / NO_REANCHOR`。
- predecessor 验证、三审与 authority 不得继承；本 successor 必须全量重跑。

## Frozen Donor Identity

前序最终 exact15 donor：`15 MODIFY / 100644`，无第十六路径。

- bundle：`sha256:1860ba0415ae7a6a9fb5ef36f9f8dc247c24a3195689ed1d652f79351677e0cd`
- combined binary full-index diff：`sha256:a2584159b3a47db2ab6e94b4b01c025c51256103a8d4136f911532327f314869`
- bundle 算法：path 字典序的 `{path, mode:"100644", bytes, rawSha256}` RFC 8785 canonical array 后计算 SHA-256。

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
| `backend/tests/test_daily_memorial_storage.py` | `7413250fd00d34276a9e2cae037fcf229270f24b` | `sha256:b3cefb1ad4e6ec413fb5f689b507fdf5029d98ac859f84554217442a4689e850` | 21827 |
| `backend/tests/test_readiness.py` | `c1204ea41f382e68a6094f96dce693174ee214da` | `sha256:2aa88c2acf0407dba704745dabc1864394a11168027b9cb294f3b2d938d21f95` | 17572 |
| `backend/tests/test_shiguan_adopted_evidence.py` | `43b108d1e716696370f2d5647d8e47a5afe2d84a` | `sha256:80d6e08e42b34352eaaeaa07f469534128df90f63d3cec49271e9ddfa9c8669f` | 46604 |
| `backend/tests/test_shiguan_migrations.py` | `a1cc05c9a153fc90119672d554a3d9271f42feae` | `sha256:1527ff599dc28c27feeb810080e24d4a81331caad915bb9c0c7a2979e06451a6` | 57906 |
| `backend/tests/test_sqlite_backup.py` | `01c23f4687b90bb68328655ed86cfbdde52f8833` | `sha256:f07cf7bf68b896f2104e2cf645f18656887d9a9f68fb3e6bff50bae6fd043c07` | 50888 |

除 `backend/tests/test_shiguan_migrations.py` 外为 fixed14；最终 blob 必须逐条精确相等。唯一 corrective path 必须离开 `a1cc05c9…`，且语义差异只能是导入标准库 `secrets`、生成局部随机测试值并在同一测试内用于哈希与登录。任何其他变化立即 STOP。

## Affected Modules

- 模块：Tenant Principal V1、schema-v5→v6 migration test、credential-leak pre-commit contract。
- 允许路径：manifest 冻结的 exact15；实际可变路径仅 `backend/tests/test_shiguan_migrations.py`。

## Technical Plan

1. 新 approval 与 machine GO 后，从新基线建立唯一 candidate 工作区。
2. 按 donor manifest 重物化 exact15；复核 bundle/full-index diff。
3. 暂存 exact15 并运行既有 credential guard，精确证明唯一 RED 是 migration 正向测试中直接传给 `hash_password` 的硬编码登录值。
4. 仅在该测试内生成 `login_value = secrets.token_urlsafe(32)`，同一变量用于哈希与登录；不得修改 guard、测试断言、哈希算法或其他路径。
5. 运行该正向迁移/登录测试，证明随机测试 credential 的写入、迁移与认证链闭合；运行原 credential guard 必须 GREEN。
6. 重跑 focused、Ruff、backend-full、根矩阵与三路独立审查；冻结新 exact15。
7. 普通 commit hooks 必须自然通过；machine verify-candidate PASS 后才普通快进 push。

## RED And Security Negatives

- RED 必须来自现有 credential guard 对 migration 正向测试硬编码登录值的单一命中；测试/环境失败不得冒充。
- GREEN 后 guard 不得出现凭据命中，也不得通过修改/豁免/跳过 guard 达成。
- 随机测试 credential 只存在于当前测试进程内；不得从环境读取、记录、输出或以明文写入数据库；same-principal migration 与登录正例继续通过。
- fixed14 中 revoked principal 零副作用、legacy cross-user ambiguity fail-closed、same-user same-key 正例均不变。

## Delivery Constraints

- 不修改 credential guard、Git config、hooks、Harness、authority、runtime-lock、生产代码、fixed14 或第十六路径。
- 不引入真实凭据，不跳过 hooks，不用环境变量禁用门禁。
- 不继承 predecessor candidate/验证/审查/authority。
- 不 Pilot、不发布、不部署。

## Acceptance Criteria

- [ ] 新 approval 是 `291733a8…` 的直接单亲子，predecessor authority abandoned unconsumed。
- [ ] donor exact15 身份全部匹配；guard RED 精确且唯一。
- [ ] 最终 candidate 为 `15 MODIFY / 100644`；fixed14 全等，仅 migration test blob变化。
- [ ] 临时随机 credential 的 hash/migration/login 正例、focused、Ruff、backend-full、root矩阵全绿。
- [ ] 普通 commit hooks 自然通过；Code/Python-DB/Security 三审 GO。
- [ ] machine verify-candidate PASS 后才普通快进 push；不部署。

## Implementation Report

前序最终字节曾通过 storage `24 passed`、focused `269 passed`、backend-full `4430 passed, 4 skipped, 3 warnings`、根矩阵与三审；但普通 commit hook以疑似凭据命中失败，因此全部仅为 donor/诊断证据，不能继承为本轮通过结论。

## Acceptance Review

待本 successor 全新 RED/GREEN、矩阵、三审、commit hooks 与 machine verification 完成后填写。

## Stop Conditions

远端漂移、machine STOP、guard RED 不唯一、需修改 guard/fixed14/第十六路径、随机值被读取自环境或输出/明文持久化、验证失败、hooks 再失败或独立审查 P0–P2，立即 STOP。禁止 force-push、Pilot、发布与部署。
