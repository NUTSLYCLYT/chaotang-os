# 任务：实现 V5 宫门欢迎与认证页面

## Status

Ready

## Product Definition

- 用户确认：2026-07-30，用户确认根路径采用 Figma `V5/Motion A · 宫门启朝`
  （节点 `218:49`），点击“上朝”进入登录页；用户随后确认登录页使用 Figma
  `V5/00 登录`（节点 `200:43`）的视觉，并保留现有真实认证字段。
- 问题：当前真实登录与注册能力已存在，但根路径和认证页面未呈现用户确认的 V5 宫门视觉与
  仪式化入口。
- 目标用户：访问朝堂 OS 的未登录用户和返回自己独立朝堂的已有用户。
- 目标：以 V5 原型重做 `/`、`/login`、`/register` 的视觉和导航，同时保持现有认证、会话、
  `next` 跳转与用户隔离契约不变。
- 非目标：认证后端改造、新字段、新角色、邀请流程、业务页面改版或 ADR 0028 变更。

## Acceptance Criteria

- [ ] `/` 忠实呈现 V5 宫门欢迎页；“上朝”“已有朝堂？登录”和“跳过仪式”均可进入
  `/login`。
- [ ] `/login` 呈现 V5 双栏场景与表单卡片，但只提交现有账号或邮箱与密码，并提供
  `/register` 入口。
- [ ] `/register` 复用 V5 视觉壳，保留当前注册字段、验证、提交和登录入口。
- [ ] 登录、注册、错误、加载、cookie、会话和安全 `next` 跳转行为与改版前一致。
- [ ] Figma 图片资源以稳定本地文件交付，生产代码不依赖短期 Figma 资源 URL。
- [ ] 桌面与窄屏均可阅读和操作；键盘焦点清晰，并尊重 reduced-motion。
- [ ] 相关测试、前端 lint/typecheck/test/build 和根 harness 通过，且完成浏览器视觉验收。

## Delivery Constraints

- 范围：`frontend/src/app/page.tsx`、`frontend/src/app/login/**`、
  `frontend/src/app/register/**`、`frontend/src/features/welcome/**`、
  `frontend/src/features/pre-auth/**`、对应测试、V5 登录前静态资源，以及必要的相关文档。
- 兼容性：保持 Next.js App Router、React、TypeScript、CSS Module、现有认证 BFF 和
  backendClient 契约；不得影响已认证业务页面。
- 风险与限制：Figma 资源 URL 约七天后失效，必须保存原始字节；宫门动效不能用整图互相淡化
  冒充分层开门；现有工作区有与本任务无关的改动，实施时必须避开。
- 技能计划：`using-superpowers`、`codex-engineering-workflow`、`writing-plans`、
  `test-driven-development`、`figma-design-to-code`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 和 `gstack-claude`。

## Affected Modules

- 模块：公开欢迎入口、登录前共享视觉壳、登录表单、注册表单。
- 允许路径：`frontend/src/app/page.tsx`、`frontend/src/app/login/**`、
  `frontend/src/app/register/**`、`frontend/src/features/welcome/**`、
  `frontend/src/features/pre-auth/**`、对应测试、`frontend/public` 下的 V5 登录前资源目录、
  本任务与设计文档。
- 依赖模块：现有认证 BFF、会话 cookie、表单验证与安全跳转逻辑；只读复用，不改变契约。

## Technical Plan

- 架构边界：欢迎页保持纯展示与站内导航；认证状态和请求继续封装在现有登录/注册组件中；
  共享 V5 视觉组件不得拥有认证业务状态。
- 接口与依赖：不新增后端接口和第三方前端依赖；Figma 代码只作为参考，转换为现有 CSS
  Module 体系。
- 实施顺序：保存并核验 Figma 素材；RED 测试根路径导航；GREEN 实现欢迎页；RED 测试认证页
  字段与链接；GREEN 迁移共享视觉壳；回归错误、加载、`next` 与响应式行为；浏览器验收。
