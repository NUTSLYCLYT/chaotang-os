# Pre-auth UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the `dev` branch's pre-auth visual experience into the current frontend without adding authentication or backend behavior.

**Architecture:** Add a self-contained `features/pre-auth` module for shared presentation and pure validation. App Router pages use only this module and Next links/search parameters. Submits validate locally then show an explicit unavailable-service message; they never request a service, persist state, or create a session.

**Tech Stack:** Next.js App Router, React 19, TypeScript 5.9, CSS Modules, Node built-in `node:test`.

## Global Constraints

- Except for Task 8's explicit root-route migration, do not change `frontend/src/app/page.tsx`, `frontend/src/app/study/**`, `frontend/src/app/shiguan/**`, `frontend/src/app/api/**`, or `frontend/src/lib/backendClient.ts`.
- Do not change dependencies, the root layout, or global styles.
- Do not import or write auth, session, backend API, database, storage, cookie, WebSocket, or `fetch` code.
- Every route that calls `useSearchParams()` must render its client interaction component inside a `Suspense` boundary.
- Scope styles in `features/pre-auth` and `features/welcome` with CSS Modules.
- Keep changes uncommitted unless the user explicitly authorizes a commit.

---

### Task 1: Shared shell and pure validation

**Files:**
- Create: `frontend/src/features/pre-auth/formValidation.ts`
- Create: `frontend/src/features/pre-auth/formValidation.test.ts`
- Create: `frontend/src/features/pre-auth/PreAuthShell.tsx`
- Create: `frontend/src/features/pre-auth/preAuth.module.css`

**Interfaces:**
- Produces `validateLogin(values: LoginValues): string | null`, `validateRegister(values: RegisterValues): string | null`, and `normalizeInviteCode(value: string): string`.
- Produces `PreAuthShell({ eyebrow, title, description, children, footer })`.

- [ ] **Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInviteCode, validateLogin, validateRegister } from "./formValidation.ts";

test("login validation requires both fields", () => {
  assert.equal(validateLogin({ username: "", password: "secret" }), "请填写账号和密码。");
  assert.equal(validateLogin({ username: "court", password: "" }), "请填写账号和密码。");
  assert.equal(validateLogin({ username: "court", password: "secret" }), null);
});
test("registration validation checks fields", () => {
  const valid = { username: "court", email: "court@example.com", password: "secret", confirm: "secret" };
  assert.equal(validateRegister({ ...valid, email: "invalid" }), "请填写有效的邮箱地址。");
  assert.equal(validateRegister({ ...valid, confirm: "other" }), "两次输入的密码不一致。");
  assert.equal(validateRegister({ ...valid, password: "123", confirm: "123" }), "密码至少需要 6 位。");
  assert.equal(validateRegister({ ...valid, username: " " }), "请先完成所有必填字段。");
});
test("invite normalization uppercases and trims", () => {
  assert.equal(normalizeInviteCode(" court2026 "), "COURT2026");
  assert.equal(normalizeInviteCode("   "), "");
});
```

- [ ] **Step 2: Verify RED**

Run from `frontend/`: `npm test -- src/features/pre-auth/formValidation.test.ts`.

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal contract**

```ts
export type LoginValues = { username: string; password: string };
export type RegisterValues = LoginValues & { email: string; confirm: string };

export function validateLogin({ username, password }: LoginValues): string | null {
  return username.trim() && password.trim() ? null : "请填写账号和密码。";
}
export function validateRegister(values: RegisterValues): string | null {
  if (![values.username, values.email, values.password, values.confirm].every((value) => value.trim())) return "请先完成所有必填字段。";
  if (!values.email.includes("@")) return "请填写有效的邮箱地址。";
  if (values.password.length < 6) return "密码至少需要 6 位。";
  return values.password === values.confirm ? null : "两次输入的密码不一致。";
}
export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}
```

Create `PreAuthShell` with a `main` landmark, a themed information panel, a form panel, and optional footer. Put dark background, gold borders, responsive grid, focus, error, button, and `prefers-reduced-motion` styles in the CSS Module.

- [ ] **Step 4: Verify GREEN**

Run from `frontend/`: `npm test -- src/features/pre-auth/formValidation.test.ts`.

Expected: PASS, 3 tests.

### Task 2: Login and registration pages

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/register/page.tsx`

**Interfaces:**
- Consumes Task 1 shell and validators.
- Produces UI-only `/login` and `/register` routes.

- [ ] **Step 1: Implement login**

Create a client page with username, password, and message state. Its submit handler calls `validateLogin`; a valid result sets exactly `认证服务尚未接入；此页面仅演示登录前界面。`. Include normal links to `/register` and `/invite`. Do not import auth, backend, or session modules.

