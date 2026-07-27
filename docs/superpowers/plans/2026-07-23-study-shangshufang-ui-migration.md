# 上书房真实视觉元素迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/study` use the dev 上书房的公共头部、实体卷轴和背景图，同时保留现有下旨行为。

**Architecture:** `ChaotangHeader` 复刻 `dev` 的顶栏构图，但仅保留静态导航。新的 `EdictScrollShell` 从 `dev` 的 `EdictStage` 提取卷轴轴、绫纸、云纹与钤印视觉，接受 children；`StudyClient` 将原有输入与回奏作为 children 放入卷轴。所有样式为 CSS Module；旧 API、SWR、lucide 和 Tailwind 均不进入当前分支。

**Tech Stack:** Next.js App Router、React 19、TypeScript、CSS Modules、Node `node:test`。

## Global Constraints

- 不修改 `frontend/src/app/study/page.tsx`、`frontend/src/lib/requireUser.ts`、`frontend/src/app/api/decrees/chancellor/route.ts` 或 `frontend/src/app/study/decreeStatus.ts`。
- 只复制 `dev:frontend/public/shangshufang/bg-shangshufang-full.webp` 这一静态资源；不复制 dev 旧业务组件。
- 输入、按钮与所有回奏结果继续使用相同 `data-testid`；`fetch("/api/decrees/chancellor")` 与 401 跳转保持不变。
- 不保留三栏、Dock、侧栏、时钟、通知、弹层、旧认证或旧网络请求。
- 不新增包，不提交、不推送、不部署。

---

### Task 1: Add the background asset and visual-only scroll shell

**Files:**

- Create: `frontend/public/shangshufang/bg-shangshufang-full.webp` (exact copy from `dev`)
- Create: `frontend/src/components/chaotang/EdictScrollShell.tsx`
- Create: `frontend/src/components/chaotang/EdictScrollShell.module.css`
- Create: `frontend/src/components/chaotang/EdictScrollShell.test.ts`

**Interfaces:**

- Produces: `EdictScrollShell({ children }: { children: React.ReactNode })`.
- Consumes: React `ReactNode` only; no API, session, route, icon, or data-model imports.

