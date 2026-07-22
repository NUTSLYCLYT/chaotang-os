# 史馆双文种归档设计

## 背景

当前史馆把 `MEMORIAL`、`DECISION`、`TASK_RESULT`、`KNOWLEDGE`、`PUBLICITY`
并列为五种档案。这个分类混合了业务公文、处理阶段和内容属性：下旨链路还会把旨意原文
伪装成一份 `MEMORIAL`，再创建一份 `DECISION`。这既不符合实际业务流，也让用户难以理解
史馆中的每条记录究竟是什么。

用户于 2026-07-20 确认：史馆的公开业务档案只保留“奏折”和“回奏”，并委托自动交付。

## 产品模型

史馆只公开两种业务文种：

- `MEMORIAL`（奏折）：由真实的上奏/呈报行为产生，记录向上提交的原始公文。
- `REPLY`（回奏）：由对旨意或奏折的办理流程产生，记录办理过程和最终答复。

`TASK_RESULT`、`KNOWLEDGE`、`PUBLICITY` 不再是档案类型。经验、教训、证据、复盘状态继续
作为档案属性存在，不升级为独立文种。

## 数据契约

两类档案共享现有通用字段：`id`、`type`、`title`、`content`、`matter_type`、
`department`、`related_archive_ids`、`evidence`、`created_at`、`lessons_learned`、
`pitfalls`、`review_status`。

`REPLY` 额外要求：

- `source_kind`：`DECREE` 或 `MEMORIAL`，表明回奏针对旨意还是奏折。
- `source_text`：本次办理所依据的旨意或奏折原文快照。
- `participating_departments`：全部参与部门。
- `reply_process`：办理路径和过程说明。
- `reply_conclusion`：回奏结论。
- `reply_time`：ISO 8601 时间。
- `respondent`：回奏责任主体。

`MEMORIAL` 不得携带上述回奏专属字段。针对奏折形成的回奏通过
`related_archive_ids` 指向对应 `MEMORIAL`；针对旨意形成的回奏直接把旨意原文保存到
`source_text`，不再制造一份假的奏折。

## 业务流

### 下旨

丞相流程完成后只创建一条 `REPLY`。旨意原文进入 `source_text`，结构化办理结果进入
回奏专属字段。归档失败仍不得把已成功的下旨 HTTP 响应改成失败，也不得在响应中宣称归档
成功。

### 奏折与回奏

真实奏折由独立的上奏行为创建。后续回奏必须以 `source_kind=MEMORIAL` 并通过关系字段关联
该奏折。本次不新增奏折提交页面或新的业务 API，只收敛已有史馆创建接口和类型契约。

## 历史数据迁移

SQLite 引入显式 schema 版本和事务迁移：

1. 既有 `DECISION` 改为 `REPLY`，`decision_*`/`responsible_owner` 数据迁移到对应的
   `reply_*`/`respondent` 字段。
2. v1 没有不可伪造的来源标记，因此标题、正文、部门和关系形状不得作为通用自动删除规则。
   只有进入显式确认名单的旧 `DECISION`/`MEMORIAL` 对，才把奏折正文迁入 `source_text`，
   删除该自动生成的假奏折及其附属关系；迁移后的回奏使用 `source_kind=DECREE`。
3. 未进入确认名单的旧 `DECISION` 或歧义关系不删除；迁移必须以明确错误中止并回滚，交由
   人工处理。用户已于 2026-07-20 确认当前本地库中的两对记录均为下旨自动产物。
4. 数据库中若存在 `TASK_RESULT`、`KNOWLEDGE`、`PUBLICITY`，迁移同样中止并提示人工处理，
   不静默删除或改名。
5. 新库直接创建最新 schema；迁移测试只使用临时数据库，不接触真实运行数据。

## 前端体验

史馆筛选只显示“全部 / 奏折 / 回奏”。卡片对回奏展示来源、办理部门、办理过程、结论、时间
与回奏主体；奏折保持通用内容展示。前端、Next.js BFF 和 FastAPI 必须共享两类型契约，旧
类型和不完整回奏按契约错误处理，不偷偷映射成其它类型。

## 安全与兼容边界

- 不新增依赖，不引入 ORM 或外部数据库。
- 不触发真实 DeepSeek 请求，不点击真实“下旨”。
- 保留复盘、统计、召回的既有可用能力；召回摘要改为优先使用回奏结论。
- 本次不做鉴权、数据分级、删除 UI、备份系统或全文检索。
- 未经用户单独授权，不提交、不推送、不部署。

## 验收

- 模型、API、BFF、页面只接受并展示 `MEMORIAL` 与 `REPLY`。
- 下旨自动归档只产生一条 `REPLY`，原旨意保存在 `source_text`。
- 经显式确认的旧 `DECISION + 自动 MEMORIAL` 可在临时库中原子迁移为单条 `REPLY`。
- 含不支持类型或歧义关联的旧库迁移失败并完整回滚。
- 召回、复盘、统计功能在新契约下通过离线测试。
- 后端 lint/test、前端 lint/typecheck/test/build、harness 与 `git diff --check` 通过。
