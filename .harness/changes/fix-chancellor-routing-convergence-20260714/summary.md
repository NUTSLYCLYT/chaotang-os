# 变更摘要：fix-chancellor-routing-convergence-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-chancellor-routing-convergence-20260714 |
| 类型 | fix |
| 状态 | IN_PROGRESS |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：backend(丞相→六部→蜂群路由链)。执行 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第14节阶段1 + 计划收口 + swarm_execution_loop 审查簇拆分。
- 文件：
  - PR1:backend/src/chancellor_router.py(decide 委托 chancellor_decide_route,降级为部名→蜂群适配层)、backend/web/routers/runs_stream.py(证券红线合规落点钉死单入口,防 junjichu 窄集旁路)、backend/src/chancellor/routing_service.py(收敛注释)、backend/tests/test_chancellor_golden_cases.py(分歧测试翻成收敛 tripwire:assert divergences == [])、backend/tests/test_chancellor_router.py、backend/tests/test_orchestration_plan.py(直办/证据缺口措辞拆分)、backend/tests/fixtures/chancellor_golden_cases_divergence.json(收敛后为 [])
  - PR2:backend/src/orchestration_plan.py、backend/web/routers/runs_stream.py、chaotang.py、swarm.py
  - PR3:backend/src/swarm_review.py(新)、backend/src/swarm_execution_loop.py(shim)
- 验证：
  - `cd backend && python3 -m pytest tests/test_chancellor_golden_cases.py tests/test_chancellor_router.py tests/test_orchestration_plan.py tests/test_securities_redline_precheck.py tests/test_runs_stream_honesty.py tests/test_orchestration_tier.py tests/test_model_tier.py -q` → 89 passed
  - 全量 `python3 -m pytest -q` → 2507 passed / 12 failed;12 个失败在干净基线(0269074)原样复现,与本变更无关(见下)

## 行为变更(有意)

- 密旨直发路径 mode 口径统一到 chancellor_decide_route(黄金案例钦定):证据缺口/多部门且无直办动词 → junjichu,召集频率上升,成本上升可观测(data/<tenant>/routing/decisions.jsonl)。
- 证券红线命中且有合规落点时,runs_stream 钉死单入口 direct,不再进三层分解(修复:旧逻辑丢弃合规落点重新 build_plan,junjichu 窄集不跑红线会旁路)。

## 范围外记录(不顺手修)

基线既有失败 12 个:test_case_archive_rag(2)、test_chaotang_department_protocol(1)、test_commit_closeout_check(1)、test_lawyer_rag(4)、test_persona_registry(1)、test_production_observability(1)、test_system_communication_topology(2,FakeApiOrchestrator.run() 不认 project_id kwarg)。
