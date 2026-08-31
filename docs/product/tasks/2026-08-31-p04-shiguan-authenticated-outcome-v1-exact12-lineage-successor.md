# P04 Shiguan Authenticated Outcome V1 Exact12 Lineage Successor

任务 ID：`P04-SHIGUAN-AUTHENTICATED-OUTCOME-V1-EXACT12-LINEAGE-SUCCESSOR-20260831`

冻结基线：`origin/ext-dev@7021bf71019dec57c95aa58bb5a389a66bd0ffdf`

冻结 tree：`b53c6323f48f1a37aaac09e132e0b9881654ee11`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务在最新 `ext-dev` 上重新签发 P04 authenticated Outcome exact12。它只在现有史馆 SQLite、认证 Tenant Principal、`REPLY` 档案、不可变 `ADOPTED` decision 与 evidence references 上增加唯一的 append-only、tenant/owner/membership-bound `OutcomeEvent` 和严格脱敏读取投影。它不创建第二套史馆、truth ledger、authority 或 runtime，也不把 ReviewStatus、job success、artifact publish、confirmation 或 synthetic fixture 冒充真实 Outcome。

生产写请求采用闭合字段 `outcome`、`occurred_at`、`idempotency_key`、可空 `supersedes_event_id`。`outcome` 仅为 `ACHIEVED | PARTIAL | NOT_ACHIEVED | OBSERVING`；tenant、owner、membership、actor、`source_type=OWNER_ATTESTATION`、`source_auth_level=AUTHENTICATED_OWNER_ASSERTION` 与 `recorded_at` 全由服务器派生。该等级只证明“已认证 Owner 的陈述”，不代表独立核验、真实商业成功或 LIVE truth。

Outcome 写入必须在 `BEGIN IMMEDIATE` 事务内重新 JOIN active `PERSONAL/OWNER` membership，并读取同 Owner 的 `REPLY + ADOPTED ArchiveDecision + 至少一条 immutable archive_evidence_reference`。事件不可 update/delete；纠正只能 append 并 supersede 同 scope 当前 head，事务内 CAS 与数据库约束禁止自环、跨 scope、重复 supersede 和并发分叉。

本 successor 不继承旧 approval、machine authority、candidate、RED/GREEN、验证或审查身份。旧未提交 exact12 仅是已知起点 donor；独立 Security Review 已证明其存在 session-revocation TOCTOU 与最终 pathname/inode inspection splice，因此最终 candidate 不得 byte-for-byte 冒充旧 donor。fresh machine GO 后先机械重物化 donor，再只在冻结 exact12 内完成两项安全纠偏并重新运行全部验证与独立审查。

## Acceptance Criteria

- [ ] Candidate 精确为 approval manifest 冻结的 `12 MODIFY`，全部 `100644`，无第十三路径。
- [ ] v6→v7 迁移增加 OutcomeEvent、append-only/head 约束和 ArchiveDecision UPDATE/DELETE 拒绝 trigger；失败回滚，post-commit readback 失败保持 `PENDING_VERIFICATION` 并拒绝运行。
- [ ] registry 同时冻结 current-v7 与 canonical `SHIGUAN_V6_PREDECESSOR`；v5→v6 与 v6→v7 必须显式分两段执行并各自保留验证 backup，禁止静默串迁。
- [ ] 迁移按稳定主键/列序复用既有 typed-content digest 算法，证明 source-before、verified-v6-backup 与 committed-v7-readback 的历史内容等价。
- [ ] Outcome 绑定 server-derived principal、REPLY archive、ADOPTED decision、ordered evidence bundle、发生/记录时间、幂等键、request digest 和 event digest。
- [ ] 同 scope 幂等只有在原 event 及当前 archive/decision/evidence snapshots 全部复核一致时返回原事件；漂移固定 503 且不泄露事件字段。
- [ ] 纠正只允许当前 head；跨 tenant/owner/membership/archive/source、非 head、自环与并发双 fork 全部 fail closed。
- [ ] 写端和两个 Outcome GET 的 `session_id` 只从同一请求 Authorization header 经现有 canonical helper 派生，不进入 body/query/DTO/event/digest/log；写事务 `BEGIN IMMEDIATE` 后、读事务首次 snapshot read 时，按 exact session/user/membership/tenant JOIN 复核 session 未撤销未过期及 active OWNER/PERSONAL membership。
- [ ] session expiry 以 aware UTC datetime 解析比较，授权时点与 event `recorded_at` 使用同一事务起始时刻；禁止把 `Z` 与 `+00:00` 文本直接比较。
- [ ] v7 最终 schema/verified-state/count inspection 优先通过 held descriptor 完成，并在返回前再次核对 directory 与 pathname entry identity；最终 inspection 窗口被替换成另一合法 v7 inode 必须失败。
- [ ] GET 仅返回 closed redacted DTO，不含自由文本、客户标识、URL、path、prompt、evidence 正文或访问元数据；limit 为 `1..100`，cursor 受界且绑定稳定排序键。
- [ ] missing 与 cross-scope 返回同一固定 404 status/body；未认证/撤销 session、事务中 membership 撤销、非 REPLY、非 ADOPTED、零 evidence、digest drift、时间越界和客户端身份/source/truth 夹带全部零写入。
- [ ] machine candidate verification 必须复算全部 donor objects 与 donor RFC 8785 bundle；六条无关路径必须保持 donor blob，六条 corrective 路径必须与 donor blob 不同，且 candidate worktree 与 committed tree 一致。
- [ ] fresh RED、focused、backend-full、exact12 Ruff、Harness/Doctor/Doctor tests/hook/authority regression/V2/diff check 和 Governance/Python/Security 三审全绿。

