# P14 Exact30 Trusted Artifact Delivery Gate A Lineage Successor Plan

## Status

`FINALITY_DISPOSITION_CONFIRMED / GATE_A_IMPLEMENTATION_ONLY`

## Objective

Owner 已精确确认旧 V4 finality 永久终止及基于最新 `ext-dev@3432f7e8147a05a7abc713f6da460c1532a21387` 的新 exact30 Gate A lineage。完成正式状态转换后，才以单一 product authority 重建 P14 exact30 的本地 Gate A 字节证据，同时保留旧 donor 的完整价值与当前主线后继价值。Gate A 最多产生一个不可接受、不可推送的本地 byte-freeze child，不运行真实 release，不部署。

## Frozen Scope

- Approval commit paths：本轮 approval、Task、Plan 三文件。
- Product paths：approval manifest 精确 30 条，全部 `MODIFY / 100644`。
- Byte donor：旧 `c174872f…` dirty worktree，30-file bundle `sha256:9bb672155f1def266e88a016dd2bb06af8755312a60f0c6297085c88a3c3c9d6`。
- Replay split：17 条逐字重物化；13 条以 current base 为准做语义融合。
- Product STOP：第 31 路径、第十四条冲突路径、registry/consumer 身份不一致、关键节点 skip/todo 假绿、旧身份继承、矩阵失败或独立 P0–P2。

## Execution DAG

1. `GOVERNANCE_FREEZE`：strict JSON、duplicate-key rejection、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、Harness/Doctor、canonical/raw/bundle 与三审；保持 proposed/non-authorizing。
2. `FINALITY_DISPOSITION / COMPLETE`：Owner 已精确确认旧 V4 终止旧 lineage、允许当前主线新 Gate A lineage，并确认新 lineage 的单次 finality。
3. `FORMAL_STATE_TRANSITION / ACTIVE`：Task/Plan 更新为 `FINALITY_DISPOSITION_CONFIRMED / GATE_A_IMPLEMENTATION_ONLY`，重跑 schema/Harness/三审并重算正式 raw/canonical/bundle；approval JSON 才可原字节物化。
4. `APPROVAL_FF`：移除 proposed 临时路径，正式三文件直接单亲 commit，普通快进；push 前后远端双读。
5. `MACHINE_GO_ONCE`：authority 前后均从 `/tmp` 以固定 Gitee URL、禁 global/system config、拒绝 include/includeIf、`url.*.insteadOf`、`core.sshcommand`、固定 `/usr/bin/ssh -F /dev/null` 验证远端精确等于 approval；只运行一次 `--authorize`，STOP 不重试。
6. `EXACT30_RED`：在原产品测试路径内证明 current/donor 缺口和十三路三方融合回归。
7. `EXACT30_GREEN`：17 条逐字 donor + 13 条最小语义融合，无第 31 路径。
8. `PRECOMMIT_MATRIX_AND_REVIEWS`：在 working tree 运行精准/全量矩阵与四审，冻结 exact30 scope/mode/raw/blob/bytes/bundle/diff；任一失败不创建 child。
9. `LOCAL_BYTE_FREEZE_CHILD`：仅在预检全绿后创建一次本地直接单亲 exact30 child，标记 `BYTE_DONOR_ONLY / NO_CANDIDATE_ACCEPTANCE`。
10. `COMMITTED_IDENTITY_MATRIX`：人工运行 manifest 00–98；99 固定 exit 86，只作为禁止 machine acceptance 的终止器，不属于正向全绿矩阵。不得运行本 task `--verify-candidate`，不得 push。
11. `SUPERVISOR_SUCCESSOR`：独立治理并实现 candidate-external supervisor、expected runner pin 与外部执行 authority。
12. `GATE_B_SUCCESSOR`：在最新 ext-dev 重物化同一 exact30，重新完整验证与 machine acceptance，方可普通快进。

## Semantic Merge Rules

