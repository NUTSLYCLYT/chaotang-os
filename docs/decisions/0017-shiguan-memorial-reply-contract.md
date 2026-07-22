# 决策 0017：史馆奏折与回奏双文种契约

## Status

Accepted — 2026-07-20

## Context

ADR 0015 把 `MEMORIAL`、`DECISION`、`TASK_RESULT`、`KNOWLEDGE`、`PUBLICITY`
并列为五类档案，并要求下旨后在一个事务中写入 `MEMORIAL + DECISION`。这个模型把业务
公文、处理阶段和内容属性混为一体：下旨流程会把旨意原文制造成一份并不存在的“奏折”，
而“决策”“任务结果”“知识”“宣传”也不是史馆业务流中的公文文种。

产品已于 2026-07-20 确认史馆只保留奏折和回奏，并分次确认当前运行库中的四组
`DECISION + MEMORIAL` 都是既有下旨流程自动生成的记录，允许在迁移前备份数据库后将每组
合并为一条 `REPLY` 并删除对应假奏折。旧 schema 没有可靠的来源标记，因此不能把关系形状、
标题或正文模式当作通用迁移依据。

## Decision

史馆公开业务档案类型收敛为：

- `MEMORIAL`（奏折）：只能由真实上奏或呈报行为创建。
- `REPLY`（回奏）：由办理旨意或奏折的流程创建。

两类档案继续共享 ADR 0015 确立的通用字段、证据、经验教训、复盘状态和关联能力。
`REPLY` 额外要求 `source_kind`（`DECREE` 或 `MEMORIAL`）、`source_text`、
`participating_departments`、`reply_process`、`reply_conclusion`、`reply_time` 与
`respondent`；`MEMORIAL` 不得携带这些回奏专属字段。

来源关系必须满足以下约束：

- `source_kind=DECREE` 时，旨意原文快照保存在 `source_text`，且不得关联档案。
- `source_kind=MEMORIAL` 时，必须且只能通过 `related_archive_ids` 关联一条真实
  `MEMORIAL`，且 `source_text` 必须等于该奏折正文快照。

下旨流程完成后只在一个 SQLite 事务中创建一条 `REPLY`，不再创建假 `MEMORIAL`；归档
失败仍不得改写既有下旨 HTTP 成功契约或在响应中宣称归档成功。真实奏折到后续回奏的关联
仍由同一事务保证完整性。

SQLite schema 升级为 v2。v1 没有 provenance，因此迁移函数只接受调用方显式提供的
`confirmed_pairs`，并逐对核验它确实是该 `DECISION` 的唯一关系、对应 `MEMORIAL` 未被共享
且没有出向关系。所有旧 `DECISION` 都必须得到显式确认；存在未确认或歧义关系，或存在
`TASK_RESULT`、`KNOWLEDGE`、`PUBLICITY` 等不支持的旧类型时，迁移整体失败并回滚，不推断、
不删除、不静默改名。当前运行库经用户确认的四对记录必须先备份，再显式传入确认映射执行
一次性迁移。

本决策取代 ADR 0015 中“五类档案”和“下旨自动写入 `MEMORIAL + DECISION`”的部分。
ADR 0015 关于 Python 标准库 `sqlite3`、短连接、本地单文件数据库、召回上下文只读注入、
复盘响应形状、归档原子事务和不暴露归档结果的决策继续适用。本次不新增 ORM 或任何生产
依赖。

## Consequences

- 收益：史馆类型与真实业务公文一致，界面和 API 不再暴露伪奏折或阶段性内容分类。
- 收益：旨意和奏折两种来源都有明确、可校验的来源快照及关系语义。
- 收益：历史迁移以显式确认和事务回滚为安全门禁，不会凭启发式规则误删真实奏折。
- 代价：v1 数据必须先人工确认映射；包含未知类型或歧义关系的库会拒绝自动升级。
- 代价：运行库迁移需要先生成可恢复备份，并作为独立运维动作执行。
- 限制：仍是本地单实例 SQLite；本次不引入鉴权、数据分级、备份系统、删除 UI 或全文检索。

## Verification

- `backend/.venv/Scripts/python.exe -m ruff check .`
- `backend/.venv/Scripts/python.exe -m pytest -q`
- `npm run lint`（在 `frontend/`）
- `npm run typecheck`（在 `frontend/`）
- `npm test`（在 `frontend/`）
- `npm run build`（在 `frontend/`）
- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `git diff --check`
