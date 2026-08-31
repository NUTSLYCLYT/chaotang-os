# P04 Shiguan Authenticated Outcome V1 Prerequisite Successor

任务 ID：`P04-SHIGUAN-AUTHENTICATED-OUTCOME-V1-PREREQUISITE-SUCCESSOR-20260831`

冻结基线：`origin/ext-dev@b86f4e32a29d03c833eba5221c91f53a83ca6e26`

冻结 tree：`35570b1c5e3f79ba31cdf4d7736b74cdb61e056d`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是 CT-00 V2 的最窄真实性前置：在现有史馆 SQLite、认证 Tenant Principal、REPLY 档案、数据库级不可变终局 decision 与证据引用之上，增加 canonical、append-only、tenant/owner/membership-bound OutcomeEvent 及严格脱敏只读投影。它替代把可覆盖 ReviewStatus、job success、artifact publish、confirmation 或 synthetic fixture 冒充真实 Outcome 的错误路径。

生产请求采用 `extra="forbid"` 的闭合字段：`outcome`、`occurred_at`、`idempotency_key`、可空 `supersedes_event_id`。`outcome` 仅为 `ACHIEVED | PARTIAL | NOT_ACHIEVED | OBSERVING`；`source_type=OWNER_ATTESTATION`、`source_auth_level=AUTHENTICATED_OWNER_ASSERTION`、`recorded_at`、tenant、owner、membership 和 actor 均由服务器派生。这个等级只证明“已认证 Owner 的陈述”，不能技术性判断 Owner 陈述是否真实，不等于独立核验、商业成功或 LIVE truth，任何下游不得把它提升为 `INDEPENDENTLY_SETTLED`。

`idempotency_key` 必须匹配 ASCII `^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$`。新 event ID 与 `supersedes_event_id` 使用 32 位 lowercase hex；既有 archive ID 保持兼容，但路径输入必须匹配 `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`。`occurred_at` 必须归一化为唯一 UTC `YYYY-MM-DDTHH:MM:SS.ffffffZ` 表示后再参与摘要。

写事务以 `BEGIN IMMEDIATE` 开始，并在同一连接内重新 JOIN active `PERSONAL/OWNER` membership，再读取同 Owner 的 `REPLY + ADOPTED ArchiveDecision + 至少一条 immutable archive_evidence_reference`。客户端不能提供身份、source/auth level、archive/decision/evidence digest、recorded_at 或 synthetic/truth 标志。`occurred_at` 必须是带时区 ISO8601，且满足 `decision.decided_at <= occurred_at <= recorded_at`。

纠正只能追加 `supersedes_event_id`，目标必须是同 tenant/owner/membership/archive/source scope 的当前未被取代 head；`UNIQUE(supersedes_event_id)`、`CHECK(supersedes_event_id != event_id)` 与事务内 head CAS 禁止自环、并发分叉和跨 scope 拼接。禁止更新或删除 OutcomeEvent；v7 同时为 `archive_decisions` 增加 UPDATE/DELETE 拒绝 trigger，使 Outcome 的 decision 来源在 SQLite 层不可变。

本任务不实现 CT-00 Gate E 映射或 jiqun consumer；它只提供后续可消费的唯一 Outcome 事实源与白名单脱敏投影。后续 CT-00 必须基于届时最新 ext-dev 重新签发 successor。

## Acceptance Criteria

