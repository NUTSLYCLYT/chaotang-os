# P04 Shiguan Authenticated Outcome V1 Exact12 Readiness-Corrected Lineage Successor

任务 ID：`P04-SHIGUAN-AUTHENTICATED-OUTCOME-V1-EXACT12-READINESS-CORRECTED-LINEAGE-SUCCESSOR-20260831`

冻结基线：`origin/ext-dev@293fe5d884152918686637cbb4bb6cd6b1fa29d7`

冻结 tree：`0fed6e1e2b14de33d3737fd87de482bb141b5eca`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务在已落地第八组 readiness compatibility pair 的最新 `ext-dev` 上，重新签发 P04 authenticated Outcome exact12。它只在现有史馆 SQLite、认证 Tenant Principal、`REPLY` 档案、不可变 `ADOPTED` decision 与 evidence references 上增加唯一的 append-only、tenant/owner/membership-bound `OutcomeEvent` 和严格脱敏读取投影；不创建第二套史馆、truth ledger、authority 或 runtime，也不把 ReviewStatus、job success、artifact publish、confirmation 或 synthetic fixture 冒充真实 Outcome。

生产写请求仅含 `outcome`、`occurred_at`、`idempotency_key` 和可空 `supersedes_event_id`。tenant、owner、membership、actor、`source_type=OWNER_ATTESTATION`、`source_auth_level=AUTHENTICATED_OWNER_ASSERTION` 与 `recorded_at` 全由服务器派生。该等级只证明“已认证 Owner 的陈述”，不代表独立核验、真实商业成功或 LIVE truth。

Outcome 写入必须在 `BEGIN IMMEDIATE` 事务内重新 JOIN active `PERSONAL/OWNER` membership，并读取同 Owner 的 `REPLY + ADOPTED ArchiveDecision + 至少一条 immutable archive_evidence_reference`。事件不可 update/delete；纠正只能 append 并 supersede 同 scope 当前 head，事务内 CAS 与数据库约束禁止自环、跨 scope、重复 supersede 和并发分叉。

旧 exact12 approval `121c1fa97939584306771094f3a4b5f0198c1f9c` 的 one-child authority 从未被 candidate commit 消费，现按 standing Owner authorization 终止为 `ABANDONED_BY_OWNER_STANDING_AUTHORIZATION_UNCONSUMED / REISSUE_REQUIRED / NO_REANCHOR`。其工作树中的 corrected exact12 只能作为 starting byte donor；独立 Python Review 已证明 v7 `VERIFIED` promotion 仍早于最终 pathname/inode inspection，且若干安全不变量缺少直接负测，因此该 donor 不具有 candidate 或通过身份。旧 authority、candidate、验证、审查和通过身份均不得继承。

## Acceptance Criteria

- [ ] Candidate 精确为 approval manifest 冻结的 `12 MODIFY`，全部 `100644`，无第十三路径。
- [ ] Candidate 先从 bundle `sha256:7ee08b8a336c9fa957bc39027324844e5a0534d4e63400ad4e51804eb08499a9`、full-index diff `sha256:ed63cf5cac3de60f30f829ae0e3863b1684c3c0a0d4b8dc35959273a60c6a46f` 的 corrected donor 重物化；八条无关路径必须保持 donor raw/blob/bytes，四条 review-corrective 路径只允许最小 TDD 纠偏并生成新的 candidate identity。
- [ ] v6→v7 迁移增加 OutcomeEvent、append-only/head 约束和 ArchiveDecision UPDATE/DELETE 拒绝 trigger；失败回滚，post-commit readback 失败保持 `PENDING_VERIFICATION` 并拒绝运行。
- [ ] registry 同时冻结 current-v7 与 canonical `SHIGUAN_V6_PREDECESSOR`；v5→v6 与 v6→v7 显式分两段执行并各自保留验证 backup，禁止静默串迁。
- [ ] Outcome 绑定 server-derived principal、REPLY archive、ADOPTED decision、ordered evidence bundle、发生/记录时间、幂等键、request digest 和 event digest。
- [ ] 同 scope 幂等只有在原 event 及当前 archive/decision/evidence snapshots 全部复核一致时返回原事件；漂移固定 503 且不泄露事件字段。
- [ ] 纠正只允许当前 head；跨 tenant/owner/membership/archive/source、非 head、自环与并发双 fork 全部 fail closed。
- [ ] 写端和两个 Outcome GET 的 `session_id` 只从 Authorization header 经 canonical helper 派生；各事务重新复核 exact session/user/membership/tenant、撤销、过期和 active OWNER/PERSONAL membership。
- [ ] v7 最终 schema/content/count/path identity 检查全部在 held PENDING inode 上完成；`VERIFIED` promotion 必须是最后一个持久动作，promotion 后只做无失败窗口的关闭/返回。最终 inspection 窗口替换成另一合法 v7 inode 必须失败，pathname replacement 与 displaced inode 均保持不可运行。
- [ ] GET 只返回 closed redacted DTO；missing 与 cross-scope 返回同一固定 404；非法输入、digest drift 与客户端身份/source/truth 夹带全部零写入。
- [ ] 当前 65 路径 runtime fingerprint 为 `sha256:82885fc13cec86318e4436fccfd80c78d7880e4aa25cdb530d0f4d18c9c73fe3`，successor fingerprint 为 `sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`；两个 validators 已原子接受该第八 pair。
- [ ] 直接负测证明 expired/revoked session、request/event/archive/decision/evidence digest 与幂等 splice、自环/跨 scope/non-head/并发双 fork、OutcomeEvent 和 ArchiveDecision 的 UPDATE/DELETE 均 fail closed。
- [ ] focused、backend-full、exact12 Ruff、Harness/Doctor/Doctor tests/hook/authority regression/V2/diff check、Governance/Python/Security 三审与 machine candidate verification 全绿。

