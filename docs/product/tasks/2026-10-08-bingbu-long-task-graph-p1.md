# 任务：兵部 Revenue OS P1 长时任务 Graph + Bounded Loops 基础

## Status

Ready

## Product Definition

兵部 Revenue OS P0 已完成一次性导入、证据整理、DecisionPacket 和人工审批。P1 建立可恢复的长时任务执行内核，使一次销售作战可以跨进程暂停、恢复、重试、回放和人工接管，同时保持朝堂现有的 owner scope、证据优先、无隐式外部副作用和 DeepSeek-first/provider-agnostic 边界。

本任务只交付后端图与 Loop 基础，不把实验性自主 Agent 直接暴露给用户，也不改变 P0 API。

## Acceptance Criteria

- [ ] 有版本化、强类型的 graph run state、node attempt、loop policy、interrupt 和 terminal reason 模型。
- [ ] 图引擎支持确定性节点、顺序边、条件边和有界 fan-out/fan-in；join 只在全部分支达到确定终态后通过。
- [ ] 每个节点完成后写入 owner-scoped checkpoint 与 append-only event；重复恢复不重复执行已提交节点。
- [ ] Loop 同时受最大轮数、provider 请求预算、token 预算和 deadline 约束，并返回稳定 stop reason。
- [ ] 支持 `HUMAN_REVIEW` interrupt 与带版本校验的 resume；错误 resume、过期 resume 和跨 owner resume 必须拒绝。
- [ ] 节点重试采用显式 idempotency key；失败分类为 retryable、blocked、terminal，不允许无限重试。
- [ ] 全部自动化验证离线运行，不调用真实 DeepSeek、不访问 CRM、不发送邮件/消息、不执行 ActionDraft。
- [ ] 新增 RED→GREEN 测试、Ruff、Harness 检查通过；不修改 P0 API、前端路由和 ADR 0028。

## Delivery Constraints

- dev-mode: exempt：本 P1 只实现离线 graph/checkpoint/loop 内核，不调用模型网关；真实 DeepSeek 异构审查在启用 provider 前单独执行。
- 范围：仅允许修改 approval manifest 指定的长时任务基础文件、对应测试、任务合同和本任务 ADR。
- 依赖：复用仓库已锁定的 LangGraph 与 Python 标准库；不得新增模型供应商 SDK、队列服务或 Temporal。
- 安全：所有 checkpoint、event、resume token 按 owner scope 校验；不得把 token、凭据或原始客户资料写入日志。
- 兼容：不改变现有 `decree_jobs` 公共 API；通过适配边界为后续接入现有 worker 预留接口。

## Affected Modules

- 模块：长时任务状态模型、SQLite checkpoint/event 存储、LangGraph 编排适配、bounded loop policy、人工中断/恢复和单元测试。
- 允许路径：见 `.harness/approvals/BINGBU-LONG-TASK-GRAPH-P1-20261008.json` 的 `productPaths`。
- 依赖模块：`backend/app/decree_jobs/` 的 lease/deadline 语义、现有 `backend/app/langgraph_runtime/`、兵部 P0 的证据/DecisionPacket 契约。

## Technical Plan

1. 先写 RED：覆盖状态版本、owner 隔离、节点幂等、checkpoint 恢复、fan-out/fan-in、loop budget、deadline、interrupt/resume 和 terminal reason。
2. 实现纯模型与 reducer；图节点不得直接执行外部副作用。
3. 实现 owner-scoped SQLite store：runs、checkpoints、events、branch joins、resume tokens；事件只追加，状态由 checkpoint 恢复。
4. 实现 LangGraph adapter：用 typed state、conditional edges、`Send` fan-out 和 `interrupt`/`Command` resume；所有模型调用通过注入 provider，不在本任务创建真实 provider。
5. 实现 loop guard：`max_iterations`、`max_provider_requests`、`max_tokens`、`deadline_at` 和稳定 stop reason。
6. 运行聚焦测试、Ruff、后端回归和 Harness；完成后单独写 ADR 与验证证据。

## Verification Plan

- `backend/.venv/Scripts/python.exe -m pytest -q tests/test_long_task_graph.py tests/test_long_task_loops.py`
- `backend/.venv/Scripts/python.exe -m ruff check app/long_task_graph tests/test_long_task_graph.py tests/test_long_task_loops.py`
- `node scripts/check_harness.mjs --check`
- `node scripts/harness-doctor.mjs --check`
- `git diff --check`

## Non-goals

- 不接真实 DeepSeek 或 LiteLLM
- 不新增 CRM、邮件、微信或其他外部 side effect
- 不修改兵部 P0 HTTP API
- 不改前端页面或浏览器 BFF
- 不引入 Temporal、Celery、Kafka 或新的队列基础设施
- 不改 ADR 0028、product authority、Harness 和 CI
- 不宣称生产多实例部署已完成

## Implementation Report

- 改动摘要：Pending
- 自审：Pending
- 验证：Pending
- 实际使用的 skill：pc-agent-design、verification-before-completion、git-workflow-and-versioning
- 验证命令与结果：Pending
- 未运行项与原因：Pending
- 剩余风险：Pending

## Acceptance Review

- 验收结果：Pending
- 验收证据：Pending
- 未通过项：Pending

Approval lineage: re-anchored to latest ext-dev before product execution; product scope and non-goals are unchanged.
Approval lineage: synchronized to ext-dev head 343deeff8573d9943cbcbe00803800182e527294 before candidate generation.
Approval verification uses repository-pinned uv through Node on Windows authority hosts.
Approval verification wrapper paths are repository-root relative on Windows authority hosts.
Approval lineage: synchronized to ext-dev head 5ab87cd6ac1a65acc5e5481e80dbd13bba1c79cc before candidate generation.
Approval lineage: synchronized to ext-dev head 1687ca5c7dc89f0de545dc6f0a87fb12106dfad7 before candidate generation.
