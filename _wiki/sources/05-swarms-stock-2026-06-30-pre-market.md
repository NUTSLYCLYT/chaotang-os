---
name: source-05-swarms-stock-2026-06-30-pre-market
type: source
source_kind: raw
raw_path: /home/ubuntu/CourtOS-Brain/05-Swarms/Stock/2026-06-30 pre-market.md
ingested_at: 2026-06-30
updated_at: 2026-06-30
schema_version: 1
---

# 05-Swarms/Stock/2026-06-30 pre-market.md

## TL;DR

隔夜美股全线上涨，中概ADR普遍走强，但港股科技股涨跌互现，加密资产下跌。三个评审agent均调用失败，无操作信号。

## 关键事实

- 美股三大指数均上涨，S&P 500涨1.13%
- 中概ADR普遍上涨，百度涨7.88%
- 港股科技股阿里、腾讯下跌，美团、京东上涨
- BTC、ETH、SOL等加密资产下跌
- 三个评审agent全部调用失败

## 关联 concepts

- [[concepts/pre-market-brief]]
- [[concepts/overnight-us-stocks]]
- [[concepts/china-adrs]]
- [[concepts/hk-tech-stocks]]
- [[concepts/crypto-assets]]
- [[concepts/agent-review]]

## 关联 entities

- [[entities/service/finance-bull-analyst]] · finance-bull-analyst
- [[entities/service/finance-bear-analyst]] · finance-bear-analyst
- [[entities/service/portfolio-rebalancer]] · portfolio-rebalancer

## 原文摘录

> # 盘前 Brief · 2026-06-30
> # 蜂群评审 · 2026-06-30 09:15
> **主题**：**盘前 brief**：基于隔夜美股 + 港股/A股 + 中概 ADR + 财经新闻，输出：① 今日 3 个最重要操作信号 ② 主要风险点 ③ 仓位调整建议（如有）
> 
> *评审 agent: finance-bull-analyst, finance-bear-analyst, portfolio-rebalancer*
> 
> ---
> 
> ## 🎯 finance-bull-analyst  _(响应 0.0s)_
> 
> ⚠️ 调用失败：exit 141: 
> 
> ---
> 
> ## 🎯 finance-bear-analyst  _(响应 0.1s)_
> 
> ⚠️ 调用失败：exit 141: 
> 
> ---
> 
> ## 🎯 portfolio-rebalancer  _(响应 0.1s)_
> 
> ⚠️ 调用失败：exit 141: 
> 
> ---
> 
> 
> ---
> ## 原始数据
> # 盘前数据 · 2026-06-30 09:15
> 
> ## 🌎 隔夜美股
> - 🟢 S&P 500 (^GSPC): 7440.43 (+1.13%)
> - 🟢 Dow (^DJI): 52182.74 (+0.50%)
> - 🟢 Nasdaq (^IXIC): 25820.15 (+1.82%)
> - 🔴 VIX (^VIX): 17.65 (-4.13%)
> 
> ## 🇭🇰 港股科技 + 🇨🇳 A股指数（昨收/当前）
> - 🔴 阿里-HK (9988.HK): 93.00 (-2.11%)
> - 🟢 美团 (3690.HK): 67.65 (+2.34%)
> - 🔴 腾讯 (0700.HK): 420.20 (-0.28%)
> - 🟢 京东-HK (9618.HK): 99.00 (+0.25%)
> - 🔴 小米 (1810.HK): 21.

---
*compiled by LLM-Wiki ingest · model=ollama-fast*
