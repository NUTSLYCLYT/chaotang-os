# 任务拆解：feat-jinyiwei-evidence-pool-20260712

## 任务 1 —— 持久化模型 + 迁移

- 目标：新增 `JinyiweiEvidence` 表与对应 Alembic 迁移。
- 输入：`SwarmEvidenceLink` 的既有风格、`005_decree_execution_event_sequence.py` 的迁移格式参考。
- 输出：`models.py` 新表定义、`006_jinyiwei_evidence.py` 迁移文件。
- 验收：`create_all` 建表冒烟测试通过；迁移文件语法正确(本沙箱未装 alembic 包，无法直接跑 upgrade head，仅做代码审查级验证)。

## 任务 2 —— 存储层模块

- 目标：`upsert_evidence()`/`query_evidence()`。
- 输入：`jinyiwei_agent._finding_to_item()` 已算好的字段形状。
- 输出：`src/jinyiwei_evidence_store.py`。
- 验收：幂等更新、三个过滤维度、租户隔离测试全部通过。

## 任务 3 —— 路由接线

- 目标：`intel_brief()` 写入持久池；新增查询端点。
- 输入：路由层原有的 `findings`/`doc["items"]` 数据流。
- 输出：`web/routers/jinyiwei.py` 改动。
- 验收：真实调用 `/api/intel/brief` 后 `/api/intel/evidence` 能查到，且 claim 未被截断。

## 任务 4 —— 回归验证

- 目标：证明没有引入回归。
- 输入：任务1-3 完成后的代码。
- 输出：全量 `pytest`、三层 harness doctor 的运行结果。
- 验收：无新增失败；三层 doctor 全绿。
