# 0025 — 确定性证据编排与行情降级

## Status

Accepted — 2026-07-24

## Context

大陆股票最新价链路已经具备史馆优先、管理员批准的只读 MCP、provider-neutral
证券身份、行情时效验证和证据冻结能力。真实调用证明腾讯自选股 MCP 可以返回有效行情，
但下旨仍可能失败：丞相路由、部内选司、司级缺数、司级恢复、部级综合或丞相汇总中的
任一个模型严格 JSON 输出发生字段漂移，都会使整条链路收敛为
`model_unavailable`。

继续扩充提示词或共享一次纠正预算只能降低某一种格式错误的概率，不能保证已取得的可信
证据最终可交付，也会让市场、指标、单位和数据形状继续受模型自由输出控制。

## Decision

对明确的中国大陆股票最新价请求采用系统拥有的确定性证据编排：

- 事实计划固定为 `MARKET_QUOTE + LAST_PRICE + CN + CNY + number`，模型不得覆盖；
- 明确境外市场、B 股、多个标的或无法安全提取实体时失败关闭，不猜测证券代码；
- 事实计划继续交给既有锦衣卫协调器，严格执行史馆优先，资料缺失或过期时才选择管理员
  批准的只读 MCP；
- 行情计划的来源范围固定为史馆和 MCP；史馆已有完整锁定事实身份的采用证据直接复用，
  不再经过模型重新提取，锁定身份不匹配时失败关闭；
- provider symbol 仍只允许由 `app/jinyiwei/` 的 mapping/adapter 产生，上层不得绑定
  腾讯或任何具体提供方；
- 只有已冻结、已解析且包含当前有效行情的证据包可以生成确定性保底意见；
- 对受支持的 canonical Mainland `LAST_PRICE`，确定性 renderer 输出是完整且唯一的
  事实表达契约；LLM 响应只有 opinion 与 renderer 逐字相等且 adopted IDs 与 renderer
  选择逐项相等时才可采用，否则采用 renderer 并记录节点降级；
- adopted selection 必须等于 renderer 对当前 pack 的权威选择，并满足 fresh、
  `SUPPORTS`、可采用核验状态、`PRIMARY/AUTHORITATIVE` 和批准来源适配器；即使 pack
  因其它合格条目而为 `RESOLVED`，选择 stale、`CONTRADICTS`、`UNVERIFIED` 或未批准
  来源条目仍不得进入 adopted 状态；
- 投资司直接采用 renderer canonical opinion，户部逐字采用投资司 opinion，丞相逐字采用
  户部 opinion 并固定返回三条安全建议；各层不重复调查，也不把降级伪装成完整模型成功；
- 未命中的其它旨意继续使用现有模型路由和通用证据协议。

第一阶段只实现大陆 `LAST_PRICE`。新闻、统计、百科和监管文件后续通过同一事实计划接口
分别接入，不在本决策中一次性实现。

## Consequences

好处：

- 是否缺数和缺少什么事实不再依赖模型准确返回 `NEEDS_DATA`；
- 支持范围内减少路由和缺数格式调用，降低延迟与模型调用成本；
- 有效行情一旦取得，不再因后续表达 JSON 漂移而变成通用 502；
- 结构合法但语义改写价格、时间、来源、市场、指标或建议的 LLM 输出也不能替换权威结果；
- 事实范围、来源优先级、采用证据和降级条件均可离线测试与审计；
- 新数据类型可以复用编译器协议，而不需要把具体 MCP 写入通用 Agent。

代价：

- 每种事实类别需要维护一个小型、保守的事实计划编译器；
- 模糊实体和未登记市场会更早失败关闭，部分自然语言请求可能需要用户明确公司或代码；
- 确定性保底答复表达较简洁，模型降级状态需要在内部验证证据中明确记录；
- 史馆旧库迁移仍是独立运维事项，本决策不消除其降级警告。

本决策同步影响 `ARCHITECTURE.md`、`backend/AGENTS.md`、产品任务和 harness 必需文件，
但不改变 MCP 只读审批、网络、凭据或运行态数据库边界。

## Verification

实施后运行：

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_graph.py::test_market_quote_graph_uses_precompiled_plan_and_adopts_latest_available_evidence tests/test_chancellor_graph.py::test_supported_market_graph_degrades_each_model_layer_with_adopted_evidence -q
.\.venv\Scripts\python.exe -m pytest tests/test_market_fact_plan.py tests/test_evidence_rendering.py tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_chancellor_graph.py -q
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check .
Set-Location ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

离线门禁通过后，在既有真实模型和只读 MCP 授权范围内，从 `/study` 连续查询十次
“帮我看看比亚迪的股票价格”。每次必须返回 HTTP 200、经过户部投资司、包含且只包含
非零锦衣卫行情证据，不主动加入港股或额外指标，且不得出现通用
`model_unavailable`。只有非缓存取证可以标记“锦衣卫（调查）”，缓存命中不得冒充新的
外部调查。真实验收不得执行交易、自选股修改或其它写操作。
