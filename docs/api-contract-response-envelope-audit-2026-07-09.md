# API Response Envelope Audit

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:40:16.166Z |
| Status | pass_with_legacy_exceptions |
| Used backend routes | 74 |
| Standard envelope routes | 67 |
| Legacy exception routes | 7 |
| Review required routes | 0 |

## Legacy Exceptions

| Route | Category | File | Frontend calls | Reason |
| --- | --- | --- | --- | --- |
| GET /api/health | health-contract-exception | backend/web/routers/health.py | 2 | Health endpoint is operational telemetry and not a page view model contract. |
| GET /api/runs/stream/{task_id} | stream-contract-exception | backend/web/routers/runs_stream.py | 1 | Runs stream endpoints expose stream/status contracts rather than the standard JSON view envelope. |
| GET /api/runs/stream/{task_id}/status | stream-contract-exception | backend/web/routers/runs_stream.py | 1 | Runs stream endpoints expose stream/status contracts rather than the standard JSON view envelope. |
| POST /api/auth/login | auth-contract-exception | backend/web/routers/auth.py | 1 | Auth endpoints intentionally return token/session-oriented response shapes consumed by auth adapters. |
| POST /api/auth/logout | auth-contract-exception | backend/web/routers/auth.py | 1 | Auth endpoints intentionally return token/session-oriented response shapes consumed by auth adapters. |
| POST /api/auth/register | auth-contract-exception | backend/web/routers/auth.py | 1 | Auth endpoints intentionally return token/session-oriented response shapes consumed by auth adapters. |
| POST /api/auth/verify-invite | auth-contract-exception | backend/web/routers/auth.py | 2 | Auth endpoints intentionally return token/session-oriented response shapes consumed by auth adapters. |

## Review Required

None.

## Policy

- Standard page/data contracts should return a parseable envelope or be adapted before reaching UI components.
- Legacy exceptions must stay documented with owner and tests; they are not permission to add frontend BFF routes.
- This audit is evidence only and does not modify UI behavior.
