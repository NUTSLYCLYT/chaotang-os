---
name: source-01-daily-briefings-2026-07-10-daily-briefing
type: source
source_kind: raw
raw_path: /home/ubuntu/CourtOS-Brain/01-Daily-Briefings/2026-07-10 Daily Briefing.md
ingested_at: 2026-07-10
updated_at: 2026-07-10
schema_version: 1
---

# 01-Daily-Briefings/2026-07-10 Daily Briefing.md

## TL;DR

今日蜂群评审9个agent全部exit141失败，根因openclaw路径断裂；Wiki知识库503个概念为stub，合成从未执行；晨报cron跑完但输出为空。存在调度链断裂、知识退化风险，需修复PATH或激活合成pipeline。

## 关键事实

- 蜂群评审全线崩塌，9个agent全部exit141失败
- openclaw二进制在cron环境中路径不可达
- 503个concepts全部为stub，LLM合成从未执行
- 晨报cron退出码0但输出全部为空
- 风险：调度链断裂可能蔓延至所有swarm-review cron
- 风险：207个source摘要已摄入但503个stub无定义

## 关联 concepts

- [[concepts/feng-qun]]
- [[concepts/swarm-review]]
- [[concepts/openclaw]]
- [[concepts/courtos]]
- [[concepts/wiki-stub]]
- [[concepts/daily-briefing]]
- [[concepts/cron-exit-141]]
- [[concepts/morning-brief-empty]]
- [[concepts/hermies-api]]
- [[concepts/evolve-status]]
- [[concepts/agent-call-failure]]

## 关联 entities

- [[entities/tool/openclaw]] · openclaw
- [[entities/service/hermes-api]] · Hermes API
- [[entities/org/courtos]] · CourtOS

## 原文摘录

> # 2026-07-10 Daily Briefing
> 
> Source: CourtOS
> 
> ## Three things that matter
> 
> 
> 1. **蜂群评审全线崩塌（exit 141）**：今日 stock pre-market、close-alert、evolution 三组共 9 个评审 agent 全部 exit 141 失败，根因同一：`openclaw` 二进制找不到（昨日 evolution cron 明确报 `No such file or directory: 'openclaw'`）。这不是个别 cron 问题，是整个蜂群调度层的执行路径断裂。直接影响：今日无盘前决策、无尾盘调仓信号、无 daily lesson 产出。MOC 显示「晨报暂停，等待评分」——系统在等一个永远不会来的评分。
> 
> 2. **Wiki 知识库空心化**：503 个 concepts 全部为 stub（待合成），383 个 entities 中 379 个为 stub。207 个 source 有数据摄入但 LLM 合成从未执行。每天 ingest 照跑、audit 照跑、但概念永远停在"待 audit cron 合成"。这已不是 bug——是 audit cron 的设计假设（LLM 会合成熟）与实际执行脱节。
> 
> 3. **morning-brief 空壳**：晨报 cron 跑完了（exit 0），Agent 分析了 173 条原始信息并生成了分类框架，但最终 Daily Briefing 的 Three things / Risks / Opportunities / Decisions 全部为空——没有任何结论写入。可能是输出截断、格式解析失败、或 Agent 在"计划写什么"阶段耗尽 token 后直接退出。
> 
> ## Risks
> 
> 
> - **调度链断裂蔓延风险

---
*compiled by LLM-Wiki ingest · model=ollama-fast*
