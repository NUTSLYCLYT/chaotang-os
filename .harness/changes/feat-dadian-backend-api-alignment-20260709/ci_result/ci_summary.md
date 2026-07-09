# CI Summary: feat-dadian-backend-api-alignment-20260709

## Commands

- `cd backend; python -m pytest -q tests/test_dadian_api.py tests/test_enforce_jwt_secret_strength.py`
- `cd frontend; pnpm exec tsc --noEmit`
- `Invoke-WebRequest -UseBasicParsing -Uri http://127.0.0.1:3002/chaotang/api/court/dadian/feed` without login
- `Invoke-WebRequest -UseBasicParsing -MaximumRedirection 0 -Uri http://127.0.0.1:3002/chaotang/dadian` without login
- Register/login a one-time probe user through `/chaotang/api/auth/*`, then call `/chaotang/api/court/dadian/feed` with the returned cookie.

## Results

- Backend dadian API and JWT secret tests: passed, 14 tests.
- Frontend TypeScript check: passed.
- Anonymous frontend proxy dadian feed probe: HTTP 401.
- Anonymous frontend dadian page probe: HTTP 307 to `/chaotang/login?next=%2Fchaotang%2Fdadian`.
- Authenticated probe user flow: register 201, login 200, dadian feed 200.

## Notes

- Runtime backend was restarted with `FENGQUN_AUTH=true`, a strong local development `FENGQUN_JWT_SECRET`, and `FENGQUN_COOKIE_SECURE=false` for local HTTP testing.
- Provider preflight still reports missing `DEEPSEEK_API_KEY`, so the chancellor endpoint exposes derived or unavailable advice rather than pretending to be live LLM output.
