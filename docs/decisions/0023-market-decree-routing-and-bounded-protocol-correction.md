# ADR 0023：行情旨意路由与有界协议纠正

## Status

Accepted — 2026-07-24

## Context

现有丞相与六部使用模型完成通用路由，能够覆盖开放式旨意，但明确的证券行情查询曾被模型
有效却错误地分到军机处或非户部路径。即使进入司级节点，模型也可能在缺少外部事实时直接
返回结构合法的 `READY`；证据协议会以 `unsupported_factual_dependency` 失败关闭，用户
最终只能看到通用不可用错误。已经批准的锦衣卫调查、证据绑定、行情时效与只读 MCP 边界
能够满足数据取得需求，缺口位于通用路由边界和首次司级协议响应。

完全用静态关键词取代模型会损失通用路由能力；只增强提示词又不能为已观察到的非确定性
错误提供稳定约束。因此需要一个窄范围、可审计且不绑定行情提供方的保护策略，并保持现有
失败关闭证据协议。

## Decision

- 模型继续负责通用丞相分流和部内选司。只有文本同时包含证券市场词和报价查询词时，才将
  已通过既有 JSON、schema、部门与基数校验的丞相结果规范化为 `single + 户部`。
- 同一明确行情意图进入户部后，把投资司放在有效司列表首位并去重；模型仍可保留其它有效
  户部司。非行情旨意在公开返回边界保持原有路由和顺序。
- 行情意图策略集中在 `app/agents/market_intent.py`，只包含无供应商依赖的纯函数，不包含
  证券代码、端点、凭据读取或提供方条件分支。
- 司级模型第一次返回 `READY` 且仅因 `unsupported_factual_dependency` 被拒绝时，协议
  追加一条不含被拒响应、异常或证据正文的静态消息，要求按既有 schema 返回
  `NEEDS_DATA`，并只纠正一次。其它错误、纠正后仍为 `READY`、调查后的第二次缺数和恢复
  响应不合规均继续失败关闭。
- 因上述一次可选纠正调用，single 路径最坏同步模型调用上限由 11 次变为 12 次；现有串行
  编排、调查次数、抽取次数和 30 秒外部工作预算不变。
- 现有证据绑定、采纳、新鲜度、史馆优先、网络显式开关、凭据来源、登记来源、只读工具与
  脱敏错误边界全部保持不变。本决策不授权真实网络、凭据访问、交易或其它写操作。

## Consequences

明确证券行情查询在模型给出结构合法但错误的结果时仍会稳定进入户部投资司；首次把未提供
的行情写成事实时，可在一个额外模型回合后进入既有锦衣卫调查与引用恢复链路。策略范围可由
纯函数测试审计，且不把任何具体 MCP 提供方写入通用路由或证据协议。

代价是明确行情 single 路径的最坏模型调用数增加一次，调用方仍需考虑同步超时。词组策略
刻意保持窄范围，含糊的投资、公司或产品价格问题不会被静态接管；新市场表达需要通过测试和
新的产品决定扩展，不能演变成通用关键词路由引擎。外部来源不可用、凭据缺失或证据不合规时
仍会失败关闭。

## Verification

```powershell
cd backend
Remove-Item Env:JINYIWEI_EXTERNAL_NETWORK_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:JINYIWEI_MCP_CREDENTIAL_SOURCE -ErrorAction SilentlyContinue
.venv\Scripts\python.exe -m pytest tests/test_chancellor_graph.py tests/test_ministries_agent.py tests/test_bureaus_agent.py tests/test_agent_evidence_protocol.py -q
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check .
cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```
