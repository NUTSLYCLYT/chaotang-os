# API Alias Retirement Audit

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:40:32.883Z |
| Status | pass |
| PATH_ALIAS calls | 16 |
| Alias groups | 4 |
| Tested groups | 4 |
| Review required | 0 |

## Alias Groups

| Group | Status | Owner | Retire when | Calls | Transport test evidence |
| --- | --- | --- | --- | --- | --- |
| /api/court/court-session/latest | complete | backend/web/routers/court_session.py | court session callers use /api/court-session/latest directly | 1 | frontend/src/lib/backend-api.nodetest.ts |
| /api/court/legal/overview | complete | backend/web/routers/legal.py | legal overview callers use /api/legal/overview directly | 1 | frontend/src/lib/backend-api.nodetest.ts |
| /api/court/shangshufang/* | complete | backend/web/routers/shangshufang.py | inventory has no /api/court/shangshufang/* frontend callers | 13 | frontend/src/lib/backend-api.nodetest.ts |
| /api/court/swarm/roster | complete | backend/web/routers/swarm.py | swarm roster callers use /api/swarm/roster directly | 1 | frontend/src/lib/backend-api.nodetest.ts |

## Review Required

None.

## Policy

- PATH_ALIAS is allowed only as a temporary transport-layer compatibility rule.
- Every alias must have owner, canonical backend route, verification commands and a retirement condition.
- This audit does not edit UI files and does not add frontend BFF routes.
