# Business Time Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every user-visible ISO8601 business timestamp to fixed Beijing time in `YYYY/MM/DD HH:mm:ss` format.

**Architecture:** Keep API payloads, validation, sorting, and storage in ISO8601. Add one pure frontend formatter in `src/lib`, then call it only at React rendering boundaries so all pages share the same timezone, output shape, and invalid-value fallback.

**Tech Stack:** TypeScript 5.9, Node.js `node:test`, React 19, Next.js 16, built-in `Intl.DateTimeFormat`

## Global Constraints

- Fixed display timezone: `Asia/Shanghai`.
- Fixed output: `YYYY/MM/DD HH:mm:ss`.
- `2026-07-28T11:11:36.727253+00:00` must display as `2026/07/28 19:11:36`.
- Invalid, empty, or missing input displays `时间未知`; never echo invalid raw input.
- Do not change API schemas, database values, ISO8601 validators, sorting, evidence freshness, or machine-only timestamps.
- Do not add a date/time dependency.
- Git commits in the steps below may run only after separate explicit user authorization.

---

### Task 1: Shared business-time formatter

**Files:**
- Create: `frontend/src/lib/formatBusinessTime.ts`
- Create: `frontend/src/lib/formatBusinessTime.test.ts`

**Interfaces:**
- Consumes: ISO8601 `string | null | undefined`
- Produces: `formatBusinessTime(value: string | null | undefined): string`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { formatBusinessTime } from "./formatBusinessTime.ts";

test("formats UTC ISO8601 timestamps as fixed Beijing time", () => {
  assert.equal(
    formatBusinessTime("2026-07-28T11:11:36.727253+00:00"),
    "2026/07/28 19:11:36",
  );
});

test("honors input offsets and handles date rollover", () => {
  assert.equal(
    formatBusinessTime("2026-12-31T18:30:40-05:00"),
    "2027/01/01 07:30:40",
  );
});