## Delivery Constraints

- 只有一个 exact12 字节写入者；测试只使用临时 SQLite，不触碰运行数据库。
- 只修改冻结十二路径；禁止新增数据库包、第二 ledger、第二 authority、Jiqun runtime、worker、MCP、网络或前端入口。
- 重物化后只允许在 `backend/app/shiguan/maintenance.py`、`backend/app/shiguan/storage.py`、`backend/tests/test_shiguan_migrations.py`、`backend/tests/test_shiguan_storage.py` 内完成本轮 review-corrective TDD；其余八路径必须逐字节保持 donor。不得顺手重构。
- 不自动 backfill ReviewStatus；历史数据等待未来独立、显式、可审计迁移。
- 不 Pilot、Release、部署、force-push、merge 或 rebase；machine STOP、远端漂移、第十三路径和独立审查 P0–P2 均立即停止。

## Affected Modules

- 模块：史馆 v7 append-only OutcomeEvent、runtime registry/受治理迁移、owner/tenant 绑定存储、认证写入口和脱敏只读投影。
- 允许路径：`backend/app/api/shiguan.py`、`backend/app/operations/runtime_data_registry.py`、`backend/app/shiguan/db.py`、`backend/app/shiguan/maintenance.py`、`backend/app/shiguan/models.py`、`backend/app/shiguan/storage.py`、`backend/tests/test_daily_memorial_scheduler.py`、`backend/tests/test_readiness.py`、`backend/tests/test_shiguan_adopted_evidence.py`、`backend/tests/test_shiguan_api.py`、`backend/tests/test_shiguan_migrations.py`、`backend/tests/test_shiguan_storage.py`。

## Technical Plan

1. 冻结三文件治理包，执行 strict JSON/schema/manifest/Task/Harness，并完成 Governance/Python/Security 三路独立审查。
2. 创建直接单亲 approval commit 并普通快进；在 clean worktree 仅运行一次 product authority，STOP 即停止，GO 只允许一个 exact12 child。
3. 从 approval commit 创建唯一隔离 candidate，将 corrected donor 十二文件 byte-for-byte 重物化；先增加 direct negative tests 并证明 `VERIFIED` promotion、digest/idempotency、supersede/fork 与双向 trigger 的真实 RED。
4. 只在四条 review-corrective 路径内将 promotion 移到最终 PENDING inspection 之后，并闭合负测；运行安全 focused、focused、backend-full、Ruff、完整治理矩阵与三审。所有证明必须绑定 committed HEAD 字节。
5. 创建直接单亲 candidate commit，运行 machine `--verify-candidate`；只有 PASS 才普通快进。
6. 落地后另立 P04 浏览器 Outcome 闭环与 CT-00/Jiqun read-only projection successor；本包不接线、不部署。

## Implementation Report

