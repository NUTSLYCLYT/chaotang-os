# Packet 14 — Exact30 Trusted Artifact Delivery Gate A Lineage Successor

## Status

Draft

Governance state: `FINALITY_DISPOSITION_CONFIRMED / GATE_A_IMPLEMENTATION_ONLY`.

Task ID: `PACKET-14-EXACT30-TRUSTED-ARTIFACT-DELIVERY-GATE-A-LINEAGE-SUCCESSOR-20260901`

## Product Definition

在 canonical `ext-dev@3432f7e8147a05a7abc713f6da460c1532a21387` 上重新签发 P14 trusted-artifact exact30 Gate A。旧 `c174872f42c31b3d7a20c727a7c42c4a136c45dc` 工作区的 30 条未提交产品字节只作为 byte donor evidence；旧 V3/V4 approval、authority、candidate、验证、审查与通过身份一律不得继承或 re-anchor。

本 successor 保留 V4 的实质 finality，不通过 V5/V6 扩展产品范围，也不新增第 31 条路径。它只解决 forward-only lineage 事实——work-product BFF exact2 与 P04/readiness/runtime 主线已在旧 exact30 基线之后合法落地。current registry 仍冻结旧 8-trigger report-artifacts schema，而 donor storage 会新增永久 `confirmation_receipts_guard_insert_v2` 并改变 report schema digest；因此 `runtime_data_registry.py` 必须作为 semantic merge 保留当前 v3/plural-digest/Shiguan v7 价值并接纳该 P14 schema。旧 release consumers 绑定 `014a4d…`，donor consumers 绑定 `bbad23…`，二者都不得冒充最终候选 registry digest；最终 digest 必须从实际 candidate 机械重算，再原子同步到全部生产 consumers。最终分类为 17 条 byte replay + 13 条 semantic merge；两条 API 测试路径必须新增认证状态和资源查询顺序负测，不得继续逐字 replay。禁止旧字节或旧断言覆盖 readiness、tenant/principal、claim-evidence 和 schema/backup 价值。

Owner 已精确确认：旧 V4 finality 永久终止旧 base/digest/authority/candidate 的 retry、correction 和 re-anchor；旧 V4 从未形成已接受产品 child，因此不具有 P14 completion、通过、可恢复或可继承身份。本包不是 V5/V6，也不是旧 approval re-anchor，而是基于当前主线的新 Gate A lineage。该确认只激活本 Task 冻结的条件链，不扩大 exact30、Gate A 或禁止事项。

新 lineage 重新继承单次 finality：若最终 readiness pair 不被现有 closed set 接受，则 `TERMINAL STOP / NO_GO`，不得修改 oracle、再次 re-anchor 或创建同类 successor；只有独立确认的新 P0 才能重新打开治理。

Gate A 只允许形成、验证并冻结本地 exact30 产品字节，并在全部字节预检通过后创建一次本地直接单亲 `BYTE_DONOR_ONLY` child；它不铸造可接受或可推送 candidate。该本地 child 只让 committed-child 身份门可机械执行，禁止调用本 task 的 machine `--verify-candidate`，且 manifest 的终门固定返回 exit 86。候选外 supervisor、最终 runner pin、真实 release side effect 与 Gate B product acceptance 必须使用后续独立 authority；本包不发布、不部署。

## Acceptance Criteria

