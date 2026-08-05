# DeepSeek JSON 拟旨被默认思考耗尽输出预算

## Summary

浏览器真实拟旨在相同账号和相同入口下间歇性返回 HTTP 502，导致用户无法进入正式下旨。离线测试此前全绿，但没有覆盖 DeepSeek V4 默认开启思考模式后的真实输出预算行为。

## Root Cause

`build_deepseek_chat_model(..., json_output=True)` 为结构化输出设置了 `max_tokens=2500`，却没有显式关闭 DeepSeek V4 默认开启的思考模式。真实失败样本以 `finish_reason=length` 结束，`message.content` 长度为 0；输出预算被思考内容耗尽后，拟旨图连续三次都无法取得可解析 JSON，最终经后端和 BFF 映射为脱敏 502。

## Prevention

所有使用当前 DeepSeek V4 模型的确定性 JSON 输出调用都显式关闭思考模式，使有限输出预算用于最终 JSON 正文。文本对话保持现有模式不变；不得用提高前端超时掩盖空正文，也不得依赖 provider 对 JSON 空输出的偶然优化。

## Detection

`backend/tests/test_deepseek_client.py` 必须断言 `json_output=True` 的请求同时包含 `response_format={"type": "json_object"}` 与 `extra_body={"thinking": {"type": "disabled"}}`，普通文本请求则不携带该开关。正式验收还必须在获得外部调用授权后，通过浏览器 UI 连续完成拟旨、下旨和回奏闭环；只跑 mock、健康检查或模型目录查询不能证明真实生成可用。

## Evidence

- [DeepSeek 客户端](../../backend/app/langgraph_runtime/deepseek_client.py)
- [DeepSeek 客户端回归测试](../../backend/tests/test_deepseek_client.py)
- [拟旨图](../../backend/app/agents/chancellor_draft/graph.py)
- [DeepSeek JSON Output 官方说明](https://api-docs.deepseek.com/guides/json_mode/)
- [DeepSeek Thinking Mode 官方说明](https://api-docs.deepseek.com/guides/thinking_mode)
- 浏览器证据：`POST /api/drafts/chancellor` 间歇性返回 502；脱敏直连样本为 `finish_reason=length`、`content length=0`、`JSONDecodeError` 位置 0。

