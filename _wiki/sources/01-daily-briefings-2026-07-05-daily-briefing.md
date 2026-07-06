---
name: source-01-daily-briefings-2026-07-05-daily-briefing
type: source
source_kind: raw
raw_path: /home/ubuntu/CourtOS-Brain/01-Daily-Briefings/2026-07-05 Daily Briefing.md
ingested_at: 2026-07-05
updated_at: 2026-07-05
schema_version: 1
---

# 01-Daily-Briefings/2026-07-05 Daily Briefing.md

## TL;DR

2-3 句压缩，不超过 120 字

## 关键事实

- 短句要点 1
- 短句要点 2

## 关联 concepts

- [[concepts/concept-slug-1]]
- [[concepts/concept-slug-2]]

## 关联 entities

- [[entities/tool/原名]] · 原名

## 原文摘录

> # 2026-07-05 Daily Briefing
> 
> Source: CourtOS
> 
> ## Three things that matter
> 
> 
> 1. **蜂群评审管道今日全灭** — 5组评审（weekly-retro / close-alert / pre-market / hf-papers / daily-lesson）共14个agent调用，14个失败。错误分两类：12个 `exit 141`（SIGPIPE，评审agent收到空stdin或被管道断连）、2个 `openclaw: command not found`（daily-lesson）。CourtOS 盘前和尾盘数据抓取本身成功（隔夜美股 S&P -0.21%, Dow +1.11%, Nasdaq -1.45%），但没有一个评审结论送达你。策略输出中断一整天。
> 
> 2. **ta-postmarket 独活，A股数据实测可用** — 唯一完整的策略输出是 ta-postmarket（7085 B，A股收盘数据、持仓盈亏、估值分位、行业轮动均取到）。三花智控今日 +9.06%（+¥407），但风险仪表盘显示 MDD=-100%（peak 5/25→trough 6/9）、VaR=67.5%——组合风险暴露极大。close-alert 的 pre-script 走 Yahoo Finance 被全面 403 封禁，但 ta-postmarket 用了另一数据源成功获取上证 4043.64。修复方向明确：把 close-alert 的数据源从 Yahoo 切到 ta-postmarket 同款。
> 
> 3. **晨报+evolve评分双双卡住** — `morning-brief` cron exit=1，Daily Briefing 的 Three things/Risks/Opportunities 全

---
*compiled by LLM-Wiki ingest · model=ollama-fast*
