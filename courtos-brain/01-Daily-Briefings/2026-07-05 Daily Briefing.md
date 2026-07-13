# 2026-07-05 Daily Briefing

Source: CourtOS

## Three things that matter


1. **蜂群评审管道今日全灭** — 5组评审（weekly-retro / close-alert / pre-market / hf-papers / daily-lesson）共14个agent调用，14个失败。错误分两类：12个 `exit 141`（SIGPIPE，评审agent收到空stdin或被管道断连）、2个 `openclaw: command not found`（daily-lesson）。CourtOS 盘前和尾盘数据抓取本身成功（隔夜美股 S&P -0.21%, Dow +1.11%, Nasdaq -1.45%），但没有一个评审结论送达你。策略输出中断一整天。

2. **ta-postmarket 独活，A股数据实测可用** — 唯一完整的策略输出是 ta-postmarket（7085 B，A股收盘数据、持仓盈亏、估值分位、行业轮动均取到）。三花智控今日 +9.06%（+¥407），但风险仪表盘显示 MDD=-100%（peak 5/25→trough 6/9）、VaR=67.5%——组合风险暴露极大。close-alert 的 pre-script 走 Yahoo Finance 被全面 403 封禁，但 ta-postmarket 用了另一数据源成功获取上证 4043.64。修复方向明确：把 close-alert 的数据源从 Yahoo 切到 ta-postmarket 同款。

3. **晨报+evolve评分双双卡住** — `morning-brief` cron exit=1，Daily Briefing 的 Three things/Risks/Opportunities 全部空。evolve 显示评分暂停自今早8:00，"提问质量 30/100、记忆深度 10/100"且最后复盘停留在 **2026-05-18**（距今 48 天）。morning-brief 的 exit=1 无 stderr，大概率是评审 agent 同样 exit 141 导致输出为空后脚本报非零退出。

---

## Risks


- **蜂群评审静默已超 12 小时**：如果你依赖 weekly-retro 做周日复盘，或依赖 pre-market/close-alert 做下周一开盘决策，目前你什么也没收到。根因很可能是 cron 环境 PATH 不含 `/home/ubuntu/bin`（已验证 `openclaw` 在 `/home/ubuntu/bin` 但 cron 用裸命令 `openclaw`），或最近 backend-upgrade-watch（今早8:38有 legacy state migration warning）导致 agent 调用协议变更。今晚要做：在一条 cron 脚本里加 `export PATH="/home/ubuntu/bin:$PATH"` 后手动跑一次评审验证。

- **A股/港股数据 Yahoo Finance 通道全面毙掉**：403 不会自愈，下周一（7月7日）开盘前如果 stock cron 还没切换数据源，盘前/尾盘 agent 继续空转。ta-postmarket 已证明备用路径可行——close-alert cron 脚本需要改数据抓取逻辑。

- **MDD=-100% 且 VaR=67.5%**：组合净值曾从峰值跌到几乎归零（peak 5/25→trough 6/9）。虽然 ta-postmarket 标记 Calmar=73209（看起来像计算bug）但 MDD 数据点暴露真实历史风险。三花智控+9.06%单日大涨后别误判安全——PB 3年90%分位、市场情绪100/100过热。

---

## Opportunities


- **修复蜂群评审是一次性投入**：如果所有 agent 都因 `openclaw` 找不到路径而失败（daily-lesson 明确报 `No such file or directory`），只需在 cron 脚本加绝对路径或 PATH 即可恢复 5 条评审线。今晚花 15 分钟：`export PATH="/home/ubuntu/bin:$PATH" && openclaw agent --agent trend-researcher` 跑一条测试。

- **ta-postmarket 的数据源可以作为 stock 管道的应急替代**：ta-postmarket 今日完整拿到了上证/深成/创业板收盘价、行业轮动、个股公告、北向资金。如果今晚确认 Yahoo 403 无法绕过，直接让 close-alert 和 pre-market 的 pre-script 改用 ta-postmarket 同数据源——抄它的脚本即可。

- **三花智控 7月1日公告密集（股权激励行权+限售解禁）**：这是 +9.06% 的可能催化剂。ta-deep-brief 今日 exit=1（超时），如果修好 openclaw 路径后重跑深度分析，可以判断这是短期脉冲还是趋势启动。

---

## What changed

-

## Decisions needed


- **7月6日12:00前拍板：stock cron 是暂停还是改美股-only**。选项 A：暂停 `stock-pre-market` 和 `stock-close-alert`，下周一只用 ta-postmarket 信号，避免产出假的空结论。选项 B：只保留美股部分（隔夜美股数据正常），屏蔽 A/H 股输出并标注"数据源不可用"。取舍点：暂停更干净但缺信号，美股-only 给你部分信息但有偏。

- **evolve 评分中断超过 48 天，是否需要重置评分逻辑**。选项 A：手动评分一条后让系统恢复（当前卡在"等待评分"状态）。选项 B：跳过评分环节，直接改 evolve cron 让它不依赖评分阻塞晨报。取舍点：A 保留进化机制但需要你介入，B 去阻塞但放弃反馈闭环。

---


---
_自动智能填充 @ 21:35 · source: 2026-07-05_21-31-42.md_

