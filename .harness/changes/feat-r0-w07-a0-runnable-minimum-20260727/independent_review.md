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

当前状态：implementation candidate
`4eaab7cc31480c24caa8c4b3277d34f3c152d68c`, tree
`3458c262e00f6769000a877a9a3bbf34011965b6` 已冻结；状态为
`IMPLEMENTATION_CANDIDATE_FROZEN / FRESH_TWO_PASS_REVIEW_PENDING`。
本文件不预判下一候选的独立审查结论。
