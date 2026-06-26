# 系统自检 · 2026-06-25 23:50
# 蜂群评审 · 2026-06-25 23:50
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
# 今日系统诊断 · 2026-06-25

## 🔧 Cron 任务状态

| job | last_run | exit | duration | stderr_tail |
|---|---|---|---|---|
| archive-to-brain | 2026-06-25T23:00 | 0 | 0s | ✓  |
| auto-llm-task | 2026-06-25T10:15 | 0 | 3s | ✓  |
| backup-agents | 2026-06-25T09:30 | 0 | 5s | ✓  |
| brain-daily | 2026-06-25T09:00 | 0 | 16s | ✓  |
| chaotang-finder | 2026-06-25T07:35 | 0 | 79s | ✓  |
| closing100-nudge | 2026-06-25T21:35 | 0 | 0s | ✓  |
| config-snapshot | 2026-06-25T09:15 | 0 | 16s | ✓  |
| content-factory | 2026-05-12T23:00 | 0 | 269s | ✓  |
| content-flight-deck | 2026-05-13T08:30 | 0 | 2s | ✓  |
| cost-ceiling | 2026-06-25T23:00 | 0 | 4s | ✓  |
| council-engineering | 2026-06-24T09:15 | 0 | 31s | ✓  |
| council-investment | 2026-06-22T09:15 | 1 | 0s | 🔴  |
| council-management | 2026-06-19T09:15 | 0 | 67s | ✓  |
| council-strategy | 2026-06-23T09:15 | 0 | 141s | ✓  |
| cron-stale-check | 2026-06-25T23:00 | 0 | 4s | ✓  |
| daily-briefing-fill-forward | 2026-06-25T21:35 | 0 | 2s | ✓  |
| daily-diff-watcher | 2026-06-25T21:30 | 0 | 2s | ✓  |
| daily-lesson | 2026-06-25T23:45 | 0 | 2s | ✓  |
| daily-top3 | 2026-05-12T22:30 | 0 | 49s | ✓  |
| daily-work-report | 2026-06-25T09:00 | 0 | 1s | ✓  |
| disk-retention | 2026-06-21T04:30 | 0 | 1s | ✓  |
| evolve-morning | 2026-06-25T08:00 | 0 | 2s | ✓  |
| evolve-sync | 2026-06-25T18:00 | 0 | 0s | ✓  |
| evolve-weekly | 2026-06-21T21:00 | 0 | 8s | ✓  |
| feishu-resolve-recover | 2026-06-25T23:30 | 0 | 0s | ✓  |
| git-review | 2026-06-25T22:00 | 1 | 0s | 🔴 /home/ubuntu/.openclaw/script/git-review-daily.sh: line 19: cd: /home/ubuntu/dev |
| hermes-cron-health | 2026-06-25T21:00 | 0 | 5s | ✓  |
| hermes-evolution-forward | 2026-06-25T23:35 | 0 | 3s | ✓  |
| hermes-output-quality-check | 2026-06-24T23:55 | 0 | 1s | ✓  |
| hf-papers | 2026-06-25T07:00 | 0 | 2s | ✓  |
| info-swarm | 2026-06-25T21:30 | 0 | 92s | ✓  |
| lead-draft | 2026-06-25T07:45 | 0 | 43s | ✓  |
| lead-signal-scan | 2026-06-25T07:30 | 0 | 125s | ✓  |
| log-rotate | 2026-06-25T10:00 | 0 | 0s | ✓  |
| logrotate | 2026-06-25T09:45 | 0 | 0s | ✓  |
| mainline-mirror | 2026-06-25T08:50 | 1 | 9s | 🔴  |
| model-bench | 2026-06-21T04:00 | 0 | 35s | ✓  |
| monitor | 2026-06-25T23:30 | 0 | 15s | ✓  |
| morning-brief | 2026-06-25T08:00 | 1 | 347s | 🔴  |
| morning-cockpit-forward | 2026-06-25T08:30 | 0 | 2s | ✓  |
| opportunity-scan | 2026-05-13T11:00 | 0 | 29s | ✓  |
| port-health | 2026-06-25T23:30 | 0 | 1s | ✓  |
| proxy-shim-watchdog | 2026-06-25T23:50 | 0 | 0s | ✓  |
| quota-aware-router | 2026-06-25T23:45 | 1 | 3s | 🔴  |
| sales-digest | 2026-06-25T08:00 | 0 | 2s | ✓  |
| sales-redteam-forward | 2026-06-22T09:05 | 0 | 3s | ✓  |
| self-improve | 2026-06-24T23:50 | 0 | 2s | ✓ Traceback (most recent call last):   File "<stdin>", line 57, in <module>   File |
| stock-close-alert | 2026-06-25T14:55 | 0 | 95s | ✓  |
| stock-pipeline | 2026-05-17T19:00 | 2 | 252s | 🔴  |
| stock-pre-market | 2026-06-25T09:15 | 0 | 105s | ✓  |
| sync-brain | 2026-06-25T09:30 | 0 | 67s | ✓  |
| ta-deep-brief | 2026-06-25T18:45 | 1 | 1s | 🔴 [ta-deep] 18:45:07 多 agent 深度分析: 三花智控 特变电工 [ta-deep] 写入 /home/ubuntu/.openclaw/s |
| ta-postmarket | 2026-06-25T15:05 | 0 | 435s | ✓ [postmarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-06-25-post.md (5806 B)  |
| ta-premarket | 2026-06-25T08:30 | 0 | 141s | ✓ [premarket] /home/ubuntu/.openclaw/state/ta-briefs/2026-06-25-pre.md (1411 B)  |
| ta-weekly-review | 2026-06-21T12:15 | 0 | 38s | ✓  |
| today-priorities | 2026-06-25T08:30 | 0 | 2s | ✓  |
| token-quota-tracker | 2026-06-25T23:00 | 0 | 0s | ✓  |
| trade-journal-review | 2026-06-21T18:30 | 0 | 5s | ✓  |
| trader-video-daily | 2026-06-25T16:00 | 1 | 9s | 🔴  |
| value-miner | 2026-05-13T10:00 | 0 | 29s | ✓  |
| vault-backup | 2026-06-25T08:15 | 0 | 0s | ✓  |
| vault-index | 2026-06-25T08:45 | 0 | 23s | ✓ mbed: HTTP Error 404: Not Found   ✗ embed: HTTP Error 404: Not Found   ✗ embed:  |
| weekly-automation-forward | 2026-06-22T08:35 | 0 | 2s | ✓  |
| weekly-retro | 2026-06-21T18:00 | 0 | 22s | ✓  |
| wiki-audit | 2026-06-25T03:00 | 0 | 0s | ✓  |

## 🤖 Agent 表现

- agent 调用成功 ≈ 0 次
- agent 调用失败 ≈ 25 次
- 命中率 ≈ 0%

## 📨 Telegram 推送

