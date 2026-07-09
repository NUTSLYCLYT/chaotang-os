# Change Summary: feat-dadian-backend-api-alignment-20260709

| Field | Value |
| --- | --- |
| Change ID | feat-dadian-backend-api-alignment-20260709 |
| Type | feat |
| Status | DONE |
| Owner | Project Agent |
| Date | 20260709 |

## Scope

- Mainline: `/dadian` should call backend APIs directly through the frontend proxy, without restoring the old BFF layer.
- Backend source of truth: `backend/web/routers/dadian.py` owns the `/api/court/dadian/*`, `/api/court/chancellor-advice`, and `/api/court/decision-judgment` contracts.
- Frontend surface: `frontend/src/features/dadian/components/ChancellorTodayCard.tsx` accepts both live LLM advice and backend-derived advice without presenting derived output as live.
- Verification: backend contract tests, frontend TypeScript check, and browser-path proxy probes.