- [ ] Candidate 精确为 `12 MODIFY` exact12，全部 `100644`，无第十三路径。
- [ ] fresh schema 与受治理 v6→v7 迁移增加 OutcomeEvent、唯一索引、append-only/head trigger 及 archive_decisions UPDATE/DELETE trigger；事务内失败全回滚，post-commit readback 失败则保持 v7 `PENDING_VERIFICATION`、拒绝运行并保留已验证 v6 backup。
- [ ] runtime registry 冻结唯一 canonical v7 tables/triggers/schema digest；canonical v6 只可作为迁移 predecessor，readiness、backup、restore 和 same-inode readback 对漂移全部 fail closed。
- [ ] registry 另保留精确 `SHIGUAN_V6_PREDECESSOR`。旧 `--migrate-v5-to-v6` 只产生已验证但 `ready=false` 的 v6 intermediate，不得拿 current-v7 entry 验证、不得静默串迁；独立 `--migrate-v6-to-v7` 再生成 `.v6-backup` 并进入 current-v7。v5→v7 必须由操作者显式执行两段并保留两份备份。
- [ ] 迁移为 canonical v6 每个既有表按稳定主键/列序计算 row count 与 typed-content digest；typed-content 必须复用现有 `db._content_digest_value` 的精确类型标签、字节长度和原始 bytes framing，以及 `db._legacy_content_snapshot` 的稳定表/列/行顺序，不得另造摘要算法。`source-before == verified-v6-backup == committed-v7-readback`，仅新增 v7 objects 与 verification 状态转移可不同。row loss、type drift、backup substitution 或 pathname/inode splice 均保持 PENDING 并拒绝打开。
- [ ] OutcomeEvent 绑定 server-derived tenant/owner/membership/actor、REPLY、ADOPTED decision、archive snapshot、ordered evidence bundle、发生时间、幂等键、request digest 与 event digest。
- [ ] 同 scope 幂等键与同 request digest 只有在原事件及当前三类 snapshot 完整性复核通过后才返回原事件；任何 stored/current/event 漂移固定 503 且零事件字段，不同 request digest 为 409。纠正仅追加当前 head，`UNIQUE(supersedes_event_id)`，并发只允许一个赢家；写入前必须重算 current snapshots 并与目标 head 已存三类 snapshot digests 精确相等，漂移固定 503、零写入，禁止把已变化来源重新绑定为纠正事件。
- [ ] 只读 API 仅返回白名单字段：`event_id`、`archive_id`、`event_kind`、`outcome`、`source_type`、`source_auth_level`、`occurred_at`、`recorded_at`、三个 snapshot digest、`evidence_count`、`supersedes_event_id`、`event_digest`；不存在任意自由文本、label/value/URL/path/metadata 字段。两个 GET 均默认 `limit=50`、仅允许 `1..100`，使用最长 256 字符的 strict base64url cursor 绑定 `(recorded_at,event_id)`，排序固定为 `recorded_at DESC,event_id ASC`。
- [ ] reader 在同一只读事务中从当前 archive、ADOPTED decision 与 ordered refs 重算三个 snapshot digest，并从每条 `snapshot_json` 重算 legacy `snapshot_hash`；stored/current/event 任一不一致固定 503 且零事件字段。
- [ ] missing 与 cross-tenant/cross-owner/cross-membership/cross-scope supersede 精确返回同一固定 404 status/body；仅完成同 scope 授权后的业务冲突为 409，结构错误为 422。
- [ ] 非 REPLY、非 ADOPTED、无 evidence、digest drift、悬空 evidence、客户端身份/source/truth/synthetic 标志夹带、过期或撤销 session、revoked membership 全部 fail closed，零 Outcome 写入；系统不得从 fixture、ReviewStatus、job/artifact/confirmation 自动生成 Outcome，但不冒充能判定已认证 Owner 陈述的现实真假。
- [ ] focused、migration、backend-full、Ruff、Harness/authority/V2 和三路独立审查全绿。

## Delivery Constraints

- 只有一个 exact12 产品字节写入者；不碰运行数据库，测试只用临时 SQLite。
- 只修改冻结十二路径；不新增数据库包、第二 ledger、第二 authority、jiqun runtime、worker、MCP、网络或前端入口。
- 不自动 backfill ReviewStatus；历史数据必须等待未来单独、显式、可审计迁移。
- API 不接受任意 owner/tenant/membership/actor、raw payload、prompt、URL 或外部 evidence 内容。
- 三份新增兼容测试路径不得删除、skip、xfail、重排或放宽既有断言；只允许把 fresh/current Shiguan 的 v6 期望升级为 v7并增加更严格的 Outcome/迁移约束。
- 不 Pilot、Release、部署、force-push、merge 或 rebase；machine STOP 和独立审查优先。

## Affected Modules

