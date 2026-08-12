# 任务：修复下旨后永久无回奏

## Status

Ready

## Product Definition

- 用户确认：用户于 2026-08-11 确认按最小异步修复方案处理。
- 问题：`/study` 下旨返回已受理后，任务可能永久停留在 `QUEUED`，页面无法得到回奏或明确失败。
- 目标用户：通过上书房正式下旨的已认证用户。
- 目标：标准后端启动后异步 worker 必须消费任务；worker 不可用时 readiness 失败；页面在终态停止轮询并显示真实回奏或稳定错误。
- 产品补充确认：用户于 2026-08-11 明确要求“下旨永远都能下旨”，并批准“永远受理、如实回奏”设计及相关业务契约变更。材料不足改为下旨后的正式 `NEEDS_INPUT` 回奏，不再阻止下旨。
- 非目标：不改变 ADR 0028 的丞相、部门办理、证据与史馆归档主流程，不退回同步长请求，不伪造成功结果，不提交、推送或部署。

## Acceptance Criteria

- [ ] 未配置 `CHAOTANG_DECREE_JOB_WORKER_ENABLED` 时，应用 lifespan 启动且只启动一个 worker，并在关闭时停止它。
- [ ] worker 缺失或线程死亡时，`GET /readyz` 返回 `503` 与 `worker_not_running`。
- [ ] 已受理任务从 `QUEUED` 进入运行态或终态，不再因无人消费永久等待。
- [ ] 前端轮询在 `SUCCEEDED`、`FAILED` 或 `CANCELLED` 后停止，并显示真实回奏或稳定脱敏错误。
- [ ] 一旨一条 `REPLY`、owner 隔离、冻结路由、证据和成果发布边界保持不变。
- [ ] 已认证用户提交非空旨意时，【下旨】不受拟旨状态或材料预检结果限制，后端持久化后返回 `202` 和任务标识。
- [ ] 材料不足、路由不明确或数据来源不可用时，已受理任务最终形成说明缺失项和补充方式的 `NEEDS_INPUT` 回奏。
- [ ] 不可恢复的执行异常最终形成脱敏 `FAILED` 回奏；任何已受理任务不得永久停留在 `QUEUED` 或 `RUNNING`。
- [ ] 最终版本按固定验收流程连续通过 10 轮；任一轮失败或代码、配置、流程变化后从第 1 轮重计。

## Delivery Constraints

- 范围：异步下旨 worker 生命周期、readiness、前端轮询、对应测试和故障/交付文档；以及为完成验收所需的 Next.js Route Handler 导出边界修复。
- 兼容性：保持 ADR 0028 主业务链与 ADR 0039 异步持久化架构，并遵循 ADR 0041 的永远受理契约；显式 `CHAOTANG_DECREE_JOB_WORKER_ENABLED=false` 仍允许测试或维护场景关闭 worker。
- 风险与限制：不得调用真实模型、真实外网或生产写入；运行态数据库只做只读诊断，测试使用临时目录。
- 技能计划：`systematic-debugging`、`brainstorming`、`writing-plans`、`test-driven-development`、`codex-engineering-workflow`、`record-failure`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：异步下旨作业生命周期、健康门禁、上书房轮询反馈、Next.js BFF 入口模块边界。
- 允许路径：`backend/app/main.py`、`backend/app/decree_jobs/worker.py`、相关 backend tests、`frontend/src/app/study/studySubmission.*`、`frontend/src/app/api/**/route.ts`、受影响路由的相邻 `handler.ts` 与测试、本任务相关 docs。
- 依赖模块：既有 `DecreeJobStore`、`PersistentDecreeJobExecutor`、Next.js BFF 与史馆幂等归档。

## Technical Plan

- 架构边界：FastAPI lifespan 持有单 worker；SQLite 作业存储继续作为恢复和并发事实源；readiness 同时检查离线配置/存储与 worker 存活；浏览器只消费 owner-scoped BFF 状态。
- 接口与依赖：不新增公开端点；保持 `POST /api/v1/decrees/chancellor` 的 `202`、作业 GET/取消契约及终态响应。
- 实施顺序：验证旧故障测试 → 核对默认 worker 与 readiness 实现 → 核对终态轮询 → 全套验证 → 连续 10 轮验收。
- 验证计划：backend focused/full pytest、Ruff、compileall；frontend test/lint/typecheck/build；harness 四项；`git diff --check`；固定验收组合连续 10 轮。
- 技术风险：常驻旧进程不会自动加载修复，验收后必须明确提示重启；真实模型成功回奏仍受供应商可用性影响，但不得再无限等待。

## Implementation Report

- 改动摘要：待验收后填写。
- 自审：待验收后填写。
- 验证：待验收后填写。
- 实际使用的 skill：待验收后填写。
- 验证命令与结果：待验收后填写。
- 未运行项与原因：待验收后填写。
- 剩余风险：待验收后填写。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待完成连续 10 轮后填写。
- 未通过项：待验收。
