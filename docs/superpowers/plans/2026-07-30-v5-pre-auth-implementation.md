# V5 宫门欢迎与认证页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将根路径、登录页和注册页迁移到用户确认的 V5 宫门视觉，同时保持现有认证、会话、错误和安全跳转契约不变。

**Architecture:** `features/welcome` 继续承载纯展示根入口，`features/pre-auth` 继续承载认证视觉壳和表单；两者通过本地静态图片和 CSS Module 呈现 V5 视觉，不新增前端依赖。认证请求仍由 `formValidation.ts` 调用现有同源 BFF，欢迎页不得拥有认证状态。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript 5.9、CSS Module、Node test runner。

## Global Constraints

- 必须遵守 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`，不得修改或绕过该基线。
- 只使用 Codex；禁止 Claude CLI、Claude runner 和 `gstack-claude`。
- 不新增 Tailwind、motion、图标库或 UI 组件库。
- 不修改后端认证 API、cookie、数据库、用户隔离和安全 `next` 跳转契约。
- 登录页只使用现有账号或邮箱与密码；不得新增“朝堂号”“皇帝身份”等原型字段。
- Figma 临时资源 URL 不得保留在生产代码中；必须保存原始素材字节。
- 当前工作区存在无关改动；实施者只修改本计划列出的路径，不整理或覆盖其他改动。
- 任何提交、推送或部署均需要用户对该动作的单独明确授权。

---

## File Map

- Create: `frontend/public/assets/v5-pre-auth/palace-gate.png` — 根路径宫门场景原图。
- Create: `frontend/public/assets/v5-pre-auth/palace-login.png` — 登录与注册场景原图；若与宫门图 SHA-256 相同则不创建，CSS 复用前者。
- Modify: `frontend/src/features/welcome/WelcomeGate.tsx` — V5 根路径语义、文案和三个 `/login` 入口。
- Modify: `frontend/src/features/welcome/welcome.module.css` — 宫门全屏布局、一次性渐显、响应式和 reduced-motion。
- Replace: `frontend/src/features/welcome/welcomeContent.test.ts` — 根路径入口和 V5 文案的源级契约测试。
- Modify: `frontend/src/features/pre-auth/PreAuthShell.tsx` — V5 公共页头、左侧介绍、表单面板和页脚。
- Modify: `frontend/src/features/pre-auth/preAuth.module.css` — 登录/注册 V5 双栏视觉与窄屏布局。
- Modify: `frontend/src/features/pre-auth/LoginForm.tsx` — V5 登录文案和提交中状态；请求载荷不变。
- Modify: `frontend/src/features/pre-auth/RegisterForm.tsx` — V5 注册文案和提交中状态；请求载荷不变。
- Modify: `frontend/src/features/pre-auth/publicEntry.visual.test.ts` — 本地 V5 素材、链接和无业务依赖契约。
- Modify: `frontend/src/features/pre-auth/authForms.test.ts` — 保持 BFF、字段载荷和安全跳转回归。
- Modify: `docs/product/tasks/2026-07-30-v5-pre-auth-implementation.md` — 实施与验证证据。

### Task 1: 保存并核验 Figma 原始素材

**Files:**
- Create: `frontend/public/assets/v5-pre-auth/palace-gate.png`
- Create if distinct: `frontend/public/assets/v5-pre-auth/palace-login.png`

**Interfaces:**
- Consumes: Figma 节点 `218:49` 的资源 `f92e1d13-5f63-45fe-85d8-88ed820bf6dc`，节点 `200:43` 的资源 `45d928cd-1c24-4200-b71e-b00535757f89`。
- Produces: 稳定站内 URL `/assets/v5-pre-auth/palace-gate.png` 和可选 `/assets/v5-pre-auth/palace-login.png`。

- [ ] **Step 1: 下载 Figma 返回的精确素材字节**

在 `D:\workspace\chaotang-os-harness-only` 运行：

```powershell
New-Item -ItemType Directory -Force -Path 'frontend\public\assets\v5-pre-auth' | Out-Null
Invoke-WebRequest -Uri 'https://www.figma.com/api/mcp/asset/f92e1d13-5f63-45fe-85d8-88ed820bf6dc' -OutFile 'frontend\public\assets\v5-pre-auth\palace-gate.png'
Invoke-WebRequest -Uri 'https://www.figma.com/api/mcp/asset/45d928cd-1c24-4200-b71e-b00535757f89' -OutFile 'frontend\public\assets\v5-pre-auth\palace-login.png'
```

Expected: 两个文件存在且大小均大于 100 KiB。

- [ ] **Step 2: 核验图片格式、尺寸和哈希**

```powershell
Get-Item 'frontend\public\assets\v5-pre-auth\*.png' | Select-Object Name,Length
Get-FileHash -Algorithm SHA256 'frontend\public\assets\v5-pre-auth\*.png'
```

Expected: 两个文件可读取、长度非零；记录两个 SHA-256。若哈希相同，只保留
`palace-gate.png`，后续两类页面均引用它。

- [ ] **Step 3: 视觉检查原始素材**

用本地图片查看器检查两张图。Expected: `palace-gate.png` 对应宫门启朝画面；
`palace-login.png` 对应登录画面的宫廷庭院，不存在错误页、透明空图或裁切预览。

- [ ] **Step 4: 检查任务范围**

```powershell
git status --short -- 'frontend/public/assets/v5-pre-auth'
```

Expected: 只出现上述新素材。未经单独授权，不执行 `git add` 或 `git commit`。

### Task 2: 以测试驱动重做根路径宫门欢迎页

**Files:**
- Modify: `frontend/src/features/welcome/welcomeContent.test.ts`
- Modify: `frontend/src/features/welcome/WelcomeGate.tsx`
- Modify: `frontend/src/features/welcome/welcome.module.css`
- Delete only after no imports remain: `frontend/src/features/welcome/welcomeContent.ts`

**Interfaces:**
- Consumes: `/assets/v5-pre-auth/palace-gate.png`。
- Produces: `WelcomeGate(): JSX.Element`，包含三个明确指向 `/login` 的入口。

- [ ] **Step 1: 将旧内容数组测试替换为失败的 V5 页面契约测试**

`welcomeContent.test.ts` 使用源文件断言，核心内容如下：

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("root welcome renders the V5 palace gate and three login routes", async () => {
  const component = await readFile(new URL("./WelcomeGate.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("./welcome.module.css", import.meta.url), "utf8");

  assert.match(component, /启 朝/);
  assert.match(component, /朕只需下一道旨，群臣 Agent 自会办结/);
  assert.equal(component.match(/href="\/login"/g)?.length, 3);
  assert.match(component, />上朝</);
  assert.match(component, /已有朝堂？登录/);
  assert.match(component, /跳过仪式/);
  assert.match(css, /\/assets\/v5-pre-auth\/palace-gate\.png/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
```

