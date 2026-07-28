# 专署·锦衣卫唯一入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/zhuanshu/jinyiwei` the sole protected, read-only 专署·锦衣卫 entry.

**Architecture:** Move the existing client-side Jinyiwei audit desk into a focused feature component, and render it from the protected `/zhuanshu/jinyiwei` server page inside `CourtShell`. Remove every obsolete page route instead of redirecting, and adjust the court navigation to the sole route. Update the explicitly authorized route governance wording and its integrity hash in the same change.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules/global feature CSS, Node `node:test`.

## Global Constraints

- `/zhuanshu/jinyiwei` is the sole entry; `/zhuanshu`, `/jinyiwei`, and `/zhuanshu/jinyiwei/[signalId]` must not remain as redirects.
- The page must call only existing same-origin GET-only `/api/jinyiwei/**` BFF endpoints and must remain read-only.
- Require a server-side session with `requireUser("/zhuanshu/jinyiwei")` before rendering the client audit desk.
- Keep existing loading, empty, error, narrow-screen, non-color status, cancellation, and stale-response behavior.
- Do not create a Git commit unless the user explicitly authorizes it.

---

## File structure

- `frontend/src/features/jinyiwei-visual/JinyiweiAuditDesk.tsx`: client-only read-only audit-desk controller and markup, moved out of an App Router page.
- `frontend/src/features/jinyiwei-visual/jinyiwei.css`: existing audit-desk styles colocated with the feature.
- `frontend/src/features/jinyiwei-visual/jinyiweiStatus.ts`: existing pure audit-desk status/query helpers.
- `frontend/src/features/jinyiwei-visual/jinyiweiStatus.test.ts`: direct unit and source-boundary tests for the feature.
- `frontend/src/app/zhuanshu/jinyiwei/page.tsx`: protected server route that wraps `JinyiweiAuditDesk` in `CourtShell`.
- `frontend/src/app/court-entry-pages.test.ts`: route inventory asserting the sole protected page and no placeholder.
- `frontend/src/components/chaotang/ChaotangHeader.tsx` and `.test.ts`: 专署 navigation target and its literal union.
- `frontend/src/lib/requireUser.ts` and `.test.ts`: only the remaining protected 专署 route type/value.
- `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`: authorized sole-route wording.
- `scripts/check_harness.mjs`: matching SHA-256 for the revised authorized baseline.

### Task 1: Lock the sole route in failing tests

**Files:**
- Modify: `frontend/src/app/court-entry-pages.test.ts`
- Modify: `frontend/src/components/chaotang/ChaotangHeader.test.ts`
- Modify: `frontend/src/lib/requireUser.test.ts`
- Modify: `frontend/src/features/jinyiwei-visual/jinyiweiStatus.test.ts` (created by moving the existing test)

**Interfaces:**
- Consumes: `requireUser("/zhuanshu/jinyiwei")`, `CourtShell`, `JinyiweiAuditDesk`.
- Produces: executable assertions that the only entry has one server guard, is not a placeholder, and the audit UI contains no mutation request.

- [ ] **Step 1: Move the status test beside the intended feature and add the red assertions**

```ts
test("the sole Jinyiwei entry is protected and uses the audit desk", async () => {
  const page = await readFile(new URL("../../app/zhuanshu/jinyiwei/page.tsx", import.meta.url), "utf8");
  assert.match(page, /await requireUser\("\/zhuanshu\/jinyiwei"\)/);
  assert.match(page, /<CourtShell currentLabel="专署·锦衣卫" currentPath="\/zhuanshu\/jinyiwei">/);
  assert.match(page, /<JinyiweiAuditDesk\s*\/>/);
  assert.doesNotMatch(page, /CourtPlaceholderPage|"use client"|fetch\(/);
});

test("audit desk remains read-only", async () => {
  const source = await readFile(new URL("./JinyiweiAuditDesk.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /method\s*:\s*["'](?:POST|PATCH|PUT|DELETE)/);
  assert.doesNotMatch(source, /<form|contentEditable|删除|编辑证据|重新采集/);
  assert.match(source, /\/api\/jinyiwei\/summary/);
  assert.match(source, /\/api\/jinyiwei\/investigations/);
});
```

- [ ] **Step 2: Replace the old placeholder expectations with a sole-entry inventory**

```ts
const pages = [
  ["zhuanshu/jinyiwei/page.tsx", "/zhuanshu/jinyiwei", "专署·锦衣卫", /JinyiweiAuditDesk/, /CourtShell/],
] as const;

assert.doesNotMatch(source, /CourtPlaceholderPage/);
assert.match(source, /await requireUser\("\/zhuanshu\/jinyiwei"\)/);
```

- [ ] **Step 3: Make navigation and protected-path tests demand the exact new path**

