# CI 验证摘要：feat-jinyiwei-evidence-fill-gap-20260712

## 命令

- `python3 -m pytest -q tests/test_jinyiwei_endpoint.py`
- `python3 -m pytest -q`(后端全量)
- `python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`(根级)

## 结果

- `tests/test_jinyiwei_endpoint.py`：14 passed，包含新增的 `test_fill_gap_rejects_unknown_task_id`/`test_fill_gap_rejects_task_not_awaiting_evidence`/`test_fill_gap_rejects_empty_task_id_or_gap`/`test_fill_gap_success_persists_to_shared_pool`。
- 全量 `pytest`：2411 passed / 8 failed(既有无关失败，与此前基线一致)/ 25 skipped。
- `python3 scripts/harness_doctor.py`：0 errors, 0 warnings。
- `node scripts/harness-doctor.mjs`(根级)：0 errors, 0 warnings。

## Codex 停止前审查纠正(2026-07-12)

Codex 停止前审查指出:"new fill-gap endpoint is tenant/user blind"。复核确认属实：第一版实现把 `CurrentUser` 依赖参数命名为 `_` 并直接丢弃，只把它当鉴权门槛用，没有核对 `task_id` 是不是调用者自己的任务——`DecisionTask.status.filter_by(id=task_id)` 对任何认证用户一视同仁放行。

排查确认这不是本次改动独有的新洞：`shangshufang.py` 里十几个 `DecisionTask` 按 `id` 查询的端点(`GET /tasks/{id}/status`、`POST /tasks/{id}/decision`、`POST /confirm-edict` 等)全部是同样的写法，`DecisionTask` 表本身也没有 `tenant_id` 列——这是一个跨越整个 `DecisionTask` API 表面的既有系统性缺口，本次不追平所有既有端点(范围过大，需要单独立项)。但 `DecisionTask.user_id` 在任务创建时(`draft_edict` 等)确实真实填了当前用户身份(`_user_id(user)`，不是恒定 `"anonymous"`)，按它做归属校验对新增端点而言是真实、有效的最小修复——新写的代码不应该带着明知可以做、却不做的同类漏洞上线，即使这意味着它比其余十几个既有端点更严格。

修复：`intel_evidence_fill_gap` 参数改回 `user: CurrentUser`，解析 `requester_id = str(user.user_id or user.username or user.tenant_slug or "anonymous")`，在状态校验之前先校验 `task.user_id == requester_id`，不匹配则拒绝(`"无权操作该任务"`)。

测试更新：`_seed_awaiting_evidence_task` 的 `user_id` 默认值改成 `"1"`(匹配 `conftest.py::_authenticated_api_user` 注入的 `CurrentUser(user_id=1, ...)`)，`test_fill_gap_rejects_task_not_awaiting_evidence` 内联种的任务同步改成 `user_id="1"`，否则会先被新加的归属校验拦下而不是原本要测的状态校验。新增 `test_fill_gap_rejects_task_owned_by_another_user`：种一个 `user_id="someone_else"` 的 `awaiting_evidence` 任务，验证即使状态符合也会因为不属于当前用户而被拒绝。

验证：`python3 -m pytest -q tests/test_jinyiwei_endpoint.py` 15 passed；全量 `pytest` 2412 passed，同一组 8 个既有无关失败；三层 `harness:doctor` 全绿。
