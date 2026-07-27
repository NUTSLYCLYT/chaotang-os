# W07-A0 Independent Review

## First Candidate Verdict

Candidate `c343cab312d69203ed0ebf36b0b0538760844552`, tree
`a273d7c3811e05e6cce872597e85e761a08b3b72` received two independent Codex
`NO-GO` verdicts. Each pass reported `HIGH 1 / MEDIUM 4`; the consolidated
findings below also retain two low-severity scope/honesty defects.

## Second Candidate Verdict

Candidate `ea267d1c27cd8fa68ec3cee2f3356c06566c3923`, tree
`9e5ddbf6c3454688809734412960fd97662359ec` also received two independent
Codex `NO-GO` verdicts:

- pass 1: `HIGH 4 / MEDIUM 1 / LOW 0`;
- pass 2: `HIGH 1 / MEDIUM 4 / LOW 1`.

主控逐项复核后确认的适用问题：

1. brief 和 legacy memorial review 可绕过 endpoint-local `DECIDE` 检查；
2. pack-only contract candidate 未进入合同 fail-closed 分类；
3. `REVISE_BEFORE_PROCEED` 等非放行 verdict 未参与 server action resolution；
4. 请求 taskId 未与响应 task identity 绑定；
5. fallback/partial/blocker 与 receipt 并存时前端仍可显示 archived/LIVE；
6. 合同 panel 复用 legacy rejected disabled 文案；
7. OpenAPI baseline 可被环境变量改钉；
8. “before any write”证据未覆盖完整 task/final/review/loop 状态。

pass 1 的 artifact user-level finding 不适用：W06R 已批准并实现的是 tenant-owned
artifact 与 cross-tenant isolation，见 W06R spec lines 63-74；W07-A0 不擅自引入
第二层 artifact owner 身份或数据库变更。

## Third Candidate Verdict

Review envelope `4795ebb77a90007225e2d947cd880bd95fc42f7f`, tree
`8f92ba3e56ccae5dae038cd9a774f4afd039dfae` received two fresh independent
Codex `NO-GO` verdicts:

- backend pass `019fa3a4-b192-7271-b67c-9216b5a10a7c`:
  `HIGH 1 / MEDIUM 2 / LOW 0`;
- frontend pass `019fa3a4-fbdd-7893-810a-887726132f23`:
  `HIGH 0 / MEDIUM 2 / LOW 1`.

主控逐项复核后确认全部 findings 适用：

1. brief/shared writer 未验证 review tenant 与 exact final lineage；
2. 非放行 verdict 可被异常既有 receipt 重新投影为有效归档；
3. 零写入快照只比较状态和行数，未覆盖 review/loop/decision/archive 内容；
4. 前端 parser 未绑定 pack/final 的 `court_review_id`；
5. 上书房 ARCHIVED 标签未执行 adjudicable + READY + no blocker 完整 gate；
6. 浏览器证据未直接断言 legacy 四个裁决按钮均消失。

## Required Remediation

1. 正式裁决写入口必须消费 server `DECIDE`，不得绕过 delivery/source/mission 门。
2. nested RiskItem 的 source/engine 必须进入有效来源裁决，aggregate drift fail closed。
3. 对外 read model 必须公开 effective source class，不得只展示 task source。
4. manifest 虽为 READY 但三件套不可下载时，对外状态不得继续显示 READY。
5. `/shiguan` 必须校验 URL `archiveId` 与 exact receipt 一致。
6. Packet 必须诚实区分 base doctor PASS 与 candidate PRE_INTEGRATION STOP。
7. test-only JWT launcher 必须列入 Packet scope/ownership。
8. frontend parser 必须校验 mission/task identity。
9. 删除与本纵切无关的史馆通用“建议”行改动。

## Scope Gate

`APPROVED / 2026-07-27`

Product Owner 已批准修改 `backend/web/routers/shangshufang.py` 和 focused tests，
仅为既有 decision endpoint 增加 `tenant_id + user_id` 双重所有权校验；同时批准在原
文件范围内修复全部 HIGH/MEDIUM、补 seeded PARTIAL browser refresh 和固定 OpenAPI
baseline。该批准不扩展到 Checkpoint B、push、部署、数据库迁移或 listener 3050。

## Remediation Evidence

