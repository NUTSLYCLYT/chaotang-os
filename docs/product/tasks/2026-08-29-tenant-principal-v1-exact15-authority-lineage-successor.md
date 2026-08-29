# Tenant Principal V1 Exact15 Authority Lineage Successor

任务 ID：`TENANT-PRINCIPAL-V1-EXACT15-AUTHORITY-LINEAGE-SUCCESSOR-20260829`

冻结基线：`origin/ext-dev@1e7a5efed79c17b51010eac36d104c6229bb3de5`

冻结 tree：`e310d950c57e87c43e7af777b960cc66cd05dbb6`

Approval RFC 8785 canonical digest：`sha256:d606a96dca6c1d0db344509987dd82ff3bcadf7717b416719cd1adb58e0b7df2`

## Status

Draft

细分状态：`DRAFT_NON_AUTHORIZING / PRODUCT_STOP / AUTHORITY_LINEAGE_SUCCESSOR`

旧候选 `c471b034353440401b18995ac13fbfdbe5cbc966` 明确标记为：

`STOP / VERIFICATION_FAILED / BYTE_DONOR_ONLY / NO_REANCHOR / NO_AUTHORITY_OR_EVIDENCE_INHERITANCE / DO_NOT_PUSH`

它只能为下述 exact14 提供逐 blob 字节；其 candidate 身份、authority、测试证据、review 结论和提交父子关系一律失效，不得推送或接受。

## Product Definition

本任务是 Tenant Principal V1 的验证合同纠正后继，不改变原产品定义、公开 API、schema-v6 或安全边界。唯一产品差异是第十五条既有测试路径中的故障注入方式；原 exact14 必须逐 blob 重物化。

## Corrective Scope

原 Tenant Principal V1 产品契约保持不变。本后继只纠正验证合同：旧测试 `test_update_exception_rolls_back_insert_and_run` 通过新增未登记 SQLite trigger 注入 UPDATE 失败；严格 schema-v6 drift 检查会在业务操作前正确失败关闭，使该测试不再抵达预期的业务专属错误边界。禁止放宽 drift 检查。

产品候选精确为 original exact14 加：

`backend/tests/test_daily_memorial_storage.py`

形成 exact15。前十四路径必须逐 blob 等于 c471 供体；第十五路径只能把上述 trigger 注入改成不改变 schema 的连接/执行失败注入，并继续证明：

- 对外仍为业务专属错误；
- 同一事务内 INSERT 与 run UPDATE 一并回滚；
- 严格 schema drift fail-closed 保持原样；
- 不修改生产代码、不引入第十六路径。

## Exact15

1. `backend/app/api/auth.py`
2. `backend/app/auth/models.py`
3. `backend/app/auth/storage.py`
4. `backend/app/operations/runtime_data_registry.py`
5. `backend/app/operations/sqlite_backup.py`
6. `backend/app/shiguan/db.py`
7. `backend/app/shiguan/maintenance.py`
8. `backend/tests/test_auth_api.py`
9. `backend/tests/test_auth_storage.py`
10. `backend/tests/test_daily_memorial_scheduler.py`
11. `backend/tests/test_daily_memorial_storage.py`
12. `backend/tests/test_readiness.py`
13. `backend/tests/test_shiguan_adopted_evidence.py`
14. `backend/tests/test_shiguan_migrations.py`
15. `backend/tests/test_sqlite_backup.py`

## Affected Modules

- 模块：Tenant Principal V1 exact14、daily memorial storage 验证合同。
- 允许路径：`backend/app/api/auth.py`, `backend/app/auth/models.py`, `backend/app/auth/storage.py`, `backend/app/operations/runtime_data_registry.py`, `backend/app/operations/sqlite_backup.py`, `backend/app/shiguan/db.py`, `backend/app/shiguan/maintenance.py`, `backend/tests/test_auth_api.py`, `backend/tests/test_auth_storage.py`, `backend/tests/test_daily_memorial_scheduler.py`, `backend/tests/test_daily_memorial_storage.py`, `backend/tests/test_readiness.py`, `backend/tests/test_shiguan_adopted_evidence.py`, `backend/tests/test_shiguan_migrations.py`, `backend/tests/test_sqlite_backup.py`。
- Tenant Principal V1 exact14：只允许从冻结供体 blob 重物化，不允许重新实现或修改。
- `backend/tests/test_daily_memorial_storage.py`：只允许纠正一个 UPDATE 失败注入测试。
- 产品实现、Harness、Authority、CI、ADR、前端、奖励、分享和发布模块均不受影响。