## Delivery Constraints

- 只有一个 exact12 字节写入者；测试只使用临时 SQLite，不触碰运行数据库。
- 只修改冻结十二路径；禁止新增数据库包、第二 ledger、第二 authority、Jiqun runtime、worker、MCP、网络或前端入口。
- 不自动 backfill ReviewStatus；历史数据等待未来独立、显式、可审计迁移。
- 三份兼容测试只能将 fresh/current Shiguan 的 v6 期望升级为 v7并增加约束，禁止删除、skip、xfail、重排或放宽既有断言。
- 不 Pilot、Release、部署、force-push、merge 或 rebase；machine STOP、远端漂移、第十三路径和独立审查 P0–P2 均立即停止。

## Affected Modules

- 模块：史馆 v7 append-only OutcomeEvent、runtime registry/受治理迁移、owner/tenant 绑定存储、认证写入口和脱敏只读投影。
- 允许路径：`backend/app/api/shiguan.py`、`backend/app/operations/runtime_data_registry.py`、`backend/app/shiguan/db.py`、`backend/app/shiguan/maintenance.py`、`backend/app/shiguan/models.py`、`backend/app/shiguan/storage.py`、`backend/tests/test_daily_memorial_scheduler.py`、`backend/tests/test_readiness.py`、`backend/tests/test_shiguan_adopted_evidence.py`、`backend/tests/test_shiguan_api.py`、`backend/tests/test_shiguan_migrations.py`、`backend/tests/test_shiguan_storage.py`。

## Technical Plan

1. 冻结三文件治理包并完成 strict JSON/schema/manifest/Task/Harness 与三路独立审查。
2. 物化正式 approval，普通快进落地后仅运行一次 product authority；STOP 即停止，GO 只允许一个 exact12 child。
3. 在 fresh candidate 中先形成真实 RED，覆盖可变 ReviewStatus、同形 404、身份夹带、membership/session 撤销竞态、非 REPLY/ADOPTED/证据、时间/key/cursor 越界、snapshot/event digest drift、幂等 splice、纠正 fork、SQL update/delete、投影泄漏与最终 inspection pathname replacement。RED 命令、失败节点和输出摘要形成独立开发证据；它不冒充最终 candidate identity。
4. 先在 exact12 内机械重物化 donor，再只修改六条 corrective 路径：`backend/app/api/shiguan.py`、`backend/app/shiguan/maintenance.py`、`backend/app/shiguan/storage.py`、`backend/tests/test_shiguan_api.py`、`backend/tests/test_shiguan_migrations.py`、`backend/tests/test_shiguan_storage.py`。其余六条必须保持 donor blob；如需第十三路径立即停止。
5. 运行 manifest 全矩阵及 Governance/Python/Security 三审；随后 machine verify-candidate，只有 PASS 才普通快进。
6. 落地后另立 P04 浏览器 Outcome 闭环与 CT-00/Jiqun read-only projection successor；本包不接线、不部署。