- 模块：史馆 v7 append-only OutcomeEvent、runtime registry/受治理迁移、owner/tenant 绑定存储、认证写入口和脱敏只读投影。
- 允许路径：`backend/app/api/shiguan.py`、`backend/app/operations/runtime_data_registry.py`、`backend/app/shiguan/db.py`、`backend/app/shiguan/maintenance.py`、`backend/app/shiguan/models.py`、`backend/app/shiguan/storage.py`、`backend/tests/test_daily_memorial_scheduler.py`、`backend/tests/test_readiness.py`、`backend/tests/test_shiguan_adopted_evidence.py`、`backend/tests/test_shiguan_api.py`、`backend/tests/test_shiguan_migrations.py`、`backend/tests/test_shiguan_storage.py`。

## Technical Plan

1. 冻结三文件 approval，完整 Harness 与 Governance/Python/Security 独立审查后普通快进落地。
2. 运行一次 product authority；STOP 即停止，GO 只允许一个 exact12 child。
3. 先物化 RED：可变 ReviewStatus 不得成为 Outcome；同形 404、事务内 membership 撤销、非 REPLY/非 ADOPTED/零 evidence、时间越界、source laundering、snapshot/event digest drift、幂等 splice、SQL update/delete、自环/并发 fork、无界 key/page 与投影泄漏均失败。
4. 在 models/db/storage 中实现闭合 OutcomeEvent、v7 schema、append-only writer、owner/tenant-bound reader 和 redacted projection；在 registry/maintenance 中实现 canonical v6 predecessor → canonical v7 的锁定备份、same-inode readback 与 PENDING→VERIFIED 门。
5. 在现有 Shiguan API 中增加 `POST /api/v1/shiguan/archives/{archive_id}/outcomes`、`GET /api/v1/shiguan/archives/{archive_id}/outcomes` 与 owner-scoped `GET /api/v1/shiguan/outcomes`；Principal 全由 bearer session 派生，参数不允许身份或 source 字段。所有列表使用同一 bounded cursor contract。
6. 运行冻结验证矩阵和三路独立审查；任一 P0-P2 为 NO-GO。
7. machine verify-candidate PASS 后才允许普通快进；落地后 CT-00 V2 重新基于最新主线签发。

## Implementation Report

尚未实施。旧 `backend/src/shiguan_outcome.py` 与 `archive_outcomes.py` 属于不兼容旧谱系和不同存储架构，只可作设计 donor，不能继承 identity、authority、验证或直接重放。四个误导 ref `codex/ct00-gate-e-jiqun-governance-20260829`、`codex/ct00-gate-e-jiqun-governance-v2-20260829`、`codex/ct00-gate-e-jiqun-governance-v3-20260829`、`codex/ct00-gate-e-jiqun-governance-proposal-20260830` 及 `/tmp/chaotang-ct00-gate-e-proposal-RveUWB` 均为 `NO_IDENTITY / NO_AUTHORITY / NO_VERIFICATION_INHERITANCE`。

当前 base 已包含现有史馆内核、P10 Claim-Evidence 主线与 P14 WorkProduct/可信交付 primitives；本包只消费这些前置能力，不宣称 P14 Release 已完成。本包也不是完整 P04：P04 的真实浏览器结果录入/读取验收、Pilot 与商业成效仍必须在后继包中另证。

## Acceptance Review

待正式 approval、machine GO、exact12 RED/GREEN、完整矩阵与 Governance/Python/Security 三审后填写。通过只证明 authenticated Owner assertion 的 append-only 事实源和脱敏读取，不证明独立核验、完整 P04、CT-00、jiqun、Pilot、Release 或商业成功。后续 CT-00 只能绑定本 P04 candidate 的最终 commit/tree/machine evidence 重新签发。

## Canonical Identity Contract

