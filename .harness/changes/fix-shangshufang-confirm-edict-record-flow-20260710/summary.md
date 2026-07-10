# 变更摘要：fix-shangshufang-confirm-edict-record-flow-20260710

| 字段 | 值 |
| --- | --- |
| Change ID | fix-shangshufang-confirm-edict-record-flow-20260710 |
| 类型 | fix |
| 状态 | IMPLEMENTED |
| Owner | Project Agent |
| 创建日期 | 20260710 |

## 范围

- 主线：上书房确认下旨流程。
- 事实源：`backend/web/routers/shangshufang.py` 的 `/api/shangshufang/confirm-edict`。
- 前端边界：`frontend/src/features/shangshufang/ShangshufangPage.tsx` 只停止确认后自动触发蜂群深挖，保留下旨记录展示和状态入口。
- 后端边界：确认下旨只生成下旨记录与初始 review 留痕，不在同一请求内同步等待回奏。

## 关键结果

- 复杂任务确认下旨后返回 `edict_recorded` 和 `decree_record`。
- `confirm-edict` 不再同步调用 `_run_swarm_execution_loop_sync`，避免长耗时 LLM/蜂群链路导致代理 `ECONNRESET` 或 500。
- 前端下旨成功后不再调用 `shangshufangSwarmDeepen`，不会把页面重新带入“等待回奏”路径。
- 回归测试与本地运行时接口链路均已验证通过。
