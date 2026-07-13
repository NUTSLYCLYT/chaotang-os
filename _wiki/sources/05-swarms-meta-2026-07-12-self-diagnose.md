---
name: source-05-swarms-meta-2026-07-12-self-diagnose
type: source
source_kind: raw
raw_path: /home/ubuntu/CourtOS-Brain/05-Swarms/Meta/2026-07-12 self-diagnose.md
ingested_at: 2026-07-12
updated_at: 2026-07-12
schema_version: 1
---

# 05-Swarms/Meta/2026-07-12 self-diagnose.md

## TL;DR

系统自检和蜂群评审中发现 sprint-prioritizer 和 devops-automator 因缺少 openclaw 文件而调用失败。cron 诊断显示 council-investment、cron-stale-check、git-review、info-swarm、morning-brief 等任务失败。

## 关键事实

- sprint-prioritizer 和 devops-automator 调用失败，缺少 openclaw 文件
- cron 任务 council-investment、cron-stale-check、git-review、info-swarm、morning-brief 退出码非0
- 其他 cron 任务正常，但 self-improve 有 Traceback

## 关联 concepts

- [[concepts/system-self-check]]
- [[concepts/bee-swarm-review]]
- [[concepts/cron-diagnosis]]
- [[concepts/openclaw-missing]]

## 关联 entities

- [[entities/tool/sprint-prioritizer]] · sprint-prioritizer
- [[entities/tool/devops-automator]] · devops-automator
- [[entities/tool/openclaw]] · openclaw

## 原文摘录

> # 系统自检 · 2026-07-12 23:50
> # 蜂群评审 · 2026-07-12 23:50
> **主题**：**系统自检 → 明天的 3 个具体改进**：基于诊断报告，输出：① 1 个最紧急要修的 bug（精确到文件+行为）② 1 个可以加的新 cron（说明价值+实现思路）③ 1 个可以减掉/简化的（避免熵增）
> 
> *评审 agent: sprint-prioritizer, devops-automator*
> 
> ---
> 
> ## 🎯 sprint-prioritizer  _(响应 0.0s)_
> 
> ⚠️ 调用失败：[Errno 2] No such file or directory: 'openclaw'
> 
> ---
> 
> ## 🎯 devops-automator  _(响应 0.0s)_
> 
> ⚠️ 调用失败：[Errno 2] No such file or directory: 'openclaw'
> 
> ---
> 
> 
> ---
> # 今日系统诊断 · 2026-07-12
> 
> ## 🔧 Cron 任务状态
> 
> | job | last_run | exit | duration | stderr_tail |
> |---|---|---|---|---|
> | archive-to-brain | 2026-07-12T23:00 | 0 | 1s | ✓  |
> | auto-llm-task | 2026-07-12T10:15 | 0 | 6s | ✓  |
> | backend-upgrade-watch | 2026-07-12T08:38 | 0 | 316s | ✓ [state-migrations] Legacy state migration warnings: - Left plugin install index  |
> | backup-agents | 20

---
*compiled by LLM-Wiki ingest · model=ollama-fast*
