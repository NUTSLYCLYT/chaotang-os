# 决策 0031：下旨确定性合成边界

## Status

Accepted — 2026-07-28

## Context

下旨流程依赖模型在司级、部级、军机处和丞相汇总阶段返回严格 JSON。真实模型即使启用 JSON
Output，也只能保证 JSON 语法，不能保证业务 schema。此前按观测到的具体漂移逐个修补，
导致同一旨意偶尔成功、随后又因新的响应形状返回统一 `model_unavailable`。单次成功无法证明
流程稳定，统一 502 又缺少安全的内部失败阶段。

ADR 0028 已规定不可变的业务拓扑、证据采用和史馆归档规则。本决策只明确模型内容与确定性
编排代码的职责边界，不改变该基线。

## Decision

- 下旨拓扑、节点顺序、响应字段、部门顺序、建议数量和归档时机由代码确定性控制。
- 模型只生成当前节点的候选内容，不能改变流程结构。
- 明确列举且可安全隔离的内容/schema 错误在发生节点丢弃，使用不依赖被拒内容的确定性安全
  降级，并记录 degradation。
- 被拒绝的模型正文不得进入后续节点、证据采用、HTTP 成功响应或史馆归档。
- 网络、认证、配置、SDK 调用、身份、不变量和未知程序错误继续整旨失败。
- 内部诊断只使用固定阶段、稳定错误码、节点标识和时间；禁止记录旨意、提示词、模型正文、
  异常原文、密钥、令牌或私人数据。
- 修复完成必须以同一旨意通过真实完整链路连续成功至少 10 次证明；任一次失败后从 0 计数。

## Consequences

- 收益：随机 schema 漂移被限制在生成它的节点，不再无差别拖垮整条旨意。
- 收益：下旨仍严格遵守 ADR 0028，且失败可以在不泄密的情况下定位到具体阶段。
- 收益：连续 10 次完整链路验收替代单次直接图成功，降低假绿风险。
- 代价：需要为部级、会审和最终汇总维护确定性安全降级逻辑及更完整的状态不变量测试。
- 代价：真实验收产生模型费用、案件记录和至少 10 条史馆 `REPLY`；用户已明确授权。
- 限制：真实 provider 完全不可用时仍会失败，本决策不提供无限重试或备用模型。

## Verification

- `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_junjichu_agent.py tests/test_chancellor_graph.py tests/test_decrees_api.py -q`
- `cd backend && .\.venv\Scripts\python.exe -m ruff check app tests`
- `cd frontend && npm test`
- `node scripts/check_harness.mjs`
- `git diff --check`
- 最终代码重启后，从真实 `/study` 完整链路使用指定原旨意串行连续成功至少 10 次，并逐次
  核对 HTTP 200、多部门结构、三条建议、一条史馆 `REPLY` 和完成案件状态。
