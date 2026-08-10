# R0-W08 Database Compatibility Amendment

| Field | Value |
| --- | --- |
| Change ID | fix-r0-w08-database-compatibility-20260807 |
| Base | `cfacf9536251e9578a0ed85b19fbfdfbeab134a7` |
| Owner | EXT Master Governance / W08 Backend Compatibility |
| Status | CANDIDATE_VERIFIED / AWAITING_EXT_INTEGRATION |
| Scope | Legacy unversioned database adoption and migration-head assertions |

## Approved implementation scope

- `backend/src/schema_adoption.py`
- Focused migration/adoption tests covering the affected compatibility contract

The implementation is limited to compatibility detection and test expectations. It does not execute a migration or alter a persistent database.

## Non-goals

- No product workflow changes.
- No frontend changes.
- No real database migration.
- No deployment.
- No push.
- No operation of listener 3050.
- No integration into `feature-chaotang-ext` without a separate exact-H acceptance decision.

## Baseline evidence

- Full backend baseline: `3466 passed, 30 skipped, 12 failed`.
- The relevant failures are legacy adoption compatibility and stale migration-head assertions.
- Candidate source branch contains a narrowly matching hunk set; no branch-wide merge is permitted.

## Required exit evidence

1. Focused tests fail before the implementation hunk is applied.
2. Focused tests pass after the hunk is applied.
3. Full backend suite is rerun and any residual failures are classified.
4. `git diff --check` passes.
5. Changed paths remain within the approved implementation scope.
6. Independent read-only review records GO or the packet remains blocked.

## Current evidence

- Focused compatibility and migration tests are green.
- All three project Harness Doctors are green.
- Full backend residuals are isolated to two out-of-scope order-dependent knowledge-router logging assertions.
- Candidate review is conditional GO; this packet is not yet integrated into EXT.