- [ ] approval commit 是 `3432f7e8…` 的直接单亲子，只包含本轮三份治理文件。
- [x] Owner 已精确确认旧 V4 finality disposition；重新完成正式治理验证与摘要冻结后，才允许把 proposed approval 相同 JSON bytes 物化到 manifest `approvalPath`。
- [ ] product child 只修改 manifest 中精确 30 条路径，结构为 `30 MODIFY / 0 ADD`，模式全部 `100644`。
- [ ] 旧 donor 30 文件 bundle `sha256:9bb672155f1def266e88a016dd2bb06af8755312a60f0c6297085c88a3c3c9d6` 与 old-base full-index diff `sha256:4b59b078c85f3b57b74e775d4eb41452334fef66779b5807650b9c5181d2a356` 仅作 byte donor evidence，不是新 candidate identity。
- [ ] 17 条 `BYTE_REPLAY_SAFE` 路径逐字重物化 donor；13 条 `SEMANTIC_MERGE_REQUIRED` 路径保留当前主线全部后继行为并合入 donor 的 P14 变更。
- [ ] 十三条语义融合路径精确为 `backend/app/operations/runtime_data_registry.py`、`backend/app/operations/sqlite_backup.py`、`backend/tests/test_accounting_confirmation_api.py`、`backend/tests/test_readiness.py`、`backend/tests/test_report_artifacts_api.py`、`backend/tests/test_sqlite_backup.py`、`deploy/release-manifest.schema.json`、`scripts/build_offline_release.mjs`、`scripts/build_offline_release.test.mjs`、`scripts/run_rc1_release_acceptance.mjs`、`scripts/run_rc1_release_acceptance.test.mjs`、`scripts/verify_offline_release.mjs`、`scripts/verify_offline_release.test.mjs`；需要第十四条冲突路径或第 31 条产品路径立即 STOP。
- [ ] 认证负测节点 `test_download_rejects_invalid_session_states_before_storage_lookup`、`test_download_hides_unknown_and_cross_authority_with_uniform_not_found`、`test_work_product_routes_reject_invalid_session_states_before_storage_lookup`、`test_work_product_routes_hide_unknown_and_cross_authority_with_uniform_not_found` 必须逐节点实际 PASS，零 skip/xfail/xpass，不得只依赖测试进程 exit 0。
- [ ] Gate A 闭合 artifact no-replace、owner 隔离、confirmation/lease、bearer 零保留持久化，以及 runtime-lock candidate、installed-wheel/config protocol、offline release、runner pin、cleanup deadline 的 candidate-side 协议与负向测试；真实 installed wheel 与外部进程性质留给 supervisor/Gate B。
- [ ] candidate-external expected pin、single-FD supervisor、阻塞 event loop/忽略信号/setsid 子孙进程、cgroup emptiness、超时后无 PASS 只可由独立 supervisor successor + Gate B 真实验收闭合；Gate A 不得宣称完成。
- [ ] backend focused/full/Ruff/runtime-lock candidate、隔离离线依赖重建后的 frontend full/lint/typecheck/production build、release、Harness、Doctor、authority regression、V2 与 diff check 全绿；manifest 00–98 全绿，固定 exit 86 的 99 不是正向矩阵成员。
- [ ] Governance、Python、TypeScript 与 Security 独立复审均无 P0–P2。
- [ ] Gate A 产品字节冻结后只形成一次本地直接单亲 `BYTE_DONOR_ONLY` child；不得运行本 task 的 machine `--verify-candidate`，不得 push 该 child。

## Delivery Constraints

- Canonical base commit/tree：`3432f7e8147a05a7abc713f6da460c1532a21387 / d8d02b9cc03d0a6b5d1ac2ad3eaf5eb5749c8f12`。
- 旧 exact30 donor worktree：`/home/ubuntu/Projects/chaotang-os/.worktrees/p14-exact30-authority-current-20260824`；必须保持不动，不暂存、不提交、不清理。
- 旧 `PACKET-14-EXACT30-CANDIDATE-SUCCESSOR-V4-20260824` 及全部 predecessor 只作 immutable historical evidence；远端已离开其 approval lineage，旧 one-child authority 不得恢复、消费或重试。
- 当前 proposed approval 位于 `docs/migrations/2026-09-01-packet-14-exact30-trusted-artifact-delivery-gate-a-lineage-successor.approval.proposed.json`；它不在 `approvalCommitPaths` 内、不得作为 machine authority 输入。Finality 已确认，但仍须等待正式验证、摘要重冻与原字节物化。
- 17 条安全重物化路径只有在 raw/blob/mode/bytes 与 donor 冻结身份一致时可直接复制；13 条冲突路径必须以当前主线为 base 做最小语义合并并新增/保留双侧回归。
- 十三条 semantic donor input 的 raw/blob/mode/bytes 必须在合并前机械锁定；它们只冻结合并输入，不要求最终输出等于 donor。
- 不修改已落地的 work-product exact2；不修改 Harness、authority、readiness validators、CI、ADR、配置、真实数据或凭据。
- 不 merge、cherry-pick、rebase、force-push；不执行 release、Pilot 或部署。
- candidate-external supervisor 必须独立、root-owned、single-FD copy/hash、固定 expected pin、绝对 deadline 与 cgroup watchdog；candidate 不能成为自己的 trust root。

## Affected Modules

- 模块：artifact storage/API、SQLite backup/readiness、artifact BFF/UI、offline release build/verify/acceptance。
- 允许路径：machine-readable approval 中 `request.productPaths` 的精确 30 条路径。
- 历史重物化：17 条 `BYTE_REPLAY_SAFE`。
- 语义融合：13 条 `SEMANTIC_MERGE_REQUIRED`，仅保留和组合已批准行为，不引入新事实源。

## Technical Plan

