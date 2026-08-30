# Packet 10-B1 — Durable Commitment Compatibility Prerequisite Successor

任务 ID：`PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-COMPATIBILITY-PREREQUISITE-SUCCESSOR-20260830`

## Status

Draft

`OWNER_AUTHORIZED / GOVERNANCE_REPAIR / EXACT6_PREREQUISITE_ONLY`

## Product Definition

P10-B1 canonical rebuild successor 已在 approval `642848e8bfc960c709372b2fa8c453f189a8ad61 / 6661fb313b52c4773cd67f8717996ddfa98019a7` 上形成 exact8 未提交 shadow。该 shadow 关闭了 durable staged authority handoff、canonical SQLite rebuild、closed schema、SQL NULL fail-closed 与固定 API 边界，并通过 Governance、Python/SQLite 与 Security 三重独立审查。它不是 candidate，不能提交或继承验证身份。

完整 backend 的唯一失败拓扑为两个独立 prerequisite：44项来自 `decree_jobs.sqlite3` registry 仍只接受旧 closed digest，1项来自 readiness validators 尚未接受 exact8 的 65-path runtime fingerprint。没有第三根因。因此本任务只允许 exact6 兼容前置，落地后必须基于最新 `ext-dev` 重新签发 final exact8 successor。

### Frozen shadow evidence

- exact8 bundle：`sha256:d750580bbc26138589367aba51710097f044c7193eff9ede097b5fc44c7c3b2f`
- combined full-index diff：`sha256:afce5a35187aaa5b7abfd09f7867e1ed8ea67e26937a151e0ce4e33de6e38c97`
- storage canonical raw schema identity：`sha256:8b38c49b719aa2a758ba037eb436d6fdf97db50e0a4b8cabd874b1a20f3059c2`
- runtime registry observed new digest：`sha256:5372895aff08d4b39a19c4100b1b30ec8eaf7a9e597960425fee13c52552f5e3`
- final target runtime fingerprint：`sha256:cc42339eaa423d71307ef96ff713ec095a89ba2cc4d4f6630ee1b40dec94d34d`
- unchanged successor fingerprint：`sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`
- verification evidence：`sha256:8351e659def70d67de45e2f74df2e6611cd5213dba6206642cea9ae53c1cbab9`
- shadow evidence：`sha256:19cf73b398d244fb34bddf43b095fc97a5db18a4d02a4e5879b36b81af6ae1ac`
- authority disposition：`ABANDONED_UNCONSUMED / PREREQUISITE_REISSUE_REQUIRED`

65-path边界只包含 exact8 中的 `decrees.py`、models、storage、worker和storage/worker tests；本 exact6 的四条 registry/backup 路径不属于该 65-path集合，两个 validator又是既有 exclusions。因此 exact6 本身不改变当前或未来 runtime/successor fingerprint，第六 ordered pair不存在自引用。exact6 候选与落地后的实际 observed pair 必须仍是现有第五对 `[sha256:a6d109de…e80c, sha256:709ebaf1…c924]`；`[sha256:cc42339e…d34d, sha256:709ebaf1…c924]` 只是一组 dormant forward-compatibility tuple，只有 final exact8 byte-for-byte重物化后才能成为observed pair，不能作为exact6自身的字节身份、当前readiness身份或验证证据。

## Acceptance Criteria

- [ ] exact6 精确 `0 ADD + 6 MODIFY`，全部 `100644`，无第七路径。
- [ ] runtime registry 对 `decree_jobs.sqlite3` 只接受现行旧 runtime digest `sha256:fa4e21efd694b2160197f9202419ed0889b83098e182932ec75231e78fd92b9d` 与 new runtime digest `sha256:5372895aff08d4b39a19c4100b1b30ec8eaf7a9e597960425fee13c52552f5e3`；顺序固定、去重、第三值拒绝。storage raw identity `8b38c49...` 与被拒绝的单ALTER runtime digest `5d928d42...` 均不得进入该集合。
- [ ] registry document从`chaotang.runtime-data-registry.v2`显式升为`v3`，closed字段改为`schemaContractDigests`；单一条目同时表达 canonical digest 与精确 predecessor compatibility，不创建第二份 allowlist、registry或事实源，registry digest随closed shape机械重算。
- [ ] backup、restore、manifest verification 均绑定实际 observed digest；不得用默认/current digest替换观察值，source与snapshot/restore digest必须一致且属于同一闭合集合。
- [ ] 旧/new 两种合法数据库均能 readiness、backup、restore；unknown、单边、manifest混搭、digest篡改、第三状态和downgrade全部 fail-closed。
- [ ] Python与Node validators在现有五对后原子追加第六 ordered pair，集合差精确 `+1/-0`，总数精确6；单边、混搭、第七pair、第五exclusion、策略分叉全拒绝。
- [ ] exact6 前后机械复算 observed pair 均精确保持现有第五对；第六对保持dormant。final exact8落地前不得把第六对报告成当前状态。
- [ ] historical review identity、69/65文件计数、四项exclusions、两条successor paths和现有五对原样同序保留。
- [ ] focused、backend-full、Ruff、Harness/self-test/doctor、authority regression、V2、diff check全绿。
- [ ] Governance、Python与Security独立审查无P0–P2且未提交工作树矩阵通过后，才可创建本地candidate commit；随后机械验证结构、单亲、模式、完整矩阵和实时远端父提交。Owner仍须确认精确candidate SHA/tree与普通fast-forward外部动作，未确认不得推送；确认后、推送前必须再次运行实时远端父提交门禁。

