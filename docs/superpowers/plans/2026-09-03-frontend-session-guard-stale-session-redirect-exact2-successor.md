# Frontend Session Guard Stale Session Redirect exact2 Successor Plan

任务：`FRONTEND-SESSION-GUARD-STALE-SESSION-REDIRECT-EXACT2-SUCCESSOR-20260903`

## Objective

用 exact2 修复 V2 前端 protected-route session guard 的 stale cookie 崩屏缺口，使不可验证会话安全回登录页。

## Scope

Approval commit paths：

1. `.harness/approvals/FRONTEND-SESSION-GUARD-STALE-SESSION-REDIRECT-EXACT2-SUCCESSOR-20260903.json`
2. `docs/product/tasks/2026-09-03-frontend-session-guard-stale-session-redirect-exact2-successor.md`
3. `docs/superpowers/plans/2026-09-03-frontend-session-guard-stale-session-redirect-exact2-successor.md`

Candidate paths：

1. `frontend/src/lib/requireUser.test.ts`
2. `frontend/src/lib/requireUser.ts`

## Non-goals

- 不新增 BFF 或 route。
- 不修改后端认证、session 存储、authority、Harness、systemd、P01/P10/P14。
- 不做 UI 改版。
- 不部署生产。

## Execution sequence

1. 提交并普通快进本 approval commit。
2. 运行 product authority，要求 `GO / APPROVED_FOR_ONE_CHILD`。
3. 创建唯一 candidate 工作区，物化 exact2。
4. 运行 focused、frontend build/lint/typecheck、root Harness、V2 check 和 browser stale cookie 验证。
5. machine verify-candidate 通过后，创建 candidate commit 并普通快进。

## Safety checks

- 认证不确定时 fail-closed。
- 受保护页面不得对 stale cookie 放行。
- `next` 只来自编译期受保护路径参数。
- 不暴露后端网络错误。

## Rollback

所有提交必须为普通单亲 fast-forward。失败时保留证据，下一步只能 forward-only corrective successor；不 force-push、不部署生产。
