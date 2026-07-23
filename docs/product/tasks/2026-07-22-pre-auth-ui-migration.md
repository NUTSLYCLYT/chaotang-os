# 任务：迁移 dev 登录前 UI

## Status

Accepted

## Product Definition

- 用户确认：2026-07-22，用户明确要求将 `dev` 分支的 UI 层带入当前分支；在范围选项中选择“仅页面视觉与交互组件”，并确认优先迁移登录前页面及推荐方案 1。随后曾提出实现真实认证，但最终明确决定先迁移纯 UI、验收后再单独完善后端。完成第一阶段验收后，用户又明确确认：五个登录前页面应与 `dev` 视觉对齐；本任务重新进入实施。
- 问题：当前分支缺少登录前的入口、登录、注册和邀请码页面视觉；`dev` 中的对应 UI 与认证、会话、服务端 API 和数据依赖耦合，不能直接整段迁移。
- 目标用户：需要在当前分支体验朝堂主题登录前界面的本地开发者和验收人员。
- 目标：完整迁移 `dev` 欢迎页的信息架构、文案、背景、遮罩、网格、版式、面板比例和响应式视觉；根路径承载欢迎页，前端健康检查迁至 `/health`，同时不扩大当前分支的后端和认证边界。
- 非目标：真实登录、注册、邀请码验证、会话创建、鉴权、数据库、后端 API、全局鉴权布局、依赖升级、提交、推送或部署。

## Acceptance Criteria

- [x] `/enter`、`/login`、`/register`、`/invite` 及邀请码落地页可访问，并与 `dev` 对齐呈现背景、遮罩、网格、版式和朝堂主题的登录前 UI。
- [x] 登录、注册和邀请码表单保留本地必填与格式校验，以及登录前页面之间的邀请码参数传递和跳转。
- [x] 任一表单提交不调用后端、不写入会话、不发出网络请求；页面明确说明认证服务尚未接入。
- [x] 根路径 `/` 完整呈现 `dev` 欢迎页的导航、英雄区、痛点、解决方案、适用场景和预约体验；前端健康检查在 `/health` 可访问；既有 `/study`、`/shiguan`、`backendClient.ts` 与 `src/app/api/**` 行为保持不变。
- [x] 前端 lint、typecheck、test、build 及根 harness 均通过。

## Delivery Constraints

- 范围：仅 `frontend/src/app/page.tsx`、`frontend/src/app/health/**`、`frontend/src/app/enter/**`、`frontend/src/app/login/**`、`frontend/src/app/register/**`、`frontend/src/app/invite/**`、`frontend/src/features/pre-auth/**`、`frontend/src/features/welcome/**`、`frontend/public/shangshufang/bg-shangshufang-scene.webp`、`frontend/public/assets/intro/courtos-vision-hero.png`、对应测试、`frontend/AGENTS.md`、`ARCHITECTURE.md`、`docs/decisions/0018-root-welcome-and-health-route.md` 和本任务说明。
- 兼容性：保留当前 Next.js 技术栈和根布局；迁入样式必须避免污染现有页面。
- 风险与限制：`dev` 的原始页面依赖真实认证链路，当前任务必须删除或替换这些依赖，不能用伪会话冒充已登录状态。
- 技能计划：`brainstorming`、`writing-plans`、`test-driven-development`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 和 `gstack-claude`。

## Affected Modules

- 模块：登录前体验与本地表单交互。
- 允许路径：`frontend/src/app/page.tsx`、`frontend/src/app/health/page.tsx`、`frontend/src/app/enter/page.tsx`、`frontend/src/app/login/page.tsx`、`frontend/src/app/register/page.tsx`、`frontend/src/app/invite/page.tsx`、`frontend/src/app/invite/[code]/page.tsx`、`frontend/src/features/pre-auth/**`、`frontend/src/features/welcome/**`、`frontend/public/shangshufang/bg-shangshufang-scene.webp`、`frontend/public/assets/intro/courtos-vision-hero.png`、`frontend/AGENTS.md`、`ARCHITECTURE.md`、`docs/decisions/0018-root-welcome-and-health-route.md`、本任务文件。
- 依赖模块：现有 Next.js App Router；不依赖后端服务。

## Technical Plan

