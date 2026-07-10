# API Contract Stability Report

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:40:46.556Z |
| Status | pass |
| Diff mode | diff_checked |
| Route count | 297 |
| Breaking changes | 0 |
| Warnings | 0 |

## Artifacts

- `docs/api-contract-openapi-2026-07-09.json`
- `docs/api-contract-route-snapshot-2026-07-09.json`
- `frontend/src/lib/contracts/backend-openapi-2026-07-09.d.ts`

## Breaking Changes

None.

## Warnings

None.

## CI Policy

- Run `node scripts/api-contract-stability.mjs` after backend route or response model changes.
- A removed route, removed response status, or changed response schema signature is reported as breaking.
- The generated TypeScript declaration is a contract snapshot for frontend adapters; it is not UI code and must not be used to add a frontend BFF.
