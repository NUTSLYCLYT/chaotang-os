# Complete only-worktree Semantic Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Account for all 108 source-worktree entries while migrating only the user-confirmed UI surface into `harness-only`; explicitly reject non-UI entries and preserve the target branch's authentication, owner isolation, immutable evidence, and safe integration contracts.

**Architecture:** Freeze the source snapshot in a machine-checkable disposition manifest, then recover the visual/controller layers in dependency order. Backend code and tests, production BFF routes, auth, `frontend/src/lib/backendClient.ts`, and Jinyiwei production are excluded. Target-only ownership and evidence contracts remain authoritative; migrated UI controllers and payload decoders adapt to them without overwriting them. Every behavior change starts with a failing test, and the final gate checks both the migrated product surfaces and all 108 dispositions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS Modules, Node `node:test`, and PowerShell. Backend technologies are preserved but are not implementation targets for this UI-only correction.

## Global Constraints

- The migration input is `D:\workspace\chaotang-os-harness-only-worktree`, interpreted as recovered commit `734b0aad07eb9b48469e9263e24cdd68fee1c4e4` plus its current dirty delta.
- The user's final clarification is authoritative: migrate UI only. Reject source backend/tests/migrations, BFF/auth/backendClient boundary changes, Jinyiwei production changes, SDD scratch state, and historical delivery documents.
- Preserve authenticated FastAPI ownership, opaque revocable sessions, same-origin BFF cookie forwarding, and per-user Shiguan isolation.
- Preserve `MEMORIAL` and `REPLY` as the only archive types and retain immutable Jinyiwei `evidenceReferences` plus MCP provenance.
- Preserve ADR 0028, deterministic Jinyiwei orchestration, approved MCP boundaries, public `/` and `/health`, login, and registration.
- Do not invoke real models, read private dotenv files, enable external networking, or use real runtime databases during tests.
- Do not push, delete or rewrite the source worktree, or broaden external capabilities.
- Local commits are authorized; before every Git write, print and verify the absolute workspace, branch, HEAD, and `git status`.

---

### Task 1: Freeze the 108-entry source inventory and create a failing completeness gate

**Files:**

- Create: `docs/migrations/2026-07-27-only-worktree-dispositions.json`
- Create: `scripts/check_migration_completeness.mjs`
- Create: `scripts/check_migration_completeness.test.mjs`
- Modify: `.github/workflows/harness.yml`

**Interfaces:**

- Consumes: source `git status --porcelain=v1 --untracked-files=all`, source file SHA-256 values, restore commit `734b0aad`.
- Produces: a 108-entry manifest and `check_migration_completeness.mjs` CLI with default CI mode and optional `--source-worktree <absolute-path>` mode.

- [ ] **Step 1: Generate the frozen inventory as test input**

Use a temporary one-off Node command to read the source status and calculate hashes without modifying the source:

```powershell
node -e "const{execFileSync}=require('node:child_process');const{createHash}=require('node:crypto');const{readFileSync,existsSync}=require('node:fs');const{join}=require('node:path');const root='D:\\workspace\\chaotang-os-harness-only-worktree';const lines=execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);const rows=lines.map(line=>{const status=line.slice(0,2).trim();const path=line.slice(3).replace(/^\"|\"$/g,'');const file=join(root,path);return{path,sourceStatus:status,sourceSha256:existsSync(file)?createHash('sha256').update(readFileSync(file)).digest('hex'):null};});console.log(JSON.stringify({count:rows.length,rows},null,2));"
```

Expected: `count` is `108`; status totals are `43 M`, `4 D`, and `61 ??`.

- [ ] **Step 2: Write negative checker tests**

`scripts/check_migration_completeness.test.mjs` must create temporary repositories/manifests and assert non-zero results for:

```js
const invalidCases = [
  "missing disposition",
  "duplicate source path",
  "count drift",
  "unknown source entry",
  "missing target path",
  "deleted source target still exists",
  "empty superseded or rejected reason",
  "source sha drift",
];
```

It must also assert that a complete 108-entry fixture exits zero in default mode and in `--source-worktree` mode.

- [ ] **Step 3: Run the checker test and verify RED**

Run:

```powershell
node --test scripts/check_migration_completeness.test.mjs
```

Expected: FAIL because `scripts/check_migration_completeness.mjs` and the manifest do not exist.

- [ ] **Step 4: Implement the manifest schema and checker**

The manifest top level must contain:

```json
{
  "sourceHead": "df037478d50f4681103a4d62de4f959e51a55856",
  "restoreCommit": "734b0aad07eb9b48469e9263e24cdd68fee1c4e4",
  "counts": {
    "total": 108,
    "modified": 43,
    "deleted": 4,
    "untracked": 61,
    "restoreIdentical": 58,
    "postRestoreModified": 37,
    "dirtyOnlyAdded": 13
  },
  "canonicalInventorySha256": "the lowercase SHA-256 of the canonical JSON serialization of entries",
  "entries": []
}
```

Each entry must have `path`, `sourceStatus`, `sourceLayer`, `sourceSha256`, `disposition`, `targetPaths`, `reason`, and `verification`. The checker must reject unknown keys, duplicate paths, wrong counts, missing targets, surviving targets for source deletions, generic/empty rejection reasons, and source SHA drift.

- [ ] **Step 5: Add the checker to CI and verify GREEN**

Add these commands to the harness job:

```yaml
- run: node --test scripts/check_migration_completeness.test.mjs
- run: node scripts/check_migration_completeness.mjs
```

Run:

```powershell
node --test scripts/check_migration_completeness.test.mjs
node scripts/check_migration_completeness.mjs --source-worktree D:\workspace\chaotang-os-harness-only-worktree
```

Expected: tests PASS; the live-source check remains RED until Tasks 2-7 have assigned valid target dispositions.

---

### Task 2: Recover shared court visuals, reply projection, fidelity assets, and the latest Study workspace

**Files:**

- Create from the source snapshot: `frontend/src/features/court-replies/replyFeed.ts`
- Create from the source snapshot: `frontend/src/features/court-replies/replyFeed.test.ts`
- Create from the source snapshot: `frontend/src/features/court-visuals/`
- Create from the source snapshot: `frontend/src/features/study-visual/`
- Create from the source snapshot: `frontend/src/app/globals.css`
- Copy from the source snapshot: `frontend/public/assets/zhuangyuan/04-zhuangyuan-new.webp`
- Copy from the source snapshot: `frontend/public/shangshufang/portrait-chancellor.webp`
- Copy from the source snapshot: `frontend/public/shangshufang/portrait-wang.webp`
- Modify semantically: `frontend/src/app/layout.tsx`
- Modify semantically: `frontend/src/app/study/StudyClient.tsx`
- Modify semantically: `frontend/src/app/study/StudyClient.test.ts`
- Modify semantically: `frontend/src/app/study/study.module.css`
- Modify semantically: `frontend/src/components/chaotang/ChaotangHeader.tsx`
- Modify semantically: `frontend/src/components/chaotang/ChaotangHeader.module.css`
- Modify semantically: `frontend/src/components/chaotang/CourtShell.tsx`
- Modify semantically: `frontend/src/components/chaotang/CourtShell.module.css`

**Interfaces:**

- Consumes: target `DecreeUiState`, target `/api/decrees/chancellor`, `ShiguanArchive`, and `requireUser("/study")`.
- Produces: fail-closed `toReplyCaseView`, `ImmersiveCourtShell`, `CourtQuickDock`, `EdictStage`, and the latest `DevStudyWorkspace`.

- [ ] **Step 1: Copy only the source tests and run them RED**

Copy the relevant `*.test.ts` files using explicit file paths, then run:

```powershell
cd frontend
node --test src/features/court-replies/replyFeed.test.ts src/features/court-visuals/courtVisuals.test.ts src/features/court-visuals/edict/EdictStage.test.ts src/features/study-visual/DevStudyWorkspace.test.ts
```

Expected: FAIL because the corresponding implementation and assets are absent.

- [ ] **Step 2: Recover the source implementations and assets**

Use `Copy-Item -LiteralPath` for each file represented in the manifest. Create destination directories first. Do not copy source `auth`, `backendClient.ts`, route handlers, or private/runtime files.

`replyFeed.ts` must retain this fail-closed boundary:

```ts
if (
  archive.type !== "REPLY" ||
  !archive.participatingDepartments?.length ||
  !archive.replyProcess ||
  !archive.replyConclusion ||
  !archive.replyTime ||
  !archive.respondent
) {
  return null;
}
```

- [ ] **Step 3: Merge the target contracts into the recovered Study client**

`StudyClient.tsx` remains the only request owner and must render:

```tsx
<DevStudyWorkspace
  decreeText={decreeText}
  uiState={uiState}
  canEdit={canEdit}
  canSubmit={canSubmit}
  onDecreeTextChange={setDecreeText}
  onSubmit={() => void handleSubmitDecree()}
/>
```

It must keep the existing same-origin POST, 401 allowlisted login redirect, complete target response decoder, cost warning, and no automatic submission.