- [ ] **Step 2: Implement registration**

Create a client interaction component with username, email, password, confirm, and message state. Render it from the route default export inside `<Suspense fallback={null}>`; the interaction component reads `invite` using `useSearchParams` and renders it as read-only context. Its submit handler calls `validateRegister`; a valid result sets exactly `认证服务尚未接入；注册信息未被提交或保存。`. Link to `/login?invite=${encodeURIComponent(inviteCode)}`. Apply the same `Suspense` structure to the login and invite pages.

- [ ] **Step 3: Verify components compile**

Run from `frontend/`: `npm run typecheck && npm test`.

Expected: exit 0 and all existing plus Task 1 tests pass.

### Task 3: Invite entry and invite landing pages

**Files:**
- Create: `frontend/src/app/invite/page.tsx`
- Create: `frontend/src/app/invite/[code]/page.tsx`

**Interfaces:**
- Consumes `PreAuthShell` and `normalizeInviteCode`.
- Produces routes that only pass code through a register URL.

- [ ] **Step 1: Implement invite entry**

Create a client page that initializes input from optional `code` search params, normalizes it on change, and on submit shows `请输入邀请码。` for an empty value or `邀请码已记录在当前页面；验证服务尚未接入。` otherwise. Render a register `Link` only when the normalized code is nonempty.

- [ ] **Step 2: Implement invite landing**

Create a server page receiving `params: Promise<{ code: string }>`; normalize the resolved code and render it with links to `/register?invite=<code>` and `/login?invite=<code>`. Never verify a code or issue a request.

- [ ] **Step 3: Verify all tests**

Run from `frontend/`: `npm test`.

Expected: exit 0.

### Task 4: Invitation entry page and static boundary check

**Files:**
- Create: `frontend/src/app/enter/page.tsx`
- Modify: `docs/product/tasks/2026-07-22-pre-auth-ui-migration.md`

**Interfaces:**
- Produces a UI-only `/enter` route.

- [ ] **Step 1: Implement entry**

Create a client page that reads an optional `token` only to choose visible copy: no token shows `请通过登录或邀请码进入朝堂。`; a token shows `邀请令牌已收到；认证服务尚未接入。`. Provide one link to `/login`; no timer, validation, router push, or authenticated destination.

- [ ] **Step 2: Verify no forbidden side effects**

Run from repository root:

```powershell
rg -n "\b(fetch|localStorage|sessionStorage|document\.cookie|backendFetch|setSession|AuthGate)\b" frontend/src/app/enter frontend/src/app/login frontend/src/app/register frontend/src/app/invite frontend/src/features/pre-auth
```

Expected: no matches.

- [ ] **Step 3: Record implementation evidence**

Update the task report with created routes, validation behavior, no-network boundary evidence, and actual command results. Do not mark `Implemented` until Task 5 passes.

### Task 5: Full verification and delivery evidence

**Files:**
- Modify: `docs/product/tasks/2026-07-22-pre-auth-ui-migration.md`

- [ ] **Step 1: Run frontend checks**

Run from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits 0.

- [ ] **Step 2: Smoke-test routes**

Start the production server after the build; request `/enter`, `/login`, `/register`, `/invite`, and `/invite/COURT2026`. Verify HTTP 200 and a route-specific heading in every response, then stop the server. Do not submit any form.

Expected: five successful renders and no backend request.

- [ ] **Step 3: Run repository checks and finalize**

Run from the repository root:

```powershell
node scripts/check_harness.mjs
git diff --check
```

Expected: exit 0. Record actual results and remaining risks in the product task, then mark it `Implemented`; final `Accepted` remains a separate product review.

---

## Visual Alignment Revision

### Task 6: Migrate the approved background asset and align the shared shell

**Files:**
- Create from `dev`: `frontend/public/shangshufang/bg-shangshufang-scene.webp`
- Modify: `frontend/src/features/pre-auth/PreAuthShell.tsx`
- Modify: `frontend/src/features/pre-auth/preAuth.module.css`

**Interfaces:**
- Keeps the existing `PreAuthShell` props and all form components unchanged.
- Produces one reusable background layer whose URL is `/shangshufang/bg-shangshufang-scene.webp`.

- [ ] **Step 1: Confirm the asset exists on `dev` and is absent locally**

Run from repository root:

```powershell
git cat-file -e dev:frontend/public/shangshufang/bg-shangshufang-scene.webp
Test-Path frontend/public/shangshufang/bg-shangshufang-scene.webp
```

Expected: the first command exits 0 and the second returns `False` before migration.

- [ ] **Step 2: Copy only the approved tracked asset**

Run from repository root:

```powershell
git checkout dev -- frontend/public/shangshufang/bg-shangshufang-scene.webp
```

