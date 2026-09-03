# Frontend Session Guard Stale Session Redirect exact2 Successor

任务 ID：`FRONTEND-SESSION-GUARD-STALE-SESSION-REDIRECT-EXACT2-SUCCESSOR-20260903`

冻结基线：`b084bc9e6f5f4f3987b969515d3bd9586de93047`

冻结基线 tree：`b40a6ec77957fa0c69316cd8dc04cf20c2a7ee56`

> 状态：`APPROVED_FOR_ONE_CHILD` 仅由同 commit 内正式 approval manifest 表达；本文档本身不创建第二 authority。

## Status

Draft

## Product Definition

本 successor 将前端受保护页面的 stale session 处理改为安全登录重入。真实浏览器预检显示：残留失效 `courtos_session`
访问 `/honglusi` 时，后端会话校验不可达会使 `requireUser()` 抛出 `Unable to validate the current session.`，页面进入 Runtime Error。

目标行为：

- 缺失 session、后端明确拒绝、网络不可达或会话无法验证，均跳转到 `/login?next=<protected path>`。
- 不向浏览器暴露后端错误细节。
- 不把后端不可达视为认证成功。
- 不新增 BFF、不修改后端认证事实源。

## Acceptance Criteria

- [ ] approval commit 是 `b084bc9e6f5f4f3987b969515d3bd9586de93047` 的直接单亲子，只包含正式 approval、Task、Plan 三路径。
- [ ] candidate commit 只修改：
  - `frontend/src/lib/requireUser.test.ts`
  - `frontend/src/lib/requireUser.ts`
- [ ] `getCurrentUser` 返回 `network` 时，`requireUser("/honglusi")` 跳转 `/login?next=%2Fhonglusi`。
- [ ] absent session、backend rejected session 与成功 session 行为不回退。
- [ ] 前端 focused/typecheck/lint/build、根级 Harness、V2 check 全部通过。
- [ ] 真实浏览器 stale cookie 访问 `/honglusi` 不再出现 Runtime Error。

## Delivery Constraints

- 不新增 `frontend/src/app/api/**` 或任何 route handler。
- 不修改后端、认证存储、tenant principal、authority、Harness、P01、P10、P14、systemd 或生产配置。
- 不读取客户数据、不部署生产、不 force-push。

## Affected Modules

- 模块：Frontend protected-route session guard
- 允许路径：`frontend/src/lib/requireUser.test.ts`；`frontend/src/lib/requireUser.ts`

## Technical Plan

1. 在 `frontend/src/lib/requireUser.test.ts` 增加 stale session + auth validation network failure 的 fail-closed 测试。
2. 在 `frontend/src/lib/requireUser.ts` 中将所有 `getCurrentUser` 非成功结果统一重定向到登录页。
3. 运行 manifest 冻结矩阵和真实浏览器复查。
4. 通过 machine verify-candidate 后，才允许普通 fast-forward 推送 candidate。

## Implementation Report

当前为 approval 治理阶段。产品字节必须在 approval commit 落地并获得 machine GO 后从最新基线重新物化。

pre-governance evidence 显示 exact2 方案可行：

- focused `requireUser`：5/5 passed
- frontend unit：689/689 passed
- typecheck：PASS
- lint：PASS
- build：PASS
- browser `/honglusi` stale cookie：Runtime Error 已收敛为登录重入

上述证据不得直接继承为正式 candidate 通过结论。

## Acceptance Review

本 Task 只有在正式 approval commit 被 product-authority 验证、exact2 candidate 重新物化、manifest 矩阵通过、真实浏览器链通过后，才可进入 candidate acceptance。

任一机器 STOP、第三路径、受保护页面泄露或验证失败都必须停止。
