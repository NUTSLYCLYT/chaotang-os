# 系统自检 · 2026-06-22 23:50
# 蜂群评审 · 2026-06-22 23:50
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
# 今日系统诊断 · 2026-06-22

## 🔧 Cron 任务状态

| job | last_run | exit | duration | stderr_tail |
|---|---|---|---|---|
| archive-to-brain | 2026-06-22T23:00 | 0 | 1s | ✓  |
| auto-llm-task | 2026-06-22T10:15 | 0 | 4s | ✓  |
| backup-agents | 2026-06-22T09:30 | 0 | 6s | ✓  |
| brain-daily | 2026-06-22T09:00 | 0 | 25s | ✓  |
| chaotang-finder | 2026-06-22T07:35 | 0 | 151s | ✓  |
| closing100-nudge | 2026-06-22T21:35 | 0 | 0s | ✓  |
| config-snapshot | 2026-06-22T09:15 | 0 | 1s | ✓  |
| content-factory | 2026-05-12T23:00 | 0 | 269s | ✓  |
| content-flight-deck | 2026-05-13T08:30 | 0 | 2s | ✓  |
| cost-ceiling | 2026-06-22T23:00 | 0 | 3s | ✓  |
| council-engineering | 2026-06-17T09:15 | 1 | 26s | 🔴 nt call last):   File "<stdin>", line 28, in <module>   File "/usr/lib/python3.1 |
| council-investment | 2026-06-22T09:15 | 1 | 0s | 🔴  |
| council-management | 2026-06-19T09:15 | 0 | 67s | ✓  |
| council-strategy | 2026-06-16T09:15 | 1 | 46s | 🔴 nt call last):   File "<stdin>", line 28, in <module>   File "/usr/lib/python3.1 |
| cron-stale-check | 2026-06-22T23:00 | 0 | 6s | ✓  |
| daily-briefing-fill-forward | 2026-06-22T21:35 | 1 | 0s | 🔴  |
| daily-diff-watcher | 2026-06-22T21:30 | 0 | 0s | ✓  |
| daily-lesson | 2026-06-22T23:45 | 0 | 2s | ✓  |
| daily-top3 | 2026-05-12T22:30 | 0 | 49s | ✓  |
| daily-work-report | 2026-06-22T09:00 | 0 | 3s | ✓  |
| disk-retention | 2026-06-21T04:30 | 0 | 1s | ✓  |
| evolve-morning | 2026-06-22T08:00 | 0 | 3s | ✓  |
| evolve-sync | 2026-06-22T18:00 | 0 | 0s | ✓  |
| evolve-weekly | 2026-06-21T21:00 | 0 | 8s | ✓  |
| feishu-resolve-recover | 2026-06-22T23:30 | 0 | 0s | ✓  |
| git-review | 2026-06-22T22:00 | 1 | 0s | 🔴 /home/ubuntu/.openclaw/script/git-review-daily.sh: line 19: cd: /home/ubuntu/dev |
| hermes-cron-health | 2026-06-22T21:00 | 0 | 9s | ✓  |
| hermes-evolution-forward | 2026-06-22T23:35 | 0 | 0s | ✓  |
| hermes-output-quality-check | 2026-06-21T23:55 | 0 | 1s | ✓  |
| hf-papers | 2026-06-22T07:00 | 0 | 6s | ✓  |
| info-swarm | 2026-06-22T21:30 | 0 | 99s | ✓  |
| lead-draft | 2026-06-22T07:45 | 0 | 82s | ✓  |
| lead-signal-scan | 2026-06-22T07:30 | 0 | 226s | ✓  |
| log-rotate | 2026-06-22T10:00 | 0 | 0s | ✓  |
| logrotate | 2026-06-22T09:45 | 0 | 0s | ✓  |
| mainline-mirror | 2026-06-22T08:50 | 0 | 1s | ✓  |
| model-bench | 2026-06-21T04:00 | 0 | 35s | ✓  |
| monitor | 2026-06-22T23:30 | 0 | 16s | ✓  |
| morning-brief | 2026-06-22T08:00 | 1 | 420s | 🔴  |
| morning-cockpit-forward | 2026-06-22T08:30 | 0 | 0s | ✓  |
| opportunity-scan | 2026-05-13T11:00 | 0 | 29s | ✓  |
| port-health | 2026-06-22T23:30 | 0 | 0s | ✓  |
| proxy-shim-watchdog | 2026-06-22T23:50 | 0 | 0s | ✓  |
| quota-aware-router | 2026-06-22T23:45 | 0 | 3s | ✓  |
| sales-digest | 2026-06-22T08:00 | 0 | 3s | ✓  |
| sales-redteam-forward | 2026-06-22T09:05 | 0 | 3s | ✓  |
| self-improve | 2026-06-21T23:50 | 0 | 4s | ✓ Traceback (most recent call last):   File "<stdin>", line 57, in <module>   File |
| stock-close-alert | 2026-06-22T14:55 | 0 | 23s | ✓  |
| stock-pipeline | 2026-05-17T19:00 | 2 | 252s | 🔴  |
| stock-pre-market | 2026-06-22T09:15 | 0 | 27s | ✓  |
| sync-brain | 2026-06-22T09:30 | 0 | 62s | ✓  |
| ta-deep-brief | 2026-06-22T17:30 | 1 | 3s | 🔴 [ta-deep] 17:30:03 多 agent 深度分析: 三花智控 特变电工 [ta-deep] 写入 /home/ubuntu/.openclaw/s |
| ta-postmarket | 2026-06-22T15:05 | 0 | 1079s | 🟡 [postmarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-06-22-post.md (5446 B)  |
| ta-premarket | 2026-06-22T08:30 | 0 | 236s | ✓ [premarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-06-22-pre.md (1911 B)  |
| ta-weekly-review | 2026-06-21T12:15 | 0 | 38s | ✓  |
| today-priorities | 2026-06-22T08:30 | 0 | 3s | ✓  |
| token-quota-tracker | 2026-06-22T23:00 | 0 | 0s | ✓  |
| trade-journal-review | 2026-06-21T18:30 | 0 | 5s | ✓  |
| trader-video-daily | 2026-06-22T16:00 | 1 | 47s | 🔴 [vault_explain] 三花智控 skipped: HTTP Error 500: Internal Server Error [vault_expla |
| value-miner | 2026-05-13T10:00 | 0 | 29s | ✓  |
| vault-backup | 2026-06-22T08:15 | 0 | 0s | ✓  |
| vault-index | 2026-06-22T08:45 | 0 | 3s | ✓ mbed: HTTP Error 404: Not Found   ✗ embed: HTTP Error 404: Not Found   ✗ embed:  |
| weekly-automation-forward | 2026-06-22T08:35 | 0 | 2s | ✓  |
| weekly-retro | 2026-06-21T18:00 | 0 | 22s | ✓  |
| wiki-audit | 2026-06-22T03:00 | 0 | 0s | ✓  |

## 🤖 Agent 表现

- agent 调用成功 ≈ 0 次
- agent 调用失败 ≈ 0 次
- 命中率 ≈ 0%

## 📨 Telegram 推送

