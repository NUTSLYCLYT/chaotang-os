# API Contract Client Layer Audit

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:40:33.215Z |
| Status | pass |
| Required clients | 4 |
| Complete clients | 4 |
| Review required | 0 |

## Clients

| Domain | File | Status | Uses shared transport | Missing paths | Forbidden hits |
| --- | --- | --- | --- | --- | --- |
| dadian | frontend/src/features/dadian/api/index.ts | complete | true |  |  |
| bureaus | frontend/src/features/bureaus/api/index.ts | complete | true |  |  |
| shangshufang | frontend/src/features/shangshufang/api/index.ts | complete | true |  |  |
| junjichu | frontend/src/features/command-center/junjichu/api/swarm-runs.ts, frontend/src/features/command-center/junjichu/api/governance.ts, frontend/src/features/command-center/junjichu/api/archive.ts | complete | true |  |  |

## Review Required

None.

## Policy

- These files are business API clients/adapters, not UI implementation files.
- New frontend BFF routes, route handlers and server actions remain forbidden.
- New clients must use backend-owned routes or documented transport aliases.
