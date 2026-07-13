# 系统自检 · 2026-07-08 23:50
# 蜂群评审 · 2026-07-08 23:50
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
# 今日系统诊断 · 2026-07-08

## 🔧 Cron 任务状态

| job | last_run | exit | duration | stderr_tail |
|---|---|---|---|---|
| archive-to-brain | 2026-07-08T23:00 | 0 | 1s | ✓  |
| auto-llm-task | 2026-07-08T11:30 | 0 | 3s | ✓  |
| backend-upgrade-watch | 2026-07-08T11:02 | 0 | 293s | ✓ [state-migrations] Legacy state migration warnings: - Left plugin install index  |
| backup-agents | 2026-07-08T10:45 | 0 | 4s | ✓  |
| brain-daily | 2026-07-08T10:57 | 0 | 16s | ✓  |
| chaotang-censor-watchdog | 2026-07-08T18:15 | 0 | 0s | ✓  |
| chaotang-censor | 2026-07-08T11:07 | 0 | 9s | ✓  |
| chaotang-finder | 2026-07-08T11:00 | 0 | 106s | ✓  |
| closing100-nudge | 2026-07-08T21:35 | 0 | 0s | ✓  |
| config-snapshot | 2026-07-08T10:52 | 0 | 1s | ✓  |
| content-factory | 2026-05-12T23:00 | 0 | 269s | ✓  |
| content-flight-deck | 2026-05-13T08:30 | 0 | 2s | ✓  |
| cost-ceiling | 2026-07-08T23:00 | 0 | 3s | ✓  |
| council-engineering | 2026-07-08T17:45 | 0 | 29s | ✓  |
| council-investment | 2026-07-06T09:15 | 1 | 0s | 🔴  |
| council-management | 2026-07-03T09:15 | 0 | 27s | ✓  |
| council-strategy | 2026-07-07T09:15 | 0 | 35s | ✓  |
| cron-stale-check | 2026-07-08T23:00 | 0 | 4s | ✓  |
| daily-briefing-fill-forward | 2026-07-08T21:35 | 0 | 2s | ✓  |
| daily-diff-watcher | 2026-07-08T21:30 | 0 | 0s | ✓  |
| daily-lesson | 2026-07-08T23:45 | 0 | 2s | ✓  |
| daily-top3 | 2026-05-12T22:30 | 0 | 49s | ✓  |
| daily-work-report | 2026-07-08T10:45 | 0 | 1s | ✓  |
| disk-retention | 2026-07-05T04:30 | 0 | 0s | ✓  |
| evolve-morning | 2026-07-08T10:45 | 0 | 1s | ✓  |
| evolve-sync | 2026-07-08T18:00 | 0 | 0s | ✓  |
| evolve-weekly | 2026-07-05T21:00 | 0 | 2s | ✓  |
| feishu-resolve-recover | 2026-07-08T23:30 | 0 | 0s | ✓  |
| git-review | 2026-07-08T22:00 | 1 | 0s | 🔴 /home/ubuntu/.openclaw/script/git-review-daily.sh: line 19: cd: /home/ubuntu/dev |
| hermes-cron-health | 2026-07-08T21:00 | 0 | 5s | ✓  |
| hermes-evolution-forward | 2026-07-08T23:35 | 0 | 3s | ✓  |
| hermes-output-quality-check | 2026-07-08T10:56 | 0 | 0s | ✓  |
| hf-papers | 2026-07-08T10:52 | 0 | 4s | ✓  |
| info-swarm | 2026-07-08T21:30 | 0 | 87s | ✓  |
| lead-draft | 2026-07-08T10:59 | 0 | 63s | ✓  |
| lead-signal-scan | 2026-07-08T10:57 | 0 | 132s | ✓  |
| log-rotate | 2026-07-08T11:15 | 0 | 0s | ✓  |
| logrotate | 2026-07-08T11:15 | 0 | 0s | ✓  |
| mainline-mirror | 2026-07-08T10:57 | 0 | 5s | ✓  |
| model-bench | 2026-07-05T04:00 | 0 | 27s | ✓  |
| monitor | 2026-07-08T23:30 | 0 | 12s | ✓  |
| morning-brief | 2026-07-08T10:45 | 1 | 375s | 🔴  |
| morning-cockpit-forward | 2026-07-08T10:56 | 0 | 3s | ✓  |
| opportunity-scan | 2026-05-13T11:00 | 0 | 29s | ✓  |
| port-health | 2026-07-08T23:30 | 0 | 1s | ✓  |
| proxy-shim-watchdog | 2026-07-08T23:50 | 0 | 0s | ✓  |
| quota-aware-router | 2026-07-08T23:45 | 0 | 2s | ✓  |
| sales-digest | 2026-07-08T11:02 | 0 | 1s | ✓  |
| sales-redteam-forward | 2026-07-06T09:05 | 0 | 0s | ✓  |
| self-improve | 2026-07-08T10:54 | 0 | 2s | ✓ Traceback (most recent call last):   File "<stdin>", line 57, in <module>   File |
| stock-close-alert | 2026-07-08T14:55 | 0 | 76s | ✓  |
| stock-pipeline | 2026-05-17T19:00 | 2 | 252s | 🔴  |
| stock-pre-market | 2026-07-08T10:52 | 0 | 105s | ✓  |
| sync-brain | 2026-07-08T10:51 | 0 | 60s | ✓  |
| ta-deep-brief | 2026-07-08T17:30 | 1 | 3s | 🔴 [ta-deep] 17:30:01 多 agent 深度分析: 三花智控 特变电工 [ta-deep] 写入 /home/ubuntu/.openclaw/s |
| ta-postmarket | 2026-07-08T15:05 | 0 | 388s | ✓ [postmarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-07-08-post.md (6426 B)  |
| ta-premarket | 2026-07-08T10:54 | 0 | 124s | ✓ [premarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-07-08-pre.md (2018 B)  |
| ta-weekly-review | 2026-07-03T21:00 | 0 | 7s | ✓  |
| today-priorities | 2026-07-08T10:52 | 0 | 2s | ✓  |
| token-quota-tracker | 2026-07-08T23:00 | 0 | 0s | ✓  |
| trade-journal-review | 2026-07-05T18:30 | 0 | 1s | ✓  |
| trader-video-daily | 2026-07-08T16:00 | 1 | 32s | 🔴 [vault_explain] 三花智控 skipped: timed out [vault_explain] 特变电工 skipped: timed out  |
| value-miner | 2026-05-13T10:00 | 0 | 29s | ✓  |
| vault-backup | 2026-07-08T10:52 | 0 | 0s | ✓  |
| vault-index | 2026-07-08T10:54 | 0 | 31s | ✓ mbed: HTTP Error 404: Not Found   ✗ embed: HTTP Error 404: Not Found   ✗ embed:  |
| weekly-automation-forward | 2026-07-06T08:35 | 0 | 0s | ✓  |
| weekly-retro | 2026-07-05T18:00 | 0 | 2s | ✓  |
| wiki-audit | 2026-07-08T10:56 | 0 | 0s | ✓  |

## 🤖 Agent 表现

- agent 调用成功 ≈ 0 次
- agent 调用失败 ≈ 128 次
- 命中率 ≈ 0%

## 📨 Telegram 推送

