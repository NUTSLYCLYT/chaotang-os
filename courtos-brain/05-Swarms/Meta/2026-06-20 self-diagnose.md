# 系统自检 · 2026-06-20 23:50
# 蜂群评审 · 2026-06-20 23:50
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
# 今日系统诊断 · 2026-06-20

## 🔧 Cron 任务状态

| job | last_run | exit | duration | stderr_tail |
|---|---|---|---|---|
| archive-to-brain | 2026-06-20T23:00 | 0 | 1s | ✓  |
| auto-llm-task | 2026-06-20T10:15 | 0 | 6s | ✓  |
| backup-agents | 2026-06-20T09:30 | 0 | 5s | ✓  |
| brain-daily | 2026-06-20T09:00 | 0 | 70s | ✓  |
| closing100-nudge | 2026-06-20T21:35 | 0 | 9s | ✓  |
| config-snapshot | 2026-06-20T09:15 | 0 | 1s | ✓  |
| content-factory | 2026-05-12T23:00 | 0 | 269s | ✓  |
| content-flight-deck | 2026-05-13T08:30 | 0 | 2s | ✓  |
| cost-ceiling | 2026-06-20T23:00 | 0 | 4s | ✓  |
| council-engineering | 2026-06-17T09:15 | 1 | 26s | 🔴 nt call last):   File "<stdin>", line 28, in <module>   File "/usr/lib/python3.1 |
| council-investment | 2026-06-15T09:15 | 1 | 1s | 🔴  |
| council-management | 2026-06-19T09:15 | 0 | 67s | ✓  |
| council-strategy | 2026-06-16T09:15 | 1 | 46s | 🔴 nt call last):   File "<stdin>", line 28, in <module>   File "/usr/lib/python3.1 |
| cron-stale-check | 2026-06-20T23:00 | 0 | 4s | ✓  |
| daily-briefing-fill-forward | 2026-06-20T21:35 | 0 | 0s | ✓  |
| daily-diff-watcher | 2026-06-20T21:30 | 0 | 0s | ✓  |
| daily-lesson | 2026-06-20T23:45 | 0 | 10s | ✓  |
| daily-top3 | 2026-05-12T22:30 | 0 | 49s | ✓  |
| daily-work-report | 2026-06-20T09:00 | 0 | 10s | ✓  |
| disk-retention | 2026-06-14T04:30 | 0 | 0s | ✓  |
| evolve-morning | 2026-06-20T08:00 | 0 | 2s | ✓  |
| evolve-sync | 2026-06-20T18:00 | 0 | 0s | ✓  |
| evolve-weekly | 2026-06-14T21:00 | 0 | 2s | ✓  |
| feishu-resolve-recover | 2026-06-20T23:30 | 0 | 1s | ✓  |
| git-review | 2026-06-20T22:00 | 1 | 0s | 🔴 /home/ubuntu/.openclaw/script/git-review-daily.sh: line 19: cd: /home/ubuntu/dev |
| hermes-evolution-forward | 2026-06-20T23:35 | 0 | 0s | ✓  |
| hermes-output-quality-check | 2026-06-19T23:55 | 0 | 0s | ✓  |
| hf-papers | 2026-06-20T07:00 | 0 | 3s | ✓  |
| info-swarm | 2026-06-20T21:30 | 0 | 146s | ✓  |
| log-rotate | 2026-06-20T10:00 | 0 | 0s | ✓  |
| logrotate | 2026-06-20T09:45 | 0 | 0s | ✓  |
| model-bench | 2026-06-14T04:00 | 0 | 342s | ✓  |
| monitor | 2026-06-20T23:30 | 0 | 24s | ✓  |
| morning-brief | 2026-06-20T08:00 | 1 | 321s | 🔴  |
| morning-cockpit-forward | 2026-06-20T08:30 | 0 | 0s | ✓  |
| opportunity-scan | 2026-05-13T11:00 | 0 | 29s | ✓  |
| port-health | 2026-06-20T23:30 | 0 | 1s | ✓  |
| proxy-shim-watchdog | 2026-06-20T23:50 | 0 | 0s | ✓  |
| quota-aware-router | 2026-06-20T23:45 | 1 | 5s | 🔴  |
| sales-redteam-forward | 2026-06-15T09:05 | 0 | 0s | ✓  |
| self-improve | 2026-06-19T23:50 | 0 | 1s | ✓ Traceback (most recent call last):   File "<stdin>", line 57, in <module>   File |
| stock-close-alert | 2026-06-20T16:15 | 0 | 35s | ✓  |
| stock-pipeline | 2026-05-17T19:00 | 2 | 252s | 🔴  |
| stock-pre-market | 2026-06-20T10:30 | 0 | 36s | ✓  |
| sync-brain | 2026-06-20T09:30 | 0 | 18s | ✓  |
| ta-deep-brief | 2026-06-20T18:45 | 1 | 4s | 🔴 [ta-deep] 18:45:06 多 agent 深度分析: 三花智控 特变电工 [ta-deep] 写入 /home/ubuntu/.openclaw/s |
| ta-postmarket | 2026-06-20T16:30 | 0 | 1503s | 🟡 [postmarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-06-20-post.md (5665 B)  |
| ta-premarket | 2026-06-20T09:45 | 0 | 81s | ✓ [premarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-06-20-pre.md (1962 B)  |
| ta-weekly-review | 2026-05-22T21:00 | 0 | 118s | ✓  |
| today-priorities | 2026-06-20T08:30 | 0 | 1s | ✓  |
| token-quota-tracker | 2026-06-20T23:00 | 0 | 0s | ✓  |
| trade-journal-review | 2026-06-14T18:30 | 0 | 3s | ✓  |
| trader-video-daily | 2026-06-20T17:15 | 1 | 22s | 🔴  |
| value-miner | 2026-05-13T10:00 | 0 | 29s | ✓  |
| vault-backup | 2026-06-20T08:15 | 0 | 0s | ✓  |
| vault-index | 2026-06-20T08:45 | 0 | 4s | ✓ mbed: HTTP Error 404: Not Found   ✗ embed: HTTP Error 404: Not Found   ✗ embed:  |
| weekly-automation-forward | 2026-06-15T08:35 | 0 | 0s | ✓  |
| weekly-retro | 2026-06-17T18:30 | 0 | 250s | ✓  |
| wiki-audit | 2026-06-20T03:00 | 0 | 1s | ✓  |

## 🤖 Agent 表现

- agent 调用成功 ≈ 0 次
- agent 调用失败 ≈ 0 次
- 命中率 ≈ 0%

## 📨 Telegram 推送

