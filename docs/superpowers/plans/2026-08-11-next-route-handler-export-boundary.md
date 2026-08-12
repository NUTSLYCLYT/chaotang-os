# Next Route Handler Export Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Next.js `route.ts` export only framework-supported symbols while retaining dependency-injected unit tests.

**Architecture:** Move each `create*Handler` factory and its private implementation into an adjacent `handler.ts`. Keep `route.ts` as a minimal adapter that imports the factory and exports only `GET`, `POST`, or other allowed route symbols.

**Tech Stack:** Next.js 16.2, TypeScript, Node 24 test runner, ESLint.

## Global Constraints

- Preserve every existing URL, HTTP method, request/response contract, auth boundary and error mapping.
- Use relative imports with explicit `.ts` extensions in Node-tested modules.
- Do not call real backends, models, external network or production storage.
- Do not commit, push or deploy without separate authorization.
- Any implementation or acceptance-flow change resets the 10-round final acceptance count.

---

### Task 1: Add the route export guard

**Files:**
- Create: `frontend/src/app/api/routeExports.test.ts`

**Interfaces:**
- Consumes: recursive `src/app/api/**/route.ts` source files.
- Produces: a deterministic failure listing route files that export `create*Handler` factories.

- [ ] Create a Node test that walks from `new URL("./", import.meta.url)`, reads each `route.ts`, and asserts the source does not match `/^export\s+(?:async\s+)?(?:function|const)\s+create\w+Handler\b/m`.
- [ ] Run `node --test src/app/api/routeExports.test.ts`; expect FAIL and a list containing all 17 current offenders.

### Task 2: Split daily memorial and decree handlers

**Files:**
- Create/modify adjacent `handler.ts`, `route.ts`, and `route.test.ts` for:
  - `frontend/src/app/api/daily-memorial-drafts/[id]/confirm/`
  - `frontend/src/app/api/daily-memorial-drafts/latest/`
  - `frontend/src/app/api/decree-jobs/[id]/cancel/`
  - `frontend/src/app/api/decree-jobs/[id]/`
  - `frontend/src/app/api/decrees/chancellor/`

**Interfaces:**
- `handler.ts` exports the existing factory name and signature.
- `route.ts` imports that factory and exports only the existing HTTP method.

- [ ] Move factory implementation without semantic edits; update tests to import `./handler.ts`.
- [ ] Run the five affected test files; expect PASS.
- [ ] Run the export guard; expect only the remaining 12 routes to fail.

### Task 3: Split Jinyiwei and Junjichu handlers

**Files:**
- Create/modify adjacent `handler.ts`, `route.ts`, and tests for:
  - `frontend/src/app/api/jinyiwei/investigations/[id]/`
  - `frontend/src/app/api/jinyiwei/investigations/`
  - `frontend/src/app/api/jinyiwei/summary/`
  - `frontend/src/app/api/junjichu/cases/`

**Interfaces:** Same factory signatures and HTTP methods as before.

- [ ] Move the four factories without changing validation or sanitization; update test imports.
- [ ] Run the four affected test files; expect PASS.
- [ ] Run the export guard; expect only the remaining 8 routes to fail.

### Task 4: Split Qintian handlers

**Files:**
- Create/modify adjacent `handler.ts` and `route.ts` for:
  - `frontend/src/app/api/qintianjian/consult/`
  - `frontend/src/app/api/qintianjian/forecasts/[id]/reviews/`
  - `frontend/src/app/api/qintianjian/forecasts/[id]/`
  - `frontend/src/app/api/qintianjian/forecasts/`
  - `frontend/src/app/api/qintianjian/triggers/pending/`
- Modify: `frontend/src/app/api/qintianjian/qintianRoutes.test.ts`

**Interfaces:** Same six factory exports, including both GET and POST factories for forecasts.

- [ ] Move factories without semantic edits and update the consolidated test imports.
- [ ] Run `node --test src/app/api/qintianjian/qintianRoutes.test.ts`; expect PASS.
- [ ] Run the export guard; expect only the three report artifact routes to fail.

### Task 5: Split report artifact handlers and reach GREEN

**Files:**
- Create/modify adjacent `handler.ts`, `route.ts`, and `route.test.ts` for:
  - `frontend/src/app/api/report-artifacts/[id]/confirmation/`
  - `frontend/src/app/api/report-artifacts/[id]/`
  - `frontend/src/app/api/report-artifacts/[id]/work-product/`

**Interfaces:** Same POST/GET factories and download/confirmation contracts as before.

- [ ] Move the three factories without semantic edits and update test imports.
- [ ] Run the three affected test files; expect PASS.
- [ ] Run `node --test src/app/api/routeExports.test.ts`; expect PASS with zero illegal exports.

### Task 6: Full validation and resumed decree acceptance

**Files:**
- Modify: `docs/product/tasks/2026-08-11-fix-decree-worker-no-reply.md`

**Interfaces:** Produces fresh verification evidence for the original user-visible bug and the build-boundary fix.

- [ ] Run frontend `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`; expect exit 0.
- [ ] Run backend full pytest, Ruff and compileall; expect exit 0.
- [ ] Run all four harness commands and `git diff --check`; expect exit 0.
- [ ] Execute the unchanged final acceptance round 10 consecutive times and record every round.
- [ ] Update the product task Implementation Report and Acceptance Review.

## Self-Review

- Coverage: all 17 illegal route exports are assigned exactly once across Tasks 2–5.
- Placeholder scan: no deferred implementation remains; every task has exact paths and commands.
- Type consistency: factory names and signatures remain unchanged; only import locations change.