## Delivery Constraints

- 单一 exact6 字节写入者；独立审查者只读。
- 禁止修改 exact8 shadow、产品 API、decree job storage/worker、历史 readiness 报告、authority、CI、锦衣卫、史馆、前端或发布配置。
- 不得生成任意 schema/fingerprint allowlist、笛卡尔积、默认值冒充observed digest、环境扩展、第二registry、第二backup系统或第二authority。
- predecessor digest只服务已有旧数据库的安全读取/备份；不授予回滚、降级或把新数据库标记为旧身份的能力。
- 远端漂移、machine STOP、第七路径、第三 backend 根因、验证失败或独立审查P0–P2立即STOP。

## Affected Modules

- 模块：唯一 runtime SQLite registry、现有 backup/restore、两套受保护 readiness validators及对应测试。
- 允许路径：`backend/app/operations/runtime_data_registry.py`、`backend/app/operations/sqlite_backup.py`、`backend/tests/test_readiness.py`、`backend/tests/test_six_ministry_readiness_report.py`、`backend/tests/test_sqlite_backup.py`、`scripts/check_harness.mjs`。

1. `backend/app/operations/runtime_data_registry.py`
2. `backend/app/operations/sqlite_backup.py`
3. `backend/tests/test_readiness.py`
4. `backend/tests/test_six_ministry_readiness_report.py`
5. `backend/tests/test_sqlite_backup.py`
6. `scripts/check_harness.mjs`

## Technical Plan

先以负向测试冻结旧/new runtime schema digest闭合集合和observed-digest backup契约，再最小扩展现有 `RuntimeDataEntry` 表达，不增加并行事实源。registry closed document明确从v2升v3并输出`schemaContractDigests`。所有entry必须显式提供非空、有序、唯一tuple；singleton兼容访问只允许唯一值，多值时必须失败而不是选择默认。backup所有路径必须从同一connection返回和校验实际观察digest，并证明source、snapshot、manifest、restore逐字同身份。随后在Python与Node readiness validators原子追加：

```json
[
  "sha256:cc42339eaa423d71307ef96ff713ec095a89ba2cc4d4f6630ee1b40dec94d34d",
  "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"
]
```

完成未提交工作树矩阵和三重独立审查后才创建exact6本地单亲child。该阶段readiness必须通过原第五对，registry/backup变化只由exact6六文件bundle、closed schema与observed-digest测试绑定。本地commit形成后才运行commit结构与live remote-parent门禁，冻结并报告SHA/tree/parent/scope/bundle/evidence，等待Owner对该精确identity和普通fast-forward动作的确认；未确认立即STOP。确认后、push前再次运行同一hermetic repository/remote-parent门禁，防止TOCTOU。exact6落地后，冻结shadow只能作为byte donor，必须在最新基线下重新签发final exact8 approval并byte-for-byte重物化；此时复算pair才必须切换为第六对，再全量重验。

## Implementation Report

尚未实施。exact8 shadow当前为 `SHADOW_EVIDENCE_FROZEN / NOT_A_CANDIDATE`；focused `274 passed`、P10-A `42 passed`、Ruff通过，backend-full为 `4467 passed, 4 skipped, 45 failed`，精确归类为registry closed digest 44项与readiness pair 1项。三审均无P0–P2。

## Acceptance Review

Owner 的持续主线授权允许本protected-path治理闭环在完整校验与独立审查通过后创建三文件治理commit、实施exact6并创建本地候选commit。ordinary product authority明确拒绝受保护路径，因此不得伪造approval或用该STOP推导替代GO；此处实施权来自Owner对governance-repair精确范围的授权。依据`project-owner.md`，exact6普通fast-forward仍须在本地commit形成后由Owner确认精确candidate SHA/tree与外部Git动作。本文件不授权exact8直接提交、P10-B2、Pilot、Release或部署。