| Finding | Remediation | Focused evidence |
| --- | --- | --- |
| READY 三件套 | 服务端计算 exact PDF/DOCX/JSON downloadable set | action/projection tests |
| pack adjudicability | quality/source labels/engine tiers fail closed | projection tests |
| decision authz | `tenant_id + user_id` 双重所有权，缺失 tenant 也拒绝 | P0-B + final gate |
| 非合同任务 | 仅 explicit task candidate，server mission/pack 验证后锁旧动作 | frontend node tests |
| 下载授权 | download controls 服从 `DOWNLOAD_ARTIFACT` | action-policy tests |
| DRAFT 顺序 | mission DRAFT 在 archive/decision 分支前 fail closed | action table |
| lineage parser | task/final/delivery/receipt identity/hash 跨字段校验 | parser/readback tests |
| exact error | error 优先于 stale data，禁止 indexed fallback | archive tests |
| idempotency | 未确认成功前内存复用同一 key，成功后清除 | delivery attempt test |
| API baseline | 从 exact `ed822255...` Git archive 生成，比较 schema 内容 | 4 node tests + double-run hash |
| PARTIAL refresh | JWT-protected test-only seed + real JWT browser reload | Playwright 1/1 x2 fresh runs |

## Second Remediation Evidence

| Finding | Remediation | Focused evidence |
| --- | --- | --- |
| task/brief/legacy bypass | 将 `DECIDE` 门下沉到共享 final-decision writer | task/brief/pack-only API tests |
| brief ownership | tenant + user + non-null identity before writer | cross-tenant brief test |
| verdict promotion | 仅 `PROCEED_TO_HUMAN_APPROVAL` 可获得 `DECIDE`；其他 verdict 仍可下载并进入补证/复审 blocker | action/projection/API tests |
| full zero-write proof | 比较 task/final status 及 decision/archive/review/loop 全快照 | API tests |
| request identity | parser 强制 expected taskId | frontend parser test |
| invalid archive display | `REOPEN_ARCHIVE` + adjudicable + READY + no blocker 才显示 archived/detail | policy/readback tests |
| legacy rejected wording | 合同任务隐藏 legacy footer，保留 typed panel 为唯一动作入口 | browser assertion |
| fixed API baseline | 非默认 `API_CONTRACT_BASE_REF` 直接拒绝 | 5 node tests |
| launcher honesty | 明确记录隔离进程加载 canonical app，seed route 不进 schema | Packet diff |

## Third Remediation Evidence

| Finding | Remediation | Focused evidence |
| --- | --- | --- |
| review ownership/lineage | shared writer 写前校验 task/tenant/current final；brief 校验 task/review/user tenant | cross-tenant + unrelated review API tests |
| abnormal receipt | receipt 分支要求 `PROCEED_TO_HUMAN_APPROVAL`，否则按 verdict fail closed | four-verdict resolver table |
| complete zero-write proof | task/final/decision/archive/review/loop 均按完整持久列快照 | mutation-sensitivity + API no-write tests |
| pack/final lineage | parser 强制相同 `court_review_id` | frontend parser test |
| ARCHIVED gate | 上书房与史馆统一要求 adjudicable + READY + `REOPEN_ARCHIVE` + no blocker | action-policy tests |
| single decision entrance | Playwright 直接断言 `准奏/驳回/会审/批示` 四按钮不存在 | real JWT browser 1/1 |

## Fourth Candidate Verdict

Review envelope `a8e8858988be2a3b086228cc469236ad2d7fb86c`, tree
`611aad5b542c80bccd0755ede47db10cc9aee462` received two fresh independent
Codex `NO-GO` verdicts:

- backend pass `019fa3b8-bfb1-7880-904a-b7f1c993b964`:
  `HIGH 1 / MEDIUM 0 / LOW 0`;
- frontend pass `019fa3b8-f758-7753-8c0c-c2e25bb4fb9a`:
  `HIGH 0 / MEDIUM 3 / LOW 1`.

主控技术裁决：

1. `review=None` 仍可写入合同 decision/archive：适用；
2. malformed-present mission/pack 与矛盾 DECIDE fail open：适用；
3. `LIVE_ENGINE` 在史馆被误降级：适用；
4. 合同身份验证完成前 legacy footer/modal 仍可操作：适用；
5. frontend child evidence 仍写 pending/24：适用；
6. “PARTIAL/non-proceed 不得显示 LIVE”：不适用。W07-A0 spec 将来源真实性与
   delivery completeness 分列；PARTIAL 必须显示 blocker 且不得显示
   READY/ARCHIVED/resume/DECIDE，但不应把真实来源降级为 FALLBACK。

## Fourth Remediation Evidence

