# 司级模型瞬时读超时导致整道旨意失败

## Summary

浏览器能够完成拟旨，但正式下旨在司级办理阶段间歇性返回 HTTP 502，无法得到回奏。相同旨意的真实后端闭环采样中出现一次成功、两次失败，失败均由供应商读超时触发。

## Root Cause

DeepSeek SDK 被配置为 `max_retries=0`、单次超时仅 30 秒，应用适配层也只调用一次。正式下旨会串行执行多个模型节点，真实响应可能接近或超过 30 秒；任一司级调用发生 `APITimeoutError`/`ReadTimeout`，都会被证据协议映射为 `model_unavailable`，再使完整旨意失败关闭。业务层既没有足够的正常响应窗口，也没有一次受控的瞬时连接恢复机会。

## Prevention

DeepSeek 适配层把单次请求超时提高到 60 秒，并仅对 `APITimeoutError` 与 `APIConnectionError` 最多进行两次立即重试（三次总尝试）。HTTP 4xx、结构化响应错误、证据协议错误及其他业务异常继续失败关闭，避免用广泛重试掩盖确定性错误或重复扩大外部调用。

单个逻辑调用因此最多可能占用约 180 秒，前端原有 120 秒总等待预算会在编排尚未完成时抢先中止。ADR 0029 将拟旨默认等待调整为 570 秒，并将正式下旨的过渡性等待调整为 900 秒；全六部链路仍需通过异步作业架构根治。

## Detection

`backend/tests/test_deepseek_client.py` 断言客户端超时为 60 秒，并使用真实 OpenAI SDK 异常类型和模拟客户端，证明第一次超时、第二次成功时恰好调用两次；现有通用异常测试继续证明非瞬时异常不会被重试。正式验收必须在获得外部调用授权后，通过浏览器连续完成拟旨、下旨和回奏，单次成功不能替代重复验证。

## Evidence

- [DeepSeek 客户端](../../backend/app/langgraph_runtime/deepseek_client.py)
- [DeepSeek 客户端回归测试](../../backend/tests/test_deepseek_client.py)
- [司级证据协议](../../backend/app/agents/evidence_protocol.py)
- [正式下旨图](../../backend/app/agents/chancellor/graph.py)
- 真实脱敏失败链：`ChancellorGraphInvocationError(stage=bureau)` → `MinistryAgentInvocationError(stage=bureau)` → `BureauAgentInvocationError(stage=bureau)` → `ReadTimeout`。
