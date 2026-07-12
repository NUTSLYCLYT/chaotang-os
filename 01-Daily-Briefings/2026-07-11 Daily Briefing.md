# 2026-07-11 Daily Briefing

Source: CourtOS

## Three things that matter


1. **蜂群评审 agent 全线 exit 141 — 今天的盘前/尾盘/HF 论文/进化复盘 4 组评审全部失败。** 金融三 agent（`finance-bull-analyst`, `finance-bear-analyst`, `portfolio-rebalancer`）盘前和尾盘各炸一次，exit 141；HF 论文评审两个 agent 同时 exit 141；evolution lesson 两个 agent 报 `openclaw: No such file or directory`。这不是偶发——是系统级故障，连续 7+ agent 调用全部无效输出。战略含义：**蜂群评审链路实际已处于不可用状态，今天 A 股创业板暴跌 4.37% 的交易日里主上没有收到任何 swarm 分析**，决策裸奔。

2. **9 个 cron 任务失败，其中 3 个 timeout。** `morning-brief` (exit 1)、`vault-index` (numpy 缺失)、`lead-signal-scan` (exit 124)、`chaotang-finder` (exit 124)、`ta-premarket`/`ta-postmarket` (exit 1)、`ta-deep-brief` (三花/特变超时)、`trader-video-daily` (.venv 缺失)、`quota-aware-router` (exit 1)。尤其是 `lead-signal-scan` 和 `chaotang-finder` 的 124 timeout 表明某些爬虫/call 卡死在网络等待——占着坑位导致后续依赖链也断掉。`trader-video-daily` 的 venv 丢失是环境漂移，需重建。

3. **Brain wiki 515 个 concept 全为 stub，382/386 个 entity 为 stub。** audit 显示 wiki 规模增长（214 sources，+79 条新 concept 来自今日 source），但 **100% 的 concept 和 entity 都是 auto-stub 骨架**，没有一条 LLM 完成了 synthesis。vault 在灌数据但 wiki 没有消化。战略含义：主上的知识库目前是「只入库不提炼」状态——概念之间没有关系解释，检索只能靠关键词匹配。

## Risks


- **exit 141 如果明天继续，swarm 评审 = 装饰品。** 退出码 141 = SIGPIPE，大概率是 agent 子进程的 stdout 管道被提前关闭——可能 `openclaw agent` 调用参数拼装有变化或 gateway 超时配置过短。影响面：股票决策、论文筛选、复盘学习全断。**今晚做：** `openclaw agent --agent finance-bull-analyst "test"` 直接单次调用复现，看完整 stderr；如果是 `openclaw` 二进制路径问题（同 evolution 的 "No such file"），检查 cron PATH 和 agent 配置中的 command 字段。

- **ta 链路全线崩塌。** `ta-premarket` + `ta-postmarket` + `ta-deep-brief` + `trader-video-daily` 四个 ta 相关 cron 全失败。三花智控/特变电工今天是创业板暴跌日的关键标的，深度分析却超时没产出。**明天开盘前修：** 先修 `trader-video-daily` 的 venv 路径，再逐个调大 ta-deep-brief 的 timeout。

- **vault-index numpy 缺失阻断了 RAG 检索。** 用户问 brain-ask 时会用旧索引甚至空结果。**今晚修：** `pip install numpy` 进 cron 用的 python 环境，然后重跑 `vault-index`。

- **backend-upgrade-watch 报告 acpx/feishu 插件遗留状态冲突。** 目前没炸但属于 known-broken 状态，飞书 bot 可能在下次调用时静默失败。**明天检查** feishu 消息推送是否正常。

## Opportunities


- **HomeRail 791e5642 跑通 9/9，是实现基础设施正常运转的唯一亮点。** 5 节点全部通过，plan 节点产出了 README 改进清单，implement 节点产出了可运行的 snake-game。如果能把 HomeRail 的 agent 调用方式（参数、超时、管道处理）对照到 swarm 评审的调用方式，很可能定位 exit 141 的根因。**5 分钟验证：** 对比 HomeRail 成功的 agent call 和 Stock swarm 失败的 agent call 的命令行差异。

- **尾盘数据本身有决策价值，即使 agent 没评审。** 创业板 -4.37%、上证 -1%、恒生基本平盘、阿里 HK +2.51% 而腾讯 -3.88%——分化极度明显。阿里已是连续第二日强于大盘。如果明天继续这个 pattern，存在做多阿里/做空指数的对冲机会。**触发条件：** 明天阿里开盘再涨 >1% 且恒生没有跟随补跌。

## What changed

-

## Decisions needed


- **明天 12:00 前：exit 141 是修还是降级。** 选项 A：今晚 debug 修好（改 timeout/参数/二进制路径），明天评审恢复正常。选项 B：如果 A 成本 >2h，把 swarm 评审临时改为 Hermes 直接调用（不走 `openclaw agent` CLI），牺牲并行但保证产出。取舍：B 方案会丢并行评审的对抗视角（牛/熊分析师分别调用），但至少不会裸奔。

- **ta 链路优先级排序。** `trader-video-daily` > `ta-deep-brief` > `ta-premarket/postmarket`。因为视频分析覆盖范围最广（全量而不是两支），修好一个等于修好最宽的信号入口。选项：先集中 30 分钟修 video daily。

---

**自检重写：**

最像模板的一句是"蜂群评审链路实际已处于不可用状态"——改成：

> **今天 A 股创业板 -4.37% 的交易日，finance-bull/bear/portfolio 三个 agent 全部 exit 141，swarm 没有产出任何一句调仓建议，主上连收盘该不该动阿里仓位都不知道。**


---
_自动智能填充 @ 21:35 · source: 2026-07-11_21-30-47.md_

