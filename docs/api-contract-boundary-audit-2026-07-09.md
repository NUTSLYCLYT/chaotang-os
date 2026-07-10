# API Contract Boundary Audit

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:39:51.396Z |
| Status | pass_with_warnings |
| Frontend BFF violations | 0 |
| UI layer violations | 0 |
| Known workspace UI issues | 2 |
| Inaccessible frontend paths | 8 |

## Findings

| Severity | Code | Path | Details |
| --- | --- | --- | --- |
| warning | KNOWN_WORKSPACE_UI_ISSUE | frontend/src/features/bingbu/components/bingbu-quotation-verdict-panel.tsx | Pre-existing deleted/permission-denied UI path is still present in git status. |
| warning | KNOWN_WORKSPACE_UI_ISSUE | frontend/src/features/hubu/components/hubu-finance-preview-panel.tsx | Pre-existing deleted/permission-denied UI path is still present in git status. |
| warning | INACCESSIBLE_FRONTEND_PATH | frontend/src/features/bingbu/components | EPERM |
| warning | INACCESSIBLE_FRONTEND_PATH | frontend/src/features/bingbu/hooks | EPERM |
| warning | INACCESSIBLE_FRONTEND_PATH | frontend/src/features/gongbu/components | EPERM |
| warning | INACCESSIBLE_FRONTEND_PATH | frontend/src/features/gongbu/hooks | EPERM |
| warning | INACCESSIBLE_FRONTEND_PATH | frontend/src/features/hubu/components | EPERM |
| warning | INACCESSIBLE_FRONTEND_PATH | frontend/src/features/hubu/hooks | EPERM |
| warning | INACCESSIBLE_FRONTEND_PATH | frontend/src/features/libu/components | EPERM |
| warning | INACCESSIBLE_FRONTEND_PATH | frontend/src/features/lifu/components | EPERM |

## Changed Files

| Status | Path | UI | BFF | Known issue |
| --- | --- | --- | --- | --- |
|  M | backend/web/main.py | false | false | false |
|  M | backend/web/routers/auth.py | false | false | false |
|  M | backend/web/routers/chaotang.py | false | false | false |
|  M | backend/web/routers/court_session.py | false | false | false |
|  M | backend/web/routers/dadian.py | false | false | false |
|  M | backend/web/routers/dept.py | false | false | false |
|  M | backend/web/routers/legal.py | false | false | false |
|  M | backend/web/routers/metrics.py | false | false | false |
|  M | backend/web/routers/shangshufang.py | false | false | false |
|  M | backend/web/routers/swarm.py | false | false | false |
|  M | backend/web/routers/swarm_runs.py | false | false | false |
|  M | backend/web/schemas/swarm.py | false | false | false |
|  M | frontend/.harness/wiki/api-contracts.md | false | false | false |
|  M | frontend/.harness/wiki/document-index.md | false | false | false |
|  D | frontend/src/features/bingbu/components/bingbu-quotation-verdict-panel.tsx | true | false | true |
|  D | frontend/src/features/hubu/components/hubu-finance-preview-panel.tsx | true | false | true |
|  M | frontend/src/lib/backend-api.ts | false | false | false |
| ?? | .harness/changes/docs-frontend-backend-contract-alignment-plan-20260709/ | false | false | false |
| ?? | backend/tests/test_all_frontend_used_routes_exact_contract.py | false | false | false |
| ?? | backend/tests/test_contract_alignment_p0.py | false | false | false |
| ?? | backend/tests/test_court_session_api_contract.py | false | false | false |
| ?? | backend/tests/test_swarm_runs_api_contract.py | false | false | false |
| ?? | backend/web/routers/court_compat.py | false | false | false |
| ?? | backend/web/routers/governance_compat.py | false | false | false |
| ?? | backend/web/routers/orchestration_compat.py | false | false | false |
| ?? | docs/api-contract-alias-retirement-audit-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-alias-retirement-audit-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-all-matrix-audit-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-all-matrix-audit-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-boundary-audit-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-boundary-audit-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-client-layer-audit-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-client-layer-audit-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-exact-test-audit-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-exact-test-audit-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-frontend-access-audit-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-frontend-access-audit-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-implementation-audit-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-implementation-audit-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-inventory-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-inventory-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-openapi-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-p0-matrix-audit-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-p0-matrix-audit-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-response-envelope-audit-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-response-envelope-audit-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-route-snapshot-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-source-label-audit-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-source-label-audit-2026-07-09.md | false | false | false |
| ?? | docs/api-contract-stability-report-2026-07-09.json | false | false | false |
| ?? | docs/api-contract-stability-report-2026-07-09.md | false | false | false |
| ?? | docs/frontend-backend-contract-alignment-plan-2026-07-09.md | false | false | false |
| ?? | docs/shangshufang-integration-plan.md | false | false | false |
| ?? | docs/军机处-全功能三栏实施方案-2026-07-09.md | false | false | false |
| ?? | frontend/e2e/dadian-api-contract.spec.ts | false | false | false |
| ?? | frontend/src/features/bureaus/api/ | false | false | false |
| ?? | frontend/src/features/dadian/api/ | false | false | false |
| ?? | frontend/src/features/shangshufang/api/ | false | false | false |
| ?? | frontend/src/lib/backend-api.nodetest.ts | false | false | false |
| ?? | frontend/src/lib/contracts/api-envelope.ts | false | false | false |
| ?? | frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts | false | false | false |
| ?? | scripts/api-contract-alias-retirement-audit.mjs | false | false | false |
| ?? | scripts/api-contract-all-matrix-audit.mjs | false | false | false |
| ?? | scripts/api-contract-boundary-audit.mjs | false | false | false |
| ?? | scripts/api-contract-client-layer-audit.mjs | false | false | false |
| ?? | scripts/api-contract-exact-test-audit.mjs | false | false | false |
| ?? | scripts/api-contract-frontend-access-audit.mjs | false | false | false |
| ?? | scripts/api-contract-implementation-audit.mjs | false | false | false |
| ?? | scripts/api-contract-inventory.mjs | false | false | false |
| ?? | scripts/api-contract-p0-matrix-audit.mjs | false | false | false |
| ?? | scripts/api-contract-response-envelope-audit.mjs | false | false | false |
| ?? | scripts/api-contract-source-label-audit.mjs | false | false | false |
| ?? | scripts/api-contract-stability.mjs | false | false | false |

## Policy

- This audit checks the implementation boundary for the frontend-backend contract alignment plan.
- It must not be used to prove browser UX quality.
- Known workspace UI issues are reported separately and do not authorize new UI edits.
- Missing backend capabilities must be implemented in backend routes or existing transport aliases, not new frontend BFF routes.