This is an explicit, user-authorized migration from `dev`; do not copy the rest of `frontend/public/shangshufang/`.

- [ ] **Step 3: Change the visual shell**

Render the following decorative layers before the existing frame in `PreAuthShell.tsx`; each uses `aria-hidden="true"`:

```tsx
<div className={styles.backdrop} />
<div className={styles.overlay} />
<div className={styles.grid} />
<div className={styles.leftGlow} />
<div className={styles.bottomFade} />
```

Set `.backdrop` to cover the viewport with `background-image: url("/shangshufang/bg-shangshufang-scene.webp")`, and use CSS Module styles for the `dev`-matching dark dual-gradient overlay, low-opacity gold grid, left gold band, lower fade, desktop two-column frame, and narrow-screen single-column fallback. Do not introduce Tailwind utility classes, image helpers, external icon/motion packages, or global selectors.

- [ ] **Step 4: Verify the asset and shell references**

Run from repository root:

```powershell
Test-Path frontend/public/shangshufang/bg-shangshufang-scene.webp
rg -n "bg-shangshufang-scene\.webp|backdrop|overlay|grid|leftGlow|bottomFade" frontend/src/features/pre-auth
```

Expected: the asset exists and every decorative layer is present in the shell and CSS Module.

### Task 7: Verify visual routes and preserve pure-UI boundaries

**Files:**
- Modify: `docs/product/tasks/2026-07-22-pre-auth-ui-migration.md`

- [ ] **Step 1: Run frontend verification**

Run from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits 0.

- [ ] **Step 2: Smoke-test all five routes in production mode**

Start `next start` on an unused local port. Request `/enter`, `/login`, `/register`, `/invite`, and `/invite/COURT2026`; verify each response is HTTP 200, contains `<h1>` and `COURTOS`, and references `/shangshufang/bg-shangshufang-scene.webp`. Do not submit a form.

Expected: five successful responses using the migrated image path.

- [ ] **Step 3: Check boundaries and document evidence**

Run from repository root:

```powershell
rg -n "\b(fetch|localStorage|sessionStorage|document\.cookie|backendFetch|setSession|AuthGate|useRouter|router\.(push|replace)|window\.location|setTimeout)\b" frontend/src/app/enter frontend/src/app/login frontend/src/app/register frontend/src/app/invite frontend/src/features/pre-auth
node scripts/check_harness.mjs
git diff --check
```

Expected: the scan has no matches; both remaining commands exit 0. Update the task implementation report and acceptance review with actual results, then mark it `Implemented` for product acceptance.


---

## Welcome Root-Route Revision

### Task 8: Move the health-check presentation and add the welcome-page module

**Files:**
- Create: `frontend/src/app/health/page.tsx`
- Modify: `frontend/src/app/page.tsx`
- Create from `dev`: `frontend/public/assets/intro/courtos-vision-hero.png`
- Create: `frontend/src/features/welcome/WelcomeGate.tsx`
- Create: `frontend/src/features/welcome/welcome.module.css`
- Modify: `frontend/AGENTS.md`, `ARCHITECTURE.md`, and the product task
- Create: `docs/decisions/0018-root-welcome-and-health-route.md`

**Interfaces:**
- `/health` preserves the existing `fetchHealth()` server-component call and `data-testid="backend-status"` output.
- `/` renders `WelcomeGate` and does not call a backend service.

- [ ] **Step 1: Preserve health behavior in the new route**

Move the current root page implementation unchanged into `frontend/src/app/health/page.tsx`:

```tsx
import { fetchHealth } from "@/lib/backendClient";

export default async function HealthPage() {
  const result = await fetchHealth();
  return <main><h1>chaotang-os</h1>{/* retain the existing backend-status section verbatim */}</main>;
}
```

The full existing success and failure markup, including `data-testid="backend-status"`, must remain verbatim so the health contract is preserved.

- [ ] **Step 2: Copy only the welcome background asset**

Run from repository root:

```powershell
git cat-file -e dev:frontend/public/assets/intro/courtos-vision-hero.png
git checkout dev -- frontend/public/assets/intro/courtos-vision-hero.png
```

This explicit checkout is the user-authorized migration of exactly one tracked asset. Do not copy other `dev` public assets.

- [ ] **Step 3: Implement the welcome UI without `dev` dependencies**

Create `WelcomeGate.tsx` as a client component using local state only. It provides a top navigation, a full-screen hero using `/assets/intro/courtos-vision-hero.png`, CSS/SVG light axis and gold grid, a prompt field whose submit updates a local demo verdict, and normal `Link` elements to `/login` and `/register`. Do not import `lucide-react`, Tailwind classes, `withBasePath`, `useRouter`, `fetch`, authentication, storage, or timers.