| Finding | Remediation | Focused evidence |
| --- | --- | --- |
| missing exact review | current final 存在时 `review=None` 或 review id drift 均在写前拒绝 | direct writer + endpoint tests |
| malformed boundary | Zod 校验 mission/review pack，hash/time/delivery shape fail closed | parser tests |
| contradictory DECIDE | 仅 confirmed + passed/proceed + READY + no blocker 可消费 DECIDE | parser state test |
| incomplete READY | DECIDE/REOPEN 要求 PDF/DOCX/JSON 恰好三种且全部 STORED/downloadable | parser packet test |
| source normalization | `LIVE_ENGINE` 在 exact Shiguan readback 保持 `LIVE` | archive test |
| loading-window action | `useSearchParams` 首帧识别；footer/modal/handler 同步阻断 | delayed-read Playwright |
| child evidence drift | exact rerun 和 focused `26 passed` 回写 child Packet | child CI/E2E summaries |

## Fifth Candidate Verdict

Review envelope `68158da9f4e5b0c2158ee3a18e1055a038eaddd4`, tree
`d124c0a5b96799967854e028549f35441319428d` received two fresh independent
Codex `NO-GO` verdicts:

- backend pass: `HIGH 1 / MEDIUM 2`;
- frontend pass: `HIGH 1 / MEDIUM 2`.

主控逐项复核后确认全部 findings 适用：

1. 调用方构造但未持久化的 `CourtReview` 仍可被共享 writer 信任；
2. projection 在 exact `CourtReview` 缺失时仍可能公开 `DECIDE`；
3. 零写入快照未覆盖 `OutboxEvent` 和 `DecreeExecutionEvent`；
4. 任意 absolute/protocol-relative artifact URL 可把 JWT 带往外部 origin；
5. incomplete mission 或 fallback/unknown risk item 仍可能保留 `DECIDE`；
6. fallback archive receipt 可被 typed readback 组装为史馆案卷。

## Fifth Remediation Evidence

| Finding | Remediation | Focused evidence |
| --- | --- | --- |
| persisted review | projection 和共享 writer 均从 DB 读取 exact final review，拒绝 transient/missing row | projection + direct writer + legacy API tests |
| decision ownership | task endpoint 校验 tenant + user；writer 校验 task/review/final tenant、task user 和 exact review lineage | parameterized endpoint + cross-tenant final tests |
| complete zero-write proof | 快照加入 `OutboxEvent`、`DecreeExecutionEvent` 全持久列并验证 mutation sensitivity | API snapshot tests |
| download origin | parser 与 download API 均只接受 exact `/api/artifacts/{artifact_id}/download` | frontend parser tests + defense-in-depth guard |
| complete typed facts | MissionContract/ContractRiskItem/ContractReviewPack 结构化校验，fallback/unknown facts fail closed | frontend node tests |
| receipt provenance | parser 和 typed archive readback 均拒绝非 adjudicable receipt source | parser + archive-readback tests |

当前状态：implementation candidate
`08d46fb4a8c194947e827776bf1fbf4d46e9a038`, tree
`31067a4b0573775086f7b423553ea40fb4b15ecf` 已冻结；状态为
`IMPLEMENTATION_CANDIDATE_FROZEN / FRESH_TWO_PASS_REVIEW_PENDING`。
本文件不预判下一候选的独立审查结论。

## Sixth Candidate Verdict

Review envelope `6a2ffefc24c687f0a2d26ed5dbbc6932577c69be`, tree
`db272c49f102424d278684db971a1589857537d8` received two fresh independent
Codex `NO-GO` verdicts:

- backend pass: `HIGH 1 / MEDIUM 1 / LOW 0`;
- frontend pass: `HIGH 1 / MEDIUM 1 / LOW 1`.

主控逐项复核后确认全部 HIGH/MEDIUM 适用：

1. `recheck` 未消费 server action，且 ready final 与 persisted review status 脱节；
2. W06 `EXPIRED` artifact 无法进入 W07 typed public projection；
3. Mission 与 ReviewPack 的五项业务范围可漂移但仍获得 `DECIDE`；
4. 史馆顶部声明 exact archive，中间卷轴仍显示“来源待核”和 legacy 裁决建议。

LOW 为 parser root/task/blocker 未统一声明 `additionalProperties: false`；不影响当前
typed H/M closure，保留为后续 contract hardening residual，不在本次批准范围扩展。

## Sixth Remediation Evidence