1. proposed approval、Task、Plan 的只读治理/代码/安全审查与摘要冻结已完成；Owner 已精确确认旧 V4 finality disposition。
2. 确认后先把 Task/Plan 更新为 `FINALITY_DISPOSITION_CONFIRMED / GATE_A_IMPLEMENTATION_ONLY`，重新执行 schema/Harness/三审并重新冻结正式三文件摘要；只有 approval JSON 保持原字节物化到 manifest `approvalPath`，移除 proposed 临时路径后提交正式三文件。authority 前后均从 `/tmp` 以固定 Gitee URL、禁 global/system config、拒绝 include/includeIf、`url.*.insteadOf`、`core.sshcommand`，并固定 `/usr/bin/ssh -F /dev/null` 只读确认远端等于 approval commit；只运行一次 product authority。
3. 从新 approval 创建唯一干净 candidate worktree。保留当前 13 条语义冲突路径，逐字重物化其余 17 条 donor。
4. 对 13 条冲突路径做三方语义合并：当前主线是基底，已锁定 donor patch 是输入；任何无法在 exact30 内闭合的行为立即 STOP。`runtime_data_registry.py` 保留 v3/plural digest/Shiguan v7，并加入 P14 v2 trigger 与机械观测的 report schema digest；随后从实际 candidate 机械重算唯一 registry digest，并原子同步到 release schema、build、verify、acceptance 等生产 consumers，明确拒绝 `014a4d…`、`bbad23…` 与 current 旧 registry digest。`sqlite_backup.py` 必须使用 `validated_registered_schema_digest_connection` 得到实际 allowed digest，不得读取 multi-digest registration 的 singular property。两条 API 测试路径必须机械证明 missing/expired/revoked/membership-invalid 认证在 storage/resource lookup 前同形 401 且零访问，以及有效认证下 unknown/cross-owner/cross-tenant/cross-membership 同形 404 且不泄露。身份图冻结为三段：`_create_synthetic_runtime` baseline 精确保留固定 synthetic owner user、PERSONAL tenant、OWNER membership、单条 active `rc1-synthetic-session` 与 v7 VERIFIED，不得提前增加 revoked session；baseline→P14 preimage 只新增 browser Owner A 的 user + tenant + membership + membership-bound revoked registration session + active login session，随后才调用 fixture seeder；postSeed→final poststate 再新增 Owner B 的同形五行身份图及其业务增量。auth binding 必须校验 tenant/membership row digest、active OWNER membership、PERSONAL tenant、session membership、expiry/revocation；Python/runner strict wire keys同步并升级 `schemaVersion`。
5. 先补真实负向测试，再闭合 artifact 不替换、owner/lease/bearer、schema/backup、installed wheel、runner trust 和 cleanup deadline。
6. 在未提交字节上先运行精准 RED/GREEN、范围/模式、donor 输入、registry-consumer 同源、exact2 no-drift 和完整测试预检；四审无 P0–P2 后，只创建一次 approval 的本地直接单亲 exact30 byte-freeze child。
7. 在该本地 child 上人工执行 manifest 00–98，冻结新 exact30 raw/blob/mode/bytes、bundle、diff 与验证 evidence；99 仅证明 machine acceptance 会固定 STOP，不作为全绿门运行。不得调用 `--verify-candidate` 或 push。
8. 以最终 runner 字节另立 candidate-external supervisor/release authority，再基于届时最新 ext-dev 签发 Gate B product successor并逐字重物化冻结 exact30。

## Implementation Report

只读盘点已确认旧 donor 精确 30 条未提交 `M/100644`，共 `13383 insertions / 678 deletions`。进一步契约审计确认：current registry 尚未吸收 donor storage 的 permanent v2 trigger/schema；release consumers 也必须随最终 candidate registry digest 同步；runner/test 与当前 tenant/membership/session 事实需语义合并。真实范围为 exact30：17 条 byte replay + 13 条 semantic merge；两条 API 测试路径转为 semantic，以闭合 session/membership 无效时资源查询前 401 与合法认证但无权/不存在时同形 404 的机器负测。P14 work-product BFF exact2 已通过三审、完整矩阵和 machine verify，并以 `3432f7e8147a05a7abc713f6da460c1532a21387` 普通快进落地。

本记录不宣称 exact30 已实现、已验证、可提交或可发布。旧 exact30 donor bundle 和 diff 仅用于检测重物化漂移。

## Acceptance Review

`FINALITY_DISPOSITION_CONFIRMED / GATE_A_IMPLEMENTATION_ONLY`。Owner 已确认旧 V4 finality 终止及当前主线新 exact30 Gate A；正式物化仍必须完成本轮 Task/Plan 状态转换后的 schema/Harness/三审与正式 bundle 重冻。任一 remote/base/path-set/donor 漂移、语义价值丢失、第 31 路径、完整矩阵失败、独立 P0–P2 或 candidate-external supervisor 缺失均立即 STOP。Gate A 字节即使全绿也只能作为 Gate B byte donor。

## Rollback

治理阶段只放弃未推送三文件。Gate A 产品阶段只保留隔离工作区及其本地 byte-freeze child；不改写远端、不清理 donor、不触发外部副作用。Gate B 之后仍只允许普通 fast-forward，并以提交 parent/tree 与证据摘要回滚定位。
