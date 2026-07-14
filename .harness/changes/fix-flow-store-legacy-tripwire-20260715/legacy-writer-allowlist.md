# P2 legacy writer 精确白名单

默认策略：`FENGQUN_LEGACY_WRITE_TRIPWIRE` 未设置时启用；writer ID 缺失、未知或请求未登记 operation，必须在 mutation 前失败。`=0/false/off` 仅作事故止血，命中会记录 `rollback_bypass`，不得作为长期配置。

| Writer ID | 当前调用点 | 允许 operation | 到期/移除条件 |
| --- | --- | --- | --- |
| `chaotang-router-p3-pending` | `web/routers/chaotang.py` | task/decree/review/retrospective legacy writes；review JSON copy | P3 对应端点逐个吸收后删除；不得整体续期 |
| `chaotang-orchestrator-p3-pending` | `_persist_task_done/_persist_task_error` | task status、memorial upsert | P3c/P3d 改走 canonical outbox 后删除 |
| `chaotang-store-p3-pending` | `src/chaotang_store.py` JSON+SQLite compatibility writer | review、retrospective 双写 | P3a/P3e canonical 单写完成后删除 |
| `flow-store-backfill` | `scripts/backfill_flow_db.py` | memorial/review/retrospective 回填 | P3e 表只读后冻结脚本并删除 |
| `pytest-flow-store` | pytest only | 7 个 flow-store 写 operation | 仅 `FENGQUN_TEST_DB_GUARD=1` 可用，不得用于生产 |
| `pytest-chaotang-store` | pytest only | chaotang-store 双写及其 SQL 写 | 仅 `FENGQUN_TEST_DB_GUARD=1` 可用，不得用于生产 |

架构守门同步冻结当前 import 面：后端只允许上述四个生产文件 import legacy write symbols；前端只允许 P4 清单中的六个现存生产文件 import 本地决策引擎。任何新增项必须先修改本 change/后续 Packet 的显式清单并独立评审，不能用目录通配。

回滚顺序：先设全局 tripwire 开关止血并保留计数 → 定位 `legacy_writer_calls_total{outcome="rollback_bypass"}` → 修复/登记精确调用点 → 恢复默认启用。禁止通过新增 `*` writer 或 operation 通配回滚。