| Finding | Remediation | Focused evidence |
| --- | --- | --- |
| review/action split | ready final 只接受 persisted `awaiting_decision` review；contract `recheck` 必须消费 `REFRESH_REVIEW` | projection + API zero-write tests |
| expired artifact | internal `EXPIRED` 映射为 public `UNAVAILABLE / expired`，delivery 降为 `UNDER_REVIEW` | projection test |
| business scope drift | backend 与 frontend 同时比较 jurisdiction/language/contract_type/our_role/legal_question | projection + parser tests |
| archive contradiction | exact receipt 使用 audit-only `EdictView`，显示 LIVE 且不暴露 legacy decision advice | node + Playwright + screenshot |
| P0-B ratchet | `contracts.py ×1` 只登记已有 `_owned_task` 查询；四个 route 继续由跨用户 404 probes 约束 | P0-B 26/26 |

新 implementation candidate
`5d5ff747850ee161a1b39af849f39a0732be15d9`, tree
`cf6a25089c69fe70961ae6d8f3972065923a605e` 已冻结；状态为
`IMPLEMENTATION_CANDIDATE_FROZEN / FRESH_TWO_PASS_REVIEW_PENDING /
NOT_DEPLOYED`。本文件不预判下一候选的独立审查结论。

## Seventh Candidate Verdict

Review envelope `492703ce9b6f89d57f5ac0b07082289426ed6b5e`, tree
`6a2f5d859a1c4e6119e4d55e327823505895e9e7` received two independent
Codex `NO-GO` verdicts:

- backend pass `019fa41e-6f6d-7de3-bc69-fdfc946c0d86`:
  `HIGH 2 / MEDIUM 1 / LOW 0`;
- frontend/cross-boundary pass `019fa41e-b775-7de2-b5c4-8185696a7d8c`:
  `HIGH 1 / MEDIUM 4 / LOW 1`.

合并后的唯一 findings 为 `HIGH 3 / MEDIUM 5 / LOW 1`：

1. HIGH：legacy memorial route 只验证 user；same-user cross-tenant 可写 decision/archive；
2. HIGH：`request_evidence`、`followup`、`cancel` 未消费 server `allowed_actions`；
3. HIGH：Mission revision/digest 未绑定 ReviewPack，可复用旧 review/delivery 取得 `DECIDE`；
4. MEDIUM：clock-expired W06 artifact 对外仍显示 `STORED`；
5. MEDIUM：terminal/cancelled DecisionTask status 未进入 privileged action resolution；
6. MEDIUM：frontend root/task/blocker boundary 未 closed-world，额外字段被保留；
7. MEDIUM：authoritative review 缺失时仍投影 final/delivery，虽无 action 但会显示 READY/LIVE；
8. MEDIUM：exact archive 中栏只读，但右栏仍暴露 retrospective 写按钮与 Next Action；
9. LOW：exact `/shiguan` loading 只有 data attribute，没有可见 loading state。

两路分别运行了 backend focused/broad、frontend 33 tests、tsc、API stability、
disposable Playwright/build/OpenAPI 和独立攻击 probe；均确认 review 前后 worktree
clean，未修改文件、未部署、未迁移数据库、未操作 3050。

## Scope Conflict

finding 1 无法仅在当前批准的
`backend/web/routers/shangshufang.py`、projection/contracts、frontend consumer 和
focused tests 范围内正确闭环。可靠修复需要修改
`backend/web/routers/chaotang.py` 和/或共享 `backend/src/decision_task_access.py`，
使 legacy route 把 caller tenant 传入统一 ownership gate。按 EXT Governance
Contract，发现 scope conflict 后停止业务修改，不允许通过阻断全部 legacy
同租户功能来伪装修复。

当前状态：
`REVIEWED_NO_GO / SCOPE_AMENDMENT_REQUIRED / NOT_DEPLOYED`。candidate 不得整合
local EXT。

## Seventh Remediation Evidence

Product Owner 已批准扩大 scope 到 `backend/web/routers/chaotang.py`、
`backend/src/decision_task_access.py`、`backend/src/contract_rework.py` 和 focused
tests，并授权修复全部第七轮 HIGH/MEDIUM。

| Finding | Remediation | Fresh evidence |
| --- | --- | --- |
| legacy tenant ownership | shared accessor 同时要求 tenant + user；三个 legacy caller 传入 caller tenant | same-user cross-tenant route RED/GREEN |
| all decision authority | W07 Mission/pack task 的 final/evidence/recheck 全部消费 server action；cancel 明确拒绝；exact idempotency winner 只读重放 | API full-state zero-write + W05 replay regression |
| Mission revision/digest | pack 携带 revision/digest；projection 与当前 Mission exact match；rework worker 写入同 identity | stale revision projection + real worker assertions |
| terminal task | terminal statuses 优先返回 `STATE_INCONSISTENT` 和空 actions | resolver table |
| clock expiry | UTC 当前时钟已过期即 public `UNAVAILABLE / expired` | immutable manifest + STORED row expiry test |
| missing review omission | 缺 authoritative review 时清除 pack/final/delivery/archive downstream | projection omission test |
| frontend closed-world | root/task/blocker/final/artifact/receipt 白名单 + strict Mission/Pack schema | Node parser RED/GREEN |
| exact archive right rail | exact receipt 使用专用只读审计栏，不渲染 retrospective writer/Next Action | real JWT Playwright |

