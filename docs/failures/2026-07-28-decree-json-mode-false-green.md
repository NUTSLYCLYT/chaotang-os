# 下旨链路未启用 JSON Output 导致的假绿

## Summary

下旨链路要求模型返回结构化 JSON，但共享 DeepSeek SDK 适配器没有启用 JSON
Output。模型返回不稳定的非 JSON 内容时，严格解析失败并最终映射为用户可见的
`model_unavailable`。

## Root Cause

业务 Agent 的提示词和解析器都采用严格 JSON 契约，但
`backend/app/langgraph_runtime/deepseek_client.py` 调用
`chat.completions.create(...)` 时只传入模型和消息，没有传入
`response_format={"type": "json_object"}`。既有客户端测试只断言了旧参数，
因此验证了实现现状而没有验证结构化输出契约，形成假绿。

## Prevention

在共享 DeepSeek 适配器提供默认关闭的 JSON Output opt-in，只允许明确依赖严格
JSON 契约的下旨丞相生产图显式启用。通用 DeepSeek 图和丞相咨询继续使用默认自由
文本模式，避免把局部结构化输出要求扩散为全局 provider 行为。保留现有严格解析和
安全失败行为，不增加静态回奏或宽松解析 fallback。

## Detection

离线测试 `backend/tests/test_deepseek_client.py` 分别断言默认 SDK 调用不包含
`response_format`，以及显式 `json_output=True` 时包含
`response_format={"type": "json_object"}`。下旨图测试必须断言生产构造显式
opt-in；通用图和丞相咨询测试必须断言保留默认自由文本模式。所有测试通过 mock
隔离网络和密钥。`node scripts/check_harness.mjs` 校验本故障记忆的章节完整性。
真实 provider 仍可能返回空内容，因此现有空响应和不可信响应测试继续作为安全失败
检测点。

## Evidence

- 业务基线：[ADR 0028](../decisions/0028-decree-evidence-flow-governance-baseline.md)
- 修复位置：`backend/app/langgraph_runtime/deepseek_client.py`、
  `backend/app/agents/chancellor/graph.py`
- 回归测试：`backend/tests/test_deepseek_client.py`
- 构造边界测试：`backend/tests/test_chancellor_graph.py`、
  `backend/tests/test_deepseek_graph.py`、
  `backend/tests/test_chancellor_consult_graph.py`
- 相关 API 测试：`backend/tests/test_decrees_api.py`