- [ ] **Step 2: 运行测试并确认 RED**

```powershell
npm test -- src/features/welcome/welcomeContent.test.ts
```

Workdir: `frontend`

Expected: FAIL，缺少“启 朝”或三条 `/login` 链接。

- [ ] **Step 3: 最小实现新的 `WelcomeGate`**

实现应为无状态服务端兼容组件：

```tsx
import Link from "next/link";
import styles from "./welcome.module.css";

export function WelcomeGate() {
  return (
    <main className={styles.page}>
      <div className={styles.scene} aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>朝堂 OS</Link>
        <Link href="/login" className={styles.skip}>跳过仪式 〉</Link>
      </header>
      <section className={styles.hero} aria-labelledby="welcome-title">
        <h1 id="welcome-title">启 朝</h1>
        <p>朕只需下一道旨，群臣 Agent 自会办结</p>
      </section>
      <nav className={styles.actions} aria-label="朝堂入口">
        <Link href="/login" className={styles.attend}>上朝</Link>
        <Link href="/login" className={styles.login}>已有朝堂？登录</Link>
      </nav>
    </main>
  );
}
```

删除旧的演示表单、内容数组、长落地页区块与客户端状态；`WelcomeGate` 不需要
`"use client"`。

- [ ] **Step 4: 用 CSS Module 还原 V5 根页**

`welcome.module.css` 必须包含：

```css
.page {
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  color: #d8c8a9;
  background: #050504;
}
.scene {
  position: absolute;
  inset: 0;
  background: url("/assets/v5-pre-auth/palace-gate.png") center / cover no-repeat;
}
.header, .hero, .actions { position: relative; z-index: 1; }
.hero { position: absolute; inset: 16.6% 0 auto; text-align: center; }
.hero h1 { margin: 0; color: #d8c8a9; font: 600 clamp(3rem, 5vw, 4.5rem)/1.3 Georgia, "Noto Serif SC", serif; letter-spacing: .18em; }
.attend { display: grid; min-width: 224px; min-height: 60px; place-items: center; border: 1px solid rgba(237,173,82,.9); border-radius: 3px; background: linear-gradient(#8f1f14,#b8301f); color: #ffebb8; }
@media (prefers-reduced-motion: no-preference) {
  .hero, .actions { animation: welcome-in .8s ease-out both; }
  .actions { animation-delay: .18s; }
}
@media (prefers-reduced-motion: reduce) {
  .hero, .actions { animation: none; }
}
```

补齐桌面位置、header、次级链接、焦点态和 `max-width: 720px` 单列规则。不得用整图
裁切副本制造开门动画。

