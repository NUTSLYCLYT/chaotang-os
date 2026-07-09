# Tasks: feat-dadian-backend-api-alignment-20260709

## Task 1

- Goal: Implement backend-owned dadian court API contracts.
- Input: Current `/dadian` frontend calls and existing backend task/memorial helpers.
- Output: `backend/web/routers/dadian.py` plus registration in `backend/web/main.py`.
- Acceptance: New endpoints return the expected envelope and status 200.

## Task 2

- Goal: Align frontend display with backend response semantics.
- Input: `source` can be `live`, `derived`, or `unavailable`.
- Output: `ChancellorTodayCard` renders `derived` advice as backend-derived, not live.
- Acceptance: TypeScript check passes.

## Task 3

- Goal: Record cross-line ownership and validation.
- Input: Root project guardrail requirement for frontend/backend changes.
- Output: This `.harness/changes/` record.
- Acceptance: Summary, spec, tasks, and verification result are present.
