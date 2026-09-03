# Frontend Session Guard Stale Session Redirect Successor

任务 ID：`FRONTEND-SESSION-GUARD-STALE-SESSION-REDIRECT-SUCCESSOR-20260903`

冻结基线：`4b1f33ca122ab6b79fe0c828345cbd6b720f1dbc`

冻结基线 tree：`13451d12b600b76a3123b89cdad224492f9fde83`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`
>
> 本 successor 只处理前端受保护页面在浏览器残留过期 session cookie、且后端会话校验不可达或不能确认时的路演级稳定性缺口。
> 目标是 fail-closed 回登录页，而不是渲染 Runtime Error。它不新增 BFF，不修改后端事实源，不创建第二套认证系统。

## Status

Draft

## Product Definition

当前 `origin/ext-dev@4b1f33ca122ab6b79fe0c828345cbd6b720f1dbc` 已通过前端 typecheck、lint、unit test、production build、后端完整回归和根级 Harness 矩阵。

真实浏览器验证发现：

- 无 cookie 访问 `/honglusi` 会正确跳转至 `/login?next=%2Fhonglusi`。
- 带残留失效 `courtos_session` cookie 访问 `/honglusi` 时，`requireUser()` 会在后端会话校验返回非 `unauthenticated` 失败时抛出 `Unable to validate the current session.`，导致 Next.js Runtime Error 页面。

本包的产品目标是将该场景改为安全、确定、可解释的登录重入：

- 未登录、后端明确拒绝、后端不可达或会话无法验证，均不暴露受保护页面。
- 统一跳转到 `/login?next=<protected path>`。
- 不信任浏览器 cookie，不把后端不可达解释成已认证。
- 不修改认证 API、cookie 格式、后端 session 存储或任何业务事实源。

## Acceptance Criteria

- [ ] approval commit 必须是 `4b1f33ca122ab6b79fe0c828345cbd6b720f1dbc` 的直接单亲子，只包含本 Task、Packet、Plan 三条治理路径。
- [ ] future candidate 只允许修改：
  - `frontend/src/lib/requireUser.ts`
  - `frontend/src/lib/requireUser.test.ts`
- [ ] candidate 必须证明带 stale session 且 `getCurrentUser` 返回 `network` 时，`requireUser("/honglusi")` fail-closed 跳转到 `/login?next=%2Fhonglusi`。
- [ ] 既有 absent session 与 backend-rejected session 行为不得回退。
- [ ] 既有成功会话仍只返回 public user，不暴露 session id 或后端错误细节。
- [ ] 真实浏览器中 `/honglusi` 在残留 stale cookie 场景不得再出现 Runtime Error；应到达登录页。
- [ ] 前端 `npm test`、typecheck、lint、production build、根级 Harness、doctor、product-authority regression、V2 convergence 和 `git diff --check` 必须通过。

## Delivery Constraints

- 不新增、删除或恢复 `src/app/api/**` route，不新增 BFF。
- 不修改后端 API、数据库、session 存储、tenant principal、authority、Harness、P01/P10/P14 或 systemd 文件。
- 不修改登录页视觉和路由结构；本包不是美工改版。
- 不读取真实客户数据，不使用生产凭据，不部署生产。
- 不继承任何旧 frontend donor、candidate、审查、验证或 authority 身份。
- 不允许 force-push、merge、rebase、fetch/pull、清理 dirty donor 或删除工作区。

## Affected Modules

- 模块：前端受保护页面 session guard
- 允许路径：`frontend/src/lib/requireUser.ts`；`frontend/src/lib/requireUser.test.ts`

## Technical Plan

1. 从 `4b1f33ca… / 13451d12…` 冻结本 successor 三文件治理包。
2. approval 普通快进落地后，从 approval commit 创建唯一干净 candidate 工作区。
3. 在 `frontend/src/lib/requireUser.test.ts` 增加 stale session + auth service network failure 的负向测试，证明当前基线会抛 Runtime Error 而不是回登录。
4. 在 `frontend/src/lib/requireUser.ts` 中将所有 `getCurrentUser` 非成功结果统一 fail-closed 到登录页。
5. 重新运行完整前端与根级矩阵，并用真实浏览器复查 `/honglusi` stale cookie 场景。

## Implementation Report

当前为治理草案。本轮不声明产品 candidate、不声明 machine GO、不声明可推送产品字节。

已有未提交路演补丁只作为 pre-governance evidence：

- 路径：`frontend/src/lib/requireUser.ts`
- 路径：`frontend/src/lib/requireUser.test.ts`
- 预检验证：
  - focused `requireUser`：5/5 passed
  - frontend unit：689/689 passed
  - typecheck：PASS
  - lint：PASS
  - production build：PASS
  - browser `/honglusi` stale cookie：由 Runtime Error 变为 `/login?next=%2Fhonglusi`

这些字节必须在 successor approval 落地后重新物化、重新验证、重新审查；不得直接继承 candidate 或通过身份。

## Acceptance Review

本 Task 当前为 `Draft`，仅提供最窄治理边界和验收合同。

通过条件：

- approval 三文件普通单亲落地；
- product authority 或项目等价机器门明确允许 exact2；
- exact2 candidate 在最新 approval commit 上重新物化；
- 完整验证与独立审查无 P0/P1/P2；
- 普通 fast-forward 落地。

若机器 authority、Harness、浏览器链或独立审查任一 STOP，则保持前端补丁为未提交 evidence，不得绕过门禁推送。
