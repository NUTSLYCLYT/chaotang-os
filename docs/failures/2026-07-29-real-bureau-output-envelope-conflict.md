# 真实司级输出因证据信封冲突降级

## Summary

通过 `/study` 页面真实调用 DeepSeek 时，丞相分流、部议、终审、页面展示与史馆归档均可完成，
但工部五司与礼部品牌司的专业意见稳定降级为 `model_synthesis_invalid`，用户无法获得司级能力包
承诺的专业输出。既有离线测试全部通过，未覆盖真实模型对组合提示的实际遵循情况。

## Root Cause

`backend/app/agents/bureaus/prompts.py` 的基础司级提示要求模型只返回
`{"opinion": "<非空意见>"}`，而启用证据会话后，
`backend/app/agents/bureaus/agent.py::_evidence_protocol_prompt()` 又要求同一次调用返回完整
`READY` 或 `NEEDS_DATA` 信封。真实 DeepSeek 首次调用稳定选择较早的裸 `opinion` 契约。

证据协议允许一次纠正调用；纠正后模型能够返回 `READY` 信封，但生成的
`factual_claims[].claim` 没有与意见中的非规范性子句逐句精确匹配，且把目标用户痛点等可验证
陈述标记为 `NORMATIVE`。严格校验因此继续拒绝响应并安全降级。多司流程还共享每旨一次的信封
纠正预算，放大了同类失败。

后续真实响应又暴露了第三种形状：模型返回了结构化 `READY`，但把本应位于顶层的
`adopted_evidence_ids` 与 `fact_basis` 错放进 `result`。协议把它归为
`uncited_fact_dependency`，而当时只允许裸 `opinion` 获取一次信封纠正；这种“接近正确但字段
错层”的结构会直接降级。最终修复将同一份按司计数的信封纠正扩展到所有
`uncited_fact_dependency`，并在静态纠正消息中明确四个顶层字段；事实内容校验与
`unsupported_factual_dependency` 的失败关闭语义保持不变。

## Prevention

- 司级提示必须只有一个权威输出契约；证据会话启用时不得同时保留裸 `opinion` schema。
- 真实 provider 验收必须覆盖首次响应和纠正响应，并验证最终经过证据协议解析后仍能形成司议，
  不能只验证 JSON 语法或离线 fake model。
- 信封纠正不应只识别裸对象；可解析但字段错层的 `READY` 也应获得同一司仅一次的脱敏 schema
  纠正机会。纠正消息不得回显被拒内容。
- 对严格逐句事实绑定，应提供模型可稳定遵循的单一 schema、明确的子句切分规则和真实响应
  兼容性测试；若仍无法稳定满足，应在不放宽 ADR 0028 证据边界的前提下重新设计确定性转换层。

## Detection

新增受控的真实 DeepSeek smoke（不进入默认 CI）时，应至少提交一条无需外部事实的单司建议类旨意，
并断言页面或 API 的 `bureau_opinions[].opinion` 不含 `model_synthesis_invalid`。同时记录脱敏后的
响应形状诊断：首次是否为裸 `opinion`、纠正后是否为 `READY/NEEDS_DATA`、以及证据协议的稳定错误码；
不得记录提示全文、API key 或完整敏感业务正文。

默认离线测试继续验证失败关闭，但不能把 fallback 文本存在视为真实能力成功。

## Evidence

- `backend/app/agents/bureaus/prompts.py`
- `backend/app/agents/bureaus/agent.py`
- `backend/app/agents/evidence_protocol.py`
- `backend/tests/test_bureaus_agent.py`
- `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
- 2026-07-29 页面实测：工部五司中四司为 `model_synthesis_invalid`、一司为
  `evidence_unavailable`；礼部品牌司为 `model_synthesis_invalid`，两次下旨均成功生成一条
  `REPLY`。