- 架构边界：新增隔离的 `features/pre-auth`，其中 `formValidation.ts` 仅含纯函数，`PreAuthShell.tsx` 与 CSS Module 仅负责展示；冻结根健康检查、`/study`、`/shiguan`、`src/app/api/**`、`src/lib/backendClient.ts`、根布局、依赖清单与后端目录。
- 接口与依赖：页面只可依赖 React、Next 路由能力和 `features/pre-auth`；不得导入 `dev` 的认证、会话、后端 API、base-path、Tailwind、lucide 或 motion。邀请码只作展示、规范化和 URL 透传；不验证、不授权、不创建登录态。
- 实施顺序：先以 RED/GREEN 完成纯校验与共享视觉壳；再实现登录/注册、邀请码页/邀请码落地页和入口页。`useSearchParams()` 消费者必须由 `<Suspense>` 外壳包裹；入口页只可导航至 `/login`，不能自动跳转。
- 验证计划：运行定向与全量前端测试、lint、typecheck、build；静态扫描网络、存储、认证和自动跳转调用；构建后对五个登录前 URL 做不提交表单的 200 烟雾验证，最后运行根 harness 与 `git diff --check`。
- 技术风险：`dev` 页面与 Tailwind、图标/动效依赖和真实认证链路耦合；本任务只能重建视觉结构与本地交互，不能复制这些依赖或伪造认证成功。

## Implementation Report

- 改动摘要：新增隔离的 `features/pre-auth` 视觉壳、CSS Module 与纯校验函数；新增 `/enter`、`/login`、`/register`、`/invite`、`/invite/[code]`。登录、注册和邀请码仅做本地输入校验、邀请码规范化与页面链接透传；均明确提示认证服务尚未接入。
- 自审：所有 `useSearchParams()` 消费者只在 Suspense 内的客户端交互组件中；服务端页面壳保留路由标题，支持生产初始 HTML 烟雾检查。输入字段包含可访问标签、`required`、`autocomplete` 和可见/`aria-live` 状态提示。未导入新依赖，未改根布局、全局样式、后端或既有业务页面。
- 验证：TDD 定向校验测试先因缺少模块失败，随后 3/3 通过；独立测试工程复核后发现初始 HTML 与原生必填属性缺口，完成一次限定返工后复核通过。
- 验证命令与结果：`npm run lint` PASS；`npm run typecheck` PASS；`npm test` PASS（82/82）；`npm run build` PASS；生产模式五路由 `/enter`、`/login`、`/register`、`/invite`、`/invite/COURT2026` 均 HTTP 200，初始 HTML 含 `<h1>` 和 `COURTOS`；禁止副作用与自动跳转静态扫描无匹配；`node scripts/check_harness.mjs` PASS（53 个基线文件）；`git diff --check` PASS。
- 未运行项及原因：未提交任何表单，避免把纯 UI 验证误当作真实认证；不运行真实登录、注册或邀请码验证，因为其后端能力不在本任务范围。
- 剩余风险：当前页面不创建账号、会话或授权状态；后续接入真实认证时需要另建产品任务，定义账户存储、密码安全、会话、邀请码规则与接口契约。
- 视觉修订：从 `dev` 迁入登录前上书房背景和欢迎页英雄背景；登录/注册页采用场景图、遮罩、网格、光带与面板布局。根路径改为欢迎页，原根健康检查 JSX 逐字迁至 `/health`；新增 ADR 0018 并同步更新架构与前端约束。欢迎页只用 CSS Module、SVG 装饰、本地演示状态和普通页面链接。
- 视觉验证：独立测试角色在桌面和 390×844 窄屏实测欢迎背景、网格和光轴均可见，且 `pointer-events: none` 装饰层不遮挡导航、链接、输入框或按钮。
- 本阶段验证命令与结果：`npm run lint` PASS；`npm run typecheck` PASS；`npm test` PASS（82/82）；`npm run build` PASS；生产模式 `/`、`/health`、`/enter`、`/login`、`/register`、`/invite`、`/invite/COURT2026` 均 HTTP 200；根页欢迎壳、`/health` 的 `backend-status` 契约和英雄图片资源均通过独立检查；欢迎模块禁止依赖扫描无匹配；harness PASS（53 个基线文件）；`git diff --check` PASS；暂存区为空。

## Acceptance Review

- 验收结果：Accepted — 2026-07-22。
- 完整欢迎页：根路径已补齐 `dev` 的四项页内导航、英雄区和本地奏折预览、四个企业痛点、五殿解决方案、三个适用场景、四张能力证明卡及预约体验转化区；所有锚点可达。
- 纯 UI 边界：欢迎页只使用 React 本地状态、CSS Module、内联 SVG 和普通页面链接；静态扫描确认没有网络、认证、会话、存储、计时器或自动路由跳转调用。预约区明确说明不会提交或保存信息。
- 最终验证：`npm test` 83/83 通过（含 welcome 内容契约测试），`npm run lint`、`npm run typecheck`、`npm run build` 均通过；生产模式 `/`、`/health`、`/enter`、`/login`、`/register`、`/invite`、`/invite/COURT2026` 全部 HTTP 200，根页包含完整欢迎内容，`/health` 保留 `data-testid="backend-status"`；`node scripts/check_harness.mjs` 与 `git diff --check` 通过。桌面实际截图确认背景、网格、光轴和交互内容层级正常；窄屏样式使用两列/单列响应式回退，允许整页纵向滚动。