- `runtime_data_registry.py`：保留 current v3/plural-digest/Shiguan v7 全部后继价值，并加入 donor storage 实际依赖的 permanent `confirmation_receipts_guard_insert_v2` 与 report-artifact schema digest `sha256:6302a6a7ee8c001848fb792d2e81f13db494fde683724688de856ebb33f152d9`。最终 `RUNTIME_DATA_REGISTRY_DIGEST` 必须从实际 candidate 机械重算，不得冻结 provisional 值。
- `sqlite_backup.py`：保留当前 schema-state validation、tenant/principal retention、decree dual canonical schema和最新 trusted runner约束；P14 projection 必须调用 `validated_registered_schema_digest_connection` 并使用其返回的实际 allowed digest，禁止读取 multi-digest entry 的 singular property；合入 donor 的 artifact backup/restore、single-FD、manifest与release行为。
- `test_readiness.py`：保留当前 readiness family、P04 Outcome、tenant/principal与 closed-pair回归；追加/重物化 P14 readiness证明，不替换现有测试。
- `test_sqlite_backup.py`：保留当前 migration verification、tenant/principal sentinel、decree schema splice负向测试；合入 donor的P14 backup/restore与runner完整性测试。
- `test_report_artifacts_api.py`、`test_accounting_confirmation_api.py`：保留 donor 下载/确认/work-product 回归，并新增 missing/expired/revoked/membership-invalid 在 storage/resource lookup 前同形 401 且零访问；有效认证下 unknown/cross-owner/cross-tenant/cross-membership 必须同形 404 且不泄露。
- `run_rc1_release_acceptance.mjs`：身份图必须精确冻结三段。第一段 `_create_synthetic_runtime` baseline 保留固定 synthetic owner user、PERSONAL tenant、OWNER membership、单条 active `rc1-synthetic-session` 与 v7 VERIFIED，不得提前增加 revoked session。第二段 baseline→P14 preimage 只新增 browser Owner A 的 user + tenant + membership + membership-bound revoked registration session + active login session，之后才调用 fixture seeder。第三段 postSeed→final poststate 再新增 Owner B 的同形五行身份图及其业务增量。auth binding 必须包含 tenant/membership row digest，并校验 active OWNER membership、PERSONAL tenant、session membership、expiry/revocation。Python/runner strict wire keys 同步且键变化时升级 `schemaVersion`。再合入 donor installed-wheel/config protocol、runner pin、Buildx 与 cleanup deadline；禁止忽略表或旧 `users/auth_sessions` 固定增量。
- `run_rc1_release_acceptance.test.mjs`：冻结上述身份初态、精确增量和 strict binding keys；必须覆盖 cross-owner/tenant/membership/session splice、额外/缺失身份行、并发 marker one-winner、所有失败 DB/artifact zero-write，以及 P14 runner/config/cleanup 负例，不得用旧 fixture 预置路径掩盖真实 runtime transition。
- `deploy/release-manifest.schema.json`、`build_offline_release{,.test}.mjs`、`verify_offline_release{,.test}.mjs`、`run_rc1_release_acceptance{,.test}.mjs`：保留 donor P14 release contract，同时把全部生产 `runtimeRegistryDigest` 消费点原子绑定实际 candidate registry 机械重算的唯一 digest；禁止 current consumer `014a4d…`、donor `bbad23…`、current 旧 registry `dd93bfe…` 或独立第二事实源。

以下新增测试节点名称是机器合同，不得改名、删除、skip、xfail 或 todo：Python 为 `test_runtime_registry_digest_is_shared_by_all_release_consumers`、`test_p14_readiness_rejects_identity_schema_version_downgrade`、`test_restore_uses_validated_registered_schema_digest_connection`、`test_restore_rejects_cross_tenant_membership_session_splice_without_writes`、`test_restore_rejects_missing_or_extra_identity_rows_without_writes`、`test_download_rejects_invalid_session_states_before_storage_lookup`、`test_download_hides_unknown_and_cross_authority_with_uniform_not_found`、`test_work_product_routes_reject_invalid_session_states_before_storage_lookup`、`test_work_product_routes_hide_unknown_and_cross_authority_with_uniform_not_found`；Node 为 `rejects cross-owner tenant membership and session splice`、`rejects missing or extra identity rows without writes`、`rejects stale identity schemaVersion`、`allows only one concurrent acceptance marker writer`、`keeps database and artifacts unchanged on identity binding failures`。manifest 必须逐节点执行并解析结果，证明每个关键节点实际 PASS 且零 skip/todo/xfail/xpass。

