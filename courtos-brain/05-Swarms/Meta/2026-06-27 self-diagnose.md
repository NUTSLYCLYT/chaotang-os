# 系统自检 · 2026-06-27 23:50
# 蜂群评审 · 2026-06-27 23:50
**主题**：**系统自检 → 明天的 3 个具体改进**：基于诊断报告，输出：① 1 个最紧急要修的 bug（精确到文件+行为）② 1 个可以加的新 cron（说明价值+实现思路）③ 1 个可以减掉/简化的（避免熵增）

*评审 agent: sprint-prioritizer, devops-automator*

---

## 🎯 sprint-prioritizer  _(响应 0.0s)_

⚠️ 调用失败：[Errno 2] No such file or directory: 'openclaw'

---

## 🎯 devops-automator  _(响应 0.0s)_

⚠️ 调用失败：[Errno 2] No such file or directory: 'openclaw'

---


---
# 今日系统诊断 · 2026-06-27

## 🔧 Cron 任务状态

| job | last_run | exit | duration | stderr_tail |
|---|---|---|---|---|
| archive-to-brain | 2026-06-27T23:00 | 0 | 0s | ✓  |
| auto-llm-task | 2026-06-27T10:15 | 0 | 2s | ✓  |
| backup-agents | 2026-06-27T09:30 | 0 | 5s | ✓  |
| brain-daily | 2026-06-27T09:00 | 0 | 16s | ✓  |
| chaotang-finder | 2026-06-27T09:00 | 0 | 112s | ✓  |
| closing100-nudge | 2026-06-27T21:35 | 0 | 0s | ✓  |
| config-snapshot | 2026-06-27T09:15 | 0 | 1s | ✓  |
| content-factory | 2026-05-12T23:00 | 0 | 269s | ✓  |
| content-flight-deck | 2026-05-13T08:30 | 0 | 2s | ✓  |
| cost-ceiling | 2026-06-27T23:00 | 0 | 2s | ✓  |
| council-engineering | 2026-06-24T09:15 | 0 | 31s | ✓  |
| council-investment | 2026-06-22T09:15 | 1 | 0s | 🔴  |
| council-management | 2026-06-26T09:15 | 0 | 24s | ✓  |
| council-strategy | 2026-06-23T09:15 | 0 | 141s | ✓  |
| cron-stale-check | 2026-06-27T23:00 | 0 | 3s | ✓  |
| daily-briefing-fill-forward | 2026-06-27T21:35 | 0 | 2s | ✓  |
| daily-diff-watcher | 2026-06-27T21:30 | 0 | 0s | ✓  |
| daily-lesson | 2026-06-27T23:45 | 0 | 2s | ✓  |
| daily-top3 | 2026-05-12T22:30 | 0 | 49s | ✓  |
| daily-work-report | 2026-06-27T09:00 | 0 | 2s | ✓  |
| disk-retention | 2026-06-21T04:30 | 0 | 1s | ✓  |
| evolve-morning | 2026-06-27T08:00 | 0 | 1s | ✓  |
| evolve-sync | 2026-06-27T18:00 | 0 | 0s | ✓  |
| evolve-weekly | 2026-06-21T21:00 | 0 | 8s | ✓  |
| feishu-resolve-recover | 2026-06-27T23:30 | 0 | 0s | ✓  |
| git-review | 2026-06-27T22:00 | 1 | 0s | 🔴 /home/ubuntu/.openclaw/script/git-review-daily.sh: line 19: cd: /home/ubuntu/dev |
| hermes-cron-health | 2026-06-27T21:00 | 0 | 6s | ✓  |
| hermes-evolution-forward | 2026-06-27T23:35 | 1 | 1s | 🔴  |
| hermes-output-quality-check | 2026-06-26T23:55 | 0 | 0s | ✓  |
| hf-papers | 2026-06-27T07:00 | 0 | 3s | ✓  |
| info-swarm | 2026-06-27T21:30 | 0 | 72s | ✓  |
| lead-draft | 2026-06-27T09:00 | 0 | 20s | ✓  |
| lead-signal-scan | 2026-06-27T08:45 | 0 | 139s | ✓  |
| log-rotate | 2026-06-27T10:00 | 0 | 0s | ✓  |
| logrotate | 2026-06-27T09:45 | 0 | 0s | ✓  |
| mainline-mirror | 2026-06-27T08:50 | 1 | 0s | 🔴  |
| model-bench | 2026-06-21T04:00 | 0 | 35s | ✓  |
| monitor | 2026-06-27T23:30 | 0 | 13s | ✓  |
| morning-brief | 2026-06-27T08:00 | 1 | 358s | 🔴  |
| morning-cockpit-forward | 2026-06-27T08:30 | 0 | 1s | ✓  |
| opportunity-scan | 2026-05-13T11:00 | 0 | 29s | ✓  |
| port-health | 2026-06-27T23:30 | 0 | 0s | ✓  |
| proxy-shim-watchdog | 2026-06-27T23:40 | 0 | 0s | ✓  |
| quota-aware-router | 2026-06-27T23:45 | 0 | 1s | ✓  |
| sales-digest | 2026-06-27T09:15 | 0 | 1s | ✓  |
| sales-redteam-forward | 2026-06-22T09:05 | 0 | 3s | ✓  |
| self-improve | 2026-06-26T23:50 | 0 | 1s | ✓ Traceback (most recent call last):   File "<stdin>", line 57, in <module>   File |
| stock-close-alert | 2026-06-27T16:15 | 0 | 75s | ✓  |
| stock-pipeline | 2026-05-17T19:00 | 2 | 252s | 🔴  |
| stock-pre-market | 2026-06-27T10:30 | 0 | 107s | ✓  |
| sync-brain | 2026-06-27T09:30 | 0 | 58s | ✓  |
| ta-deep-brief | 2026-06-27T18:45 | 1 | 0s | 🔴 [ta-deep] 18:45:02 多 agent 深度分析: 三花智控 特变电工 [ta-deep] 写入 /home/ubuntu/.openclaw/s |
| ta-postmarket | 2026-06-27T16:30 | 0 | 419s | ✓ [postmarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-06-27-post.md (5518 B)  |
| ta-premarket | 2026-06-27T09:45 | 0 | 140s | ✓ [premarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-06-27-pre.md (1273 B)  |
| ta-weekly-review | 2026-06-26T21:00 | 0 | 15s | ✓  |
| today-priorities | 2026-06-27T08:30 | 0 | 2s | ✓  |
| token-quota-tracker | 2026-06-27T23:00 | 0 | 0s | ✓  |
| trade-journal-review | 2026-06-21T18:30 | 0 | 5s | ✓  |
| trader-video-daily | 2026-06-27T17:15 | 1 | 10s | 🔴  |
| value-miner | 2026-05-13T10:00 | 0 | 29s | ✓  |
| vault-backup | 2026-06-27T08:15 | 0 | 0s | ✓  |
| vault-index | 2026-06-27T08:45 | 0 | 20s | ✓ mbed: HTTP Error 404: Not Found   ✗ embed: HTTP Error 404: Not Found   ✗ embed:  |
| weekly-automation-forward | 2026-06-22T08:35 | 0 | 2s | ✓  |
| weekly-retro | 2026-06-21T18:00 | 0 | 22s | ✓  |
| wiki-audit | 2026-06-27T03:00 | 0 | 1s | ✓  |

## 🤖 Agent 表现

- agent 调用成功 ≈ 0 次
- agent 调用失败 ≈ 41 次
- 命中率 ≈ 0%

## 📨 Telegram 推送

