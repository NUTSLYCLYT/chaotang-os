# ADR 0024：大陆 A 股身份与 provider adapter 边界

## Status

Accepted — 2026-07-24

## Context

锦衣卫需要把“比亚迪”等公司名称、法定全称或证券代码解析为可查询的大陆 A 股，同时不能把
某家 MCP 的代码格式扩散到证据协议、协调器或业务 Agent。史馆中的既有业务资料仍是第一
来源；只有资料缺失或不满足时效要求时，才按管理员批准的只读 MCP 配置补齐。腾讯自选股的
真实只读验证目前只证明了上交所和深交所格式，没有证明北交所能力。

## Decision

- `InstrumentRef` 是 provider-neutral 的规范身份，只表达交易所、六位代码、资产类别和
  币种；首阶段业务范围是 SSE、SZSE、BSE 的 A 股，排除 B 股、基金、港股及境外市场。
- provider symbol 只允许存在于 MCP 映射和 adapter 的解析结果中。生产 Python/YAML 不得
  保存公司名称到 `sh`/`sz`/`bj` code 的字面量表，也不得在业务层加入 provider 分支。
- 腾讯自选股只批准已证明的 SSE、SZSE patterns。BSE 必须由另一项真实、脱敏、只读能力
  验证和管理员审批后才能登记；未登记时返回 `provider_capability_missing`。
- 名称解析有界且歧义失败关闭。短名命中后复用已验证身份；短名到尚未见过的法定全称可以
  额外进行一次 original-only 验证，不能以错误的“零重复”承诺牺牲身份安全。
- 身份缓存寿命独立于 quote freshness。身份可以在同一次调查内复用，行情是否可采用仍由
  每个事实的 freshness 和市场观测时间单独判断。
- 所有 MCP 工具继续限制为 `READ_ONLY`；错误、审计和持久化不得包含响应正文、凭据或请求头。

## Consequences

业务 Agent 和证据协调器可以稳定使用同一规范身份，不依赖腾讯或其它 provider 的私有代码；
新增 A 股公司无需修改 Python 映射表。代价是名称不明确时必须返回
`instrument_ambiguous`/`instrument_not_found`，北交所没有已证明 provider 时不能提供行情。
安全别名校验可能产生一次额外的 resolver 调用，但仍受既有次数、时限和只读门禁约束。
`ARCHITECTURE.md`、`backend/AGENTS.md` 与 harness 同步固化这些规则。

## Verification

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_instruments.py tests/test_jinyiwei_mcp_mapping.py tests/test_jinyiwei_mcp_source.py tests/test_jinyiwei_coordinator.py -q
.venv\Scripts\python.exe -m ruff check .
cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
git diff --check
```

以上命令均为离线门禁。OAuth、真实 MCP 和 `/study` 验收必须另行授权，不能用 fixture 代替。