- 验证计划：运行相关单测、前端 lint/typecheck/test/build、根 harness；在桌面和窄屏检查
  `/`、`/login`、`/register`，并验证真实登录/注册请求未改变。
- 技术风险：完整场景图无法提供真实分层开门效果时，宁可采用静态场景与一次性渐显，也不得
  制造拼接、重影或错误空间关系；背景图片必须有深色底色回退。

## Implementation Report

- 改动摘要：根路径、登录页与注册页已采用 V5 宫门/宫廷视觉；欢迎页提供三条 `/login`
  入口；登录保留现有两字段，注册保留现有四字段；本地 V5 图片资源已接入。Task 5 仅回写
  验证证据，未修改生产代码或测试。
- 自审：浏览器逐页核对桌面 1440×1024、窄屏 390×844、键盘焦点、reduced-motion、
  console 与横向溢出；认证契约使用自动化测试核对，未使用真实凭据。
- 验证：完整证据见 `.superpowers/sdd/v5-pre-auth-task-5-report.md`；截图位于同目录的
  `v5-{root,login,register}-{desktop-1440x1024,narrow-390x844}.png`。
- 实际使用的 skill：`using-superpowers`、`codex-engineering-workflow`、
  `verification-before-completion`、`browser:control-in-app-browser`。
- 验证命令与结果：`npm run lint` PASS；`npm run typecheck` PASS；`npm test` PASS
  （416/416，0 fail）；`npm run build` PASS；`node scripts/check_harness.mjs` PASS
  （72 个基线文件）；`node scripts/check_harness.mjs --self-test` PASS（44 项）；
  `git diff --check` PASS（退出码 0，仅既有 LF→CRLF 警告）。
- 未运行项与原因：未提交真实登录/注册凭据或创建账户，按任务要求使用现有 BFF/表单自动化
  测试；未做人工网络节流的 loading 截图，loading 与重复提交由同步 gate 测试覆盖；未执行
  Git 暂存、提交、推送或部署。
- 剩余风险：共享工作区存在大量与本任务无关的并行/既有改动，最终 diff 不限于本计划 File
  Map；共享 `.next` 在 build 后被其他进程改变，浏览器验收因此复用现有 `next dev`
  （PID 23360），但新鲜完整 `npm run build` 已退出 0；最终用户验收仍待进行。

## Acceptance Review

- 验收结果：Pending
- 验收证据：
  - `/`：桌面与窄屏可见 V5 宫门背景和确认文案，三条入口均为 `/login`。
  - `/login`：V5 双栏与真实账号/邮箱、密码字段可见，提供 `/register` 入口。
  - `/register`：V5 共享壳与现有四字段可见，提供 `/login` 入口。
  - 认证错误、loading gate、cookie/BFF、会话与安全 `next` 行为由 416/416 自动化测试覆盖。
  - 图片计算 URL 为本地 `/assets/v5-pre-auth/palace-gate.png`；视觉守护测试通过。
  - 1440×1024 与 390×844 均无横向溢出；三页键盘遍历可达且表单控件焦点清晰；
    reduced-motion 下欢迎页计算动画数为 0；三页应用 console warning/error 为 0。
  - 前端 lint/typecheck/test/build、根 harness、harness self-test、`git diff --check` 均退出 0。
- 未通过项：无已发现的功能验收失败；仍需用户最终验收，故保持 Pending。

## Task 5 Evidence Correction (2026-07-30)

- Acceptance Review：**Pending**。本节覆盖上方 Task 5 证据中任何与新鲜工件不一致的旧描述；
  完整更正报告见 `.superpowers/sdd/v5-pre-auth-task-5-report.md`。
- 新鲜独立命令证据：前端 `lint`、`typecheck`、`test`（416/416）、`build`，以及根
  harness、harness self-test、`git diff --check` 均退出 0。每条命令的原始
  stdout/stderr 与退出码分别保存在 `.superpowers/sdd/v5-pre-auth-*.log`；diff-check
  日志保留共享工作区既有 LF→CRLF 警告。
