# 后端变更摘要：feat-jinyiwei-evidence-fill-gap-20260712

| Field | Value |
| --- | --- |
| Change ID | feat-jinyiwei-evidence-fill-gap-20260712 |
| Status | DELIVERED |
| Owner | 后端 harness |
| Date | 20260712 |

## 摘要

"锦衣卫作为跨阶段共享证据服务"阶段3(后端部分)：新增人工触发的证据缺口填补端点。此前 `DecisionTask.status == "awaiting_evidence"` 是个死路——没有任何 worker/监听器会对它做事，唯一出路是人工再点一次 `action="recheck"`(重跑整个蜂群会审)。这是"evidence_gap_detected"从纯计划文档短语变成一个真实、人工触发动作的落点。

## 范围

- `backend/web/routers/jinyiwei.py`：新增 `POST /api/intel/evidence/fill-gap`(body: `{task_id, gap}`)。校验 `DecisionTask.status == "awaiting_evidence"`，调用 `gather_intel(gap, search_fn=tavily_search, archive=True)`，结果通过 `_persist_brief_items(origin_task_id=task_id, ...)` 写回共享池并原样返回。`_persist_brief_items` 加 `origin_task_id` 可选参数，供 `/brief`(不传)和 `/fill-gap`(传 task_id)共用。
- `backend/tests/test_jinyiwei_endpoint.py`：新增 4 个测试(拒绝不存在的 task_id、拒绝非 awaiting_evidence 状态、拒绝空 task_id/gap、成功路径落库并可查询)。

## 非目标

- 不建自动化 `awaiting_evidence` 监听/自动重审流水线——这是明确排除的更大独立工程，本端点纯人工触发。
- 不改变 `action="recheck"` 既有的重跑蜂群会审流程——`fill-gap` 是它之外新增的补充动作，不是替代。
- 前端接线(可选)另开记录或视用户决定是否本轮做。

## 验证

- `python3 -m pytest -q tests/test_jinyiwei_endpoint.py`：14 passed。
- 全量 `python3 -m pytest -q`：2411 passed / 8 failed(既有无关失败，与基线一致)。
- `python3 scripts/harness_doctor.py`/`node scripts/harness-doctor.mjs`：0 errors, 0 warnings。
