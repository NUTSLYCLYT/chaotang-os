# Task 6 report 鈥?authenticated-user isolation documentation and verification

## Scope and assumptions

- Allowed Task 6 documentation/test paths only were changed.
- The backend and frontend were exercised locally only.  No private environment
  file was read, no external service was contacted, and no real DeepSeek model
  was invoked.
- The intended end-to-end setup used a temporary SQLite database, a loopback
  FastAPI process with `app.api.decrees.get_chancellor_graph` replaced by a
  deterministic fake graph, and a production-mode Next.js process pointing to
  that loopback backend.

## Changes made

- Added ADR 0019, documenting FastAPI as identity/owner authority, opaque
  revocable sessions, same-origin BFF cookies, owner isolation, treatment of
  legacy unowned rows, and rejected JWT/frontend-only alternatives.
- Updated `ARCHITECTURE.md`, `backend/AGENTS.md`, and `frontend/AGENTS.md` with
  the authenticated route, cookie, owner, and safe fake-graph verification
  rules.
- Added `test_public_health_and_protected_route_source_contract` to
  `backend/tests/test_auth_api.py`.  It checks that `/health` remains public
  and that the decree plus every current ShiGuan handler explicitly declares
  `CurrentUser` (the `require_current_user` dependency alias).

## Fresh verification evidence

| Command | Result |
| --- | --- |
| `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_auth_api.py` | PASS: 4 passed. |
| `backend/.venv/Scripts/python.exe -m ruff check backend` | PASS. |
| `backend/.venv/Scripts/python.exe -m pytest backend/tests` | PASS: 496 passed. |
| `frontend: npm run lint` | PASS. |
| `frontend: npm run typecheck` | PASS. |
| `frontend: npm test` | PASS: 104 passed. |
| `frontend: npm run build` | PASS; production build completed and lists protected routes. |
| `node scripts/check_harness.mjs` | PASS: 53 baseline files. |
| `git diff --check` | PASS. |

The backend test run emitted one warning: Starlette's `TestClient` reports its
`httpx` usage is deprecated.  It did not fail the suite.  `git diff --check`
also printed CRLF conversion notices for existing working-tree files, but
returned zero.

## Local BFF two-account smoke attempt

The initial smoke launcher incorrectly patched a parent interpreter rather
than the interpreter serving FastAPI.  The diagnosis in
`.superpowers/sdd/e2e-diagnosis-report.md` confirmed that this caused the
real graph factory to run and produced the earlier non-200 result; it was a
test-launcher defect, not a production defect.  That report records the
corrected same-interpreter launcher successfully returning BFF registration
201 and a fake-graph decree 200 without a model request.

This Task 6 report does not claim the remaining two-account archive and
post-logout sequence as passed until it is captured with that corrected
launcher.  The pre-existing unit/API coverage and all full checks above pass.

## Self-review

- ADR covers cookie flags, session revocation, client-owner prohibition,
  legacy-data invisibility, and the JWT/frontend-only alternatives.
- Documentation test is intentionally source-level: it guards the defined
  public exception and all presently mounted protected decree/ShiGuan handlers.
- No source implementation was altered by this task.

## Clean local two-account E2E verification (2026-07-23)

- **PASS.** Built the frontend afresh with `npm run build`, then used previously
  unused loopback ports `8137` (FastAPI) and `3137` (Next production server);
  both were explicitly confirmed to have no listener before startup.
- FastAPI ran from a temporary same-interpreter launcher.  Before `uvicorn.run`
  it patched `app.api.decrees.get_chancellor_graph` with an offline deterministic
  graph result using the valid ministry `户部`, and set `app.shiguan.db._DEFAULT_DB_PATH`
  to a new temporary SQLite database.  `DEEPSEEK_API_KEY` was removed from that
  child process; no private environment file, external service, or real model
  was used.
- Separate cookie jars registered account A and account B through the production
  Next BFF (`201` each).  The cookie values were explicitly forwarded over the
  loopback HTTP harness because production cookies are `Secure`; this tests the
  BFF/session boundary without weakening the production cookie policy.
- A submitted a decree through the BFF (`200`), and A's archive list returned
  two generated archive records (MEMORIAL and DECISION).  B's archive list was
  empty (`200`), B statistics reported `total: 0` (`200`), and B recall for
  `户部` returned an empty match list (`200`).
- With B's own bearer session, direct protected FastAPI access to A's checked
  archive returned `404` for both `GET` and `PATCH .../review`.
- A logout through the BFF returned `204`; subsequent `/study` and `/shiguan`
  each returned `307` redirects to their encoded login destinations.  A no-cookie
  protected BFF request returned `401`.  Public frontend `/` and `/health`, plus
  backend `/health`, each returned `200`.
- All temporary launchers, SQLite databases, logs, and both server processes
  were removed after the successful run; ports `8137` and `3137` have no listener.
