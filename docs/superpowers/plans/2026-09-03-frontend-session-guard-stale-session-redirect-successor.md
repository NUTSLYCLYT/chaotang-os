# Frontend Session Guard Stale Session Redirect Successor Plan

任务：`FRONTEND-SESSION-GUARD-STALE-SESSION-REDIRECT-SUCCESSOR-20260903`

## Objective

在不新增 BFF、不修改后端认证事实源的前提下，修复 V2 前端受保护页面在残留失效 session cookie 下出现 Runtime Error 的路演稳定性问题。所有不可确认的会话校验结果都应 fail-closed 到登录页。

## Scope

Governance approval paths 精确为：

1. `docs/product/tasks/2026-09-03-frontend-session-guard-stale-session-redirect-successor.md`
2. `docs/product/tasks/2026-09-03-frontend-session-guard-stale-session-redirect-successor.packet.json`
3. `docs/superpowers/plans/2026-09-03-frontend-session-guard-stale-session-redirect-successor.md`

Future candidate paths 精确为：

1. `frontend/src/lib/requireUser.test.ts`
2. `frontend/src/lib/requireUser.ts`

## Non-goals

- 不新增 App Router API route 或 BFF。
- 不修改后端认证、session 存储、tenant principal、authority、Harness 或 systemd。
- 不做前端视觉重设计。
- 不读取真实客户数据，不部署生产。

## Implementation sequence

1. 先落地本三文件治理包并完成 strict JSON、Task 合同、Harness 与审查。
2. 机器允许后，创建唯一 candidate 工作区。
3. 先添加 stale session auth-service failure 的 RED 测试。
4. 最小修改 `requireUser()`：所有 `getCurrentUser` 非成功结果统一 redirect 到登录页。
5. 运行 focused、完整前端、根级 Harness、V2、browser stale-cookie 链和 `git diff --check`。
6. 独立 Frontend Governance Review 与 Security Review 均无 P0/P1/P2 后，才允许 candidate commit 和普通快进。

## Security invariants

- 不确定认证状态必须视为未认证。
- 不暴露受保护页面、不暴露后端错误细节、不扩大 cookie 信任面。
- 登录 `next` 必须继续使用受保护路径白名单来源，不接受任意用户注入路径。
- 成功会话仍只返回 public user。

## Rollback

本包应以普通 fast-forward 小提交落地。若浏览器链或任一矩阵失败，保留证据并创建新的 forward-only corrective successor；不 force-push、不清理 donor、不部署生产。