- 构建和浏览器是两条独立证据：`npm run build` 证明构建命令成功；浏览器证据来自当前
  `http://127.0.0.1:3000` dev 实例。Task 5 没有停止、重启或替换用户现有 dev，也没有
  声称浏览器验收了同一个 production build 制品。
- 三页浏览器 JSON 分别记录 URL、实际 `390×844` viewport、interactive snapshot 与
  页面尺寸；完整 console 输出另见三个 `v5-pre-auth-browser-*-console.json`。login 截图
  使用公开合成值并明确标记 synthetic；register 的完整内容高度以 `scrollHeight=1081`
  单独记录。
- 三张窄屏图均以 `clip: 0,0,390,844`、`fullPage: false` 重拍；位图解码记录
  `v5-pre-auth-screenshot-dimensions.json` 核验 root/login/register PNG 均精确
  `390×844`。未用 register 全页图冒充 viewport 图。
- reduced-motion 实测 `matchMedia(...).matches === true`，hero/actions 的
  `animationName === "none"`，因此没有运行动画并判定 PASS。计算
  `animationDuration === "1e-05s"` 来自全局 `0.01ms` reduced-motion 规则，
  作为事实保留但不构成 concern。
- 实际 scoped changed-file 清单/stat 分别见
  `v5-pre-auth-scoped-changed-files.log` 与 `v5-pre-auth-scoped-diff-stat.log`。
  完整工作区另见 `v5-pre-auth-workspace-unrelated-changes.log`，其中存在大量本任务范围外
  并行/既有改动，本轮未修改或清理。
- 未人工网络节流观察 loading；loading/duplicate-submit 只有自动化测试证据。
  未使用真实登录/注册凭据、未创建真实账号，也未执行真实认证成功链路的人工浏览器验收。
  因此 Acceptance 必须保持 Pending。

### Task 5 Final Evidence Clarification

本小节是 Task 5 的最终证据口径，覆盖上方关于“login 输入已清空”和 reduced-motion
`1e-05s` 是 concern 的旧描述：

- login 的 390×844 viewport 截图明确使用公开合成值 `qa@example.test` 和
  `not-a-real-secret`；它们绝非真实凭据，未提交表单。对应 JSON 记录
  `synthetic=true`、长度 15/17 和 `submitted=false`，密码由 password input 正常掩码。
- `/`、`/login`、`/register` 分别完成 console clear → reload →
  `domcontentloaded`/snapshot → 全六级别日志读取。三个
  `v5-pre-auth-browser-*-console.json` 保存工具返回的完整
  `debug/info/log/warn/warning/error` 输出，并明确记录标签页日志缓冲不会被 CDP 清空删除；
  每页完整返回值中的 warning/error 聚合数量为 0。
- reduced-motion 为 **PASS**：`matchMedia` 为 true，hero/actions 的
  `animationName` 均为 `none`，因此没有运行动画。计算 duration `1e-05s` 是全局
  `0.01ms` reduced-motion 规则的事实值，不构成运行中的动画，也不再列为 concern。
- 键盘证据只证明应用控件可通过 Tab 到达且焦点可见；采集序列包含 dev/扩展注入元素并受
  起点影响，不称为 pristine 或 canonical cycle。
- 三张窄屏 PNG 均经位图解码核验为精确 390×844、`fullPage=false`；register 的
  `scrollHeight=1081` 另存 JSON，没有以全页图冒充 viewport 图。
- 未人工节流观察 loading，未使用或提交真实凭据，未人工执行真实认证成功链路；
  Acceptance 继续保持 **Pending**。

### Task 5 Desktop Evidence Hygiene

- `v5-login-desktop-1440x1024.png` 已用当前 dev 登录页的全新 `1440×1024`
  viewport 截图安全覆盖；旧文件不再作为证据。
