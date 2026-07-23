# Decision 0019: Authenticated user isolation

## Status

Accepted — 2026-07-23

## Context

The local MVP now has accounts, protected `/study` and `/shiguan` flows, and
SQLite-backed archives.  Authentication and ownership must be enforced by the
server, rather than inferred from a browser route, request parameter, or
client-side state.

## Decision

- FastAPI is the authority for local users, password verification, opaque
  sessions, and the authenticated owner used by decree and archive operations.
  Protected endpoints receive `CurrentUser`, which resolves the active session
  through `require_current_user`; clients never send or select an owner ID.
- Next.js is a same-origin BFF.  It stores the opaque session only as the
  `courtos_session` cookie (`HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure`
  in production), then forwards it to FastAPI only from server-side route
  handlers.  Browser JavaScript never receives a usable session token.
- Sessions are random opaque identifiers stored in SQLite.  Logout revokes the
  presented session at FastAPI and clears the BFF cookie; a revoked or expired
  session is rejected with 401 even if an old cookie is replayed.
- Every archive/decree read, write, review, statistic, and recall operation is
  scoped by the authenticated user ID.  A row owned by another user is treated
  as absent (404 where an individual archive is addressed).  Existing rows
  without `owner_user_id` remain retained in SQLite but are invisible to every
  account; this change does not guess an owner or migrate legacy rows.
- `GET /health`, the welcome page, registration, and login remain public.
  `/study`, `/shiguan`, and their protected BFF routes require a valid session.

## Alternatives rejected

- **JWTs:** rejected for this local MVP because server-side logout/revocation
  would require a separate deny-list lifecycle.  SQLite-backed opaque sessions
  make revocation immediate and keep credential semantics in one authority.
- **Frontend-only authentication or owner filtering:** rejected because a
  caller could bypass the UI/BFF or choose a different owner in an HTTP
  request.  Only FastAPI's authenticated session context is trusted.

## Consequences

- The BFF must preserve cookie flags and may not expose a backend URL, password
  hash, or session identifier to browser code.
- New protected FastAPI routes must declare `CurrentUser`/`require_current_user`
  and pass its ID into owner-scoped storage calls.  New public routes require an
  explicit decision and tests.
- Local two-account verification must use an injected graph response; it must
  not make a real DeepSeek request.

## Verification

- `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_auth_api.py`
  includes a source assertion that `/health` remains unauthenticated and all
  current decree/史馆 handlers declare `CurrentUser`.
- Full backend/frontend/harness verification and the two-account local BFF
  smoke scenario are recorded in `.superpowers/sdd/task-6-report.md`.
