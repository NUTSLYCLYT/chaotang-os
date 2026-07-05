# 系统自检 · 2026-07-04 23:50
# 蜂群评审 · 2026-07-04 23:50
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
# 今日系统诊断 · 2026-07-04

## 🔧 Cron 任务状态

| job | last_run | exit | duration | stderr_tail |
|---|---|---|---|---|
| archive-to-brain | 2026-07-04T23:00 | 0 | 0s | ✓  |
| auto-llm-task | 2026-07-04T11:30 | 0 | 2s | ✓  |
| backend-upgrade-watch | 2026-07-04T08:38 | 0 | 193s | ✓  |
| backup-agents | 2026-07-04T09:30 | 0 | 4s | ✓  |
| brain-daily | 2026-07-04T09:00 | 0 | 54s | ✓  |
| chaotang-finder | 2026-07-04T09:01 | 0 | 89s | ✓  |
| closing100-nudge | 2026-07-04T21:35 | 0 | 0s | ✓  |
| config-snapshot | 2026-07-04T09:15 | 0 | 1s | ✓  |
| content-factory | 2026-05-12T23:00 | 0 | 269s | ✓  |
| content-flight-deck | 2026-05-13T08:30 | 0 | 2s | ✓  |
| cost-ceiling | 2026-07-04T23:00 | 0 | 2s | ✓  |
| council-engineering | 2026-07-01T09:15 | 0 | 24s | ✓  |
| council-investment | 2026-06-29T09:15 | 1 | 0s | 🔴  |
| council-management | 2026-07-03T09:15 | 0 | 27s | ✓  |
| council-strategy | 2026-06-30T09:15 | 0 | 55s | ✓  |
| cron-stale-check | 2026-07-04T23:00 | 0 | 4s | ✓  |
| daily-briefing-fill-forward | 2026-07-04T21:35 | 0 | 2s | ✓  |
| daily-diff-watcher | 2026-07-04T21:30 | 0 | 0s | ✓  |
| daily-lesson | 2026-07-04T23:45 | 0 | 3s | ✓  |
| daily-top3 | 2026-05-12T22:30 | 0 | 49s | ✓  |
| daily-work-report | 2026-07-04T09:00 | 0 | 71s | ✓  |
| disk-retention | 2026-06-28T04:30 | 0 | 0s | ✓  |
| evolve-morning | 2026-07-04T08:00 | 0 | 1s | ✓  |
| evolve-sync | 2026-07-04T18:00 | 0 | 0s | ✓  |
| evolve-weekly | 2026-06-28T21:00 | 0 | 2s | ✓  |
| feishu-resolve-recover | 2026-07-04T23:30 | 0 | 0s | ✓  |
| git-review | 2026-07-04T22:00 | 1 | 0s | 🔴 /home/ubuntu/.openclaw/script/git-review-daily.sh: line 19: cd: /home/ubuntu/dev |
| hermes-cron-health | 2026-07-04T21:00 | 0 | 6s | ✓  |
| hermes-evolution-forward | 2026-07-04T23:35 | 0 | 5s | ✓  |
| hermes-output-quality-check | 2026-07-03T23:55 | 0 | 0s | ✓  |
| hf-papers | 2026-07-04T07:00 | 0 | 3s | ✓  |
| info-swarm | 2026-07-04T21:30 | 0 | 67s | ✓  |
| lead-draft | 2026-07-04T08:58 | 0 | 221s | ✓  |
| lead-signal-scan | 2026-07-04T08:45 | 0 | 69s | ✓  |
| log-rotate | 2026-07-04T10:00 | 0 | 0s | ✓  |
| logrotate | 2026-07-04T09:45 | 0 | 0s | ✓  |
| mainline-mirror | 2026-07-04T08:50 | 0 | 4s | ✓  |
| model-bench | 2026-06-28T04:00 | 0 | 24s | ✓  |
| monitor | 2026-07-04T23:30 | 0 | 12s | ✓  |
| morning-brief | 2026-07-04T08:00 | 1 | 416s | 🔴  |
| morning-cockpit-forward | 2026-07-04T08:30 | 0 | 2s | ✓  |
| opportunity-scan | 2026-05-13T11:00 | 0 | 29s | ✓  |
| port-health | 2026-07-04T23:30 | 0 | 1s | ✓  |
| proxy-shim-watchdog | 2026-07-04T23:40 | 0 | 0s | ✓  |
| quota-aware-router | 2026-07-04T23:45 | 0 | 3s | ✓  |
| sales-digest | 2026-07-04T09:15 | 0 | 2s | ✓  |
| sales-redteam-forward | 2026-06-29T09:05 | 0 | 2s | ✓  |
| self-improve | 2026-07-03T23:50 | 0 | 2s | ✓ Traceback (most recent call last):   File "<stdin>", line 57, in <module>   File |
| stock-close-alert | 2026-07-04T16:15 | 0 | 121s | ✓  |
| stock-pipeline | 2026-05-17T19:00 | 2 | 252s | 🔴  |
| stock-pre-market | 2026-07-04T10:30 | 0 | 86s | ✓  |
| sync-brain | 2026-07-04T09:30 | 0 | 60s | ✓  |
| ta-deep-brief | 2026-07-04T18:45 | 1 | 2s | 🔴 [ta-deep] 18:45:02 多 agent 深度分析: 三花智控 特变电工 [ta-deep] 写入 /home/ubuntu/.openclaw/s |
| ta-postmarket | 2026-07-04T16:30 | 0 | 476s | ✓ [postmarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-07-04-post.md (7085 B)  |
| ta-premarket | 2026-07-04T09:45 | 0 | 54s | ✓ [premarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-07-04-pre.md (2673 B)  |
| ta-weekly-review | 2026-07-03T21:00 | 0 | 7s | ✓  |
| today-priorities | 2026-07-04T08:30 | 0 | 1s | ✓  |
| token-quota-tracker | 2026-07-04T23:00 | 0 | 0s | ✓  |
| trade-journal-review | 2026-06-28T18:30 | 0 | 1s | ✓  |
| trader-video-daily | 2026-07-04T17:15 | 1 | 55s | 🔴 [vault_explain] 特变电工 skipped: timed out  |
| value-miner | 2026-05-13T10:00 | 0 | 29s | ✓  |
| vault-backup | 2026-07-04T08:15 | 0 | 0s | ✓  |
| vault-index | 2026-07-04T08:45 | 0 | 27s | ✓ mbed: HTTP Error 404: Not Found   ✗ embed: HTTP Error 404: Not Found   ✗ embed:  |
| weekly-automation-forward | 2026-06-29T08:35 | 0 | 1s | ✓  |
| weekly-retro | 2026-06-28T18:00 | 0 | 1s | ✓  |
| wiki-audit | 2026-07-04T03:00 | 0 | 1s | ✓  |

## 🤖 Agent 表现

- agent 调用成功 ≈ 0 次
- agent 调用失败 ≈ 97 次
- 命中率 ≈ 0%

## 📨 Telegram 推送