- 新图只含公开合成测试值 `qa@example.test`（长度 15）与
  `not-a-real-secret`（长度 17，password input 掩码），绝非真实凭据，且未提交表单。
- `v5-pre-auth-browser-login-desktop.json` 记录
  `synthetic=true`、`publicTestData=true`、`submitted=false`、精确长度、
  `viewport=1440×1024`、无可见错误/401，以及完整六级别 console 输出。
- PNG 位图解码核验为精确 `1440×1024`、`fullPage=false`。当前引用证据不再使用或描述
  旧桌面图的 identifier 与历史 401 状态。

## Welcome Gate Video Transition Evidence (2026-07-30)

- 用户确认的增量行为：根路径初始背景使用 `1785403767165.png`；点击“上朝”后播放不可操作的背景视频；前景标题、导航和按钮保持显示；视频结束后显示开门图，1 秒后进入 `/login`。
- 素材：`welcome-gate-closed.png`、`welcome-gate-opening.mp4`、`welcome-gate-open.png` 已复制到 `frontend/public/assets/v5-pre-auth/`；三份目标文件的 SHA-256 分别与用户源文件逐一相同。
- TDD 证据：聚焦测试先因 `welcomeTransition.ts` 不存在及旧的三链接契约失败；实现后 `welcomeContent.test.ts` 与 `welcomeTransition.test.ts` 共 3 项通过。
- 实际使用的 skill：`using-superpowers`、`brainstorming`、`writing-plans`、`executing-plans`、`using-git-worktrees`、`test-driven-development`、`codex-engineering-workflow`、`systematic-debugging`、`browse`、`browser:control-in-app-browser`、`verification-before-completion`。
- 自动验证：`npm test` PASS（419/419）；`npm run lint` PASS；`npm run typecheck` PASS；`npm run build` PASS；`node scripts/check_harness.mjs` PASS（72 个基线文件）；`node scripts/check_harness.mjs --self-test` PASS（44 项）；`node .agents/hooks/check-harness.mjs --self-test` PASS（3 项）；scoped `git diff --check` PASS（仅既有 LF→CRLF 警告）。
- 浏览器已验证：桌面初始背景计算 URL 为本地 `welcome-gate-closed.png`；前景 header/hero/actions 均可见；“上朝”点击后按钮禁用；视频错误降级后进入 `/login`。
- 未运行项：Codex 内置浏览器以 `ERR_BLOCKED_BY_CLIENT` 拦截直接加载本地 MP4，因此未能在该浏览器中观察视频自然播放结束；其视口覆盖也未实际切换到 390×844，因此本轮没有新增窄屏真实浏览器证据。视频的 H.264 `avc1` 与 AAC `mp4a` 标记、HTTP `video/mp4`、字节范围响应和前端生产构建均已验证，但不替代用户浏览器中的最终播放验收。
- 未执行 Git 暂存、提交、推送、发布或部署。

## Welcome Gate Direct Registration Amendment (2026-07-30)

- 用户确认：背景视频自然结束或播放失败后，立即进入 `/register`。
- 跳转使用 `router.replace("/register")`；不再展示开门图，不等待 1 秒，也不再从该过渡流程跳转 `/login`。
- 两个显式登录链接保持不变，仍然指向 `/login`。
- 已删除不再使用的 `frontend/public/assets/v5-pre-auth/welcome-gate-open.png`。
- TDD 证据：聚焦测试先针对旧的延迟登录实现失败，完成两阶段状态修改后通过（2/2）。
- 新鲜验证：`npm test` PASS（418/418）；`npm run lint` PASS；`npm run typecheck` PASS；`npm run build` PASS；`node scripts/check_harness.mjs` PASS（72 个基线文件）；`node scripts/check_harness.mjs --self-test` PASS（44 项）；`node .agents/hooks/check-harness.mjs --self-test` PASS（3 项）。
- 未执行 Git 暂存、提交、推送、发布或部署。
