---
name: source-05-swarms-meta-2026-07-10-self-diagnose
type: source
source_kind: raw
raw_path: /home/ubuntu/CourtOS-Brain/05-Swarms/Meta/2026-07-10 self-diagnose.md
ingested_at: 2026-07-10
updated_at: 2026-07-10
schema_version: 1
---

# 05-Swarms/Meta/2026-07-10 self-diagnose.md

## TL;DR

系统自检与蜂群评审会议中，两个评审agent因找不到'openclaw'而调用失败；诊断报告显示多个cron任务异常（council-investment、git-review、info-swarm等），需优先修复openclaw路径问题。

## 关键事实

- sprint-prioritizer和devops-automator因缺少'openclaw'文件而调用失败
- council-investment、git-review、info-swarm、self-improve等cron任务退出码非零，存在错误
- 诊断报告要求基于现状输出最紧急bug（openclaw缺失）、新cron建议、可简化任务

## 关联 concepts

- [[concepts/system-self-check]]
- [[concepts/swarm-review]]
- [[concepts/cron-diagnostics]]

## 关联 entities

- [[entities/tool/openclaw]] · openclaw
- [[entities/tool/sprint-prioritizer]] · sprint-prioritizer
- [[entities/tool/devops-automator]] · devops-automator

## 原文摘录

> # 系统自检 · 2026-07-10 23:50
> # 蜂群评审 · 2026-07-10 23:50
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
> # 今日系统诊断 · 2026-07-10
> 
> ## 🔧 Cron 任务状态
> 
> | job | last_run | exit | duration | stderr_tail |
> |---|---|---|---|---|
> | archive-to-brain | 2026-07-10T23:00 | 0 | 1s | ✓  |
> | auto-llm-task | 2026-07-10T10:15 | 0 | 2s | ✓  |
> | backend-upgrade-watch | 2026-07-10T08:38 | 0 | 317s | ✓ [state-migrations] Legacy state migration warnings: - Left plugin install index  |
> | backup-agents | 20

---
*compiled by LLM-Wiki ingest · model=ollama-fast*
