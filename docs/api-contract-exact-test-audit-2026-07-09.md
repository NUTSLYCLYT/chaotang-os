# Exact API Test Audit

| Field | Value |
| --- | --- |
| Generated at | 2026-07-10T01:40:33.675Z |
| Status | pass |
| Used backend routes | 74 |
| Exact routes | 74 |
| Accepted inferred routes | 0 |
| Missing exact routes | 0 |

## Missing Exact Test Evidence

None.

## Accepted Inferred

None.

## Exact Routes

| Route | Tests |
| --- | --- |
| GET /api/chaotang/archive/knowledge/count | backend/tests/test_be7_knowledge_feedback.py |
| GET /api/chaotang/archive/search | backend/tests/test_all_frontend_used_routes_exact_contract.py |
| GET /api/chaotang/dept/{code}/overview | backend/tests/test_be6_real_data.py<br>backend/tests/test_chaotang_manor_dept.py |
| GET /api/chaotang/tasks | backend/tests/test_chaotang_tasks.py<br>backend/tests/test_endpoints_s10.py |
| GET /api/chaotang/tasks/{task_id} | backend/tests/test_chaotang_tasks.py<br>backend/tests/test_endpoints_s10.py |
| GET /api/court-session/latest | backend/tests/test_court_session_api_contract.py |
| GET /api/court/backend/tasks/{task_id} | backend/tests/test_all_frontend_used_routes_exact_contract.py |
| GET /api/court/chancellor-advice | backend/tests/test_dadian_api.py |
| GET /api/court/decision-judgment | backend/tests/test_dadian_api.py |
| GET /api/court/ima-knowledge | backend/tests/test_contract_alignment_p0.py |
| GET /api/court/shiguan/promo-archive | backend/tests/test_contract_alignment_p0.py |
| GET /api/court/shiguan/release-gates | backend/tests/test_contract_alignment_p0.py |
| GET /api/court/true-chain-health | backend/tests/test_contract_alignment_p0.py |
| GET /api/court/zhuangyuan/ministry-metrics | backend/tests/test_contract_alignment_p0.py |
| GET /api/governance/audit/summary | backend/tests/test_all_frontend_used_routes_exact_contract.py |
| GET /api/governance/bills | backend/tests/test_contract_alignment_p0.py |
| GET /api/governance/bills/{bill_id}/audit | backend/tests/test_contract_alignment_p0.py |
| GET /api/governance/whoami | backend/tests/test_all_frontend_used_routes_exact_contract.py |
| GET /api/health | backend/tests/test_auth_whitelist.py<br>backend/tests/test_csp_no_unsafe_eval.py<br>backend/tests/test_web_api.py |
| GET /api/legal/overview | backend/tests/test_all_frontend_used_routes_exact_contract.py |
| GET /api/runs/stream/{task_id} | backend/tests/test_production_observability.py<br>backend/tests/test_system_communication_topology.py |
| GET /api/runs/stream/{task_id}/status | backend/tests/test_production_observability.py<br>backend/tests/test_system_communication_topology.py |
| GET /api/scribe/lessons | backend/tests/test_contract_alignment_p0.py |
| GET /api/shangshufang/home | backend/tests/test_shangshufang_loop_api.py |
| GET /api/shangshufang/tasks/{task_id}/status | backend/tests/test_shangshufang_loop_api.py<br>backend/tests/test_swarm_execution_loop_api.py |
| GET /api/swarm-runs/{swarm_run_id} | backend/tests/test_all_frontend_used_routes_exact_contract.py<br>backend/tests/test_swarm_execution_loop_api.py<br>backend/tests/test_swarm_runs_api_contract.py |
| GET /api/swarm-runs/{swarm_run_id}/brief | backend/tests/test_all_frontend_used_routes_exact_contract.py<br>backend/tests/test_swarm_execution_loop_api.py<br>backend/tests/test_swarm_runs_api_contract.py |
| GET /api/swarm-runs/{swarm_run_id}/progress | backend/tests/test_all_frontend_used_routes_exact_contract.py<br>backend/tests/test_swarm_execution_loop_api.py<br>backend/tests/test_swarm_runs_api_contract.py |
| GET /api/swarm/roster | backend/tests/test_swarm_roster.py |
| GET /api/swarm/sessions/{session_id} | backend/tests/test_chaotang_launch_loop.py<br>backend/tests/test_chaotang_study_run_edict.py<br>backend/tests/test_chaotang_true_loop_contract.py<br>backend/tests/test_finance_intel_loop_contract.py<br>backend/tests/test_pack_rd_report.py<br>backend/tests/test_swarm_release_gate.py<br>backend/tests/test_swarm_roster.py<br>backend/tests/test_system_communication_topology.py |
| PATCH /api/chaotang/tasks/{task_id}/persist | backend/tests/test_chaotang_tasks.py<br>backend/tests/test_endpoints_s10.py |
| PATCH /api/court/ima-knowledge | backend/tests/test_contract_alignment_p0.py |
| POST /api/auth/login | backend/tests/test_login_rate_limit_and_cookie.py<br>backend/tests/test_web_api.py |
| POST /api/auth/logout | backend/tests/test_web_api.py |
| POST /api/auth/register | backend/tests/test_register_no_enumeration.py |
| POST /api/auth/verify-invite | backend/tests/test_contract_alignment_p0.py |
| POST /api/chaotang/archive/knowledge/feedback | backend/tests/test_be7_knowledge_feedback.py |
| POST /api/chaotang/decree/{task_id}/proceed | backend/tests/test_chaotang_decree.py<br>backend/tests/test_endpoints_s10.py |
| POST /api/chaotang/tasks/persist | backend/tests/test_chaotang_tasks.py |
| POST /api/chat | backend/tests/test_contract_alignment_p0.py<br>backend/tests/test_web_api.py |
| POST /api/court/bureaus/{department}/{bureau}/actions | backend/tests/test_contract_alignment_p0.py |
| POST /api/court/decision-judgment | backend/tests/test_dadian_api.py |
| POST /api/court/dept/swarm-dispatch | backend/tests/test_contract_alignment_p0.py |
| POST /api/court/intel/signals/{signal_id}/dispatch | backend/tests/test_contract_alignment_p0.py |
| POST /api/court/junjichu/cases | backend/tests/test_contract_alignment_p0.py |
| POST /api/court/orchestrate | backend/tests/test_contract_alignment_p0.py |
| POST /api/court/orchestrate/all | backend/tests/test_contract_alignment_p0.py |
| POST /api/court/orchestrate/sign-off | backend/tests/test_contract_alignment_p0.py |
| POST /api/court/shiguan/analyze | backend/tests/test_contract_alignment_p0.py |
| POST /api/governance/bills | backend/tests/test_contract_alignment_p0.py |
| POST /api/governance/bills/{bill_id}/transition | backend/tests/test_contract_alignment_p0.py |
| POST /api/governance/deliberate | backend/tests/test_contract_alignment_p0.py |
| POST /api/governance/whoami | backend/tests/test_all_frontend_used_routes_exact_contract.py |
| POST /api/legal/verdict/from-text | backend/tests/test_all_frontend_used_routes_exact_contract.py |
| POST /api/manor/stream | backend/tests/test_contract_alignment_p0.py |
| POST /api/metrics | backend/tests/test_contract_alignment_p0.py |
| POST /api/orchestration/run | backend/tests/test_contract_alignment_p0.py |
| POST /api/prompt/suggest | backend/tests/test_contract_alignment_p0.py |
| POST /api/qintian/chat | backend/tests/test_contract_alignment_p0.py |
| POST /api/scribe/annals | backend/tests/test_contract_alignment_p0.py |
| POST /api/shangshufang/briefs/{brief_id}/decision/advance | backend/tests/test_shangshufang_loop_api.py |
| POST /api/shangshufang/confirm-edict | backend/tests/test_shangshufang_loop_api.py<br>backend/tests/test_swarm_execution_loop_api.py |
| POST /api/shangshufang/draft-edict | backend/tests/test_shangshufang_loop_api.py<br>backend/tests/test_swarm_execution_loop_api.py |
| POST /api/shangshufang/edict-return | backend/tests/test_shangshufang_loop_api.py |
| POST /api/shangshufang/finance-intel-loop/complete | backend/tests/test_shangshufang_loop_api.py |
| POST /api/shangshufang/finance-status-memorial | backend/tests/test_shangshufang_loop_api.py |
| POST /api/shangshufang/pack-swarm-loop | backend/tests/test_shangshufang_loop_api.py |
| POST /api/shangshufang/research-budget-loop | backend/tests/test_shangshufang_loop_api.py |
| POST /api/shangshufang/tasks/{task_id}/decision | backend/tests/test_shangshufang_loop_api.py<br>backend/tests/test_swarm_execution_loop_api.py |
| POST /api/shangshufang/tasks/{task_id}/swarm-deepen | backend/tests/test_shangshufang_loop_api.py<br>backend/tests/test_swarm_execution_loop_api.py |
| POST /api/shiguan/archives/{archive_id}/retrospective | backend/tests/test_contract_alignment_p0.py |
| POST /api/swarm-runs | backend/tests/test_all_frontend_used_routes_exact_contract.py<br>backend/tests/test_swarm_execution_loop_api.py<br>backend/tests/test_swarm_runs_api_contract.py |
| POST /api/swarm-runs/{swarm_run_id}/retry | backend/tests/test_all_frontend_used_routes_exact_contract.py<br>backend/tests/test_swarm_execution_loop_api.py<br>backend/tests/test_swarm_runs_api_contract.py |
| POST /api/swarm-runs/serial | backend/tests/test_all_frontend_used_routes_exact_contract.py |

## Policy

- Exact evidence means a backend test source contains the route path or its static prefix.
- Accepted inferred routes are operational stream/health contracts whose existing tests exercise behavior without repeating every parameterized path literal.
- This audit does not edit UI files and does not add frontend BFF routes.