- [ ] **Step 4: Verify shared visuals and Study**

Run:

```powershell
cd frontend
node --test src/features/court-replies/replyFeed.test.ts src/features/court-visuals/courtVisuals.test.ts src/features/court-visuals/edict/EdictStage.test.ts src/features/study-visual/DevStudyWorkspace.test.ts src/app/study/StudyClient.test.ts src/app/study/decreeStatus.test.ts
npm run lint
npm run typecheck
```

Expected: PASS; no source runtime code contains `BACKEND_BASE_URL`, `ownerId`, `subscribeCourtStream`, `BattleStream`, or `/api/court`.

---

### Task 3: Migrate Dadian with abortable, generation-gated overview loading

**Files:**

- Create from source: `frontend/src/app/dadian/DadianOverviewController.ts`
- Create from source: `frontend/src/app/dadian/DadianOverviewController.test.ts`
- Create from source: `frontend/src/app/api/dadian/overview/route.test.ts`
- Create from source: `frontend/src/features/dadian-visual/DadianScene.tsx`
- Create from source: `frontend/src/features/dadian-visual/DadianScene.module.css`
- Create from source: `frontend/src/features/dadian-visual/DadianScene.test.ts`
- Modify semantically: `frontend/src/app/dadian/DadianOverviewClient.tsx`
- Modify semantically: `frontend/src/app/dadian/dadian.module.css`
- Modify semantically: `frontend/src/app/dadian/page.tsx`
- Preserve: `frontend/src/app/api/dadian/overview/route.ts`

**Interfaces:**

- Consumes: target `getDadianOverview(options): Promise<ShiguanResult<DadianOverview>>` and authenticated BFF route.
- Produces: `DadianOverviewController` with `load`, `retry`, `abort`, and generation-based stale response suppression.

- [ ] **Step 1: Install the recovered tests and verify RED**

Run:

```powershell
cd frontend
node --test src/app/api/dadian/overview/route.test.ts src/app/dadian/DadianOverviewController.test.ts src/features/dadian-visual/DadianScene.test.ts
```

Expected: FAIL before the controller and scene are present.

- [ ] **Step 2: Recover controller and scene, then adapt the transport**

The client transport must call the target BFF only:

```ts
fetch(`/api/dadian/overview?${query}`, { method: "GET", signal })
```

Preserve the target route's cookie/Bearer forwarding. A new load must abort the old request and increment a generation; only the active generation may update state.

- [ ] **Step 3: Verify Dadian**

Run:

```powershell
cd frontend
node --test src/app/api/dadian/overview/route.test.ts src/app/dadian/DadianOverviewController.test.ts src/features/dadian-visual/DadianScene.test.ts
npm run lint
npm run typecheck
```

Expected: PASS for filter encoding, abort, retry, 401 redirect, malformed payload, last-known-good, and stale-response cases.

---

### Task 4: Replace Junjichu and all ministry placeholders with read-only REPLY views

**Files:**

- Create from source: `frontend/src/features/junjichu-visual/`
- Create from source: `frontend/src/features/ministries-visual/`
- Modify: `frontend/src/app/junjichu/page.tsx`
- Modify: `frontend/src/app/liubu/page.tsx`
- Modify: `frontend/src/app/liubu/[code]/page.tsx`
- Modify: `frontend/src/app/liubu/[code]/[office]/page.tsx`
- Modify: `frontend/src/app/court-entry-pages.test.ts`
- Delete after GREEN: `frontend/src/features/department-demo/DepartmentDemoViews.tsx`
- Delete after GREEN: `frontend/src/features/department-demo/departmentDemo.module.css`
- Delete after GREEN: `frontend/src/features/department-demo/departmentDemoData.ts`
- Delete after GREEN: `frontend/src/features/department-demo/departmentDemoData.test.ts`

**Interfaces:**

- Consumes: `ReplyCaseView[]` from Task 2, `GET /api/shiguan/archives?type=REPLY&limit=100`, and target `requireUser`.
- Produces: `JunjichuClient`, `JunjichuController`, six-department/39-office directory, route resolver, and ministries controller.

- [ ] **Step 1: Update route guards and run RED**

The route test must assert:

```ts
assert.match(junjichuSource, /JunjichuClient/);
assert.doesNotMatch(junjichuSource, /CourtPlaceholderPage/);
assert.match(liubuSources, /MinistryOverviewClient|resolveMinistryRoute/);
assert.doesNotMatch(liubuSources, /department-demo|DepartmentDemo/);
```

Run:

