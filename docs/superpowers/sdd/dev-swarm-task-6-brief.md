# Task 6: 跨部门军机处串行会审回归

Allowed paths: `backend/tests/test_junjichu_agent.py`, `backend/tests/test_chancellor_graph.py`.

Add offline regression coverage for a representative cross-department capability intention. Assert each ministry executes its existing route -> selected bureau -> synthesis ordering before the council runs; council receives layered `MinistryOpinion` only, never capability IDs or extra capability/evidence nodes; `processing_path` retains exactly one existing Junjichu position and actual execution order. A failure in a ministry/bureau must prevent later ministries, council and finalizer. Do not change production code or add concurrency.

Use TDD RED then GREEN, fake/injected models only. No Git writes or changes to API, ADR, Jinyiwei, Shiguan, network, persistence, scheduler.
