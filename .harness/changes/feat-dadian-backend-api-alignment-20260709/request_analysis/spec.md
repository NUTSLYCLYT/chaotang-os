# Spec: feat-dadian-backend-api-alignment-20260709

## Background

The `/dadian` frontend page was already calling same-origin API paths through the Next proxy, but several court endpoints were not implemented by the backend. The old BFF layer should not be restored; the backend should own the contract.

## Scope

- Add backend court endpoints required by the current `/dadian` page:
  - `GET /api/court/dadian/pulse`
  - `GET /api/court/dadian/feed`
  - `GET /api/court/chancellor-advice`
  - `GET /api/court/decision-judgment`
  - `POST /api/court/decision-judgment`
- Register the router in `backend/web/main.py`.
- Keep frontend calls on same-origin paths so Next rewrites them to the backend.
- Let the frontend render backend-derived chancellor advice distinctly from live LLM advice.
- Enforce backend authentication on the new dadian API contracts when `FENGQUN_AUTH=true`.
- Require login before rendering the `/dadian` page.
- Mark `/dadian` frontend UX and dadian backend contracts as frozen after this change.

## Non-Goals

- Do not reintroduce the frontend BFF layer.
- Do not fake LLM/live advice when provider credentials are unavailable.
- Do not implement legacy `WorldCourtStage` ask endpoints unless that component becomes active again.
- Do not modify `/dadian` UX or dadian backend contracts in later tasks unless the user explicitly reopens that scope.

## Acceptance Criteria

- Anonymous `/chaotang/dadian` redirects to login.
- Anonymous `/chaotang/api/court/dadian/feed` returns 401 through the frontend proxy.
- Authenticated `/chaotang/api/court/dadian/feed` returns 200 through the frontend proxy.
- Backend tests cover the new dadian API contract.
- Frontend TypeScript check passes.

## Verification Plan

- `cd backend; python -m pytest -q tests/test_dadian_api.py`
- `cd frontend; pnpm exec tsc --noEmit`
- `Invoke-WebRequest -UseBasicParsing -Uri http://127.0.0.1:3002/chaotang/api/court/dadian/feed`
- `Invoke-WebRequest -UseBasicParsing -Uri http://127.0.0.1:3002/chaotang/dadian`
