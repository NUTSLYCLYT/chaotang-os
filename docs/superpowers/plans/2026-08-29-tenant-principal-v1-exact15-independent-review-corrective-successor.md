# Tenant Principal V1 Exact15 Independent Review Corrective Successor Plan

任务：`TENANT-PRINCIPAL-V1-EXACT15-INDEPENDENT-REVIEW-CORRECTIVE-SUCCESSOR-20260829`

基线：`9f2ab34015c09ea75be8565cc44694fdfc86cf32` / tree `33aa61b127c8684792f13d6e0af22abc11f6fb43`

Approval RFC 8785 canonical digest：`sha256:3d6e416b0d572f0945132cd0790672892947f052c1662a20eaddc3fd9910ecdb`

状态：`PLAN_ONLY / NON_AUTHORIZING / DOUBLE_REVIEW_CORRECTIVE`

## Goal

保留 predecessor exact15 的完整已验证价值，在同一十五路径内修复“撤销 principal 仍被后台调度”和“歧义 legacy identifier 被迁移为 VERIFIED”两个 P1，并用新 authority、新 RED/GREEN、新审查和 machine verification 形成唯一可接受候选。

## Dependency DAG

`98428a17 runtime-lock exact2` → `9f2ab340 predecessor exact15 approval (authority GO, product NO-GO, no child)` → `corrective approval` → `corrective exact15 candidate`。

旧 exact14/exact15 approvals、旧 nonce、旧未提交 candidate、测试和 review 不能跨边继承。predecessor one-child 以 `ABANDONED_AFTER_INDEPENDENT_REVIEW_NO_GO` 终止。

## Exact Paths

- Final product scope：Task 中固定十五路径，结构 `15 M / 100644`。
- Frozen donor-only：十条路径及 blob 必须逐字节不变。
- Corrective exact5：`auth/storage.py`, `shiguan/db.py`, `shiguan/maintenance.py`, `test_daily_memorial_scheduler.py`, `test_shiguan_migrations.py`。

## RED Phase

1. 新 approval 基线上重物化完整 predecessor donor。
2. 仅增加 scheduler tests：撤销 membership 后仍出现在 targets、创建 run 或调用 invoker，必须 RED；active owner 对照必须 GREEN。
3. 仅增加 migration tests：同一规范化 key 映射到不同 user_id 的跨行 username/email casefold collision 仍生成 backup、写 v6 或 ready，必须 RED；分别覆盖直接 `db.migrate_v5_to_v6` 与 governed `maintenance.migrate_runtime_v5_to_v6` 入口，同时覆盖大小写/Unicode casefold 等价，并以同一 user_id 的 username==email 可正常迁移作为正向对照。
4. import、环境、metadata、tempdir、轮库错误不得冒充 RED。

## GREEN Phase

1. `list_user_ids_for_scheduled_jobs` 用 closed JOIN，只枚举 `tenant_memberships.revoked_at IS NULL AND role='OWNER' AND tenants.kind='PERSONAL'`，并消除重复/歧义 target。
2. 在 `db.py` 提供只读、全量、确定性的 legacy identity namespace preflight；以字符串 strip 后 `casefold()` 的 username/email key 建立 `key → user_id` 映射。相同 key 重复属于同一 user_id 时允许；仅当相同 key 映射到不同 user_id 时拒绝。`db._migrate_v5_to_v6_connection` 必须在首个 DDL/DML 前调用该 helper，不能只保护 governed maintenance 入口。
3. `maintenance.py` 在 snapshot backup 和任何 schema/data mutation 前、同一 held source FD 与 `BEGIN IMMEDIATE` 下调用 preflight；失败 rollback 且不产生 backup。
4. 不修改 schema-v6 合同，不自动改名/合并/丢弃 legacy principal。

## Verification

- 新增安全负例与 active/unique 对照。
- exact15 focused、exact15 Ruff、POSIX `/tmp` backend-full。
- committed/clean candidate 的 runtime-lock 三路 full shard与全 app/tests Ruff。
- exact15 path/status/mode/frozen-blob/corrective-delta 结构门。
- root Harness、自测、Doctor、hook、Authority regression、V2、diff-check。
- Code、Python/Database、Security 三路独立只读审查。

## Non-Goals

不新增第十六路径，不改 scheduler.py、公开 API、前端、角色模型、SSO、schema 结构、runtime-lock、Harness、authority、CI、ADR、奖励、分享、Pilot、发布或部署。

## Stop Conditions

远端漂移、machine STOP、范围扩大、测试不能形成真实 RED、十条冻结 blob 漂移、五条 corrective blob 有任一未变化、完整矩阵失败或审查 P0–P2，立即 STOP。只允许普通 fast-forward，不部署。
