# 需求说明：feat-jinyiwei-evidence-pool-20260712

## 背景

"统一决策任务生命周期"四阶段计划完成后，用户选定推进原计划里明确延后的"锦衣卫作为跨阶段共享证据服务"。摸底(Explore)确认锦衣卫后端本身是真的(Tavily 检索 + 确定性可信度分级)，但没有任何持久化、可跨任务查询的情报存储——`SwarmEvidenceLink` 只写不读，`truth_ledger.py` 是质量飞轮账本，跨部门共享只发生在单次蜂群运行内的文本拼接。

## 范围

- 新表 `JinyiweiEvidence`(`backend/src/db/models.py`)+ 对应 Alembic 迁移 006。
- `backend/src/jinyiwei_evidence_store.py`：`upsert_evidence()`/`query_evidence()`。
- `web/routers/jinyiwei.py::intel_brief()` 接线写入；新增 `GET /api/intel/evidence` 查询端点。

## 非目标

- 不改 `real_department_engines.py`/`swarm_execution_loop.py`(阶段2)。
- 不改前端(阶段3可选)。
- 不建自动化 `awaiting_evidence` 处理流水线(明确排除，见计划文件)。
- 不做向量/embedding 匹配，纯关键词 LIKE。

## 验收标准

- `upsert_evidence` 按 `(tenant_id, claim_key)` 幂等：同一条 claim(忽略首尾空白/大小写)第二次调用原地更新，不产生第二行。
- `query_evidence` 默认排除"待核"，任何情况下排除"拒"(脏情报永不出这个端点)，支持部门过滤、租户隔离。
- 真实调用 `POST /api/intel/brief` 后，对应情报能通过 `GET /api/intel/evidence` 查到，且存的是未截断的完整 claim 文本。
- 全量 `pytest` 无新增失败；三层 `harness:doctor` 全绿。

## 风险

- Tavily 真检索路径下 `gather_intel`/`_finding_to_item` 只把 claim 截断进 60 字 `title`，不保留完整文本——路由层必须自己在调用 `gather_intel` 前保留原始 `findings` 列表用于落库配对，不能事后从 `doc["items"]` 反推。
- 持久化失败不能影响 `/api/intel/brief` 本身的返回——包一层 try/except，对齐 `court_doc_builder.py` 里 `truth_ledger.record()` 的既有 best-effort 惯例。
- 全新表不需要 `ensure_*_column` 式自愈(那是"已有表加列"的场景)，但要在这里明确写清楚，避免审查者以为漏了自愈、或者反过来被拿来给不需要自愈的场景加自愈。

## 验证计划

`python3 -m pytest -q tests/test_jinyiwei_evidence_store.py tests/test_jinyiwei_endpoint.py`、全量 `python3 -m pytest -q`、`python3 scripts/harness_doctor.py`、`node scripts/harness-doctor.mjs`(根级)。
