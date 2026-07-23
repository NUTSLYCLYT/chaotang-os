# 第三批：公共入口视觉迁移报告

## 完成内容

- 将登录前共用 `PreAuthShell` 调整为 dev 的朝堂深蓝黑金入口壳：上书房场景背景、分层暗角、细网格、玻璃化双栏面板和顶端朝堂品牌导航。
- 入口导航只使用当前真实公开路由 `/`、`/login`、`/register`；不引入 dev 的过时入口或认证实现。
- 既有 `/enter`、`/login`、`/register`、`/invite`、`/invite/[code]` 都继续消费同一个壳，因此保留各自原有的登录、注册、邀请码展示/跳转、验证提示、无障碍标签和表单交互。
- 欢迎页原本已采用 dev 的场景背景、金色网格、雷电脉络、玻璃预览和真实注册/登录链接；本批保持其现有业务行为不变。
- 新增公共入口视觉/契约保护测试。

## TDD 与验证

- RED：新增 `publicEntry.visual.test.ts` 后，初始 `PreAuthShell` 缺少真实公共导航和新版视觉层而失败。
- GREEN：定向测试通过。
- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：115/115 通过。
- `npm run build`：通过。
- `git diff --check`：通过（仅有 Git CRLF 提示，无空白错误）。

## 保留的契约

- 未改动 `src/app/api/**`、`src/lib/auth/**`、会话 cookie、后端契约、受保护路由或 BFF。
- 未修改 `submitLogin`、`submitRegister`、邀请码标准化与当前页面跳转语义。
- 未引入 Tailwind、Lucide、dev hooks/API client、模拟用户或伪造邀请码。

## 未解决项

- 无。未提交、未推送，也未触发真实下旨。
