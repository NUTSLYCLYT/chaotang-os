# 2026-07-12 Daily Briefing

Source: CourtOS

## Three things that matter


1. **蜂群 agent 全线静默 — 今日 5 个关键 cron 产出为空白**。weekly-retro 的 3 个 agent（sprint-prioritizer/trend-researcher/product-manager）、HF Papers 的 2 个评审、盘前/尾盘的 finance 三件套，全部 `exit 141`（SIGPIPE）。根因是 07-11 已暴露的 `openclaw: command not found` — 这意味着**所有依赖 `openclaw agent` 调度的 cron 已至少失效 2 天**，用户看到的 Daily Briefing / 周复盘 / 盘前盘后决策均为空壳。

2. **A股今日大跌，尾盘警报零决策**。创业板 -4.37%、深成指 -2.29%、上证 -1.00%，但 `stock-close-alert` 产出的 3 个 agent 全部 exit 141，无调仓/止损/止盈输出。尾盘数据本身已采集完毕（阿里港股 +2.51% 逆势涨），但因 agent 链路断裂，**今日任何仓位变动都是人工裸奔决策**。

3. **vault-index 连续失败 — numpy 缺失**。`ModuleNotFoundError: No module named 'numpy'` — 这意味着 vault RAG 索引管道已中断，_wiki 的向量搜索能力不工作。同批 cron 还有 `ta-premarket`（2B 空输出）、`ta-postmarket`（11B 空输出）、`trader-video-daily`（venv 路径失效）、`ta-deep-brief`（超时）。今天 45 个 cron 里有 **6 个明确失败**，失败率 ~13%。

## Risks


- **openclaw CLI 路径断裂 → 所有 agent 调度 cron 静默失败**。影响面：Daily Briefing / weekly-retro / HF Papers / 股票盘前尾盘 / Evolution lesson，覆盖用户每日信息摄入的 60%+。`morning-cockpit-forward` 虽然 exit 0，但转发的是空内容。缓解：今晚确认 `openclaw` 二进制位置（`which openclaw`），修复 PATH 或 cron 脚本中的绝对路径引用。如果 `openclaw` 已卸载/迁移，需要评估替代调度方案。

- **vault-index 向量检索失效**。numpy 缺失意味着 Python 环境不完整。影响面：_wiki 的 RAG 搜索、audit 的语义去重。缓解：`pip install numpy` 或确认 venv 是否被意外重置。5 分钟修复，今晚做。

- **trader-video-daily / ta-deep-brief Python 环境断裂**。`.venv/bin/python: No such file or directory` — 指向某个已删除或路径变更的 venv。影响面：交易视频日更、深度技术分析全部中断。这不是今天的新问题，从错误特征看至少已持续数天。

- **evolve 晨报暂停等待评分，打卡仅 1 天**。MOC 显示 "晨报暂停，直到你评分完今天"，提问质量 30/100、记忆深度 10/100。如果评分机制长期卡住，evolve 闭环会瓦解。

## Opportunities


- **agent 链路修复后，可一次性回填今日所有断层产出**。HF Papers 已有 15 篇论文原始数据、盘前/尾盘数据完整采集 — 只需恢复 `openclaw agent` 调度，即可批量跑出今日缺失的 5 组评审。触发条件：`openclaw` CLI 恢复可用。验证动作：`openclaw agent --agent trend-researcher` 试跑一条。

- **model-bench 今日正常产出，swarm-worker 1.12s 最快、swarm-advisor-opus 成功率仅 67%**。opus 在 translate/summarize/json-extract 三个标准任务上掉了一个 — 值得核对是哪个任务失败，决定是否降级 opus 在某些 cron 中的角色。

## What changed

-

## Decisions needed


- **明天 12:00 前：openclaw CLI 状态确认 + 修复方案选择**。选项 A：修复 PATH/软链接恢复 `openclaw` 命令；选项 B：把所有 agent 调度 cron 改为直接调用 Hermes（如果 openclaw 已正式退役）。取舍点：A 最快但打补丁，B 彻底但需要重写所有 agent 调度脚本，约 2-4 小时工作量。

- **明天 12:00 前：是否回填今日缺失的 agent 评审**。选项 A：跑回填（一次性 5 组评审产出 Daily Briefing/周复盘/盘前盘后/HF Papers）；选项 B：跳过今天，只确保明天起恢复正常。取舍点：A 需要 30 分钟 + token 消耗，但有完整记录；B 零成本但 07-12 永远留白。

---


---
_自动智能填充 @ 21:35 · source: 2026-07-12_21-30-50.md_

