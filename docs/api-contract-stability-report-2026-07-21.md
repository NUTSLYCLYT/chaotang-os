# API Contract Stability Report

| Field | Value |
| --- | --- |
| Generated at | 2026-07-21 |
| Status | pass |
| Diff mode | fixed_ref_diff |
| Baseline ref | ed822255a452e8dd8dda8f86a180fd7c099b181e |
| Baseline source | git_archive_generated_openapi |
| Baseline routes | 361 |
| Baseline schemas | 184 |
| Route count | 362 |
| Breaking changes | 0 |
| Warnings | 10 |

## Artifacts

- `docs/api-contract-openapi-2026-07-21.json`
- `docs/api-contract-route-snapshot-2026-07-21.json`
- `frontend/src/lib/contracts/backend-openapi-2026-07-21.d.ts`

## Breaking Changes

None.

## Warnings

| Type | Key |
| --- | --- |
| route_added | GET /api/contracts/tasks/{task_id}/read-model |
| component_optional_properties_added | ContractReviewPackV1 |
| component_schema_added | ArchiveReceiptV1 |
| component_schema_added | ContractTaskBlockerV1 |
| component_schema_added | ContractTaskIdentityV1 |
| component_schema_added | ContractTaskReadModelV1 |
| component_schema_added | FinalMemorialIdentityV1 |
| component_schema_added | MissionSnapshotViewV1 |
| component_schema_added | PublicArtifactDeliveryV1 |
| component_schema_added | PublicArtifactItemV1 |

## CI Policy

- Run `node scripts/api-contract-stability.mjs` after backend route or response model changes.
- The baseline is generated from immutable Git ref `ed822255a452e8dd8dda8f86a180fd7c099b181e`; generated outputs are never reused as their own baseline.
- A removed route, removed response status, changed response schema signature, or changed/removed component schema is reported as breaking.
- The generated TypeScript declaration is a contract snapshot for frontend adapters; it is not UI code and must not be used to add a frontend BFF.
