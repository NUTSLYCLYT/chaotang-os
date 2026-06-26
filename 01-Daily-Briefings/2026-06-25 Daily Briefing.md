# 2026-06-25 Daily Briefing

Source: CourtOS

## Three things that matter


1. **蜂群 agent 大面积静默 — exit 141 故障覆盖全部 3 个金融 swarm + HF Papers + Evolution。** pre-market（09:15）、close-alert（14:55）、daily-lesson（23:45）三批次共 8 个 agent 全部 exit 141；HF Papers 的 trend-researcher + ai-engineer 同病。这是系统性故障，不是偶发。结果：今日无盘前信号、无尾盘调仓建议、无 paper 精选、无 lesson 沉淀。意味着用户今天的交易决策和信息摄入全部裸奔。

2. **morning-brief cron exit=1 — Daily Briefing 文件完全空白。** `01-Daily-Briefings/2026-06-25 Daily Briefing.md` 只有占位符，4 个段落全是空的。晨报管线断了。同时 vault-index 虽 exit=0 但 embed 全部 404（embedding 服务不可用），_wiki 里 144 个 concept + 133 个 entity 全部是 stub 状态，知识图谱持续腐烂。

3. **Nasdaq -2.64%，S&P -1.53%，但中国 A 股逆势走强（创业板 +2.62%）。** 隔夜美股科技股大跌，但中国这边 A 股和港股显示出明显韧性。恒生 refer 到 23000 附近。如果这是中美资本脱钩加速的信号，需要重新评估持仓结构。另外 仙工智能（06106.HK）6/24 港股 18C 章上市，发行价 101.60 港元，首日 +13.5%，锦衣卫核查确认 A 级可信 — 这条信号在今天 NASDAQ 大跌背景下值得注意：机器人赛道港股 IPO 窗口可能在打开。

---

## Risks


- **exit 141 根因不明，明日 swarm 大概率继续失败。** 从 09:15 到 23:45 跨越 14 小时，exit 141 持续复现。影响面：股票交易信号、HF paper 精选、每日复盘全部中断。缓解动作：今晚跑 `openclaw run stock-pre-market --verbose 2>&1 | tee /tmp/swarm-debug.log`，抓 stderr 全文；检查 `openclaw` 二进制路径是否在 cron PATH 里（Evolution 那次的报错是 "No such file or directory: 'openclaw'" — 可能和 exit 141 是同源问题）。

- **vault-index 的 embedding 服务 404 — _wiki 知识图谱在加速退化。** 144 个 concept stub + 133 个 entity stub，audit cron 只统计不修复。影响面：brain-ask 查询质量下降，过往情报检索失效。缓解动作：明天 08:00 前定位 embed 端点（大概率是本地 Ollama/LiteLLM 的某个 endpoint 挂了），重启或切 fallback。

- **ta-deep-brief exit=1，仅产出 284 字节。** 对三花智控和特变电工的多 agent 深度分析失败。如果用户持有这两只票，今天没有技术面深度信号。缓解：手动跑 `openclaw run ta-deep-brief` 或直接调 Claude 补一份。

---

## Opportunities


- **仙工智能 IPO 可能是机器人赛道信号。** 触发条件：接下来 2 周内第 2 家机器人公司递交港股 18C 申请则确认窗口打开。可验证动作：设一个 Google Alert "港股 18C 机器人 IPO"，5 分钟搞定。如果窗口确认，可提前研究 A 股/港股机器人供应链标的（伺服电机、减速器、SLAM 方案商）。

- **中美科技股走势分化如果持续，存在配对交易机会。** 触发条件：连续 3 个交易日 Nasdaq 跌而创业板涨，且 VIX > 20。可验证动作：明天盘前看 VIX 是否突破 20 + A 股是否延续强势，如果满足条件，考虑做多中概科技/做空纳指 ETF 的对冲头寸（5 分钟内可以下一个试探单）。

---

## What changed

-

## Decisions needed


- **明天 12:00 前：是否降级/停用 swarm 金融 agent 直到 exit 141 修复。** 选项 A：继续让 cron 跑（零成本但不产生有效信号，浪费 token 配额）。选项 B：暂停 stock-pre-market / stock-close-alert / ta-deep-brief 三个 cron，手动补今日信号后等修复。取舍：B 省配额但丢失自动化节奏。建议 B，并设一个 48 小时未修复则升级为手动交易辅助模式的 fallback。

- **明天 12:00 前：_wiki stub 堆积问题要不要批量修复。** 277 个 stub（144 concept + 133 entity），手动修不现实。选项 A：修 embedding 端点后让 vault-index 自然回填（慢但零人工）。选项 B：写一个脚本用 Claude 批量合成 stub 定义（快但烧 token）。取舍：A 优先（修端点），如果端点修不好再启动 B。

---


---
_自动智能填充 @ 21:35 · source: 2026-06-25_21-31-08.md_

