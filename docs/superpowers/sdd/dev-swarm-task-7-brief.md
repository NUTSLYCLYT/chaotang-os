# Task 7: 能力包证据与高风险操作边界回归

Allowed paths: `backend/tests/test_bureaus_agent.py`, `backend/tests/test_chancellor_graph.py`, and `backend/tests/test_evidence_protocol.py` only if needed.

Add/strengthen offline tests proving a capability-bound bureau preserves existing READY/NEEDS_DATA evidence protocol, only bureau nodes can access the existing controlled evidence session, and no added behavior provides department/Junjichu/Chancellor access. Assert high-risk capability prompts contain advice/draft/pending approval constraints, and tests run with no real credentials/network. Preserve one-REPLY semantics; no production changes.

TDD RED/GREEN using fakes only. No Git write, APIs, data sources, URLs, env settings, queues, persistence, or ADR changes.