Place all welcome layout, desktop/mobile breakpoints, reduced-motion behavior, decorative gradients, grid, and SVG animation in `welcome.module.css`. Decorative layers must be `aria-hidden`, `pointer-events: none`, and positioned beneath interactive content.

- [ ] **Step 4: Wire root and documentation**

Replace `frontend/src/app/page.tsx` with:

```tsx
import { WelcomeGate } from "@/features/welcome/WelcomeGate";

export default function RootPage() {
  return <WelcomeGate />;
}
```

Keep `frontend/AGENTS.md`, `ARCHITECTURE.md`, and ADR 0018 consistent: `/` is the welcome page and `/health` is the frontend health-check presentation; backend `GET /health` and `backendClient.ts` remain unchanged.

### Task 9: Verify root migration and welcome boundaries

**Files:**
- Modify: `docs/product/tasks/2026-07-22-pre-auth-ui-migration.md`

- [ ] **Step 1: Run frontend checks**

Run from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits 0.

- [ ] **Step 2: Smoke-test routes**

Start production Next on an unused local port. Request `/`, `/health`, `/enter`, `/login`, `/register`, `/invite`, and `/invite/COURT2026`. Verify HTTP 200; `/` references `/assets/intro/courtos-vision-hero.png` and contains welcome content, while `/health` contains `data-testid="backend-status"`. Do not submit any form.

- [ ] **Step 3: Verify boundaries and evidence**

Run from repository root:

```powershell
rg -n "\b(fetch|localStorage|sessionStorage|document\.cookie|backendFetch|setSession|AuthGate|useRouter|router\.(push|replace)|window\.location|setTimeout)\b" frontend/src/features/welcome frontend/src/app/page.tsx
node scripts/check_harness.mjs
git diff --check
```

Expected: the scan has no matches; remaining commands exit 0. Record actual verification and visual review evidence in the task, then mark it `Implemented` for final product acceptance.

---

## Complete Welcome-Page Content Revision

### Task 10: Rebuild the complete `dev` welcome-page information architecture

**Files:**
- Modify: `frontend/src/features/welcome/WelcomeGate.tsx`
- Modify: `frontend/src/features/welcome/welcome.module.css`
- Create: `frontend/src/features/welcome/welcomeContent.test.ts`
- Modify: `docs/product/tasks/2026-07-22-pre-auth-ui-migration.md`

**Interfaces:**
- `/` retains the root `WelcomeGate` entry point and uses no backend or authentication capability.
- The page includes the same user-visible information architecture and Chinese copy as `dev`: the four-item navigation, hero/prompt preview, pain points, solution loop, use cases, institutional proof cards, and conversion block.

- [ ] **Step 1: Add a content-contract test**

Add a source-level `node:test` contract that reads `WelcomeGate.tsx` and asserts the four navigation anchors (`#pain-points`, `#solution`, `#use-cases`, `#conversion`), the four pain-point headings, all three use-case headings, and the conversion heading are present. Run it first and confirm it fails against the shortened welcome page.

- [ ] **Step 2: Port structure and copy without importing `dev` runtime dependencies**

Replace the abbreviated welcome component with a CSS-Module implementation of the full `dev` structure. Recreate icons using a small local inline-SVG glyph component; do not import `lucide-react`, Tailwind utilities, `withBasePath`, `useRouter`, timers, storage, authentication, or network code. Keep the prompt preview as local React state and use ordinary `Link` components for login and registration.

- [ ] **Step 3: Match the visual hierarchy responsively**

Extend the CSS Module for the `dev` layout: full navigation on wide screens with horizontally usable narrow-screen fallback; visual hero and demo split; four pain cards; solution metrics and five-stage loop; three use-case cards; four proof cards; and the conversion CTA. All decorative layers remain non-interactive and the page supports narrow viewports and reduced motion.

- [ ] **Step 4: Verify the complete page and pure-UI boundary**

Run from `frontend/`:

```powershell
npm test -- src/features/welcome/welcomeContent.test.ts
npm run lint
npm run typecheck
npm test
npm run build
```

Then smoke-test `/`, `/health`, and every pre-auth route in production mode; inspect `/` at desktop and 390×844 viewport sizes. From the repository root run:

```powershell
rg -n "\b(fetch|localStorage|sessionStorage|document\.cookie|backendFetch|setSession|AuthGate|useRouter|router\.(push|replace)|window\.location|setTimeout)\b" frontend/src/features/welcome frontend/src/app/page.tsx
node scripts/check_harness.mjs
git diff --check
```

Expected: all commands pass, no forbidden-boundary matches, all expected sections are visible and reachable, `/health` retains `data-testid="backend-status"`, and no form is submitted to a service.