```ts
for (const href of ["/dadian", "/study", "/junjichu", "/liubu", "/zhuanshu/jinyiwei", "/shiguan"]) {
  assert.match(source, new RegExp(`href: "${href}"`));
}

assert.doesNotMatch(source, /href: "\/zhuanshu"/);
```

```ts
const protectedPaths = ["/study", "/shiguan", "/zhuanshu/jinyiwei"] as const;
for (const path of protectedPaths) assert.ok(source.includes(path));
assert.doesNotMatch(source, /\| "\/zhuanshu"\r?\n/);
assert.doesNotMatch(source, /`\/zhuanshu\/jinyiwei\/\$\{string\}`/);
```

- [ ] **Step 4: Run the focused tests and verify the expected red failure**

Run: `npm test -- src/app/court-entry-pages.test.ts src/components/chaotang/ChaotangHeader.test.ts src/lib/requireUser.test.ts src/features/jinyiwei-visual/jinyiweiStatus.test.ts` from `frontend/`.

Expected: FAIL because `JinyiweiAuditDesk.tsx` does not exist and `/zhuanshu/jinyiwei/page.tsx` still renders `CourtPlaceholderPage`.

### Task 2: Move the audit desk and install the sole protected page

**Files:**
- Create: `frontend/src/features/jinyiwei-visual/JinyiweiAuditDesk.tsx`
- Create: `frontend/src/features/jinyiwei-visual/jinyiwei.css`
- Create: `frontend/src/features/jinyiwei-visual/jinyiweiStatus.ts`
- Modify: `frontend/src/app/zhuanshu/jinyiwei/page.tsx`
- Delete: `frontend/src/app/jinyiwei/page.tsx`
- Delete: `frontend/src/app/jinyiwei/jinyiwei.css`
- Delete: `frontend/src/app/jinyiwei/jinyiweiStatus.ts`
- Delete: `frontend/src/app/zhuanshu/page.tsx`
- Delete: `frontend/src/app/zhuanshu/jinyiwei/[signalId]/page.tsx`

**Interfaces:**
- Consumes: existing `JinyiweiSummary`, `JinyiweiPage`, `JinyiweiDetail`, `JinyiweiStatus` types from `../../lib/backendClient.ts`, and existing BFF routes.
- Produces: `export function JinyiweiAuditDesk(): React.JSX.Element` and a server page guarded by `requireUser`.

- [ ] **Step 1: Copy the existing audit desk into the feature without changing behavior**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { JinyiweiDetail, JinyiweiEvidence, JinyiweiListItem, JinyiweiPage, JinyiweiStatus, JinyiweiSummary } from "../../lib/backendClient";
import { buildInvestigationQuery, createGenerationGuard, formatConfidence, getPageAvailability, qualityPresentation, resetDetailForListRefresh, statusPresentation } from "./jinyiweiStatus";
import "./jinyiwei.css";

export function JinyiweiAuditDesk() {
  // Move the existing `JinyiweiPage` state, effects, helpers, and read-only markup unchanged.
}
```

Change its outermost element from `<main className="jw-shell">` to `<div className="jw-shell">`, with the matching closing `</div>`, because `CourtShell` already owns the page-level `<main>`.

- [ ] **Step 2: Replace the placeholder with the protected server composition**

```tsx
import { CourtShell } from "../../../components/chaotang/CourtShell";
import { JinyiweiAuditDesk } from "../../../features/jinyiwei-visual/JinyiweiAuditDesk";
import { requireUser } from "../../../lib/requireUser";

export default async function JinyiweiPage() {
  await requireUser("/zhuanshu/jinyiwei");
  return (
    <CourtShell currentLabel="专署·锦衣卫" currentPath="/zhuanshu/jinyiwei">
      <JinyiweiAuditDesk />
    </CourtShell>
  );
}
```

- [ ] **Step 3: Remove obsolete route files**

Delete the page files listed above, and delete the old `frontend/src/app/jinyiwei/` files only after their feature copies exist. Do not add redirects or replacement files at the removed paths.

- [ ] **Step 4: Run focused tests and verify green**

Run: `npm test -- src/app/court-entry-pages.test.ts src/features/jinyiwei-visual/jinyiweiStatus.test.ts` from `frontend/`.

Expected: PASS.

### Task 3: Point navigation and protected-path types at the sole entry

**Files:**
- Modify: `frontend/src/components/chaotang/ChaotangHeader.tsx`
- Modify: `frontend/src/lib/requireUser.ts`
- Modify: tests changed in Task 1

**Interfaces:**
- Consumes: `VisualNavItem` and `ProtectedPath` union definitions.
- Produces: a navigation entry and protected-path type that allow `/zhuanshu/jinyiwei` only.

- [ ] **Step 1: Update the navigation union and 专署 item**

```ts
type VisualNavItem = {
  label: string;
  href: "/dadian" | "/study" | "/junjichu" | "/liubu" | "/zhuanshu/jinyiwei" | "/shiguan";
};

