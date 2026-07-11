# 2026-07-10 Daily Briefing

Source: CourtOS

## Three things that matter


1. **蜂群评审全线崩塌（exit 141）**：今日 stock pre-market、close-alert、evolution 三组共 9 个评审 agent 全部 exit 141 失败，根因同一：`openclaw` 二进制找不到（昨日 evolution cron 明确报 `No such file or directory: 'openclaw'`）。这不是个别 cron 问题，是整个蜂群调度层的执行路径断裂。直接影响：今日无盘前决策、无尾盘调仓信号、无 daily lesson 产出。MOC 显示「晨报暂停，等待评分」——系统在等一个永远不会来的评分。

2. **Wiki 知识库空心化**：503 个 concepts 全部为 stub（待合成），383 个 entities 中 379 个为 stub。207 个 source 有数据摄入但 LLM 合成从未执行。每天 ingest 照跑、audit 照跑、但概念永远停在"待 audit cron 合成"。这已不是 bug——是 audit cron 的设计假设（LLM 会合成熟）与实际执行脱节。

3. **morning-brief 空壳**：晨报 cron 跑完了（exit 0），Agent 分析了 173 条原始信息并生成了分类框架，但最终 Daily Briefing 的 Three things / Risks / Opportunities / Decisions 全部为空——没有任何结论写入。可能是输出截断、格式解析失败、或 Agent 在"计划写什么"阶段耗尽 token 后直接退出。

## Risks


- **调度链断裂蔓延风险**：`openclaw` 路径问题如果影响所有 swarm-review 类型的 cron，明天 stock pre-market / HF papers / evolution 继续空转。缓解：今晚手动验证 `which openclaw` 在 cron 环境中的实际路径，对比 `swarm-architecture` skill 中的调用方式是否硬编码了错误路径。
- **Wiki 知识退化**：207 个 source 的摘要已摄入，但 503 个 stub concept 没有一句话定义。用户通过 super-brain 查询时，返回的全是"待合成"空壳——等于花了 ingestion 成本但零检索收益。缓解：手动触发一次 LLM 合成 pipeline 覆盖最常引用的 top 5 concepts（feng-qun, swarm-review, evolve-status, agent-call-failure, courtos）。
- **ta-deep-brief 产出崩溃**：对三花智控和特变电工的深度分析仅产出 284 字节（exit 1），明显是中途失败。如果用户依赖这份分析做持仓决策，今天没有有效信号。

## Opportunities


- **exit 141 修复 = 一次性恢复 4+ 条 cron**：修复 `openclaw` 路径问题可同时恢复 stock pre-market、stock close-alert、evolution daily lesson、HF papers 评审——这些 cron 的 exit code 都是 0（壳脚本跑通），只是调度的子 agent 调用失败。触发条件：`openclaw` 在 cron 的 `$PATH` 中不可达。5 分钟动作：`sudo find / -name openclaw -type f 2>/dev/null` 确认实际位置，然后在 swarm-review 的 cron 脚本中添加 `export PATH` 或在调用处用绝对路径。
- **股市结构性分化可操作**：今日 A 股创业板 -3.63% vs 隔夜美股 Nasdaq +1.50%，中概 ADR 阿里 +13.25%。A 股小盘承压但中概 ADR 强势，差价是跨市场套利信号。验证：对比 ADR 溢价率和 A 股对应标的收盘价，若折价 >5% 可考虑 AH/ADR 价差策略。

## What changed

-

## Decisions needed


- **明天 12:00 前：swarm-review 修复方案二选一**。选项 A：修复 `openclaw` PATH，让现有 cron 跑通（风险低，只修一处）。选项 B：绕过 `openclaw` CLI，直接用 Hermes API 调 agent（彻底但改动大）。取舍：A 快但不解决根本架构耦合，B 稳但需要 2-3 小时改 `swarm-architecture` skill 和所有 cron 脚本。建议 A 先止血，B 列下周。

- **明天 12:00 前：wiki synthesis pipeline 是否激活**。503 个 stub 不会自愈。选项：手动合成 top 5 concepts vs 写一个 cron 每日自动合成新增的 stub。取舍：手动快（今晚 15 分钟搞定 5 个高价值概念），自动慢但可持续。

---

**自我批评修正**：原草稿写的是「建议加强系统健康监控」，典型的模板空话。修正为：*今晚 `grep "exit 141" /home/ubuntu/.openclaw/logs/*.log | wc -l` 确认受影响 cron 总数，若 ≥5 个 cron 受影响，在 22:00 前修复 PATH 并手动触发一次 stock-close-alert 回测验证路径已通。*


---
_自动智能填充 @ 21:35 · source: 2026-07-10_21-30-55.md_


### Session log 23:26 — chaotang-os
  - [no transcript summary]