## Negative Matrix

- artifact destination/root/ancestor 在 check/hash 后替换；duplicate ID/content collision、symlink/hardlink/special/oversize、post-commit compensation；跨 owner读取/确认/租约和确认前下载。
- missing/expired/revoked 或 membership 已失效的 session 必须在资源查询前返回统一 401；有效认证但对 artifact 无 owner/tenant/membership authority，或 ID 不存在，必须返回同形 404。两类均不得泄露路径、owner、session 或资源存在性细节。
- confirmation cross-run/digest/provenance splice、PENDING/ABORTED、重复/并发只能产生一条 receipt；receipt UPDATE/DELETE/伪 actor 失败关闭并保持 DB/artifact zero-write。
- lease caps/fairness 与 wait/spool/response-start/stream/disconnect/expiry 每条错误路径释放；并发 owner 不能饥饿或越权。
- bearer canary 覆盖 raw、URL/JSON 编码和 base64；扫描正常/异常/crash/cleanup 的 logs、evidence、browser payload、profile、argv、env、temp 与 retained surfaces，必须零保留。
- SQLite symlink/root/ancestor replacement、sidecar/manifest/schema splice、未来 schema、未验证 migration、部分 restore与 owner/tenant/membership/session splice。
- installed-wheel/config protocol：missing/extra/mutated config、symlink/hardlink/special、mode/owner/escape/race、host/user-site/network fallback；真实 installed wheel 与外部执行由 supervisor/Gate B 验证。
- offline release：path traversal、symlink/hardlink、digest/source mismatch、manifest/content/source commit-tree splice、expected/actual same-source、预存输出、output-root replacement 与伪 fixture。
- runner/supervisor：self-pin、hash-reopen、module changes、deadline-before-start/mid-command、never-settling、blocked event loop、忽略信号/setsid 子孙、daemon不可达、late recreate、cgroup残留与超时后伪 PASS；Gate A 只闭合 candidate-side 可证明部分。
- Gate A：never-settling Promise、deadline-before-start/mid-command、配置/runner same-source、同 inode同尺寸改写、hash后重开等 candidate-side协议负例。
- Gate B/supervisor：阻塞 event loop、忽略信号/setsid孙进程、daemon不可达、late recreate、cgroup残留与超时后伪 PASS；Gate A 不得宣称这些外部性质已闭合。
- Buildx不支持接口、重复 builder/node JSON、工具版本漂移与 candidate自己生成 expected inventory。

## Verification Matrix

- Backend focused exact30 tests（含 `test_runtime_registry_digest_is_shared_by_all_release_consumers`）、backend full、Ruff、runtime-lock candidate + installed-wheel/config protocol regressions。
- Frontend 使用 Node `v22.23.1`、npm `10.9.8`、lock `sha256:a08cf31a5089fc246380a8ac77f365299e31880995a04722affbdf413e74fb0b`；只读复制本地 npm 源 cache 到唯一 `/tmp` 隔离 cache，拒绝 cache symlink，离线执行 `npm ci --offline --ignore-scripts` 并删除临时 cache，不写回共享 `/home/ubuntu/.npm`；检查前后 22457 条 full dependency tree 摘要 `sha256:5622646be4a6238728aa4a45553a46b41f63ca4bebc71cc05ada902aa4386fd8`、无逃逸 symlink，再运行 full tests、lint、typecheck、`NODE_ENV=production` build。
- Release evidence、offline build/verify、RC1 acceptance regressions。
- Root Harness/self-test、Doctor/tests、hook、authority regression、V2 check/tests。
- Readiness fingerprint/pair复算、actual candidate registry digest 与全部 production consumer 一致性、`git diff --check`、exact30 path/mode/raw/blob/bundle/diff identity。
- 专用 release环境与真实浏览器只在独立 supervisor authority 后运行；Gate A禁止。

## Review and Stop

Governance Review检查lineage与不可继承边界；Python Review检查存储、SQLite和readiness；TypeScript Review检查BFF/UI；Security Review检查owner、bearer、TOCTOU、runner与cleanup。任何P0–P2、机器STOP、远端漂移、范围扩大、第二事实源或外部副作用立即停止并保全证据。