{ label: "专署", href: "/zhuanshu/jinyiwei" },
```

- [ ] **Step 2: Remove obsolete protected-path members**

```ts
type ProtectedPath =
  | "/study"
  | "/shiguan"
  | "/dadian"
  | "/junjichu"
  | "/command-center"
  | "/liubu"
  | `/liubu/${string}`
  | "/zhuanshu/jinyiwei";
```

- [ ] **Step 3: Run route and authentication tests**

Run: `npm test -- src/components/chaotang/ChaotangHeader.test.ts src/lib/requireUser.test.ts src/app/court-entry-pages.test.ts` from `frontend/`.

Expected: PASS.

### Task 4: Update authorized route governance and baseline integrity

**Files:**
- Modify: `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
- Modify: `frontend/AGENTS.md`
- Modify: `scripts/check_harness.mjs`
- Modify: `docs/product/tasks/2026-07-28-zhuanshu-jinyiwei-single-entry.md`

**Interfaces:**
- Consumes: the user-approved decision that `/zhuanshu/jinyiwei` is the sole entry and `DECREE_FLOW_BASELINE_SHA256` verification.
- Produces: consistent documentation and an integrity guard that accepts exactly the revised baseline.

- [ ] **Step 1: Replace the old route in ADR 0028**

```md
E --> D["/zhuanshu/jinyiwei 只读调查台"]
```

```md
- `/zhuanshu/jinyiwei` 仅展示调查汇总、列表和详情，不能触发调查或修改证据。
```

Keep all existing evidence, adoption, archival, and read-only constraints unchanged.

- [ ] **Step 2: Update frontend route documentation**

Replace every frontend documentation reference that identifies `src/app/jinyiwei/page.tsx` or `/jinyiwei` as the audit desk with `src/app/zhuanshu/jinyiwei/page.tsx` and `/zhuanshu/jinyiwei`. Preserve the three GET-only BFF endpoint paths, because those API paths do not change.

- [ ] **Step 3: Calculate and pin the new baseline hash**

Run: `node -e "const fs=require('node:fs');const crypto=require('node:crypto');console.log(crypto.createHash('sha256').update(fs.readFileSync('docs/decisions/0028-decree-evidence-flow-governance-baseline.md')).digest('hex'))"` from the repository root.

Replace the string assigned to `DECREE_FLOW_BASELINE_SHA256` in `scripts/check_harness.mjs` with exactly that lowercase output.

- [ ] **Step 4: Record the implementation plan in the product task**

Replace `- Pending implementation plan.` in `## Technical Plan` with the four task names in this plan and retain the `Ready` status until implementation begins.

- [ ] **Step 5: Verify policy consistency**

Run: `node scripts/check_harness.mjs` from the repository root.

Expected: PASS; the route wording and SHA-256 integrity guard are consistent.

### Task 5: Run full validation and route smoke checks

**Files:**
- Modify: no production files.

**Interfaces:**
- Consumes: the sole route, protected server composition, unit tests, and updated harness integrity hash.
- Produces: fresh verification evidence for the task report.

- [ ] **Step 1: Run the complete frontend checks**

Run from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits `0`.

- [ ] **Step 2: Verify the sole route and removed routes in production mode**

Run from `frontend/` after the build:

```powershell
$process = Start-Process npm -ArgumentList 'run','start' -WorkingDirectory (Get-Location) -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Seconds 3
  (Invoke-WebRequest http://127.0.0.1:3000/zhuanshu/jinyiwei -MaximumRedirection 0 -SkipHttpErrorCheck).StatusCode
  (Invoke-WebRequest http://127.0.0.1:3000/zhuanshu -MaximumRedirection 0 -SkipHttpErrorCheck).StatusCode
  (Invoke-WebRequest http://127.0.0.1:3000/jinyiwei -MaximumRedirection 0 -SkipHttpErrorCheck).StatusCode
} finally { Stop-Process -Id $process.Id -Force }
```

Expected: the protected sole route redirects unauthenticated users to login; `/zhuanshu` and `/jinyiwei` return `404`.

- [ ] **Step 3: Run repository verification**

Run from the repository root:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 4: Update the task report without changing status to accepted**

Record exact commands and outcomes under `## Implementation Report`; set the task status to `Implemented` only after all listed checks pass. Leave `## Acceptance Review` pending for product acceptance.

## Plan self-review

- Spec coverage: Tasks 1–3 implement the sole page, protected composition, removal of legacy routes, navigation, and read-only boundary; Task 4 updates the user-authorized governing route and its checksum; Task 5 validates all acceptance criteria.
- Placeholder scan: no TBD/TODO markers, and every test/code/documentation action names exact files and commands.
- Type consistency: `JinyiweiAuditDesk` is the sole client component export; the server page, source tests, and `CourtShell` use that exact name.