旧 approval `121c1fa97939584306771094f3a4b5f0198c1f9c` 的 tree 为 `48ee43b052c10fdc6fab2ddbfac00dfe7d87394b`。从旧 approval 到当前基线恰有两个直接单亲提交：

1. `bcfe6f57f2553b1d258cb8f92e971bf8314306ec`：只新增三份 readiness corrective successor 治理文件。
2. `293fe5d884152918686637cbb4bb6cd6b1fa29d7`：只修改两个 readiness validators。

上述五条 changed paths 与 exact12 零重叠。旧 one-child authority 未被 candidate commit 消费，但已因 forward-only 新基线而显式放弃；不得恢复、继承或 re-anchor。

Corrected donor 工作区固定为 `/home/ubuntu/Projects/chaotang-os/.worktrees/p04-shiguan-authenticated-outcome-v1-exact12-lineage-successor-candidate-20260831`，HEAD/tree 为 `121c1fa97939584306771094f3a4b5f0198c1f9c / 48ee43b052c10fdc6fab2ddbfac00dfe7d87394b`，状态为 `CORRECTED_STARTING_BYTE_DONOR_ONLY / REVIEW_CORRECTION_REQUIRED / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / NO_REANCHOR`。其 exact12 bundle 为 `sha256:7ee08b8a336c9fa957bc39027324844e5a0534d4e63400ad4e51804eb08499a9`，full-index diff 为 `sha256:ed63cf5cac3de60f30f829ae0e3863b1684c3c0a0d4b8dc35959273a60c6a46f`；这些摘要只能证明起点，不得成为最终 candidate identity。

Donor bundle 唯一算法：每条记录为 `{path,mode:"100644",bytes,rawSha256:"sha256:<hex>"}`，按 `path` Unicode 字典序排列为 JSON array，对 RFC 8785 canonical UTF-8 bytes 计算 SHA-256。

现有证据只证明 corrected donor 曾达到 focused `340 passed`、exact12 Ruff PASS，以及 readiness exact2 落地前 backend-full 仅余 closed-pair 一项失败。独立 Python Review 进一步证明 `_verify_v7_readback()` 在最终 held-descriptor inspection 前提交 `VERIFIED`，且原 path-replacement test 未断言 replacement/displaced inode 均不可运行；这是本 successor 必须真实 RED→GREEN 的首个根因。Reviewer 对 authority Python runtime 的疑虑已用精确 verification 环境复验排除：`/usr/bin/python3 -m pytest --version` 与 `-m ruff --version` 均 exit 0。新 successor 必须重新执行完整矩阵，不继承旧结果。

## Acceptance Review

待正式 approval、fresh machine GO、exact12 重物化、完整矩阵、三审与 machine candidate verification 后填写。通过只证明 authenticated Owner assertion 的 append-only 事实源和脱敏读取，不证明独立核验、完整 P04、CT-00、Jiqun、Pilot、Release 或商业成功。

## Corrected Donor Byte Manifest

