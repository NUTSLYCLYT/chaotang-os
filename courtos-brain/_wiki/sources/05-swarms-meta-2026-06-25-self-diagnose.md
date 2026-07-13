---
name: source-05-swarms-meta-2026-06-25-self-diagnose
type: source
source_kind: raw
raw_path: /home/ubuntu/CourtOS-Brain/05-Swarms/Meta/2026-06-25 self-diagnose.md
ingested_at: 2026-06-25
updated_at: 2026-06-25
schema_version: 1
---

# 05-Swarms/Meta/2026-06-25 self-diagnose.md

## TL;DR

系统自检发现sprint-prioritizer和devops-automator因openclaw文件缺失调用失败。Cron任务中git-review等5项异常，需优先修复路径并简化冗余任务以减少熵增。

## 关键事实

- sprint-prioritizer和devops-automator调用失败，openclaw文件不存在
- git-review等5个Cron任务异常，需紧急修复路径
- 需简化冗余任务避免熵增

## 关联 concepts

- [[concepts/sprint-prioritizer]]
- [[concepts/devops-automator]]
- [[concepts/openclaw]]
- [[concepts/git-review]]
- [[concepts/mainline-mirror]]

## 关联 entities

- [[entities/service/sprint-prioritizer]] · sprint-prioritizer
- [[entities/service/devops-automator]] · devops-automator
- [[entities/tool/openclaw]] · openclaw
- [[entities/tool/git-review]] · git-review
- [[entities/tool/mainline-mirror]] · mainline-mirror

## 原文摘录

> # 系统自检 · 2026-06-25 23:50
> # 蜂群评审 · 2026-06-25 23:50
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
> # 今日系统诊断 · 2026-06-25
> 
> ## 🔧 Cron 任务状态
> 
> | job | last_run | exit | duration | stderr_tail |
> |---|---|---|---|---|
> | archive-to-brain | 2026-06-25T23:00 | 0 | 0s | ✓  |
> | auto-llm-task | 2026-06-25T10:15 | 0 | 3s | ✓  |
> | backup-agents | 2026-06-25T09:30 | 0 | 5s | ✓  |
> | brain-daily | 2026-06-25T09:00 | 0 | 16s | ✓  |
> | chaotang-finder | 2026-06-25T07:35 | 0 | 79s | ✓  |
> | clos

---
*compiled by LLM-Wiki ingest · model=ollama-fast*
