# CourtOS Fusion Plan 2026-06-18

## Scope

This plan governs fusion of the current CourtOS frontend and backend integration branches into their respective mainlines.

Frontend mainline repo:

- `/home/ubuntu/workspace/frontend/chaotang-web-lyt`
- working branch: `feat/libu-chro-cao-contract`
- backup branch: `backup/frontend-courtos-fusion-20260618`

Backend mainline repo:

- `/home/ubuntu/fe/fengQun/jiqun_ai_fresh`
- working branch: `feat/courtos-loop-harness`
- backup branch: `backup/backend-courtos-fusion-20260618`

Do not merge these branches directly into master. Split and land in ordered slices.

## Current Branch Contents

### Frontend

The frontend branch is a large CourtOS integration branch. It contains:

- CourtOS protocol assets: schemas, loops, registries, prompts, evals.
- MVP decision loop: Shangshufang intake, Junjichu review APIs, memorial generation, decision persistence, Shiguan archive APIs.
- Shangshufang and command-center UI changes.
- Boss decision loop prototype at `/prototype/boss-decision-loop`.
- Department office contracts and runtimes for Hubu, Libu, Rites, Jinyiwei, Bingbu, Xingbu, Gongbu.
- Local collaboration assets under `.claude/`.
- Jiqun reconciliation bridge for terminal backend sessions.

### Backend

The backend branch contains:

- `GET /api/runs/{run_id}/report` report packaging.
- Shangshufang deterministic loop and API.
- Swarm execution loop, schemas, skills, persistence, and tests.
- A local development health check tweak in `scripts/serve-dev.sh`.
- Golden case update marking archive retrospective as real.

## Land Order

### 1. Backend Report API

Land first because frontend report views can consume it without requiring full loop fusion.

Prepared branch:

- backend worktree: `/home/ubuntu/worktrees/jiqun-report-api`
- branch: `fusion/backend-report-api`
- commits:
  - `e562d61 feat(api): GET /api/runs/{run_id}/report`
  - `0289843 test(api): cover run report endpoint`

Candidate files:

- `web/routers/runs.py`
- related tests for run report packaging.

Required verification:

- `python3 -m pytest tests/test_*runs*` or targeted report API tests.

Verified on prepared branch:

- `python3 -m pytest tests/test_web_api.py -k "run_report or run_detail or quality or final_output"` passed, 11 selected tests.

Rollback:

- Revert the report API commit only; it should not affect loop execution.

### 2. Frontend MVP Main Loop

Land the smallest slice that makes the CourtOS MVP loop real.

Candidate areas:

- `dev/contracts/loops/court_unified_decision.loop.yaml`
- core schemas: DraftEdict, ReviewPlan, DepartmentOpinion, Evidence, Memorial, QualityGate, EmperorDecision, ShiguanArchive, EvoMap.
- `src/core/courtos/persistence/*`
- `src/lib/db/courtos-decision-store.ts`
- `/api/shangshufang/*`
- `/api/reviews/*`
- `/api/shiguan/*`
- `dev/contracts/evals/courtos_core_loop.golden.jsonl`

Required verification:

- `npm run build`
- `npm run test:courtos:mvp-api`
- `npm run eval:courtos:core`
- `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_PATH=/chaotang npx playwright test e2e/courtos-mvp-loop.spec.ts --project=chromium`

Prepared branch:

- `/home/ubuntu/worktrees/chaotang-mvp-loop`
- branch: `fusion/frontend-mvp-loop`
- commit: `495e98e feat(courtos): add MVP decision loop persistence`

Verified on prepared branch:

- `npm run test:core` passed, 108 tests.
- `npm run test:courtos:mvp-api` passed, 7 tests.
- `npm run eval:courtos:core` passed, 14 files and 5 golden cases.
- `npm run build` passed.
- `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3003 PLAYWRIGHT_BASE_PATH=/chaotang npx playwright test e2e/courtos-mvp-loop.spec.ts --project=chromium` passed, 1 test.

Rollback:

- Revert the MVP loop slice. It must not include department deep runtimes or backend reconciliation.

### 3. Backend CourtOS Loop Harness

Land after frontend MVP contracts are stable.

Candidate files:

- `src/shangshufang_loop.py`
- `src/swarm_execution_loop.py`
- `src/swarm_persistence.py`
- `web/routers/shangshufang.py`
- `web/routers/swarm_runs.py`
- `dev/contracts/loops/swarm.execution.loop.yaml`
- `dev/contracts/schemas/Swarm*.json`
- `skills/*_swarm/*`
- `tests/test_shangshufang_loop_api.py`
- `tests/test_swarm_execution_loop_api.py`

Required verification:

- `python3 -m pytest tests/test_shangshufang_loop_api.py tests/test_swarm_execution_loop_api.py`

Prepared branch:

- `/home/ubuntu/worktrees/jiqun-loop-harness`
- branch: `fusion/backend-loop-harness`
- base: `fusion/backend-report-api`
- commit: `cf5707f feat(courtos): add loop harness APIs`

Verified on prepared branch:

- `python3 -m pytest tests/test_shangshufang_loop_api.py tests/test_swarm_execution_loop_api.py` passed, 7 tests.
- `python3 -m pytest tests/test_decree_swarm_router.py tests/test_system_communication_topology.py` passed, 12 tests.
- `python3 -m pytest tests/test_web_api.py -k "run_report or run_detail or quality or final_output or shangshufang or swarm"` passed, 11 selected tests.

Rollback:

- Revert this backend loop harness slice. Keep report API if already green.

### 4. Frontend Shangshufang Experience And Prototype

Land user-facing CourtOS entry after MVP APIs are stable.

Candidate files:

