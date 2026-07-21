# API Contract Stability Report

| Field | Value |
| --- | --- |
| Generated at | 2026-07-21T09:57:11.444Z |
| Status | pass |
| Diff mode | baseline_created |
| Route count | 352 |
| Breaking changes | 0 |
| Warnings | 1 |

## Artifacts

- `docs/api-contract-openapi-2026-07-21.json`
- `docs/api-contract-route-snapshot-2026-07-21.json`
- `frontend/src/lib/contracts/backend-openapi-2026-07-21.d.ts`

## Breaking Changes

None.

## Warnings

| Type | Key |
| --- | --- |
| warning | No previous route snapshot was found; current snapshot is the baseline for future diffs. |

## CI Policy

- Run `node scripts/api-contract-stability.mjs` after backend route or response model changes.
- A removed route, removed response status, or changed response schema signature is reported as breaking.
- The generated TypeScript declaration is a contract snapshot for frontend adapters; it is not UI code and must not be used to add a frontend BFF.
