# W07-A0 Independent Review

## First Candidate Verdict

Candidate `c343cab312d69203ed0ebf36b0b0538760844552`, tree
`a273d7c3811e05e6cce872597e85e761a08b3b72` received two independent Codex
`NO-GO` verdicts. Each pass reported `HIGH 1 / MEDIUM 4`; the consolidated
findings below also retain two low-severity scope/honesty defects.

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

当前状态：
`REMEDIATION_LOCAL_PASS / CANDIDATE_NOT_FROZEN / FRESH_TWO_PASS_REVIEW_PENDING`。
本文件不预判下一候选的独立审查结论。
