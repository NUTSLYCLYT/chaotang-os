# P0 API Contract Matrix Audit

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:40:32.832Z |
| Status | pass |
| Domains | 5 |
| Complete domains | 5 |
| Missing evidence | 0 |

## Domains

| Domain | Status | Frontend contracts | Backend owners | Tests | Primary endpoints |
| --- | --- | --- | --- | --- | --- |
| shangshufang | complete | frontend/src/lib/contracts/shangshufang.ts<br>frontend/src/lib/jiqun-api.ts | backend/web/routers/shangshufang.py | backend/tests/test_shangshufang_loop_api.py | GET /api/shangshufang/home<br>GET /api/shangshufang/tasks/{task_id}/status |
| junjichu | complete | frontend/src/features/command-center/junjichu/model/types.ts<br>frontend/src/lib/contracts/task.ts<br>frontend/src/lib/contracts/swarm.ts | backend/web/routers/chaotang.py<br>backend/web/routers/court_compat.py<br>backend/web/routers/swarm_runs.py | backend/tests/test_contract_alignment_p0.py<br>backend/tests/test_swarm_runs_api_contract.py | GET /api/chaotang/tasks/{task_id}<br>GET /api/court/backend/tasks/{task_id}<br>GET /api/swarm-runs/{swarm_run_id}/brief<br>POST /api/swarm-runs/{swarm_run_id}/retry |
| bureaus | complete | frontend/src/lib/contracts/bureau-page-view.ts<br>frontend/src/lib/contracts/department-page-view.ts<br>frontend/src/lib/contracts/dept.ts<br>frontend/src/lib/contracts/xingbu.ts<br>frontend/src/lib/contracts/hubu.ts<br>frontend/src/lib/contracts/bingbu.ts | backend/web/routers/dept.py<br>backend/web/routers/legal.py<br>backend/web/routers/court_compat.py | backend/tests/test_contract_alignment_p0.py<br>backend/tests/test_libu_router.py | GET /api/chaotang/dept/{code}/overview<br>POST /api/legal/verdict/from-text<br>POST /api/court/bureaus/{department}/{bureau}/actions |
| dadian | complete | frontend/src/lib/contracts/dadian.ts | backend/web/routers/dadian.py | backend/tests/test_dadian_api.py<br>frontend/e2e/dadian-api-contract.spec.ts | GET /api/court/dadian/feed<br>GET /api/court/dadian/pulse<br>GET /api/court/decision-judgment<br>POST /api/court/decision-judgment |
| auth-and-telemetry | complete | frontend/src/lib/contracts/authorization.ts<br>frontend/src/lib/contracts/invite-code.ts | backend/web/routers/auth.py<br>backend/web/routers/metrics.py | backend/tests/test_contract_alignment_p0.py | POST /api/auth/login<br>POST /api/auth/register<br>POST /api/auth/verify-invite<br>POST /api/metrics |

## Missing Evidence

None.

## Policy

- This matrix verifies P0 contract-source evidence only.
- It does not edit UI files and does not add frontend BFF routes.
- Browser closure still depends on frontend typecheck/build and Playwright execution.