## Implementation Report

旧 approval commit `a8d631210372924cbe96a348050d20c10a756584` 是当前基线祖先，但其 one-child identity 已因主线新增 readiness prerequisite 而终止，状态为 `HISTORICAL_EVIDENCE_ONLY / NO_REANCHOR`。从旧 approval 到当前基线恰有两个直接单亲提交：

1. `13eca83998530de6b463774a693214a82233c07f`：只新增三份 P04 readiness 治理文件。
2. `7021bf71019dec57c95aa58bb5a389a66bd0ffdf`：只修改两个 readiness validators。

这五条路径与 exact12 零重叠；因此旧产品字节可以作为 byte donor，但旧 authority、候选、验证、通过和审查结论不得继承。

Donor 工作区固定为 `/home/ubuntu/Projects/chaotang-os/.worktrees/p04-shiguan-authenticated-outcome-v1-prerequisite-successor-candidate-20260831`，HEAD/tree 为 `a8d631210372924cbe96a348050d20c10a756584 / 04d325513eb8aa69106cc8421c62417d5598f04f`，状态为 `BYTE_STARTING_DONOR_ONLY / SECURITY_CORRECTION_REQUIRED / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`。其 exact12 donor bundle 为 `sha256:fffb8a4734a0c879fc9ca42bfad52abf6127793a9b332ddadf1b097407dd8d8a`，历史 full-index diff 为 `sha256:80c750a5b0e592840f38bd6e0b882fee48a016614bad4405bb64c97763de47a4`；二者只证明 donor 来源，不是最终 candidate identity。

Donor bundle 唯一算法：每条记录为 `{path,mode:"100644",bytes,rawSha256:"sha256:<hex>"}`，按 `path` Unicode 字典序排列为 JSON array，对 RFC 8785 canonical UTF-8 bytes 计算 SHA-256。最终 candidate 完成安全纠偏后必须重新生成新的 raw/blob/bytes、bundle 与 full-index diff，旧摘要不得继承。

## Acceptance Review

待正式 approval、fresh machine GO、exact12 RED/GREEN、完整矩阵、三审与 machine candidate verification 后填写。通过只证明 authenticated Owner assertion 的 append-only 事实源和脱敏读取，不证明独立核验、完整 P04、CT-00、Jiqun、Pilot、Release 或商业成功。

## Donor Byte Manifest

