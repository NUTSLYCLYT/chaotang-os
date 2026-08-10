# R0-W08 Financial Data Source Audit

Status: `VERIFIED_PARTIAL`
Scope: documentation and asset audit only.
Base intent: answer whether the current EXT repository already has financial data sources and free data sources, without drifting W08 contract acceptance.

## Executive Answer

当前仓有金融/财务数据源能力，但不是完整行情平台。

已有：

1. 本地企业财务数据源：金蝶/审计 Excel、CSV 模板、verified_facts、数字溯源闸。
2. 免费官方公开源：SEC EDGAR/companyfacts/submissions，已有真实 fetch、ticker map 缓存和 verified 降级逻辑。
3. 免费公开事件市场源：Polymarket public-search，零 key，适合事件概率参考。

没有：

1. 统一 market data provider 层。
2. 生产级实时股票/基金/期货/外汇/加密行情源。
3. 已实现的 AkShare、yfinance/Yahoo、Tushare、东方财富、Alpha Vantage、Finnhub、Polygon、IEX、FRED、CoinGecko/Binance provider。

## Current Assets

| Asset | Current Evidence | Maturity | Use |
| --- | --- | --- | --- |
| Local enterprise finance files | `backend/src/finance_data_parser.py`、`backend/src/finance_facts.py` | Implemented | B2B 企业财务、合同回款、预算、经营风险审查 |
| Hubu CSV templates | `backend/src/hubu_finance_csv_loader.py`、`backend/tests/test_hubu_finance_csv_loader.py` | Implemented/tested | 标准 CSV 导入 fact pack |
| Number provenance gate | `backend/config/flow_finance.yaml`、`backend/src/step_assertions.py` | Implemented | 防止 LLM 编造财务数字 |
| SEC EDGAR | `backend/src/sec_edgar.py` | Implemented | 美国上市公司公开 filings 证据 |
| Finance intel loop contract | `backend/src/finance_intel_loop_contract.py` | Implemented | 将 SEC/用户来源绑定到 replayable finance session |
| Polymarket lookup | `backend/src/polymarket_lookup.py` | Implemented/tested | 事件概率参考 |
| Investment safety gate | `backend/harness/hubu-investment-swarm-gate/README.md` | Harness documented | 阻止投资建议越界 |

## Free Source Candidates

These candidates are not approved integrations. Their latest official terms, limits, and allowed use must be verified before any provider code is added.

| Candidate | Fit | Default Decision |
| --- | --- | --- |
| SEC EDGAR | Public-company filings and official facts | Continue hardening first |
| FRED | Macro indicators | Design candidate after ToS/rate review |
| World Bank / OECD | Macro and country indicators | Low-risk research candidate |
| Stooq | Free EOD market prices | Prototype only until license reviewed |
| Yahoo/yfinance | Broad quotes, easy prototyping | Noncanonical; not default production source |
| AkShare | China/A-share wrapper ecosystem | Research only; upstream source risk |
| Eastmoney | China market data | Requires legal/security review |
| CoinGecko | Crypto public market data | Only if crypto enters product scope |
| Polymarket | Event probability market | Already present, but not securities data |

## Recommended Provider Contract

If this line becomes a real task after W08 acceptance, add a provider registry rather than scattering direct API calls.

Minimum provider fields:

| Field | Meaning |
| --- | --- |
| `provider_id` | Stable identifier, for example `sec_edgar` |
| `source_type` | `filing`, `macro`, `quote`, `event_market`, `user_source`, `local_file` |
| `cost_class` | `free_public`, `free_keyed`, `paid`, `local_user_supplied` |
| `auth_type` | `none`, `credentialed_http`, `user_agent`, `oauth`, `local_file` |
| `license_status` | `verified`, `pending_review`, `restricted`, `prototype_only` |
| `freshness` | delayed/eod/realtime/filing/as_of |
| `retrieved_at` | UTC retrieval timestamp |
| `provenance_url` | canonical source URL or local source reference |
| `verification_state` | `verified_fetch`, `template_url`, `user_supplied`, `fallback`, `failed` |
| `allowed_use` | `evidence`, `analysis`, `display_only`, `blocked_for_advice` |

Fail-closed rules:

1. No source may be labeled LIVE unless a real fetch succeeded in the exact flow.
2. No real-time claim without provider, retrieved_at, and freshness.
3. No investment advice, buy/sell, position size, or trade order output.
4. User-supplied URLs can be preserved as evidence pointers, but not upgraded to official verified evidence without fetch verification.
5. Prototype providers must be isolated from W08 contract acceptance and production claims.

## W08 Boundary

W08 remains Product Acceptance Hardening:

- 36 golden contracts.
- 10/10 real backend browser flow.
- 5 non-developer users, at least 4 success.
- ContractReviewPack download.
- Shiguan audit replay.

Financial provider expansion is useful later, but it is not on the critical path for W08 unless a golden contract requires finance evidence. If needed, use current local finance import and SEC evidence as bounded inputs; do not start a broad market data program before W08 closeout.

## Next Queue

| ID | Task | Scope | Gate |
| --- | --- | --- | --- |
| FIN-A1 | Verify latest ToS/rate limits for SEC, FRED, Stooq, Yahoo/yfinance, AkShare, Eastmoney, CoinGecko | Research only | Official source review |
| FIN-A2 | Design provider registry ADR | Docs only | Security/legal/release review |
| FIN-A3 | Add read-only SEC provider tests around `sec_edgar` if needed | TDD isolated Packet | No runtime behavior change without approval |
| FIN-A4 | Prototype one free EOD quote source in isolation | Prototype only | Must not affect W08 or production |
| FIN-A5 | Map finance evidence into ContractReviewPack only when product acceptance requires it | Product contract only | W08 acceptance owner approval |