- [ ] **Step 5: 运行测试并确认 GREEN**

```powershell
npm test -- src/features/welcome/welcomeContent.test.ts
npm run typecheck
```

Workdir: `frontend`

Expected: 两条命令 PASS。

- [ ] **Step 6: 检查旧内容模块是否可删除**

```powershell
rg -n "welcomeContent|NAV_LINKS|PAIN_POINTS|PROOF_ITEMS|STAGES|USE_CASES" frontend/src
```

Expected: 无生产引用；删除 `welcomeContent.ts` 后重新运行 Task 2 的测试和 typecheck。

### Task 3: 以测试驱动迁移 V5 登录与注册视觉壳

**Files:**
- Modify: `frontend/src/features/pre-auth/publicEntry.visual.test.ts`
- Modify: `frontend/src/features/pre-auth/PreAuthShell.tsx`
- Modify: `frontend/src/features/pre-auth/preAuth.module.css`
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/register/page.tsx`

**Interfaces:**
- Consumes: `PreAuthShellProps` 中的 `eyebrow`、`title`、`description`、`children`、`footer`。
- Produces: 不拥有认证状态的 V5 公共认证壳；继续渲染传入表单。

- [ ] **Step 1: 写失败的 V5 视觉壳测试**

将 `publicEntry.visual.test.ts` 的视觉断言更新为：

```ts
assert.match(shell, /data-public-entry-shell/);
assert.match(shell, /chaotang-os · 数字朝堂/);
assert.match(shell, /独立朝堂 · Agent 自动办理 · v5/);
assert.match(authCss, /\/assets\/v5-pre-auth\/palace-(login|gate)\.png/);
assert.match(authCss, /#9a6a34/i);
assert.match(authCss, /grid-template-columns/);
assert.match(authCss, /prefers-reduced-motion:\s*reduce/);
assert.doesNotMatch(shell, /fetch\(|localStorage|sessionStorage|backendClient|useRouter/);
```

同时保留 `/`、`/login`、`/register` 链接断言。

- [ ] **Step 2: 运行测试并确认 RED**

```powershell
npm test -- src/features/pre-auth/publicEntry.visual.test.ts
```

Workdir: `frontend`

Expected: FAIL，旧 CSS 仍引用 `/shangshufang/bg-shangshufang-scene.webp`。

- [ ] **Step 3: 调整 `PreAuthShell` 的 V5 结构**

保留现有 props，结构改为：

```tsx
<main className={styles.page} data-public-entry-shell>
  <header className={styles.topbar}>
    <Link href="/" className={styles.brand}>朝堂 OS</Link>
    <Link href="/login">登录</Link>
  </header>
  <div className={styles.frame}>
    <section className={styles.introduction} aria-labelledby="pre-auth-title">
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 id="pre-auth-title" className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
    </section>
    <section className={styles.panel} aria-label={title}>
      {children}
      {footer ? <footer className={styles.formFooter}>{footer}</footer> : null}
    </section>
  </div>
  <footer className={styles.siteFooter}>
    <span>chaotang-os · 数字朝堂</span>
    <span>独立朝堂 · Agent 自动办理 · v5</span>
  </footer>
</main>
```

- [ ] **Step 4: 迁移 CSS 到 Figma V5 比例**

桌面规则必须实现 72px 页头、64px 页脚、左文案区和约 450px 表单卡片；使用
`min-height: 100svh` 和 `background-size: cover`，而不是固定 1440px 画布。`max-width:
720px` 时隐藏非关键左侧长文案或将其放在表单上方，表单始终可见且可滚动。

- [ ] **Step 5: 更新页面文案但保持组件与 Suspense**

`login/page.tsx`：

```tsx
<PreAuthShell
  eyebrow="景和朝 · 多用户朝堂"
  title="重入朝堂，续理万机"
  description="登录后只进入属于您的独立朝堂；案卷、Agent 轨迹与史馆归档彼此隔离。"
  footer={<Link href="/register">尚未创建朝堂？注册</Link>}
>
```

`register/page.tsx` 使用“创建朝堂，开启万机”语义，并保留 `<Suspense>` 与 `/login`
链接。

- [ ] **Step 6: 运行测试并确认 GREEN**

```powershell
npm test -- src/features/pre-auth/publicEntry.visual.test.ts
npm run typecheck
```

Workdir: `frontend`

Expected: PASS。

### Task 4: 保持真实认证并增加可见提交状态

**Files:**
- Modify: `frontend/src/features/pre-auth/LoginForm.tsx`
- Modify: `frontend/src/features/pre-auth/RegisterForm.tsx`
- Modify: `frontend/src/features/pre-auth/preAuth.module.css`
- Modify: `frontend/src/features/pre-auth/authForms.test.ts`

**Interfaces:**
- Consumes: `submitLogin(values, next)` 和 `submitRegister(values, next)`。
- Produces: 同一请求载荷与目的地，新增 `submitting: boolean` 仅用于按钮禁用和文案。

- [ ] **Step 1: 扩充请求契约回归测试**

在 `authForms.test.ts` 增加：

```ts
test("login posts only identifier and password", async () => {
  let body: unknown;
  await submitLogin(
    { username: " court@example.com ", password: "six-or-more" },
    undefined,
    async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    },
  );
  assert.deepEqual(body, { identifier: "court@example.com", password: "six-or-more" });
});
```

保留并运行现有不可信 `next`、401、注册载荷测试。

- [ ] **Step 2: 运行认证测试并记录基线**

```powershell
npm test -- src/features/pre-auth/authForms.test.ts src/features/pre-auth/formValidation.test.ts
```

Workdir: `frontend`

Expected: PASS。若失败，先停止并调查现有回归，不修改视觉代码掩盖失败。

- [ ] **Step 3: 为表单增加最小提交状态**

两个表单分别增加：

```tsx
const [submitting, setSubmitting] = useState(false);
```

提交逻辑使用 `try/finally`：

```tsx
setSubmitting(true);
try {
  const result = await submitLogin({ username, password }, next);
  if (result.ok) {
    window.location.assign(result.destination);
    return;
  }
  setMessage(result.message);
} finally {
  setSubmitting(false);
}
```

登录按钮：

```tsx
<button className={styles.button} type="submit" disabled={submitting}>
  {submitting ? "正在入朝…" : "进入上书房"}
</button>
```

注册表单使用相同结构，按钮文案为“正在创建…”/“创建朝堂”。标签保持真实字段：
“账号或邮箱”“密码”“用户名”“邮箱”“确认密码”。

- [ ] **Step 4: 增加禁用态和可访问性样式**

```css
.button:disabled {
  cursor: wait;
  opacity: .7;
}
```

错误信息继续使用 `role="alert"`；不得删除 `required`、`autocomplete` 或现有邀请参数显示。

- [ ] **Step 5: 运行认证回归**

```powershell
npm test -- src/features/pre-auth/authForms.test.ts src/features/pre-auth/formValidation.test.ts
npm run typecheck
```

Workdir: `frontend`

Expected: PASS。

### Task 5: 全量验证、浏览器验收与任务回写

**Files:**
- Modify: `docs/product/tasks/2026-07-30-v5-pre-auth-implementation.md`

**Interfaces:**
- Consumes: Tasks 1–4 的页面、素材和测试。
- Produces: 可复现验证证据和待用户验收的任务记录。

- [ ] **Step 1: 运行前端完整验证**

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Workdir: `frontend`

Expected: 四条命令均退出码 0；不得只报告相关测试。

- [ ] **Step 2: 运行仓库 harness**

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
git diff --check
```

Workdir: repository root

Expected: 全部退出码 0。

- [ ] **Step 3: 启动本地前端并做桌面验收**

```powershell
npm run dev
```

Workdir: `frontend`

在 1440 × 1024 检查：

- `/` 的宫门背景、品牌、“启 朝”、副标题和三个 `/login` 入口；
- `/login` 的双栏布局、两个真实字段、错误态、加载态和 `/register` 链接；
- `/register` 的现有四字段、加载态和 `/login` 链接；
- 页面无横向滚动、文字裁切、短期 Figma URL 或控制台错误。

- [ ] **Step 4: 做窄屏、键盘和 reduced-motion 验收**

在 390 × 844 检查三页可滚动、表单不被遮挡、按钮可触达。只用键盘完成链接和表单焦点
遍历；模拟 `prefers-reduced-motion: reduce` 后确认欢迎动画停用。

- [ ] **Step 5: 核对认证契约**

使用本地测试账户提交登录和注册，或在无法安全使用真实凭据时通过现有自动化 BFF 测试确认：
请求仍为 `/api/auth/login` 与 `/api/auth/register`，成功目的地仍只允许 `/study` 或
`/shiguan`，无新字段进入请求体。

- [ ] **Step 6: 回写产品任务**

将实际改动、实际使用 skill、每条命令的 PASS/FAIL、未运行项、浏览器尺寸、剩余风险写入
`Implementation Report`；将验收清单逐条核对，但在用户验收前保持 `Acceptance Review:
Pending`。

- [ ] **Step 7: 最终范围审查**

```powershell
git diff --name-only
git diff --stat
git status --short
```

Expected: 本任务只涉及 File Map 列出的文件；工作区原有无关改动仍保持原样。未经用户对 Git
动作的单独授权，不执行暂存、提交、推送或部署。