- Canonical bytes 使用 UTF-8、`ensure_ascii=False`、object key 字典序、`,`/`:` 无空格、拒绝 NaN/Infinity；本合同仅含 string/int/null/closed enum，因此跨 Python/Node 可复算。新 `request/archive/decision/evidence_bundle/event` 五类 digest 统一为 `sha256:<64hex>`；既有 `archive_evidence_references.snapshot_hash` 保持历史裸 `64hex`，禁止 backfill 或改写。
- `request_digest` 覆盖 `{archiveId,outcome,occurredAt,idempotencyKey,supersedesEventId}`；不含服务器身份与时间。
- `archive_digest` 覆盖 `{archiveId,ownerUserId,createdAt,archiveCreate}`，其中 `archiveCreate` 为现有完整 `ArchiveCreate.model_dump(mode="json")`。
- `decision_digest` 覆盖 `{archiveId,ownerUserId,actorUserId,decision,decidedAt}`。
- `evidence_bundle_digest` 覆盖按 `ordinal` 升序的 `{ordinal,evidenceId,packId,investigationId,snapshotHash}` array，至少一条且 ordinal 连续；每次写/读都先以 canonical `snapshot_json` bytes 重算裸 `snapshotHash`，不得信任数据库列值。
- Legacy hash test vector 固定为 `sha256(b"{}").hexdigest() == 44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`；它只证明裸 64hex 算法，不把 `{}` 当成有效 EvidenceSnapshot。
- `event_digest` 覆盖除自身外的全部持久字段：event/archive/principal identity、event kind、outcome、server source/auth level、occurred/recorded time、idempotency/request digest、三个 snapshot digest、evidence count 与 supersedes identity。读取时先重算 event，再从当前源表重算三个 snapshot digests；任一不一致返回固定 503 unavailable，不返回损坏字段。
- 幂等唯一域为 `(tenant_id, owner_user_id, membership_id, idempotency_key)`；已存在时先比较 request digest，再以与 reader 相同的完整算法验证原事件和当前三类 snapshots，只有全部一致才返回原事件，漂移固定 503 且零事件字段。首事件存服务器当时计算的 snapshot digests；纠正只能 supersede 同 scope 当前 head，并在写入前重算 current snapshots、要求与目标 head 已存的三类 snapshot digests 精确相等；不一致固定 503、零写入，绝不把变化后的源重新绑定到新事件。

## Security Negative Matrix

- 未认证、过期或撤销 session：401，Outcome writer/reader 零调用；认证后至写事务之间被撤销的 membership，事务内复核返回同形 404，零事件。
- tenant/owner/membership/actor/archive digest/recorded_at 输入夹带：422，零写入。
- missing/cross tenant/owner/membership/archive/supersede target：使用相同查询形状并返回完全相同的固定 404 status/body；响应不得暴露对象存在性。不承诺不同宿主、缓存或数据规模下绝对 timing-equivalence。
- 非 REPLY、非 ADOPTED、零 evidence、时间早于 decision 或晚于 recorded_at、非法/超长 key、limit/cursor 越界：稳定 409/422，零事件或 storage 调用。
- 相同幂等键不同 request digest、跨 scope/非 head supersede、自环、并发双 fork、重复 event digest：失败关闭；并发 fork 仅一个成功。
- SQLite UPDATE/DELETE OutcomeEvent 与 ArchiveDecision 必须由触发器拒绝；任何事务内失败不得留下半事件。post-commit 验证失败只留下 PENDING v7 与受保护 v6 backup，运行门拒绝打开。
- redacted DTO 为独立 closed model，不复用 `Archive`/`ArchiveEvidenceSnapshot`；禁止任意自由文本字段，正文、客户标识、URL、secret、token、header、cookie、prompt、artifact path/access metadata 无法进入投影。
- synthetic fixture、ReviewStatus、confirmation、trace/span、job/artifact success 不得自动成为 authenticated Outcome；生产客户端不得提供 source/auth/truth/synthetic 标志。Owner 的陈述始终标记为 assertion，不伪称系统已验证其现实真假。

## Stop Conditions

远端漂移、machine STOP、第十三路径、需修改 auth/RuntimeSkill/Jiqun/其他存储、canonical v6 predecessor 不匹配、v7 registry/backup/readback 不能闭合、身份或 digest 不能闭合、任何验证失败或独立审查 P0-P2，立即 STOP。

## Evidence Semantics

RED 是开发方法证据：必须先在冻结测试路径内观察对应缺陷非零失败，再做实现；记录节点、命令和输出摘要，但不得继承旧 RED 或把人工记录冒充 machine PASS。最终 candidate authority 只由提交内负向测试、完整验证矩阵、machine verify-candidate 与独立审查共同决定；本 approval 不声称能在候选提交内自动重放 parent RED。
