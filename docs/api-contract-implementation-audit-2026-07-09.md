# API Contract Implementation Audit

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:40:33.342Z |
| Overall | in_progress |
| Done | 11 |
| Blocked | 3 |
| Missing | 0 |

## Requirements

| Phase | Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| 0 | Generate API inventory and classify MATCHED / PATH_ALIAS / SHAPE_DRIFT / MISSING_BACKEND. | done | docs/api-contract-inventory-2026-07-09.md<br>docs/api-contract-inventory-2026-07-09.json | No MISSING_BACKEND or SHAPE_DRIFT remains. |
| 0 | Freeze UI layer and avoid frontend BFF during implementation. | done | docs/api-contract-boundary-audit-2026-07-09.md<br>scripts/api-contract-boundary-audit.mjs | 0 frontend BFF changes and 0 new UI layer changes; known workspace UI issues remain warnings. |
| 1 | Record contract owner, source label policy, validation commands and P0 contract evidence. | done | frontend/.harness/wiki/api-contracts.md<br>scripts/api-contract-p0-matrix-audit.mjs<br>docs/api-contract-p0-matrix-audit-2026-07-09.md<br>backend/tests/test_contract_alignment_p0.py<br>backend/tests/test_swarm_runs_api_contract.py | 5 P0 domains have frontend contract, backend owner and test evidence. |
| 1 | Record all frontend-used API routes with contract, backend owner, tests, envelope and source evidence. | done | scripts/api-contract-all-matrix-audit.mjs<br>docs/api-contract-all-matrix-audit-2026-07-09.md<br>docs/api-contract-all-matrix-audit-2026-07-09.json<br>scripts/api-contract-exact-test-audit.mjs<br>docs/api-contract-exact-test-audit-2026-07-09.md | 74 / 74 frontend-used backend routes have complete evidence; 74 routes have exact test evidence. |
| 1 | Classify backend response envelopes and document legacy exceptions. | done | scripts/api-contract-response-envelope-audit.mjs<br>docs/api-contract-response-envelope-audit-2026-07-09.md<br>docs/api-contract-response-envelope-audit-2026-07-09.json | 67 used routes have standard envelopes; 7 legacy exceptions are documented; 0 review-required routes. |
| 1 | Classify source label coverage for backend routes used by the frontend. | done | scripts/api-contract-source-label-audit.mjs<br>docs/api-contract-source-label-audit-2026-07-09.md<br>docs/api-contract-source-label-audit-2026-07-09.json | 64 used routes have source evidence; 10 non-business exceptions are documented; 0 review-required routes. |
| 1 | Frontend typecheck gate. | blocked | cd frontend; npx --yes tsc --noEmit<br>docs/api-contract-boundary-audit-2026-07-09.md | Blocked by pre-existing missing/permission-denied UI modules, not by new API contract files. |
| 2 | Keep aliases centralized in frontend transport and document owner/deprecation plan. | done | frontend/src/lib/backend-api.ts<br>frontend/src/lib/backend-api.nodetest.ts<br>scripts/api-contract-alias-retirement-audit.mjs<br>docs/api-contract-alias-retirement-audit-2026-07-09.md<br>docs/api-contract-inventory-2026-07-09.md | 16 PATH_ALIAS calls across 4 groups have owner, retireWhen and transport test evidence. |
| 2 | Provide business API clients/adapters for P0 frontend domains without touching UI or adding frontend BFF. | done | frontend/src/features/dadian/api/index.ts<br>frontend/src/features/bureaus/api/index.ts<br>frontend/src/features/shangshufang/api/index.ts<br>frontend/src/features/command-center/junjichu/api/*<br>scripts/api-contract-client-layer-audit.mjs<br>docs/api-contract-client-layer-audit-2026-07-09.md | 4 / 4 required business client groups are complete; 0 review-required items. |
| 2 | Converge page/component direct API calls into business clients/adapters. | blocked | scripts/api-contract-frontend-access-audit.mjs<br>docs/api-contract-frontend-access-audit-2026-07-09.md<br>docs/api-contract-frontend-access-audit-2026-07-09.json | 30 existing API call sites still need migration, but this implementation line cannot edit UI/component callers. |
| 3 | Backend provides missing/legacy endpoints or structured errors with contract tests. | done | backend/web/routers/court_compat.py<br>backend/web/routers/orchestration_compat.py<br>backend/web/routers/governance_compat.py<br>backend/tests/test_contract_alignment_p0.py | Compatibility routes are backend-owned and return honest source labels or structured errors. |
| 3 | Run documented backend specialty contract tests and backend harness doctor. | done | cd backend; python -m pytest -q tests/test_dadian_api.py tests/test_libu_router.py tests/test_shangshufang_loop_api.py<br>cd backend; python scripts/harness_doctor.py<br>.harness/changes/docs-frontend-backend-contract-alignment-plan-20260709/ci_result/ci_summary.md | Latest recorded result: 19 passed; backend harness doctor 0 errors / 0 warnings. |
| 4 | Playwright browser closure over login, Shangshufang, Junjichu, Liubu, deep review and Dadian. | blocked | frontend/e2e/dadian-api-contract.spec.ts<br>cd frontend; npx --yes tsc --noEmit<br>cd frontend; npx playwright test e2e/dadian-api-contract.spec.ts<br>cd frontend; npx playwright test e2e/liubu-bureau-pages-smoke.spec.ts<br>cd frontend; pnpm test:e2e | P0 Dadian Playwright contract smoke exists, but browser closure is not proven because frontend typecheck/build is blocked before e2e can honestly run. |
| P2 | OpenAPI diff / generated TS types / contract-breaking CI. | done | scripts/api-contract-stability.mjs<br>docs/api-contract-openapi-2026-07-09.json<br>docs/api-contract-route-snapshot-2026-07-09.json<br>frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts<br>docs/api-contract-stability-report-2026-07-09.md | OpenAPI export, route diff snapshot and generated TypeScript contract snapshot are in place. |

## Current Blockers

| Code | Details | Evidence |
| --- | --- | --- |
| FRONTEND_TYPECHECK_BLOCKED_BY_WORKSPACE_UI_ISSUES | Two imported UI modules are deleted/permission-denied and eight frontend feature paths are inaccessible. | frontend/src/features/bingbu/components/bingbu-quotation-verdict-panel.tsx<br>frontend/src/features/hubu/components/hubu-finance-preview-panel.tsx<br>docs/api-contract-boundary-audit-2026-07-09.md |
| FRONTEND_ACCESS_CONVERGENCE_BLOCKED_BY_UI_FREEZE | 30 existing page/component/hook call sites need migration to business clients/adapters. | docs/api-contract-frontend-access-audit-2026-07-09.md<br>docs/frontend-backend-contract-alignment-plan-2026-07-09.md |

## Policy

- This audit does not replace Playwright browser verification.
- Browser completion remains unproven until frontend typecheck/build and the documented e2e commands can run.
- UI layer changes and new frontend BFF routes remain forbidden for this implementation line.
