# Frontend second-brain archive

P4c disconnected these orphaned frontend decision/runtime writers from production on 2026-07-16.
They are retained for one version cycle only as historical/test reference; production code may not import
`dev/_attic` (enforced by `scripts/architecture-import-guard.mjs`).

Archived paths:

- `src/core/courtos/ministries/real-ministry-review.ts` → `real-ministry-review.ts`
- `src/core/courtos/runtime/live-memorial-bridge.ts` → `live-memorial-bridge.ts`
- `src/lib/db/courtos-decision-store.ts` → `courtos-decision-store.ts`

The safety knowledge that must survive removal is recorded in backend
`harness/chaotang_department_protocol/golden_cases/frontend_second_brain_distillation.json` and its test.
Do not restore these files by copying them back. A restoration requires a new reviewed change proving why
the canonical backend read model cannot serve the use case. Review expiry: 2026-08-16.
