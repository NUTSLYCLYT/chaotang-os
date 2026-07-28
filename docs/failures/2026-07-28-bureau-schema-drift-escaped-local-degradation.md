# 司级结构漂移穿透本地降级边界

## Summary

真实 `/study` 连续验收在第 6 次出现用户可见“模型调用失败”。脱敏生命周期记录为
`bureau/schema_invalid`，表明司级模型内容漂移被错误升级成整单失败。

## Root Cause

`invoke_bureau_with_evidence` 会把非 JSON 或非法结构响应归类为可本地降级的
`response_invalid`，但 `invoke_bureau_agent` 捕获 `EvidenceProtocolError` 后无条件包装为
`BureauAgentInvocationError`。上层因此无法区分内容漂移和供应商失败，最终中止整个下旨流程。

## Prevention

司级证据边界复用共享的可信异常分类器：仅 `schema_invalid` 与
`content_unsupported` 返回固定安全意见并记录司级降级；`provider_unavailable` 和未知状态仍然
fail-closed。拒绝的模型正文不得进入回奏、日志或公开错误。

## Detection

`backend/tests/test_bureaus_agent.py` 覆盖带证据会话的非法司级正文降级，以及同一路径上的供应商
异常继续 fail-closed。真实验收必须在任一次失败后归零，并重新完成 10 次串行成功与逐次
`REPLY` 数量增量检查。

## Evidence

- `backend/app/agents/bureaus/agent.py`
- `backend/app/agents/synthesis_failures.py`
- `backend/tests/test_bureaus_agent.py`
- `docs/decisions/0031-deterministic-decree-synthesis-boundaries.md`
- `docs/product/tasks/2026-07-28-fix-decree-model-invocation.md`