- `src/features/shangshufang/ShangshufangPage.tsx`
- `src/app/(dashboard)/prototype/boss-decision-loop/page.tsx`
- `e2e/boss-decision-loop-prototype.spec.ts`
- `e2e/courtos-mvp-loop.spec.ts`

Required verification:

- `npm run build`
- `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_PATH=/chaotang npx playwright test e2e/courtos-mvp-loop.spec.ts e2e/boss-decision-loop-prototype.spec.ts --project=chromium`

Prepared branch:

- `/home/ubuntu/worktrees/chaotang-shangshufang-experience`
- branch: `fusion/frontend-shangshufang-experience`
- base: `fusion/frontend-mvp-loop`
- commit: `50301fe feat(shangshufang): add MVP decision prototype`

Verified on prepared branch:

- `npm run build` passed.
- `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3004 PLAYWRIGHT_BASE_PATH=/chaotang npx playwright test e2e/courtos-mvp-loop.spec.ts e2e/boss-decision-loop-prototype.spec.ts --project=chromium` passed, 2 tests.

Rollback:

- Revert UI/prototype slice. MVP APIs should remain intact.

### 5. Department Contract Assets

Land contracts before runtimes.

Candidate areas:

- `config/*office*.registry.yaml`
- `config/*complexity_profiles.yaml`
- `config/ministry_output_contracts.yaml`
- `dev/contracts/schemas/*`
- `dev/contracts/loops/*office*.loop.yaml`
- `dev/contracts/loops/*adaptive*.loop.yaml`
- `dev/contracts/prompts/departments/*`
- `dev/contracts/evals/*office*.golden.jsonl`
- `dev/contracts/evals/*adaptive*.golden.jsonl`
- `scripts/validate-*-contracts.mjs`
- `scripts/validate-*-adaptive.mjs`

Required verification:

- `npm run eval:hubu`
- `npm run eval:libu`
- `npm run eval:rites`
- `npm run eval:jinyiwei`
- `npm run eval:bingbu`
- `npm run eval:xingbu`
- `npm run eval:gongbu`
- `npm run eval:ministry-output`

Prepared branch:

- `/home/ubuntu/worktrees/chaotang-department-contracts`
- branch: `fusion/frontend-department-contracts`
- base: `fusion/frontend-shangshufang-experience`
- commit: `d4dce6b feat(courtos): add department contract assets`

Verified on prepared branch:

- `npm run eval:hubu` passed, 16 files and 5 golden cases.
- `npm run eval:libu` passed, 20 files and 20 golden cases.
- `npm run eval:rites` passed, 19 files and 20 golden cases.
- `npm run eval:jinyiwei` passed, 24 files and 20 golden cases.
- `npm run eval:bingbu` passed, 23 files and 20 golden cases.
- `npm run eval:xingbu` passed, 21 files and 20 golden cases.
- `npm run eval:gongbu` passed, 21 files and 20 golden cases.
- `npm run eval:ministry-output` passed, 8 files and 5 golden cases.
- Additional guard checks passed: `eval:libu:adaptive`, `eval:rites:adaptive`, `eval:jinyiwei:adaptive`, `eval:bingbu:adaptive`, `eval:xingbu:adaptive`, `eval:courtos:core`, `test:core`, `test:courtos:mvp-api`, and `build`.

Rollback:

- Revert affected department contract slice. Do not touch MVP loop.

### 6. Department Runtime Slices

Land one department runtime at a time.

Candidate areas:

- `src/core/courtos/hubu/*`
- `src/core/courtos/libu/*`
- `src/core/courtos/rites/*`
- `src/core/courtos/jinyiwei/*` if present later
- `src/core/courtos/bingbu/*`
- `src/core/courtos/xingbu/*`
- `src/core/courtos/gongbu/*`

Required verification:

- Department-specific nodetests.
- `npm run test:core`
- relevant golden evals.

Prepared first runtime slice:

- department: 户部 CFO Office
- `/home/ubuntu/worktrees/chaotang-hubu-runtime`
- branch: `fusion/frontend-hubu-runtime`
- base: `fusion/frontend-department-contracts`
- commit: `b961872 feat(courtos): add hubu CFO runtime`

Verified on prepared branch:

- `node --experimental-strip-types --test src/core/courtos/hubu/hubu-cfo-office.nodetest.ts` passed, 9 tests.
- `npm run eval:hubu` passed.
- `npm run test:core` passed, 117 tests.
- `npm run test:courtos:mvp-api` passed, 7 tests.
- `npm run build` passed.

Rollback:

- Revert only the department runtime slice.

### 7. Frontend/Backend Reconciliation Bridge

Land after backend terminal session APIs are stable.

Candidate frontend files:

- `src/lib/server/jiqun-reconcile.ts`
- `src/app/api/court/shangshufang/reconcile-jiqun/route.ts`
- `src/app/api/court/shangshufang/briefing/route.ts`

Required verification:

- A mocked terminal session test for reconcile.
- `npm run build`
- `npm run test:courtos:mvp-api`

Rollback:

- Disable reconciliation call in briefing and keep explicit manual endpoint disabled.

## Items Not To Land By Default

- `.claude/*` local collaboration assets unless explicitly accepted as repo assets.
- Temporary patch scripts such as `_patch_golden.py`.
- Local-only dev environment changes unless documented and reversible.
- Large formatting-only golden rewrites unless paired with a behavioral reason.

## Gate Checklist Before Each Merge

- Worktree clean.
- Branch rebased or merged with latest `origin/master`.
- Diff reviewed by category.
- Tests listed in the relevant phase pass.
- No temporary scripts or local secrets.
- No raw DEMO/FALLBACK source labels exposed as final user-facing certainty.
- Rollback commit boundary is clear.