- [ ] **Step 1: Write the failing source-contract test**

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("EdictScrollShell contains the dev-derived scroll structure without business dependencies", async () => {
  const source = await readFile(new URL("./EdictScrollShell.tsx", import.meta.url), "utf8");
  assert.match(source, /aria-label="圣旨展示面板"/);
  assert.match(source, /styles\.rollerLeft/);
  assert.match(source, /styles\.paper/);
  assert.match(source, /styles\.seal/);
  assert.doesNotMatch(source, /fetch\(|useEffect|useState|lucide|swr|@\//);
});
```

- [ ] **Step 2: Run the test and confirm missing-file failure**

Run from `frontend/`: `node --test src/components/chaotang/EdictScrollShell.test.ts`.

Expected: FAIL with `ENOENT` for `EdictScrollShell.tsx`.

- [ ] **Step 3: Copy the approved dev background asset and implement the shell**

Use the exact Git source asset: `git restore --source=dev -- frontend/public/shangshufang/bg-shangshufang-full.webp` from the repository root. Implement this component:

```tsx
import type { ReactNode } from "react";
import styles from "./EdictScrollShell.module.css";

export function EdictScrollShell({ children }: { children: ReactNode }) {
  return <section className={styles.stage} aria-label="圣旨展示面板">
    <span className={`${styles.roller} ${styles.rollerLeft}`} aria-hidden />
    <span className={`${styles.roller} ${styles.rollerRight}`} aria-hidden />
    <div className={styles.paper}>
      <span className={styles.brocadeTop} aria-hidden />
      <span className={styles.brocadeBottom} aria-hidden />
      <span className={styles.seal} aria-hidden>奉天承运</span>
      <div className={styles.content}>{children}</div>
    </div>
  </section>;
}
```

The CSS must implement the same visible concepts from dev `EdictStage`: dark wooden side rollers, warm rice-paper radial gradient, paper grain, top/bottom brocade borders, a translucent red seal watermark, and `prefers-reduced-motion` fallback.

- [ ] **Step 4: Run the targeted shell test**

Run from `frontend/`: `node --test src/components/chaotang/EdictScrollShell.test.ts`.

Expected: PASS with one passing subtest.

### Task 2: Replace the simplified header with the dev top-nav composition

**Files:**

- Modify: `frontend/src/components/chaotang/ChaotangHeader.tsx`
- Modify: `frontend/src/components/chaotang/ChaotangHeader.module.css`
- Modify: `frontend/src/components/chaotang/ChaotangHeader.test.ts`

**Interfaces:**

- Produces: `ChaotangHeader({ currentLabel }: { currentLabel: string })` with existing consumer compatibility.
- Consumes: Next `Link` only.

- [ ] **Step 1: Extend the failing contract test before the Header change**

Add these assertions to `ChaotangHeader.test.ts`:

```ts
assert.match(source, /data-three-axis-topnav/);
assert.match(source, /上值朝 · AI 智能办公/);
assert.match(source, /朝堂 OS/);
assert.match(source, /aria-current="page"/);
```

- [ ] **Step 2: Run the Header test and confirm it fails on the absent dev visual markers**

Run from `frontend/`: `node --test src/components/chaotang/ChaotangHeader.test.ts`.

Expected: FAIL on `data-three-axis-topnav`.

- [ ] **Step 3: Rebuild the dev header visual composition with static links**

Keep the existing function signature. Render an emblem, the two-line `朝堂 OS` / `上值朝 · AI 智能办公` brand, central links for `上书房` and `史馆`, and a right-side `内廷 · {currentLabel}` label. Add `data-three-axis-topnav` to the header. CSS must use the dev header's 64px high dark gradient, gold lower border, gold-gradient brand, centered navigation and gold dot active-state. Do not add icons, time, menus, effects, API calls, or state.

- [ ] **Step 4: Run the targeted Header test**

Run from `frontend/`: `node --test src/components/chaotang/ChaotangHeader.test.ts`.

Expected: PASS with one passing subtest.

### Task 3: Place the existing decree UI inside the physical scroll and background

**Files:**

- Modify: `frontend/src/app/study/StudyClient.tsx`
- Modify: `frontend/src/app/study/study.module.css`
- Modify: `frontend/src/app/study/StudyClient.test.ts`

**Interfaces:**

- Consumes: `ChaotangHeader`, `EdictScrollShell`, existing `DecreeUiState` and `callChancellorRoute`.
- Produces: the unchanged decree controls inside the scroll; no sidebars.

- [ ] **Step 1: Write the failing page source-contract assertions**

Add to `StudyClient.test.ts`:

```ts
assert.match(source, /EdictScrollShell/);
assert.match(source, /className=\{styles\.background\}/);
assert.doesNotMatch(source, /styles\.workspace|styles\.flow|styles\.courtNote/);
```

- [ ] **Step 2: Run the test and confirm it fails on the current three-column shell**

Run from `frontend/`: `node --test src/app/study/StudyClient.test.ts`.

Expected: FAIL because `EdictScrollShell` and `styles.background` are absent.

- [ ] **Step 3: Preserve request code and replace only presentation markup**

Leave `callChancellorRoute`, `handleSubmitDecree`, `fetch("/api/decrees/chancellor")`, `window.location.assign`, textarea properties, button behavior, and result rendering unchanged. Replace the `<div className={styles.workspace}>…</div>` with:

```tsx
<div className={styles.background}>
  <EdictScrollShell>
    <div className={styles.scrollHeading}>
      <p>奉天承运 · 上书房</p>
      <h1>圣旨</h1>
      <span>内廷拟旨 · 丞相回奏</span>
    </div>
    {/* existing fee notice, composer, and response sections */}
  </EdictScrollShell>
</div>
```

Delete the previous flow and state sidebars. Set `.background` to use `url("/shangshufang/bg-shangshufang-full.webp") center/cover fixed` with a dark readable overlay. Make the scroll content vertically scrollable on narrow viewports, preserve the form focus styles, and add no global CSS.

- [ ] **Step 4: Run all migration-specific tests**

Run from `frontend/`:

```powershell
node --test src/app/study/studyWorkspace.test.ts src/components/chaotang/ChaotangHeader.test.ts src/components/chaotang/EdictScrollShell.test.ts src/app/study/StudyClient.test.ts
```

Expected: four passing subtests.

### Task 4: Perform full verification without issuing a decree

**Files:**

- Modify only the Task 1–3 files if a verification failure identifies a defect.

- [ ] **Step 1: Run static and build verification**

Run from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify the protected production entry**

Run the built app on an unused port, then request `/study` with `curl.exe -sS -D - -o NUL --max-time 10`. Confirm `HTTP/1.1 307 Temporary Redirect` and `location: /login?next=%2Fstudy`, then stop only the process started for this check. Do not submit a decree.

- [ ] **Step 3: Run final scope checks**

Run from repository root:

```powershell
rg -n 'bg-shangshufang-full.webp|EdictScrollShell|data-three-axis-topnav' frontend/src
rg -n '^import .*(@/|swr|lucide)' frontend/src/app/study frontend/src/components/chaotang
git diff --check
node scripts/check_harness.mjs
```

Expected: first command finds all three visual elements; second finds no matches; diff check and harness exit 0.

## Plan self-review

- Spec coverage: Tasks 1–3 implement only the approved background, public Header, and scroll; Task 4 verifies preserved protected-route behavior and scope boundaries.
- Placeholder scan: all file paths, test assertions, commands, and component interfaces are explicit.
- Type consistency: `EdictScrollShell` accepts `ReactNode`; `StudyClient` is its only consumer; `ChaotangHeader` retains its current prop signature.
