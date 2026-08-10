# 变更摘要：docs-r0-w08-fin-data-audit-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-r0-w08-fin-data-audit-20260728 |
| 类型 | docs |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260728 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening 的旁路资产审计；不改变 W08 合同闭环验收主线。
- 文件：仅 `.harness/changes/docs-r0-w08-fin-data-audit-20260728/` 文档。
- 验证：源码只读检索、change 文档 diff 检查、根 harness doctor。

## 结论

当前仓有三类金融/财务数据能力：

1. 企业内部财务导入：金蝶/审计 Excel、CSV 模板、verified_facts 与 number provenance gate。
2. 免费公开证据源：SEC EDGAR/companyfacts 官方公开 API，已有 `sec_edgar.py` 可拉 ticker->CIK 表、companyfacts 与 submissions URL，并按真实 fetch 结果标记 verified。
3. 免费公开预测市场源：Polymarket public-search，零 key 查询事件市场，不是证券行情源。

当前仓还没有统一的金融市场数据 provider 层，也没有生产级实时行情源。未发现已实现的 AkShare、yfinance/Yahoo、Tushare、东方财富、Alpha Vantage、Finnhub、Polygon、IEX、FRED、CoinGecko/Binance provider。

## 边界

- 本 Packet 不接入任何新数据源。
- 本 Packet 不修改产品代码。
- 本 Packet 不启动 W09。
- SEC/Polymarket 之外的免费候选源必须在接入前做最新 ToS、限流、授权与合规复核。