test("returns the stable fallback for absent or invalid input", () => {
  for (const value of [undefined, null, "", "not-a-time"]) {
    assert.equal(formatBusinessTime(value), "时间未知");
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd frontend; node --test src/lib/formatBusinessTime.test.ts`

Expected: FAIL because `formatBusinessTime.ts` does not exist.

- [ ] **Step 3: Add the minimal formatter**

```ts
const BUSINESS_TIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatBusinessTime(
  value: string | null | undefined,
): string {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "时间未知";

  const parts = Object.fromEntries(
    BUSINESS_TIME_FORMATTER
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `cd frontend; node --test src/lib/formatBusinessTime.test.ts`

Expected: PASS, including UTC conversion, offset conversion, rollover, microsecond removal, and fallback.

- [ ] **Step 5: Commit only if separately authorized**

```powershell
git add frontend/src/lib/formatBusinessTime.ts frontend/src/lib/formatBusinessTime.test.ts
git commit -m "feat(frontend): add business time formatter"
```

### Task 2: Replace direct ISO rendering in user-visible pages

**Files:**
- Modify: `frontend/src/app/jinyiwei/page.tsx`
- Modify: `frontend/src/features/junjichu-visual/JunjichuScene.tsx`
- Modify: `frontend/src/features/shiguan-visual/ShiguanArchiveDetail.tsx`
- Modify: `frontend/src/features/shiguan-visual/ShiguanWorkspace.tsx`
- Modify: `frontend/src/features/study-visual/StudySideDrawers.tsx`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- Test: `frontend/src/features/study-visual/StudySideDrawers.test.ts`
- Test: `frontend/src/app/shiguan/archiveStatus.test.ts`
- Create: `frontend/src/lib/businessTimeUsage.test.ts`

**Interfaces:**
- Consumes: `formatBusinessTime(value: string | null | undefined): string` from Task 1
- Produces: every listed React view renders Beijing time while preserving original ISO values in semantic `<time dateTime>` attributes where present

- [ ] **Step 1: Add a failing source-usage guard**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const DISPLAY_FILES = [
  "app/jinyiwei/page.tsx",
  "features/junjichu-visual/JunjichuScene.tsx",
  "features/shiguan-visual/ShiguanArchiveDetail.tsx",
  "features/shiguan-visual/ShiguanWorkspace.tsx",
  "features/study-visual/StudySideDrawers.tsx",
  "features/study-visual/DevStudyWorkspace.tsx",
];

test("all business-time views use the shared formatter", () => {
  for (const path of DISPLAY_FILES) {
    const source = readFileSync(new URL(path, ROOT), "utf8");
    assert.match(source, /formatBusinessTime/);
    assert.doesNotMatch(source, /toLocaleString/);
  }
});

test("known ISO fields are not interpolated directly into JSX", () => {
  for (const path of DISPLAY_FILES) {
    const source = readFileSync(new URL(path, ROOT), "utf8");
    assert.doesNotMatch(
      source,
      /\{(?:archive|archivedReply|item|selected)\.(?:replyTime|createdAt|updatedAt)\}/,
    );
  }
});
```

- [ ] **Step 2: Update existing view assertions before production code**

Change `StudySideDrawers.test.ts` to require `formatBusinessTime(archive.replyTime)` instead of direct `archive.replyTime`, and change `archiveStatus.test.ts` to require `formatBusinessTime(snapshot.asOf)` and `formatBusinessTime(snapshot.retrievedAt)`.

```ts
assert.match(source, /formatBusinessTime\(archive\.replyTime\)/);
assert.match(detail, /formatBusinessTime\(snapshot\.asOf\)/);
assert.match(detail, /formatBusinessTime\(snapshot\.retrievedAt\)/);
```

- [ ] **Step 3: Run the view tests and verify RED**

Run:

```powershell
cd frontend
node --test src/lib/businessTimeUsage.test.ts src/features/study-visual/StudySideDrawers.test.ts src/app/shiguan/archiveStatus.test.ts
```

Expected: FAIL because the views still contain local formatters or direct ISO rendering.

- [ ] **Step 4: Replace page-local and direct rendering**

Import the shared function using each file’s established import style:

```ts
import { formatBusinessTime } from "@/lib/formatBusinessTime";
```

Then make these exact rendering substitutions:

```tsx
// jinyiwei/page.tsx
// Remove local when(); replace every when(value) with formatBusinessTime(value).

// JunjichuScene.tsx
<time dateTime={item.updatedAt}>更新 {formatBusinessTime(item.updatedAt)}</time>
<time dateTime={selected.updatedAt}>{formatBusinessTime(selected.updatedAt)}</time>

// ShiguanArchiveDetail.tsx and ShiguanWorkspace.tsx
// Remove local displayDate(); replace each displayDate(value) with formatBusinessTime(value).

// StudySideDrawers.tsx
{formatBusinessTime(archive.replyTime)} · {archive.participatingDepartments!.join("、")}

// DevStudyWorkspace.tsx
issuer: `${archivedReply.respondent} · ${formatBusinessTime(archivedReply.replyTime)}`,
<p><strong>回奏时间</strong>{formatBusinessTime(archivedReply.replyTime)}</p>
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```powershell
cd frontend
node --test src/lib/formatBusinessTime.test.ts src/lib/businessTimeUsage.test.ts src/features/study-visual/StudySideDrawers.test.ts src/app/shiguan/archiveStatus.test.ts
```

Expected: PASS with no local `toLocaleString` implementation or direct ISO interpolation in the scoped views.

- [ ] **Step 6: Commit only if separately authorized**

```powershell
git add frontend/src/app/jinyiwei/page.tsx frontend/src/features/junjichu-visual/JunjichuScene.tsx frontend/src/features/shiguan-visual/ShiguanArchiveDetail.tsx frontend/src/features/shiguan-visual/ShiguanWorkspace.tsx frontend/src/features/study-visual/StudySideDrawers.tsx frontend/src/features/study-visual/DevStudyWorkspace.tsx frontend/src/features/study-visual/StudySideDrawers.test.ts frontend/src/app/shiguan/archiveStatus.test.ts frontend/src/lib/businessTimeUsage.test.ts
git commit -m "fix(frontend): standardize visible business times"
```

### Task 3: Repository-wide verification

**Files:**
- Verify only; do not modify contracts or backend timestamp code

**Interfaces:**
- Consumes: formatter and migrated views from Tasks 1–2
- Produces: fresh evidence that tests, static checks, build, and harness pass

- [ ] **Step 1: Scan for remaining risky render patterns**

Run:

```powershell
rg -n --glob '*.tsx' "toLocaleString|\\{[^}]*\\.(createdAt|updatedAt|replyTime|asOf|retrievedAt|completedAt|startedAt)\\}" frontend/src
```

Expected: no user-visible ISO rendering; semantic `dateTime={...}` attributes may remain because they are machine-readable metadata.

- [ ] **Step 2: Run the full frontend test suite**

Run: `cd frontend; npm test`

Expected: PASS.

- [ ] **Step 3: Run frontend static verification**

Run:

```powershell
cd frontend
npm run lint
npm run typecheck
npm run build
```

Expected: all commands PASS without new warnings or errors.

- [ ] **Step 4: Run repository harness checks**

Run:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 5: Review the diff**

Run: `git diff -- docs/superpowers/specs/2026-07-28-business-time-display-design.md docs/superpowers/plans/2026-07-28-business-time-display.md frontend`

Expected: only the approved display-format design, plan, formatter, tests, and frontend rendering-boundary changes appear; API and database representations remain unchanged.
