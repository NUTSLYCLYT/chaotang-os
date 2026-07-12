# 后端变更摘要：feat-jinyiwei-evidence-pool-20260712

| Field | Value |
| --- | --- |
| Change ID | feat-jinyiwei-evidence-pool-20260712 |
| Status | DELIVERED |
| Owner | 后端 harness |
| Date | 20260712 |

## 摘要

给锦衣卫加一张跨任务可查的持久情报池——此前锦衣卫核实过的情报只存在于单次 `court_doc` 响应和单次蜂群运行内的文本拼接里，下一个任务完全看不到。这是"锦衣卫作为跨阶段共享证据服务"这轮工作的阶段1(见 `/home/ubuntu/.claude/plans/valiant-crunching-candy.md`)。

## 范围

- `backend/src/db/models.py`：新增 `JinyiweiEvidence` 表(`SwarmEvidenceLink` 之后)，按 `(tenant_id, claim_key)` 去重存放已核实情报。
- `backend/alembic/versions/006_jinyiwei_evidence.py`：新迁移，纯 `op.create_table`，全新表无需回填、无需 `ensure_*_column` 自愈。
- `backend/src/jinyiwei_evidence_store.py`：新模块，`upsert_evidence()`/`query_evidence()`。
- `backend/web/routers/jinyiwei.py`：`intel_brief()` 成功后把 `findings`/`doc["items"]` 按下标配对落库(best-effort，失败不影响简报本身返回)；新增 `GET /api/intel/evidence` 查询端点，字段命名对齐前端 `frontend/src/lib/contracts/evidence.ts::EvidenceRecord`。
- `backend/tests/test_jinyiwei_evidence_store.py`：新文件，`upsert_evidence`/`query_evidence` 的幂等、三个过滤维度(默认排除待核、任何情况排除"拒"、部门过滤)、租户隔离、建表冒烟测试。
- `backend/tests/test_jinyiwei_endpoint.py`：新增两个集成测试，验证 `/api/intel/brief` 真的把情报落进 `jinyiwei_evidence` 表且 `GET /api/intel/evidence` 能查到；验证 Tavily 真检索路径下未截断的完整 claim(而非 `_finding_to_item` 截断的 60 字标题)被正确持久化。

## 非目标

- 不碰 `real_department_engines.py::adapt_jinyiwei()`/`swarm_execution_loop.py`——六部派单读写穿透持久池是阶段2。
- 不碰任何前端文件。
- 不建 `awaiting_evidence` 自动化处理流水线——已在计划里明确列为"未来单开"，不在本轮任何阶段做。
- 不做向量/embedding 语义匹配——`query_evidence` 用朴素关键词 LIKE。

## 验证

- `python3 -m pytest -q tests/test_jinyiwei_evidence_store.py tests/test_jinyiwei_endpoint.py`：17 passed。
- 全量 `python3 -m pytest -q`：见下方补充。
- `python3 scripts/harness_doctor.py`：见下方补充。