固定 OpenAPI base 仍为 `ed822255...`。guard 仅允许新增 optional component property，
字段删除、改型或 optional→required 仍返回 breaking；两次生成 hash 完全一致。

implementation candidate：

- H `61805256968f23cc3bcafbdba4f1a251eadd8ed4`
- tree `c47be09c7325f7d016a3be8362c2e55b194db22b`
- status
  `IMPLEMENTATION_CANDIDATE_FROZEN / FRESH_TWO_PASS_REVIEW_PENDING /
  NOT_DEPLOYED`

第七轮 LOW visible loading 未包含在批准范围，本轮不顺带实现。

## Eighth Candidate Verdict

Review envelope `a7937d7edf8341990e3baaeeb992f386c88f8b39`, tree
`019faafa0b59829fbae08dde37030ebf8ae65241` received two fresh independent
Codex `NO-GO` verdicts:

- backend/cross-boundary pass `019fa504-896e-7f21-8194-ca3cfa4d18f4`:
  `HIGH 1 / MEDIUM 5 / LOW 0`;
- frontend/contract pass `019fa504-cef7-7af3-833e-af91514eef2a`:
  `HIGH 1 / MEDIUM 3 / LOW 1`.

主控去重后的适用项为 `HIGH 2 / MEDIUM 6 / LOW 1`：

1. HIGH：旧 evidence rework event 可在处理中恢复 terminal task；
2. HIGH：只有 legacy `contract_scope` 的任务可绕过 server action authority；
3. MEDIUM：普通任务列表选中服务端合同任务时仍可能暴露 legacy 动作；
4. MEDIUM：OpenAPI guard 对 response 可达 schema 仍错误放行 optional property；
5. MEDIUM：缺 Mission 的 rework worker 未明确 fail closed；
6. MEDIUM：legacy cancel/recheck 重放会重复写 decision/timeline；
7. MEDIUM：Mission 处理后到发布前存在 revision/digest drift 窗口；
8. MEDIUM：直接 cancellation suite 的 legacy fixture 缺 tenant，无法提供回归证据；
9. LOW：已缓存的前端 artifact expiry 不会本地实时关闭，只能等待服务端重投影。

既有 LOW visible loading 仍是独立 residual，不计入上述两路新 review 数量。

## Eighth Remediation Evidence

| Finding | Remediation | Fresh evidence |
| --- | --- | --- |
| terminal worker resurrection | 处理前和 publication task lock 后均检查 terminal status | public worker interruption tests |
| scope-only authority | `contract_scope` 也进入全部 contract action gate | 8-action zero-write table |
| server contract selection | home summary 透传 `contract_scope`，仅 server-classified memorial 激活 typed panel | frontend task-selection tests |
| response compatibility | 从旧 responses 递归计算 component reachability；response schema 增字段判 breaking | API guard Node tests |
| missing Mission | worker 在任何 parse/write 前返回 `mission_missing` | worker missing-Mission test |
| replay idempotency | terminal cancel / reviewing recheck 返回既有结果，不追加 decision/timeline | HTTP replay tests |
| Mission publication | SQLite 使用既有写锁；PostgreSQL 最终重读前锁定 `court_loop_runs`，阻止事务内 publication drift | dialect lock + interruption tests |
| cancellation fixtures | legacy task/review 显式 tenant 归属并直接复跑完整文件 | `test_task_cancellation.py` |
| typed response | W07 read model 使用 required revision/digest 的专用 pack schema | OpenAPI/runtime tests |

新 implementation candidate：

- H `7b8b84d20a3e21f38f89e97f590c554b4045081c`
- tree `6263bf1d2a45a3b2dafdddc2ccdcd7b79cad07f8`
- status
  `IMPLEMENTATION_CANDIDATE_FROZEN / FRESH_TWO_PASS_REVIEW_PENDING /
  NOT_DEPLOYED`

本文件不预判 `7b8b84d2...` 的下一轮独立审查结论。
