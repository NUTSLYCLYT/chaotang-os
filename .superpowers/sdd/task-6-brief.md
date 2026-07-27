### Task 6: Record the architecture and complete end-to-end verification

**Files:**
- Create: `docs/decisions/0019-authenticated-user-isolation.md`
- Modify: `ARCHITECTURE.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`, `docs/product/tasks/2026-07-23-authenticated-user-isolation.md`
- Test: `backend/tests/test_auth_api.py`, `frontend/src/app/api/auth/authRoutes.test.ts`, all existing suites

**Interfaces:**
- ADR records FastAPI as identity authority, opaque cookie-backed sessions, same-origin BFF, and owner-scoped SQLite data.
- Run documentation includes public and protected routes, required local services, and safe two-account verification without a real model request.

- [ ] **Step 1: Write the ADR and documentation assertions**

Document the rejected JWT and frontend-only alternatives, cookie flags, session revocation behavior, legacy-data treatment, and the explicit rule that clients never select an owner. Add a documentation test or source assertion that verifies the public `/health` route stays unauthenticated while protected FastAPI routes use `require_current_user`.

- [ ] **Step 2: Verify documentation assertions fail before the guarded contract is present**

Run the focused assertion command added in Step 1.
Expected: FAIL before the protection annotations and documentation are complete.

- [ ] **Step 3: Finish the end-to-end test scenario**

Start FastAPI on `127.0.0.1:8000` and Next.js in production mode. Register account A and account B through Next BFF; with A create a decree using a fake/injected graph response and verify its archive appears for A; with B verify list/statistics/recall are empty and direct review/read of A's ID returns 404; logout A then verify `/study`, `/shiguan`, and all protected BFF routes deny access. Do not invoke a real model.

- [ ] **Step 4: Run complete verification**

Run from repository root:

```powershell
backend\.venv\Scripts\python.exe -m ruff check backend
backend\.venv\Scripts\python.exe -m pytest backend/tests
cd frontend; npm run lint; npm run typecheck; npm test; npm run build
cd ..; node scripts/check_harness.mjs; git diff --check
```

Expected: every command exits 0; evidence records the two-user isolation result, protected-route results, and the fact that no real model was called.