```powershell
cd frontend
node --test src/app/court-entry-pages.test.ts
```

Expected: FAIL against the current placeholder/demo routes.

- [ ] **Step 2: Recover Junjichu and verify its controller**

Keep `requireUser("/junjichu")`. The client may perform only a GET to the Shiguan BFF and must implement abort, retry, generation gating, and 401 redirect.

Run:

```powershell
node --test src/features/junjichu-visual/junjichuController.test.ts src/features/junjichu-visual/JunjichuScene.test.ts
```

Expected: PASS.

- [ ] **Step 3: Recover ministries and verify the authoritative directory**

The directory test must assert exactly six departments and 39 unique compound office identities, matching `backend/app/agents/bureaus/profiles.py`. Unknown or cross-department slugs must call `notFound()` after authentication.

Run:

```powershell
node --test src/features/ministries-visual/departmentDirectory.test.ts src/features/ministries-visual/ministryRouteResolver.test.ts src/features/ministries-visual/ministriesController.test.ts src/features/ministries-visual/ministriesVisual.test.ts
```

Expected: PASS.

- [ ] **Step 4: Delete department-demo and verify all routes**

Delete the four explicit files only after no imports remain.

Run:

```powershell
rg -n "department-demo|DepartmentDemo|demoTasks|CourtPlaceholderPage" src/app/junjichu src/app/liubu src/features/junjichu-visual src/features/ministries-visual
node --test src/app/court-entry-pages.test.ts
npm run lint
npm run typecheck
```

Expected: `rg` has no matches and all checks PASS.

---

### Task 5: Migrate Shiguan controller and workspace without dropping evidence references

**Files:**

- Create from source: `frontend/src/app/shiguan/shiguanController.ts`
- Create from source then extend: `frontend/src/app/shiguan/shiguanPayload.ts`
- Create from source: `frontend/src/app/shiguan/shiguanController.test.ts`
- Create from source then extend: `frontend/src/app/shiguan/shiguanPayload.test.ts`
- Create from source: `frontend/src/features/shiguan-visual/`
- Modify semantically: `frontend/src/app/shiguan/ShiguanClient.tsx`
- Modify semantically: `frontend/src/app/shiguan/ShiguanClient.visual.test.ts`
- Modify semantically: `frontend/src/app/shiguan/archiveStatus.ts`
- Modify semantically: `frontend/src/app/shiguan/archiveStatus.test.ts`
- Modify semantically: `frontend/src/app/shiguan/shiguan.module.css`
- Preserve: `frontend/src/lib/backendClient.ts`
- Preserve: `frontend/src/app/api/shiguan/`

**Interfaces:**

- Consumes: target `ShiguanArchive`, `ShiguanEvidenceReference`, and existing authenticated BFF routes.
- Produces: strict payload parsing plus controller-managed archives/statistics/recall/review state.

- [ ] **Step 1: Add target evidence cases to the recovered payload tests and run RED**

The legal archive fixture must include:

```ts
evidenceReferences: [{
  packId: "pack-1",
  investigationId: "investigation-1",
  evidenceId: "evidence-1",
  ordinal: 0,
  snapshotHash: "a".repeat(64),
  snapshot: {
    evidenceId: "evidence-1",
    factKey: "last_price",
    category: "MARKET_DATA",
    dataScope: "PUBLIC",
    subject: "002594.SZ",
    jurisdiction: "CN",
    sourceType: "MCP",
    sourceUrl: "https://example.invalid/evidence",
    accessUrl: "https://example.invalid/audit",
    accessMetadata: { serverId: "westock", toolName: "data_quote" }
  }
}]
```

The parser must reject extra fields, invalid enums/hashes, and mismatched reference/snapshot evidence IDs.

- [ ] **Step 2: Extend `parseArchive` instead of defaulting evidence away**

The exact archive key set must include `evidenceReferences`. Every reference and snapshot field is mandatory according to the target type. Never use `evidenceReferences ?? []` for malformed payloads.

- [ ] **Step 3: Recover the controller and integrate the workspace**

Archives and statistics settle independently. A failure on one side preserves the other side and its last-known-good data. Recall and review use generation gates; 401 clears expired state and navigates only to `/login?next=%2Fshiguan`.

`ShiguanArchiveDetail.tsx` must render immutable reference subject, category, data scope, source/access links, and safe MCP provenance metadata.

- [ ] **Step 4: Verify Shiguan**

Run:

