# 任务：兵部 Graph → decree_jobs Worker 适配 P2

## Status

Accepted

## Product Definition

P1 已建立可恢复的长时任务 Graph、checkpoint、人工中断和 bounded loops。本 P2 将其接入现有 `decree_jobs` worker，使 Graph run 复用既有 lease、heartbeat、deadline、取消和失败重试语义，并提供 owner-scoped 运行态查询与人工 resume 边界。

本任务只做后端桥接和离线 API；不接真实 DeepSeek、不执行 CRM/邮件/消息副作用、不改前端。

## Acceptance Criteria

- [x] Graph bridge 复用 `DecreeJobControl` 的 lease、deadline 和 cancellation checks，不创建第二套 worker ownership。
- [x] 同一 `decree_job` 只映射一个 owner-scoped graph run，重试和进程恢复不重复创建 run。
- [x] Graph checkpoint 与 decree job 的 `job_id + node + attempt` 幂等语义可追踪。
- [x] 运行态查询只返回安全摘要（状态、节点、revision、digest、terminal reason），不泄露原始客户状态或 resume token。
- [x] 人工 resume 需要 owner、revision 和 token 校验；错误 owner、revision、过期 token 返回稳定 4xx。
- [x] 取消、deadline、lease lost 分别映射到现有 worker 控制流，不吞掉租约冲突。
- [x] provider 通过注入接口保留 DeepSeek-first/provider-agnostic 边界；测试不调用真实 provider。
- [x] RED→GREEN 测试、Ruff、Harness 检查通过；不修改 P0 既有行为。

## Delivery Constraints

- 允许修改路径：见 approval manifest 的 `productPaths`。
- 复用现有 `decree_jobs` SQLite 文件和 lease；不得新增队列、Temporal、Celery 或供应商 SDK。
- API 必须按认证 owner 查询；不得接受请求体自报 owner。
- 运行态响应不返回原始 Graph state、resume token 或凭据。

## Affected Modules

- 模块：long_task_graph 与 decree_jobs worker bridge、decree-jobs 运行态 API、对应后端测试。
- 允许路径：见 `.harness/approvals/BINGBU-GRAPH-WORKER-P2-20261008.json` 的 `productPaths`。

## Technical Plan

1. 先写 RED：覆盖 run 映射幂等、lease/cancel/deadline、owner 隔离、graph status 和 resume 错误边界。
2. 实现 `DecreeJobGraphAdapter`，从 `DecreeJobControl` 复用已有控制面，把 graph store 绑定到相同 SQLite 文件。
3. 扩展 `DecreeJobControl` 的 graph advance 边界，不改变默认 executor 流程。
4. 在现有 decree-jobs API 增加 graph summary 与 resume 端点，只返回安全摘要。
5. 用 fake provider/纯节点验证 provider 注入和无外部副作用。

## Verification Plan

- `uv run --project backend pytest -q backend/tests/test_long_task_graph_decree_jobs.py backend/tests/test_decree_jobs_graph_api.py`
- `uv run --project backend ruff check backend/app/long_task_graph backend/app/decree_jobs/worker.py backend/app/api/decree_jobs.py backend/tests/test_long_task_graph_decree_jobs.py backend/tests/test_decree_jobs_graph_api.py`
- `node scripts/check_harness.mjs --check`
- `git diff --check`

## Non-goals

- 不接真实 DeepSeek、LiteLLM 或其他 provider SDK。
- 不改变现有 decree_jobs 创建、归档、发布公共行为。
- 不新增 CRM、邮件、微信、消息或 ActionDraft side effect。
- 不修改前端路由和 UI。
- 不引入新队列、Temporal、Celery、Kafka 或多实例部署承诺。

## Implementation Report

- 改动摘要：P2 产品实现提交为 `cda20573`，新增 `DecreeJobGraphAdapter`、worker graph advance/resume 边界和 owner-scoped 安全摘要 API；复用既有 lease/heartbeat/deadline/cancellation，不改变 P0 API 或前端。
- 自审：每个 `decree_job` 通过 owner + job 映射到唯一 graph run，checkpoint/event 使用 `job_id + node + attempt` 幂等键；状态查询不返回原始 graph state、resume token 或凭据；provider 仍为注入接口，未调用真实 DeepSeek。
- 验证：P2 focused pytest `6 passed`；P2 范围 Ruff 通过；Harness `--check` 通过（159 个基线文件）、`--self-test` 通过（175 项）；`git diff --check` 通过。P0/P1 后端测试在同一基线已全绿。
- 实际使用的 skill：pc-agent-design、verification-before-completion、git-workflow-and-versioning
- 验证命令与结果：按 P2 approval manifest 的 focused tests、Ruff、Harness 检查均通过；未访问网络、CRM、消息系统或模型网关。
- 未运行项与原因：未运行真实 provider smoke、前端 UI 检查或多实例生产部署，这些均明确属于 non-goals。
- 剩余风险：P2 只提供后端桥接和安全摘要；动作执行器、真实 provider、CRM 写入和前端运行态视图需要后续 exact task。

## Acceptance Review

- 验收结果：Accepted（2026-10-08）
- 验收证据：逐条核对 8 项验收标准均满足；P2 candidate `cda20573` 已在 `origin/ext-dev`，focused pytest、Ruff、Harness 与差异检查均有新鲜结果。
- 未通过项：无。真实 provider、Action Gateway 与前端运行态属于后续任务。
Approval lineage: synchronized to governance baseline 01cd91d00aa9ee735c350e9d7d76ee6437b727fd.

