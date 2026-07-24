# ADR 0022：显式本机 MCP 凭据与最新可得行情时效

## Status

Accepted — 2026-07-23

## Context

管理员已通过本机 OAuth 流程把腾讯自选股凭据加密保存在当前 Windows 用户的 DPAPI
凭据库中，但业务运行时仍只读取部署环境注入的 `env://` 凭据。因此，本地 `/study`
下旨即使已完成授权，锦衣卫也会因缺少运行时凭据而无法查询。凭据可用性与外部网络授权
是两项独立门禁，不能因为本机存在凭据就自动联网。

行情还有两种不同的时间：`retrieved_at` 表示锦衣卫何时向来源执行查询，`as_of` 表示
来源报告的真实市场观测时间。休市后查询到的最近收盘价，其 `as_of` 不会随查询时间更新；
如果只按严格的观测时间 freshness 判断，会把刚刚查询到的最新可得行情错误判为过期。

## Decision

- 业务运行时通过 `JINYIWEI_MCP_CREDENTIAL_SOURCE` 选择 MCP 凭据来源。未设置时默认
  `env`；仅精确值 `local` 才读取当前用户 DPAPI 凭据库。其它值失败关闭并报告
  `credential_source_invalid`。
- 生产环境保持 `env` 默认，通过 Secret Manager 注入 `env://` 凭据，禁止隐式回退读取
  `backend/data/credentials/`。本机 OAuth 只有在管理员显式设置
  `JINYIWEI_MCP_CREDENTIAL_SOURCE=local` 时才供业务运行时使用。
- `JINYIWEI_EXTERNAL_NETWORK_ENABLED=true` 仍是独立的外部网络门禁。选择有效凭据来源
  不会自动开启网络，也不会自动启用 MCP server 或 tool。
- freshness 策略集中为一个共享判断，并由来源候选选择与协调器最终采用共同使用。普通事实
  继续按 `as_of` 严格判断。
- “最新可得”例外只适用于事实类别 `MARKET_QUOTE` 且来源类型为 `MCP` 或
  `PUBLIC_API` 的证据：请求执行时间由 `retrieved_at` 满足 `max_age_seconds`，但证据始终
  保留和展示来源提供的真实 `as_of`。未来时间、`not_before` 违规和超过 14 天的市场观测
  仍然失败关闭。
- `SHIGUAN` 中的市场快照继续按 `as_of` 严格判断；该例外不改变史馆优先、史馆满足需求时
  不联网的来源顺序。
- 运维可安全区分 `credential_unavailable`、`credential_source_invalid` 和
  `external_network_disabled`。未列入允许集合的客户端、传输或上游错误统一收敛为
  `fact_unavailable`，不得泄露凭据、请求头、端点细节或响应正文。

## Consequences

本地管理员完成 OAuth 后，可以在显式开启网络并选择 `local` 的前提下，让 `/study`
业务运行时复用同一份加密凭据；生产环境的默认行为和 Secret Manager 边界不变。网络开关、
凭据来源和 server/tool 启用仍需分别满足，避免授权动作扩大运行权限。

休市期间刚查询到的最近收盘价可被作为“最新可得行情”采用，投资司不再仅因市场时间早于
请求 freshness 窗口而报告数据不足。代价是调用方必须同时维护查询时间和市场观测时间，
界面与回奏不能把最近收盘价描述成实时成交价。史馆与非行情事实不获得该放宽。

## Verification

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_runtime.py tests/test_jinyiwei_mcp_client.py tests/test_jinyiwei_mcp_source.py tests/test_jinyiwei_freshness.py tests/test_jinyiwei_coordinator.py -q
.venv\Scripts\python.exe -m ruff check app/jinyiwei tests/test_jinyiwei_mcp_runtime.py tests/test_jinyiwei_mcp_client.py tests/test_jinyiwei_mcp_source.py tests/test_jinyiwei_freshness.py tests/test_jinyiwei_coordinator.py
cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
git diff --check
```

经单独授权的本机业务运行时必须同时显式设置以下两个环境变量；这不是离线测试或 CI
命令：

```powershell
cd backend
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
$env:JINYIWEI_MCP_CREDENTIAL_SOURCE = "local"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