```powershell
cd frontend
node --test src/app/shiguan/archiveStatus.test.ts src/app/shiguan/shiguanPayload.test.ts src/app/shiguan/shiguanController.test.ts src/app/shiguan/ShiguanClient.visual.test.ts src/features/shiguan-visual/ShiguanWorkspace.test.ts src/lib/backendClient.test.ts
npm run lint
npm run typecheck
```

Expected: PASS; evidence reference tests prove no field is silently discarded.

---

### Task 6: Cancelled — backend owner-flow repair

The original plan proposed authenticated owner propagation changes across
FastAPI, the Chancellor graph, evidence sessions, and `ShiguanSource`. The
user's final clarification narrowed this correction to UI migration only.
Therefore Task 6 is cancelled and no backend code/tests, production BFF route,
auth, `frontend/src/lib/backendClient.ts`, or Jinyiwei production file may be
modified or migrated. Those source entries receive explicit `rejected`
dispositions in Task 8.

---

### Task 7: Repair integration routing and add route/asset migration guards

**Files:**

- Modify: `scripts/verify_integration.mjs`
- Create: `frontend/src/app/court-migration-assets.test.ts`
- Modify: `frontend/src/app/court-entry-pages.test.ts`

**Interfaces:**

- Consumes: public WelcomeGate `/`, health presentation `/health`, protected court routes, migrated controllers/scenes/assets.
- Produces: deterministic success and backend-unavailable integration checks on the correct route.

- [ ] **Step 1: Write RED route and asset guards**

The new test must assert non-empty assets and imports for Dadian, Junjichu, ministries, Shiguan, Study, `CourtQuickDock`, and `EdictStage`. It must assert the four `department-demo` files are absent.

Run:

```powershell
cd frontend
node --test src/app/court-migration-assets.test.ts src/app/court-entry-pages.test.ts
```

Expected: FAIL until all migrated targets exist and old demo files are deleted.

- [ ] **Step 2: Correct integration route assertions**

Success scenario:

```js
await assertPage("/", { contains: "WelcomeGate", excludes: "data-backend-ok" });
await assertPage("/health", { contains: 'data-backend-ok="true"' });
```

Unavailable scenario:

```js
await assertPage("/", { contains: "WelcomeGate", excludes: "data-backend-ok" });
await assertPage("/health", { contains: 'data-backend-ok="false"' });
```

Keep backend readiness probing at backend `/health`. Do not trigger decree submission, real models, or external networking.

- [ ] **Step 3: Verify guards and integration**

Run:

```powershell
cd frontend
node --test src/app/court-migration-assets.test.ts src/app/court-entry-pages.test.ts
cd ..
node scripts/verify_integration.mjs
```

Expected: all guards and both integration scenarios PASS.

---

### Task 8: Complete all dispositions, run full verification, and commit the correction

**Files:**

- Modify: `docs/migrations/2026-07-27-only-worktree-dispositions.json`
- Modify: `docs/superpowers/specs/2026-07-27-complete-only-worktree-semantic-migration-design.md`
- Modify: `docs/superpowers/plans/2026-07-27-complete-only-worktree-semantic-migration.md`
- Modify only for defects: files introduced or changed by Tasks 1-7.

**Interfaces:**

- Consumes: all migrated code, tests, source snapshot, and manifest.
- Produces: 108/108 dispositions, fresh verification evidence, and local correction commits.

- [ ] **Step 1: Finalize every manifest disposition**

Use only:

- `integrated`: target paths implement the source behavior.
- `superseded`: newer target behavior covers the source entry; give a contract-specific reason and target paths.
- `rejected`: importing the source entry would violate a named target invariant; give the precise invariant and verification.

Run:

```powershell
node scripts/check_migration_completeness.mjs --source-worktree D:\workspace\chaotang-os-harness-only-worktree
node scripts/check_migration_completeness.mjs
```

Expected: both PASS with 108 unique entries and no unknown source changes.

- [ ] **Step 2: Run the complete frontend gate**

```powershell
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all PASS.

- [ ] **Step 3: Run integration, harness, and diff gates**

```powershell
cd ..
node scripts/verify_integration.mjs
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 4: Perform independent review**

Dispatch separate specification and code-quality reviewers. Fix only findings that are reproducible against the approved spec, then rerun the affected focused tests and the full gate.

- [ ] **Step 5: Git write preflight and local commits**

Before staging:

```powershell
Resolve-Path .
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected: workspace is `D:\workspace\chaotang-os-harness-only`, branch is `harness-only`, and all changes are in the approved paths.

Stage only the UI-only Task 8 files and create a local commit. Exclude SDD
scratch files and unrelated concurrent work:

```text
docs: finalize UI-only worktree dispositions
```

Do not push.
