# 下旨任务无人消费但就绪探针假绿

## Summary

页面下旨已收到 HTTP 202 并持久化为 `QUEUED`，但默认启动的后端没有创建任务 worker，导致前端持续轮询且永远没有回奏；与此同时 `/readyz` 仍返回 ready。

## Root Cause

`app.main` 把 decree worker 设成只有 `CHAOTANG_DECREE_JOB_WORKER_ENABLED` 显式为真才启动的可选组件，而仓库标准启动命令和示例环境没有启用该变量。持久队列的 API 接受路径与 worker 消费路径因此被拆开：请求可以成功入队，却没有进程执行 `claim_next()`。readiness 只检查离线配置、存储 schema 和凭据，没有检查 worker 线程是否存在且存活，于是无法发现这个用户可见断点。

## Prevention

标准后端进程缺省启动 decree worker；仅在显式假值配置下关闭。worker 提供只读存活检查，`/readyz` 把 worker 缺失或线程死亡报告为稳定的 `worker_not_running` 503。持久租约仍是并发与恢复的事实源，没有绕过队列、重试、草案有效性或 ADR 0028 的证据治理边界。

## Detection

`backend/tests/test_decree_async_integration.py` 验证无环境开关时应用 lifespan 会启动并停止恰好一个 worker；`backend/tests/test_readiness.py` 验证停止的 worker 会令 `/readyz` 返回 503。真实验收还必须观察一个已接受 job 从 `QUEUED` 进入 `RUNNING` 或终态，并确认终态后前端停止轮询；单独看到 HTTP 202 或 `/readyz` 200 不构成通过。

## Evidence

- `backend/app/main.py`：默认 worker 生命周期与运行态 readiness 门禁。
- `backend/app/decree_jobs/worker.py`：worker 线程存活状态。
- `backend/tests/test_decree_async_integration.py`：默认启动回归测试。
- `backend/tests/test_readiness.py`：`worker_not_running` 回归测试。
- `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`：下旨证据流不可变基线。
- 真实 job `e52f2a2c09796f4f6af384c4276245fa`：修复前持久化 `QUEUED` 且零尝试；重启后被消费并以 `retry_exhausted` 持久化失败终态，页面显示明确模型失败信息并停止轮询。
