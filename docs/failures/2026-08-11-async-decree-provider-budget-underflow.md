# 异步下旨任务在合法办理链完成前耗尽模型请求预算

## Summary

异步下旨已成功返回 `202` 且 Worker 已把任务推进到 `RUNNING`，但合法的单部门办理任务仍可能在形成回奏前以 `provider_budget_exceeded` 失败。既有测试证明了固定上限会被原子执行，却没有证明该上限足以覆盖真实批准路由。

## Root Cause

任务接收层为所有批准路由冻结同一个 `provider_request_limit=8`，而这个计数记录的是底层模型 HTTP 尝试，不是业务节点数。单部门一司的受控最坏路径包含部级选司、两轮司级工具循环、部级汇总和丞相定稿共 11 次结构化模型尝试；传输适配器又允许每次调用进行一次瞬时重试。因此固定上限会在合法、仍受控的执行路径完成前主动终止任务，多部门路径的缺口更大。与此同时，非供应商的结构化输出错误被映射为永久 `execution_failed`，没有使用 Worker 已有的一次安全任务重试。

## Prevention

任务接收时必须从已经验证且冻结的 `ApprovedRouteSnapshot` 计算请求预算，预算覆盖每个批准部门、批准司、军机处会审、丞相定稿以及每次调用的一次传输重试，并继续受绝对安全上限约束。只允许 `schema_invalid` 和 `content_unsupported` 进入一次任务级重试；供应商客户端错误、预算耗尽和未知状态错误继续失败关闭。旧任务保留其已冻结预算，不在迁移或重启时静默改写。

## Detection

`backend/tests/test_decree_provider_budget.py` 对单部门和多部门批准路由断言精确预算；`backend/tests/test_decree_job_storage.py` 断言绝对上限与持久化原子计数；`backend/tests/test_decree_job_executor.py` 断言脱敏的模型契约错误进入受控重试。联合回归必须包含异步接受、幂等恢复、Worker、任务 API、丞相图、六部和司级工具循环，不能用仅返回 `202` 或仅验证固定数字的测试代替。

## Evidence

- 运行态任务 `6b9e0504ec6052745594dc1a8a81db7e`：`RUNNING` 后以 `provider_request_count=8/8`、`provider_budget_exceeded` 终止。
- 运行态任务 `bd3bf8d620ba3cda43c961b1d61f68e8`：调用两次后以 `execution_failed/internal` 终止，证明队列可用但模型契约故障被错误视为永久失败。
- 修复验证入口：`backend/tests/test_decree_provider_budget.py`、`backend/tests/test_decree_job_executor.py`、`backend/tests/test_decree_async_integration.py`。