| 路径 | Raw SHA-256 | Git blob | Bytes | Mode |
| --- | --- | --- | ---: | --- |
| `backend/app/api/shiguan.py` | `sha256:bad4a9dcc807abab61dbb91832ad6dc27a996814ee466610116e260d224c9288` | `6bedf562608bc8ccbb2e3417f6b990570b48f026` | 10965 | `100644` |
| `backend/app/operations/runtime_data_registry.py` | `sha256:6394111f89552c39b4c52e394e9ed7cf42859e74bc1d1e8534a3f7f780e4ee05` | `e338ec48c7abb420b49a1e9a849b6c9bcb817144` | 19089 | `100644` |
| `backend/app/shiguan/db.py` | `sha256:47b36d3c3612fce5a692ecd8d8b0026baea4e677a163c203c37ade23627cfd11` | `c8ab85a04425a70ce11231e800f1f91721bbf40d` | 51621 | `100644` |
| `backend/app/shiguan/maintenance.py` | `sha256:f87fa49388d8ed40f4d38f4dfa30b4add9da65897771cd3ce8d59416b9e17aad` | `4fb9212768c21df048f419c25159971c01dabe83` | 37867 | `100644` |
| `backend/app/shiguan/models.py` | `sha256:db7608dc244f3a0bc537efa997cae2086cefc53f50f399ad64c2ae9c118b9159` | `b8a355d10a5e3831dd59a6beb7600a7f31d08219` | 23016 | `100644` |
| `backend/app/shiguan/storage.py` | `sha256:692f167977cf0311565656df704e9f740af7475b54ca7a39384dc63d9536f581` | `5f70fcdfd8cdcd870774832509a2ec37b2d8b611` | 46449 | `100644` |
| `backend/tests/test_daily_memorial_scheduler.py` | `sha256:714200ad954db0b3bdbe7ef2098536e697bfd85042daaece8bd0f67d63210bf4` | `ba824c4e2e2afbae4b4942d4e70a0dee3794e87c` | 23726 | `100644` |
| `backend/tests/test_readiness.py` | `sha256:6ae63a7a708c657c9b51c8dc6fb6ab2806d6816e6be63835ef25fd19055f4cb6` | `69667b60a7e53a23d35b8feea5eee17317fad299` | 26975 | `100644` |
| `backend/tests/test_shiguan_adopted_evidence.py` | `sha256:065001b49052f008aa028898c44d2a3a23eea27880d1289a12237858876c8334` | `5de489fb907f052932371798c6c4a0544c9e1f4f` | 46723 | `100644` |
| `backend/tests/test_shiguan_api.py` | `sha256:daa4bba048b0ddb7e62f292ef5c00ad9d482b99a109a36be4a546f4d8fcd729f` | `7e9f34270f2894b98fa2df813b0b943de8e906ea` | 32503 | `100644` |
| `backend/tests/test_shiguan_migrations.py` | `sha256:0c13f629cd21efbfcb9268bbf4d638e4cda446e0e896e7fc195796d6169ecb59` | `7a7cc119d4d7c9456661ab7674be863f1f9da8db` | 61535 | `100644` |
| `backend/tests/test_shiguan_storage.py` | `sha256:bc9325ee7dd7628fc1d4fc4f87b905009a553ff5f6ff6e30b17afb9335e47cc9` | `1d15098145f97362fe3fd8e31489c5af382f383e` | 37590 | `100644` |

## Canonical Identity Contract

- Canonical bytes 使用 UTF-8、object key 字典序、无多余空格并拒绝 NaN/Infinity。新 `request/archive/decision/evidence_bundle/event` digest 为 `sha256:<64hex>`；既有 evidence `snapshot_hash` 保持历史裸 `64hex`。
- `request_digest` 覆盖 `{archiveId,outcome,occurredAt,idempotencyKey,supersedesEventId}`；`archive_digest`、`decision_digest`、`evidence_bundle_digest` 分别覆盖现有完整、排序稳定、服务器派生的对应 snapshot。
- `event_digest` 覆盖除自身外的全部持久字段。读取和幂等重试都必须重算 event 与当前 archive/decision/evidence snapshots；任一不一致固定 503 且不返回损坏字段。
- 幂等唯一域为 `(tenant_id, owner_user_id, membership_id, idempotency_key)`；纠正只能 supersede 同 scope 当前 head，并要求目标 head 的三类 snapshot digests 与当前源表精确一致。

## Security Negative Matrix

- 未认证、撤销 session、事务中 membership 撤销、客户端身份/source/truth/synthetic 夹带全部在 writer 前失败。
- API 依赖解析后再撤销 exact presented session，写端和两个读端都必须在各自事务授权点失败；session ID 只能来自 header，不能成为可持久化或可回显数据。
- missing/cross tenant/owner/membership/archive/supersede target 使用同形 404；业务冲突为 409，结构错误为 422。
- 非 REPLY、非 ADOPTED、零 evidence、时间越界、非法 key/cursor、request/event/archive/decision/evidence digest drift、幂等 splice、自环/跨 scope/non-head/并发 fork 全部 fail closed，并由直接测试逐类证明。
- SQLite UPDATE/DELETE OutcomeEvent 与 ArchiveDecision 四个方向都必须由 trigger 拒绝；迁移失败不得留下可运行的半状态。
- DTO 不复用富 Archive/Evidence 模型，不允许正文、客户标识、URL、secret、token、header、cookie、prompt、artifact path 或 access metadata。

## Stop Conditions

远端离开 `293fe5d884152918686637cbb4bb6cd6b1fa29d7`、machine STOP、donor raw/blob/bytes 漂移、第十三路径、需修改 auth/RuntimeSkill/Jiqun/其他存储、任何验证失败或独立审查 P0–P2，立即 STOP。
