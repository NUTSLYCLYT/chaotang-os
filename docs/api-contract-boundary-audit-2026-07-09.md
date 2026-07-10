# API Contract Boundary Audit

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:59:54.014Z |
| Status | pass_with_warnings |
| Frontend BFF violations | 0 |
| UI layer violations | 0 |
| Known workspace UI issues | 2 |
| Inaccessible frontend paths | 0 |

## Findings

| Severity | Code | Path | Details |
| --- | --- | --- | --- |
| warning | KNOWN_WORKSPACE_UI_ISSUE | frontend/src/features/bingbu/components/bingbu-quotation-verdict-panel.tsx | Pre-existing deleted/permission-denied UI path is still present in git status. |
| warning | KNOWN_WORKSPACE_UI_ISSUE | frontend/src/features/hubu/components/hubu-finance-preview-panel.tsx | Pre-existing deleted/permission-denied UI path is still present in git status. |

## Changed Files

| Status | Path | UI | BFF | Known issue |
| --- | --- | --- | --- | --- |
|  M | backend/tests/test_contract_alignment_p0.py | false | false | false |
|  M | docs/api-contract-alias-retirement-audit-2026-07-09.json | false | false | false |
|  M | docs/api-contract-alias-retirement-audit-2026-07-09.md | false | false | false |
|  M | docs/api-contract-all-matrix-audit-2026-07-09.json | false | false | false |
|  M | docs/api-contract-all-matrix-audit-2026-07-09.md | false | false | false |
|  M | docs/api-contract-boundary-audit-2026-07-09.json | false | false | false |
|  M | docs/api-contract-boundary-audit-2026-07-09.md | false | false | false |
|  M | docs/api-contract-client-layer-audit-2026-07-09.json | false | false | false |
|  M | docs/api-contract-client-layer-audit-2026-07-09.md | false | false | false |
|  M | docs/api-contract-exact-test-audit-2026-07-09.json | false | false | false |
|  M | docs/api-contract-exact-test-audit-2026-07-09.md | false | false | false |
|  M | docs/api-contract-implementation-audit-2026-07-09.json | false | false | false |
|  M | docs/api-contract-implementation-audit-2026-07-09.md | false | false | false |
|  M | docs/api-contract-inventory-2026-07-09.json | false | false | false |
|  M | docs/api-contract-inventory-2026-07-09.md | false | false | false |
|  M | docs/api-contract-openapi-2026-07-09.json | false | false | false |
|  M | docs/api-contract-p0-matrix-audit-2026-07-09.json | false | false | false |
|  M | docs/api-contract-p0-matrix-audit-2026-07-09.md | false | false | false |
|  M | docs/api-contract-response-envelope-audit-2026-07-09.json | false | false | false |
|  M | docs/api-contract-response-envelope-audit-2026-07-09.md | false | false | false |
|  M | docs/api-contract-route-snapshot-2026-07-09.json | false | false | false |
|  M | docs/api-contract-source-label-audit-2026-07-09.json | false | false | false |
|  M | docs/api-contract-source-label-audit-2026-07-09.md | false | false | false |
|  M | docs/api-contract-stability-report-2026-07-09.json | false | false | false |
|  M | docs/api-contract-stability-report-2026-07-09.md | false | false | false |
|  D | frontend/src/features/bingbu/components/bingbu-quotation-verdict-panel.tsx | true | false | true |
|  D | frontend/src/features/hubu/components/hubu-finance-preview-panel.tsx | true | false | true |
|  M | frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts | false | false | false |
|  M | scripts/api-contract-implementation-audit.mjs | false | false | false |
| ?? | backend/knowledge/docs/ima_archived/ | false | false | false |
| ?? | backend/knowledge/docs/ima_uploads/ | false | false | false |

## Policy

- This audit checks the implementation boundary for the frontend-backend contract alignment plan.
- It must not be used to prove browser UX quality.
- Known workspace UI issues are reported separately and do not authorize new UI edits.
- Missing backend capabilities must be implemented in backend routes or existing transport aliases, not new frontend BFF routes.