## Abandoned Exact14 Authority

远端 approval `1e7a5efed79c17b51010eac36d104c6229bb3de5` 对任务 `TENANT-PRINCIPAL-V1-EXACT14-SUCCESSOR-20260829` 的 machine authority 曾返回 `GO / APPROVED_FOR_ONE_CHILD`，approval digest 为 `sha256:2d04e3fc60da0ff7443883fd9b459595284e1e6c67721241794c04b63dcce853`。

Owner 已明确处置为：

`ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED / EXACT15_PRIORITY`

该 authority 未产生 child commit、未运行最终 verify、未推送产品 candidate；不得消费、恢复、继承或 re-anchor。现有 exact14 未提交工作树仅为十四文件 byte donor，不继承测试、审查、candidate 或 authority 身份。本 successor approval 普通快进离开 `1e7a5efe` 是 Owner 明确接受的生命周期结果。

## Lineage Successor Boundary

本包是基于实时最新主线的 forward-only lineage successor，不是旧 corrective 草案的 re-anchor。

- predecessor base：`63195b81871c0c32c6ace3f05138b8caeba80afe` / tree `33e24f7bdf8d2173826d7e4e5a19be9221621d74`
- readiness approval：`ecda2215058344a523160b6a0a2d427442b5e984`，直接单亲子，只新增三份 Tenant readiness prerequisite 治理文件。
- readiness task correction：`f6b567196bdf5a2b3f94af88c24722153f08f63f`，直接单亲子，只修改上述 readiness Task。
- readiness validator candidate：`80add8db37bbf4f1ddf0f5d35e5d55b05b843ed8` / tree `29ce6b2ef3194cb403f5c8256c15ac9d5e11f1f9`，直接单亲子，只修改 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`。
- 四段 changed paths 与本任务 exact15 产品路径集合交集精确为空。
- readiness validator candidate 是 exact15 完整验证的前置兼容落地，不授予本任务产品 authority，也不继承其 candidate 或验证身份。
- exact14 approval：`1e7a5efed79c17b51010eac36d104c6229bb3de5` / tree `e310d950c57e87c43e7af777b960cc66cd05dbb6`，是 `80add8db…` 的直接单亲子，只新增三份 exact14 successor 治理文件；与 exact15 产品路径零重叠，但产生了已由 Owner 放弃的 one-child authority。

旧未提交 corrective 三文件仅为 `REMOTE_BASE_DRIFT / BYTE_DONOR_ONLY / NO_REANCHOR / NO_AUTHORITY_OR_EVIDENCE_INHERITANCE`：

- Approval raw：`sha256:e50c6540ef7b24422ae33485c4625bdd2f36144be1285ac8706d886c1ad7dd62`
- Task raw：`sha256:9f8df9bd74f1dc8dbe2143db01efb83768e15287d0af46d7dc0b561fdbc3c343`
- Plan raw：`sha256:5607039c491253c2c8b58b33a96c559acda4adbc186f28cde64340114ae96abe`

## Donor Blob Contract

机器结构门禁冻结 exact14 的十四个 donor blob，并要求第十五路径相对 approval parent 真实变化；治理阶段不冻结不存在、不可重放的 target blob 或 patch digest。第十五路径必须先以基线字节复现已确认 RED，再仅通过测试内无 schema mutation 的执行失败注入取得 GREEN；最终 blob、patch、RED/GREEN 与 candidate evidence 只在真实实施和独立审查后冻结。全候选仍必须恰好为 15 个既有 `100644` 文件的 `M`，无新增、删除、改 mode 或额外路径。

## Temporary POSIX Environment Contract

TestClient 失败被分类为 `ENVIRONMENT_CONTRACT_MISMATCH`，不是产品 RED。旧 `/tmp/chaotang-t0-exact15-20260829` 与误触的 `/tmp/chaotang-t0-exact15-d4a91c2f7e6b4380a5c9e1f274b68d30` 均已实际创建，只能作为被拒绝的诊断证据，不删除、不复用、绝不进入 machine evidence。最终机器验证只允许使用此前未出现的冻结 nonce root：

- root：`/tmp/chaotang-t0-exact15-49d671a2eb064f80b5c3a27891de604f`
- venv：上述 root 下的 `venv`
- requirements：上述 root 下的 `requirements/test.txt`
- temp：上述 root 下的 `tmp`
- wheelhouse：只读消费 `/var/tmp/chaotang-m0-wheelhouse`

矩阵第一项必须由可信 `/usr/bin/python3 -I` 执行 bootstrap；nonce root 已存在或为 symlink 时立即 STOP，禁止先删除，必须在已验证 root-owned `01777` POSIX `/tmp` 下原子创建 `0700` root。bootstrap 调用现有非 root wheelhouse permission verifier，机械复算 lock self digest、pyproject digest、TEST projection 与 64 个 root-owned non-writable wheel，再冻结四参数 `prepare-install --lock --wheelhouse --pyproject --output-dir`。环境由 `/usr/bin/python3 3.12.3` 的 `venv --without-pip` 创建，并由受控 system pip `--python <venv>` 以 `--isolated --no-index --require-hashes --no-deps --no-cache-dir --no-compile --only-binary=:all:` 安装。`test.txt` SHA-256 必须为 `15a890d4fcac9a1eb4f9654e0b795728d462b3801c40bb7c64f908c0894d6b69`。

第二、三项在任何 pytest/ruff 前验证解释器/venv 身份、realpath/uid/mode/no-symlink、`tempfile.gettempdir()` 与 create-write-read-truncate-delete，要求 installed distributions 全集合精确等于 60 项 TEST closure，逐 RECORD 复核安装文件。pytest 固定 `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`，显式禁用冻结观察到的 `anyio` 与 `langsmith_plugin` entry point；任何额外 distribution/plugin 均 STOP。所有 pytest/ruff 及 Authority regression 进程设置精确 `PATH/TMPDIR/TEMP/TMP`。不得持久修改系统、用户、Git 或仓库配置。

## Technical Plan

1. 先落地并机器授权三文件治理提交。
2. 逐 blob 重物化 c471 exact14，第十五路径保持基线字节，运行目标测试取得有效 RED。
3. 只修改第十五路径的无 schema 执行失败注入，精准运行目标节点与 `test_get_connection_rejects_schema_drift_without_repairing_it`，取得双 GREEN。
4. 建立冻结 `/tmp` 环境，运行 exact15 完整矩阵和三路独立审查。
5. 只在 machine verify-candidate PASS 后创建普通 fast-forward 远端更新。

## Delivery Constraints

- approval 与 product 必须是两个连续、单亲、范围精确的本地提交。
- approval 只含本任务三份新治理文件；product 只含 exact15 的 15 个 `M`。
- approval 未远端到位且 machine authority 未 GO 前，不得物化产品文件。
- 所有 SQLite 验证仅使用临时数据；不得读取或修改真实运行库。
- 不新增依赖、不访问 provider/secret/生产数据、不修改持久配置。
- 禁止 force-push、部署、发布、Pilot；远端漂移或机器 STOP 立即停止。

## Acceptance Criteria

- [ ] 三份治理文件构成基线的唯一单亲 approval commit，并以普通 fast-forward 到达未漂移 `origin/ext-dev`。
- [ ] machine authority 返回 `GO / APPROVED_FOR_ONE_CHILD` 后才可物化产品候选。
- [ ] 未修改的 exact15 先复现精确旧测试 RED；修正后该测试及 strict drift 负例 GREEN。
- [ ] c471 exact14 blob 逐一相等；第十五路径只有无 schema 变更的故障注入修正。
- [ ] 临时 POSIX 环境指纹、focused/full pytest、exact15 ruff、结构、Harness 与 convergence 全部在同一 candidate SHA/tree 通过。
- [ ] Python、安全、数据库三路独立审查无 P0–P2。
- [ ] machine verify-candidate PASS 后才可普通 fast-forward push；禁止 force-push、部署、发布和 Pilot。

## Stop Conditions

远端漂移、机器 STOP、临时环境无法重现、范围出现第十六路径、任何产品实现差异、schema drift 门槛弱化或独立审查出现 P0–P2，均立即 STOP。该任务不授权任何产品公开分享、奖励、部署、发布或 Pilot。

## Implementation Report

待执行。治理提交前本节只记录计划，不声称产品实现、测试或远端结果。

## Acceptance Review

待同一 candidate SHA/tree 的完整矩阵、三路独立审查与 machine verify-candidate 完成后填写。旧 c471 的任何证据不得复用。
