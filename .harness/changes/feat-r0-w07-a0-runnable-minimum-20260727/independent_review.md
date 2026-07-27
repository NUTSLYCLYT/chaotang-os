# W07-A0 Independent Review

## Verdict

`NO-GO / HIGH 5 / MEDIUM 6 / NOT_DEPLOYED`

## Required Remediation

1. `DECIDE` 只在 PDF、DOCX、JSON 三项全部 verified/downloadable 时开放。
2. pack quality gate、source labels 和 engine tiers 必须可裁决。
3. 既有 decision endpoint 同时校验 tenant 和 user。
4. 非合同任务不得挂载合同面板或锁定旧工作流。
5. 下载按钮必须服从 server `DOWNLOAD_ARTIFACT`。
6. mission DRAFT 必须先于 archive/decision 分支 fail closed。
7. frontend parser/readback 验证 task/final/receipt 跨字段 identity。
8. exact readback 错误必须对用户可见，不能静默伪装 indexed success。
9. delivery idempotency key 在不确定重试期间保持稳定。
10. API stability 使用固定 baseline，不得被重复运行自我清零。
11. 增加 seeded PARTIAL browser refresh，证明 blocker 且无 resume/delivered。

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

当前状态：`REMEDIATION_VERIFIED / FRESH_TWO_PASS_REVIEW_PENDING`。
