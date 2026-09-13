# Mingshuo Work Product exact20 Replay Idempotency Corrective Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-REPLAY-IDEMPOTENCY-CORRECTIVE-SUCCESSOR-20260914`

State: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

Base: `a5239e9c5b1e5c4231f71d506e17e131cfebad39 / 8d46823dca941696bc69186ae33b52eef2b42923`

## Goal

在不改变 exact20 产品范围和任何外部合同的前提下，修复同一铭硕 delivery request 因 XLSX ZIP 容器字节非身份确定性而偶发 409 的 replay bug。重放返回已冻结且经过完整存储校验的 artifact/work-product identity；篡改、错租户、错绑定、缺文件或非法 saga state 仍 fail-closed。

## Frozen Scope

Candidate 仍精确为原二十路径，结构 `2 ADD + 18 MODIFY`，模式全部 `100644`。相对 donor 只允许以下四条路径改变：

- `backend/app/accounting_reports/storage.py`
- `backend/app/mingshuo/service.py`
- `backend/tests/test_accounting_work_product_storage.py`
- `backend/tests/test_mingshuo_delivery.py`

其余十六条路径必须 byte-for-byte 重物化，并由 v16 逐 blob 校验：

- `backend/app/api/mingshuo.py`
- `backend/app/mingshuo/delivery.py`
- `backend/app/mingshuo/models.py`
- `backend/app/mingshuo/storage.py`
- `backend/app/operations/runtime_data_registry.py`
- `backend/app/operations/sqlite_backup.py`
- `backend/tests/test_mingshuo_vertical.py`
- `backend/tests/test_readiness.py`
- `backend/tests/test_sqlite_backup.py`
- `deploy/release-manifest.schema.json`
- `scripts/build_offline_release.mjs`
- `scripts/build_offline_release.test.mjs`
- `scripts/run_rc1_release_acceptance.mjs`
- `scripts/run_rc1_release_acceptance.test.mjs`
- `scripts/verify_offline_release.mjs`
- `scripts/verify_offline_release.test.mjs`

Donor bundle：`sha256:d6a9f2008e182cefe054df4aaa8551e56797f15991403277e623ed27a8a03c83`。Donor combined full-index diff：`sha256:c66fea83492914c0c4bac7947f572e7de477b57f22e6e272261208f72b571959`。二者仅作 byte donor evidence。

## TDD Sequence

### RED 1 — deterministic replay across container-byte variation

在测试中使用可控生成器，使首次和重放的 XLSX 具有相同业务内容与 binding，但 ZIP 容器 SHA 不同。首次必须创建 `201`，旧实现的第二次请求必须真实产生 `409`。不得依赖 wall-clock sleep。

### RED 2 — recovery and concurrency

分别冻结 intent 为 `PREPARED`、`ARTIFACT_PENDING`，证明跨容器 SHA 的重放可完成同一 artifact/work-product；两个并发相同请求只能产生一个 durable artifact、一个 WorkProduct 和同一响应 identity。

### RED 3 — fail-closed tamper matrix

逐项篡改 frozen binding、artifact ID/SHA、work-product ID/digest、tenant/owner/project、Fact Pack identity、saga state、已存 artifact 元数据/文件、WorkProduct payload/binding，证明不会因 replay 分支而错误接受。

### GREEN 1 — owner-scoped stored artifact verification

在现有 `ArtifactStorage` 增加只读 expected-identity 核验接口。调用者必须提供 artifact ID、owner、run、report type、display name、period、source hashes 与冻结 file SHA；实现使用参数化查询、contained canonical path 和实际文件 SHA，要求唯一 PENDING row 完全一致。接口不得返回 connection、原始 row 或未约束路径，也不得修改 schema、状态或文件。

### GREEN 2 — split creation from replay truth

首次路径继续使用新生成 XLSX bytes/SHA 创建并验证 PENDING artifact。已有 intent 的重放路径不使用新生成 ZIP SHA判定 durable identity，而是：

1. 验证当前 Fact Pack 与 request 的稳定业务 binding 与 frozen intent 一致；
2. 加载 owner-scoped 已存 artifact 和 WorkProduct；
3. 调用上述公共只读核验接口验证 artifact 元数据、状态、文件存在性与实际 SHA，再复用 WorkProduct 读取/create-or-verify 能力验证唯一绑定；
4. 从冻结 intent 和已存 WorkProduct 形成与首次相同的 API identity；
5. 不完整、冲突或篡改状态返回确定性 409/503，不生成第二份成果物。

若无法只修改四条纠偏路径完成闭合校验，必须 STOP；不得修改 ArtifactStorage schema/状态机或增加第五条纠偏路径。

## Verification Matrix

1. `cd backend && python3 -m pytest -q tests/test_mingshuo_delivery.py tests/test_mingshuo_vertical.py tests/test_accounting_work_product_storage.py tests/test_report_artifacts_api.py tests/test_readiness.py tests/test_sqlite_backup.py`
2. `cd backend && TMPDIR=/tmp TEMP=/tmp TMP=/tmp python3 -m pytest -q`
3. exact20 Ruff（approval v03）。
4. `node scripts/check_harness.mjs`
5. `node scripts/check_harness.mjs --self-test`
6. `node scripts/harness-doctor.mjs --check`
7. `node --test scripts/harness-doctor.test.mjs`
8. `node .agents/hooks/check-harness.mjs --self-test`
9. `TMPDIR=/tmp TEMP=/tmp TMP=/tmp node --test scripts/product-authority.test.mjs`
10. `node scripts/ext-full-value-convergence.mjs --check`
11. `node --test scripts/ext-full-value-convergence.test.mjs`
12. offline build/verifier/RC1 test suites。
13. `git diff --check`
14. candidate commit 后运行 exact20 preimage 与 machine `--verify-candidate`。

候选字节变化后，旧 focused/backend-full/review 证据全部失效，必须按本矩阵重新生成。

## Independent Reviews

- Governance Review：确认旧 one-child authority 已放弃、无 re-anchor、approval/product paths 精确、十六条 donor blob 锁定、四条 corrective blob 必须变化、no-goals 和 STOP 条件闭合。
- Python Review：确认 replay 根因、事务边界、恢复与并发语义、只读 public ArtifactStorage 核验接口、测试确定性及异常映射。
- Security Review：确认 tenant/owner isolation、stored file/hash validation、binding tamper、formula/OOXML 防护、错误与日志泄漏边界没有退化。

任一 P0–P2 为 NO-GO。

## Rollback Boundary

正式 approval 未落地前，删除新隔离治理草案工作区即可，不影响产品或远端。未来 corrective candidate 如未推送，只丢弃该隔离 candidate；如经 machine PASS 后普通 fast-forward 落地，回滚必须另立 forward-only successor，不改写历史、不 force-push。

## STOP Conditions

- Gitee 实时远端不再精确为批准基线；
- machine authority 或 candidate verification STOP；
- exact20 之外出现第二十一条路径，或纠偏需要第五条路径；
- 无法形成真实可控 RED；
- 重放实现跳过已存文件 SHA、owner/run/binding/work-product 验证；
- readiness、runtime registry、offline/backup、Fact Pack、OOXML、租户或错误合同发生变化；
- 任一关键验证失败或独立审查出现 P0–P2。

本计划不授权正式 approval 物化、authority、产品实施、测试、commit、push、Pilot、Release 或生产部署。
