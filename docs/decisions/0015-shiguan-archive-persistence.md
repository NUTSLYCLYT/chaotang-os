# 决策 0015：史馆档案持久化与旧案召回边界

## Status

Accepted — 2026-07-18

## Context

奏折决策链此前没有可跨进程重启保留的统一档案，也无法把已持久化的历史结论、复盘状态、
经验与教训安全地提供给后续六部、军机处和丞相处理。新增史馆后，需要同时确定本地持久化
所有权、前后端契约事实源、旧案上下文注入方向和自动归档的一致性边界。

本轮仅服务本地开发，不包含鉴权、敏感数据分级、保留/删除策略、迁移、外部史料、搜索引擎、
向量数据库或公开部署。证据的 `LIVE`、`MIXED`、`FALLBACK` 只描述来源形态，不裁定事实真伪。

## Decision

史馆使用 Python 标准库 `sqlite3` 和单一本地 SQLite 文件持久化，不引入 ORM。数据库默认位于
`backend/data/shiguan.sqlite3`，连接生命周期限制在单次存储操作内；运行态数据库及 WAL、SHM、
journal 边车文件均由 Git 忽略。

`app.shiguan.models` 是档案和复盘模型的事实源，`app.shiguan.recall.RecallMatch` 是旧案召回
响应的事实源；`review_status` 固定为 `{status, reviewed_at, note}` 或 `null`，HTTP 和前端层
不得复制或猜测另一套形状。review 与 recall 请求禁止未知字段，召回 `limit` 限定为 1–100。

丞相图完成分流后，每个部门只查询一次史馆，并把同一份冻结的 `RecallContext` 作为只读证据
传给六部、军机处和丞相终审。召回失败以 `available=false` 明确降级，不得伪装成“无旧案”。

自动归档的 `MEMORIAL` 与 `DECISION` 在同一 SQLite 事务中写入，任一校验或数据库操作失败都
整体回滚。内部返回可断言的 `ArchiveDecreeResult`，但既有丞相 HTTP 成功响应不新增归档字段，
也不宣称归档成功。`DECISION.department` 表示主责部门，`participating_departments` 表示全部
参与部门，`matter_type` 表示事项类型而非部门串；部门查询同时匹配主责部门和参与部门。

## Consequences

- 收益：五类档案与复盘记录可跨进程重启保留，归档不会留下孤立的半成品记录。
- 收益：召回上下文在一次决策内保持一致，前端、BFF 和后端共享同一严格响应契约。
- 收益：零新增生产依赖，所有离线测试可使用临时 SQLite 文件运行。
- 代价：SQLite 仅适用于当前本地单实例边界；并发扩展、迁移和备份能力需要后续决策。
- 限制：没有鉴权、数据分级或删除能力，不得承载本地开发边界以外的真实敏感数据。

## Verification

- `backend/.venv/Scripts/python.exe -m ruff check .`
- `backend/.venv/Scripts/python.exe -m pytest -q`
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`（在 `frontend/`）
- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`
- `git diff --check`
