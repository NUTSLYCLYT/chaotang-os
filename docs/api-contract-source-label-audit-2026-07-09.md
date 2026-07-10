# API Source Label Audit

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:40:16.188Z |
| Status | pass |
| Used backend routes | 74 |
| Routes with source evidence | 64 |
| Legacy/non-business exceptions | 10 |
| Review required routes | 0 |

## Review Required

None.

## Exceptions

| Route | Category | Reason |
| --- | --- | --- |
| GET /api/court/decision-judgment | feedback-telemetry | Decision judgment endpoints record and summarize user feedback, not runtime business facts. |
| GET /api/health | health | Health telemetry is operational status, not page business data. |
| GET /api/runs/stream/{task_id} | stream | Stream/progress contracts use event/status semantics. |
| GET /api/runs/stream/{task_id}/status | stream | Stream/progress contracts use event/status semantics. |
| POST /api/auth/login | auth | Auth responses prove session state, not runtime facts. |
| POST /api/auth/logout | auth | Auth responses prove session state, not runtime facts. |
| POST /api/auth/register | auth | Auth responses prove session state, not runtime facts. |
| POST /api/auth/verify-invite | auth | Auth responses prove session state, not runtime facts. |
| POST /api/court/decision-judgment | feedback-telemetry | Decision judgment endpoints record and summarize user feedback, not runtime business facts. |
| POST /api/metrics | telemetry-ingest | Browser metrics ingestion does not return business facts. |

## Policy

- Runtime or business fact routes must expose source evidence through sourceLabel/source_label/source_mode/source fields or an adapter-owned equivalent.
- Auth, health, metrics ingestion and stream status routes may be documented exceptions.
- This audit does not change UI files and does not add frontend BFF routes.
