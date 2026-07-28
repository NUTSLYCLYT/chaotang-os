# Task 5: 单部门端到端与史馆契约回归

Allowed paths: `backend/tests/test_chancellor_graph.py`, `backend/tests/test_decrees_api.py` only if it exists and is required.

Using fake offline models, add a representative single-department capability route test (quotation or product is sufficient) to show the existing graph remains single: one department, no council verdict, existing layered bureau opinion and finalization contract. Assert `processing_path` contains only existing chain nodes and never capability IDs, swarm/worker/task-run nodes, or Junjichu. If practical with existing test helpers, add/strengthen API archive assertion: one successful decree yields exactly one REPLY with original source text and no capability IDs. Do not alter production code.

TDD RED then GREEN. No Git writes, real models, network, queue, API change, ADR or business-flow change. Report concise evidence in final response.
