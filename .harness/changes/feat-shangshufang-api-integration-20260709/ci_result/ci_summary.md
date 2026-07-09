# CI 摘要：feat-shangshufang-api-integration-20260709

## 已通过

- `cd backend; python -m pytest -q tests/test_shangshufang_loop_api.py tests/test_hubu_financial_reporting.py`
  - 结果：20 passed, 1 warning
- `cd backend; python -m pytest -q tests/test_swarm_execution_loop_api.py`
  - 结果：8 passed, 1 warning
- `cd frontend; pnpm exec tsc --noEmit`
  - 结果：通过
- `node scripts/harness-doctor.mjs`
  - 结果：project-harness-doctor: 0 errors, 0 warnings
- `cd backend; python -m py_compile web/routers/shangshufang.py tests/test_shangshufang_loop_api.py`
  - 结果：通过
- `git diff --check -- <本次相关文件>`
  - 结果：通过；仅有 CRLF 提示

## 未完成 / 环境阻塞

- `cd frontend; pnpm exec playwright test e2e/shangshufang-*.spec.ts`
  - 结果：未完成。
  - 原因：当前 3002 服务访问 `/chaotang/court-briefing?skipOnboarding=1` 返回 Next.js 404，测试未进入上书房页面断言阶段。
  - 影响：该失败反映本地已运行服务的 base path / route 环境不匹配，不是本次 API 对接断言失败。

## 待补跑

- 在 base path / route 正确的前端服务上补跑 `cd frontend; pnpm exec playwright test e2e/shangshufang-*.spec.ts`。
