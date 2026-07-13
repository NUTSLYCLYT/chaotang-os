# 系统自检 · 2026-07-05 23:50
# 蜂群评审 · 2026-07-05 23:50
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
# 今日系统诊断 · 2026-07-05

## 🔧 Cron 任务状态

| job | last_run | exit | duration | stderr_tail |
|---|---|---|---|---|
| archive-to-brain | 2026-07-05T23:00 | 0 | 1s | ✓  |
| auto-llm-task | 2026-07-05T10:15 | 0 | 3s | ✓  |
| backend-upgrade-watch | 2026-07-05T08:38 | 0 | 88s | ✓ [state-migrations] Legacy state migration warnings: - Left plugin install index  |
| backup-agents | 2026-07-05T09:30 | 0 | 4s | ✓  |
| brain-daily | 2026-07-05T09:00 | 0 | 18s | ✓  |
| chaotang-finder | 2026-07-05T10:16 | 0 | 93s | ✓  |
| closing100-nudge | 2026-07-05T21:35 | 0 | 0s | ✓  |
| config-snapshot | 2026-07-05T09:15 | 0 | 1s | ✓  |
| content-factory | 2026-05-12T23:00 | 0 | 269s | ✓  |
| content-flight-deck | 2026-05-13T08:30 | 0 | 2s | ✓  |
| cost-ceiling | 2026-07-05T23:00 | 0 | 0s | ✓  |
| council-engineering | 2026-07-01T09:15 | 0 | 24s | ✓  |
| council-investment | 2026-06-29T09:15 | 1 | 0s | 🔴  |
| council-management | 2026-07-03T09:15 | 0 | 27s | ✓  |
| council-strategy | 2026-06-30T09:15 | 0 | 55s | ✓  |
| cron-stale-check | 2026-07-05T23:00 | 1 | 12s | 🔴  |
| daily-briefing-fill-forward | 2026-07-05T21:35 | 0 | 2s | ✓  |
| daily-diff-watcher | 2026-07-05T21:30 | 0 | 0s | ✓  |
| daily-lesson | 2026-07-05T23:45 | 0 | 10s | ✓  |
| daily-top3 | 2026-05-12T22:30 | 0 | 49s | ✓  |
| daily-work-report | 2026-07-05T09:00 | 0 | 1s | ✓  |
| disk-retention | 2026-07-05T04:30 | 0 | 0s | ✓  |
| evolve-morning | 2026-07-05T08:00 | 0 | 2s | ✓  |
| evolve-sync | 2026-07-05T18:00 | 0 | 0s | ✓  |
| evolve-weekly | 2026-07-05T21:00 | 0 | 2s | ✓  |
| feishu-resolve-recover | 2026-07-05T23:30 | 0 | 0s | ✓  |
| git-review | 2026-07-05T22:00 | 1 | 0s | 🔴 /home/ubuntu/.openclaw/script/git-review-daily.sh: line 19: cd: /home/ubuntu/dev |
| hermes-cron-health | 2026-07-05T21:00 | 0 | 5s | ✓  |
| hermes-evolution-forward | 2026-07-05T23:35 | 1 | 6s | 🔴  |
| hermes-output-quality-check | 2026-07-04T23:55 | 0 | 0s | ✓  |
| hf-papers | 2026-07-05T07:00 | 0 | 3s | ✓  |
| info-swarm | 2026-07-05T21:30 | 0 | 86s | ✓  |
| lead-draft | 2026-07-05T10:15 | 0 | 80s | ✓  |
| lead-signal-scan | 2026-07-05T10:00 | 0 | 116s | ✓  |
| log-rotate | 2026-07-05T10:00 | 0 | 0s | ✓  |
| logrotate | 2026-07-05T09:45 | 0 | 0s | ✓  |
| mainline-mirror | 2026-07-05T08:50 | 0 | 4s | ✓  |
| model-bench | 2026-07-05T04:00 | 0 | 27s | ✓  |
| monitor | 2026-07-05T23:30 | 0 | 29s | ✓  |
| morning-brief | 2026-07-05T08:00 | 1 | 355s | 🔴  |
| morning-cockpit-forward | 2026-07-05T08:30 | 0 | 2s | ✓  |
| opportunity-scan | 2026-05-13T11:00 | 0 | 29s | ✓  |
| port-health | 2026-07-05T23:30 | 0 | 0s | ✓  |
| proxy-shim-watchdog | 2026-07-05T23:50 | 0 | 0s | ✓  |
| quota-aware-router | 2026-07-05T23:45 | 1 | 0s | 🔴  |
| sales-digest | 2026-07-05T10:30 | 0 | 2s | ✓  |
| sales-redteam-forward | 2026-06-29T09:05 | 0 | 2s | ✓  |
| self-improve | 2026-07-04T23:50 | 0 | 2s | ✓ Traceback (most recent call last):   File "<stdin>", line 57, in <module>   File |
| stock-close-alert | 2026-07-05T17:30 | 0 | 37s | ✓  |
| stock-pipeline | 2026-05-17T19:00 | 2 | 252s | 🔴  |
| stock-pre-market | 2026-07-05T11:45 | 0 | 82s | ✓  |
| sync-brain | 2026-07-05T09:30 | 0 | 60s | ✓  |
| ta-deep-brief | 2026-07-05T20:00 | 1 | 15s | 🔴 [ta-deep] 20:00:02 多 agent 深度分析: 三花智控 特变电工 [ta-deep] 写入 /home/ubuntu/.openclaw/s |
| ta-postmarket | 2026-07-05T17:45 | 0 | 57s | ✓ [postmarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-07-05-post.md (7085 B)  |
| ta-premarket | 2026-07-05T11:00 | 0 | 115s | ✓ [premarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-07-05-pre.md (2758 B)  |
| ta-weekly-review | 2026-07-03T21:00 | 0 | 7s | ✓  |
| today-priorities | 2026-07-05T08:30 | 0 | 2s | ✓  |
| token-quota-tracker | 2026-07-05T23:00 | 0 | 0s | ✓  |
| trade-journal-review | 2026-07-05T18:30 | 0 | 1s | ✓  |
| trader-video-daily | 2026-07-05T18:30 | 1 | 53s | 🔴 [vault_explain] 三花智控 skipped: timed out  |
| value-miner | 2026-05-13T10:00 | 0 | 29s | ✓  |
| vault-backup | 2026-07-05T08:15 | 0 | 0s | ✓  |
| vault-index | 2026-07-05T08:45 | 0 | 22s | ✓ mbed: HTTP Error 404: Not Found   ✗ embed: HTTP Error 404: Not Found   ✗ embed:  |
| weekly-automation-forward | 2026-06-29T08:35 | 0 | 1s | ✓  |
| weekly-retro | 2026-07-05T18:00 | 0 | 2s | ✓  |
| wiki-audit | 2026-07-05T03:00 | 0 | 1s | ✓  |

## 🤖 Agent 表现

- agent 调用成功 ≈ 0 次
- agent 调用失败 ≈ 105 次
- 命中率 ≈ 0%

## 📨 Telegram 推送

