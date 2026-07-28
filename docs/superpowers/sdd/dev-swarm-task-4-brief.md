# Task 4: 固化选司后自动触发边界

Allowed paths: `backend/app/agents/ministries/agent.py`, `backend/tests/test_ministries_agent.py` (new), and `backend/tests/test_bureaus_agent.py` only if needed.

Keep `invoke_ministry_agent` signature and `MinistryOpinion` exactly unchanged. After existing strict selected-bureau validation and before every bureau invocation, call `capability_profiles_for(department, bureau)` only as an integrity boundary. It must not change/reorder `selected_bureaus`, invoke models, create additional route decisions, or alter the normal prompt-driven capability load. If this integrity lookup fails, wrap it as `MinistryAgentInvocationError` and do not invoke any bureau or ministry synthesis. Existing selected bureau failures remain fail-closed.

TDD first: test selected commercial bureau call order remains route -> selected bureau -> synthesis and only it gets invoked; multiple selected bureaus retain model order; a monkeypatched capability lookup failure prevents bureau/synthesis. Use injected fake models only. Run focused tests RED then GREEN plus Ruff. No Git writes. No API, graph, Jinyiwei, Shiguan, queue, network, persistence or ADR change.