| 路径 | Raw SHA-256 | Git blob | Bytes | Mode |
| --- | --- | --- | ---: | --- |
| `backend/app/api/shiguan.py` | `sha256:46e49ac781a96aab7a3ca9d313fc8ce1cf599053a6c02f3dff20ad82f0dafa96` | `d834a7ce2cb3c06f11dcbbd2c9f7f1d1373a5015` | 10604 | `100644` |
| `backend/app/operations/runtime_data_registry.py` | `sha256:6394111f89552c39b4c52e394e9ed7cf42859e74bc1d1e8534a3f7f780e4ee05` | `e338ec48c7abb420b49a1e9a849b6c9bcb817144` | 19089 | `100644` |
| `backend/app/shiguan/db.py` | `sha256:47b36d3c3612fce5a692ecd8d8b0026baea4e677a163c203c37ade23627cfd11` | `c8ab85a04425a70ce11231e800f1f91721bbf40d` | 51621 | `100644` |
| `backend/app/shiguan/maintenance.py` | `sha256:263f7882ffacb362284431922a8aee94e775cc22fa473a21fe1a7d571d352aa3` | `aa9aa4d9dc75d125c741f7bbc558a8bf5aa1e9ef` | 37385 | `100644` |
| `backend/app/shiguan/models.py` | `sha256:db7608dc244f3a0bc537efa997cae2086cefc53f50f399ad64c2ae9c118b9159` | `b8a355d10a5e3831dd59a6beb7600a7f31d08219` | 23016 | `100644` |
| `backend/app/shiguan/storage.py` | `sha256:6ca2fa88ee49e0745ffec8b21054ac872c71079dedf2f8d7cb607fd9bca799ec` | `139b067e6056a16b091fd96d10453ef9509752e3` | 45178 | `100644` |
| `backend/tests/test_daily_memorial_scheduler.py` | `sha256:714200ad954db0b3bdbe7ef2098536e697bfd85042daaece8bd0f67d63210bf4` | `ba824c4e2e2afbae4b4942d4e70a0dee3794e87c` | 23726 | `100644` |
| `backend/tests/test_readiness.py` | `sha256:6ae63a7a708c657c9b51c8dc6fb6ab2806d6816e6be63835ef25fd19055f4cb6` | `69667b60a7e53a23d35b8feea5eee17317fad299` | 26975 | `100644` |
| `backend/tests/test_shiguan_adopted_evidence.py` | `sha256:065001b49052f008aa028898c44d2a3a23eea27880d1289a12237858876c8334` | `5de489fb907f052932371798c6c4a0544c9e1f4f` | 46723 | `100644` |
| `backend/tests/test_shiguan_api.py` | `sha256:79fea5ca1cf06eaa9b977f9b9b94dafaf083329f4816ff5ddd1f4502df78b237` | `5d24257ecaac825fd17e492a31aadb12c2b00477` | 28757 | `100644` |
| `backend/tests/test_shiguan_migrations.py` | `sha256:9a4f1d69d6bfdf0d60c68674b9e006886f6e71a4b0c6afad7cc123864e7c7d74` | `9da4ae0e6c673b50ff0bcbf8c8ac69cc0e24cde5` | 60523 | `100644` |
| `backend/tests/test_shiguan_storage.py` | `sha256:f6b548547123dc9f5b6ec39330130da3c7209a66d22d120d439a9815aac0e8fe` | `70e03e6e3e5b278363325bc33b2dd61a48794b7d` | 35061 | `100644` |

## Canonical Identity Contract

- Canonical bytes 使用 UTF-8、object key 字典序、无多余空格并拒绝 NaN/Infinity。新 `request/archive/decision/evidence_bundle/event` digest 为 `sha256:<64hex>`；既有 evidence `snapshot_hash` 保持历史裸 `64hex`。
- `request_digest` 覆盖 `{archiveId,outcome,occurredAt,idempotencyKey,supersedesEventId}`；`archive_digest`、`decision_digest`、`evidence_bundle_digest` 分别覆盖现有完整、排序稳定、服务器派生的对应 snapshot。
- `event_digest` 覆盖除自身外的全部持久字段。读取和幂等重试都必须重算 event 与当前 archive/decision/evidence snapshots；任一不一致固定 503 且不返回损坏字段。
- 幂等唯一域为 `(tenant_id, owner_user_id, membership_id, idempotency_key)`；纠正只能 supersede 同 scope 当前 head，并要求目标 head 的三类 snapshot digests 与当前源表精确一致。

## Security Negative Matrix

- 未认证、撤销 session、事务中 membership 撤销、客户端身份/source/truth/synthetic 夹带全部在 writer 前失败。
- API 依赖解析后再撤销 exact presented session，写端和两个读端都必须在各自事务授权点失败；session ID 只能来自 header，不能成为可持久化或可回显数据。
- missing/cross tenant/owner/membership/archive/supersede target 使用同形 404；业务冲突为 409，结构错误为 422。
- 非 REPLY、非 ADOPTED、零 evidence、时间越界、非法 key/cursor、snapshot/event digest drift、幂等 splice、自环/跨 scope/并发 fork 全部 fail closed。
- SQLite UPDATE/DELETE OutcomeEvent 与 ArchiveDecision 必须由 trigger 拒绝；迁移失败不得留下可运行的半状态。
- DTO 不复用富 Archive/Evidence 模型，不允许正文、客户标识、URL、secret、token、header、cookie、prompt、artifact path 或 access metadata。

## Stop Conditions

远端离开 `7021bf71019dec57c95aa58bb5a389a66bd0ffdf`、machine STOP、donor object 身份漂移、第十三路径、需修改 auth/RuntimeSkill/Jiqun/其他存储、session 不能在 exact12 内闭合、canonical v6 predecessor 不匹配、任何验证失败或独立审查 P0–P2，立即 STOP。
