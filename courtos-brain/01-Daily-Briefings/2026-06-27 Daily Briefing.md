# 2026-06-27 Daily Briefing

Source: CourtOS

## Three things that matter


1. **蜂群全部评审 agent 集体 SIGPIPE 退出（exit 141）** — 今日盘前、尾盘、HF Papers 三组评审共 8 个 agent 全部返回 exit 141。盘前数据已生成（上证 -2.26%、创业板 -4.07%），但零个 agent 成功输出分析。这意味着从 10:30 起，你的股票决策流水线已实质瘫痪。根因大概率是 openclaw CLI 路径或 subprocess pipe 配置问题——昨日 evolution 评审也报 `No such file or directory: 'openclaw'`。

2. **A 股单日暴跌，创业板 -4.07%** — 上证 4027（-2.26%）、深成 15782（-3.44%）、创业板 4194（-4.07%）、恒生也被拖下水。隔夜美股 S&P 仅 -0.06%，说明今天是 A 股独立杀跌。ta-postmarket 简报已写出（5518 bytes），但 ta-deep-brief 只产出了 284 字节就挂了。你手里有数据、没有解读。

3. **晨报系统两处断裂** — `morning-brief` cron exit=1，虽然 stdin 里有一份超长的 raw morning brief 文本，但 `Daily Briefing.md` 模板是空的，`MOC.md` 也确认"晨报暂停，直到你评分完今天"。evolve 评分系统卡在 2026-05-18，连续打卡只有 1 天，提问质量 30/100、记忆深度 10/100——这个评分已经低到可能影响 agent 的行为校准。

## Risks


- **蜂群评审全部失效 = 无风控覆盖**：今天 A 股 -4% 的行情，本应由 finance-bull/bear/rebalancer 三人组交叉验证仓位。现在等于裸奔了一天。**今晚必须修 openclaw CLI 路径**（`which openclaw` 确认二进制位置 → 修 cron 里的绝对路径），明早 9:15 盘前数据到的时候不能再空跑。
- **_wiki 全员 stub：知识库正在腐烂** — 176 个 concepts 全部是 stub，160 个 entities 中 156 个 stub，`concept-slug-1` 这种占位符概念被反复创建。audit cron 能跑（03:00 exit=0）但 LLM 合成从未触发。这意味着你的每周复盘、agent 上下文注入都在吃空壳数据，决策质量会逐周劣化。
- **vault-index embedding 404** — embed endpoint 连续报 404，向量索引停止更新。brain-daily 和 archive-to-brain 虽然 exit=0，但索引层坏了，搜索和 RAG 都在跑旧数据。
- **mainline-mirror + trader-video-daily 双挂** — 两个 exit=1 的 cron，前者影响代码同步，后者影响盘后视频情报。今天缺了 trader 视频就等于少了一路市场情绪信号。

## Opportunities


- **明天盘前是验证修复的绝佳窗口**：如果今晚修好 openclaw 路径，明早 9:15 盘前数据 + 10:30 stock-pre-market cron 会立刻验证。9:15→10:30 有 75 分钟窗口，如果 agent 再次 exit 141，你可以在开盘前手动介入。**触发条件**：`openclaw agent` 在 cron 环境能成功调用任何一个 agent。
- **_wiki 审计数据已就绪，合成只需一次 LLM 调用** — audit-2026-06-27 已经标出了 18 个孤立 concepts、全部 stub 数量。写一个脚本跑一次批量 `openclaw agent --agent wiki-synthesizer` 就能把 176 个 concepts 从 stub 升级为有实际定义的节点。**耗时约 15-30 分钟，效果立即可验证**：concept 的 `status` 字段从 `stub` 变为 `active`。

## What changed

-

## Decisions needed


- **明早 12:00 前：是否修复 openclaw agent 管道** — 选项 A：今晚修 `which openclaw` 路径并测试一个 agent，风险低，30 分钟内可完成。选项 B：推迟到周末，代价是明天又一个交易日无风控覆盖。**取舍点**：如果本周还有仓位在 A 股，选 A 没商量；如果已空仓，可以选 B 但至少确认根因。
- **wiki 批量合成：跑还是不跑** — 176 个 stub concepts 一次性 LLM 合成，token 成本估算约 50K-100K tokens（按每 concept 300 tokens 计算）。选项 A：今晚跑，wiki 体系恢复可用。选项 B：先只修 agent 管道，wiki 推后。**取舍点**：如果你下周要做复盘或让 agent 写分析，wiki 是必选项；否则可以暂缓。
- **晨报评分死锁：给今天的 evolve 打个分** — evolve 系统卡在"等待评分"状态，晨报因此暂停。`hermes` 会话（13:58、19:17）和 `chaotang-web-lyt` 会话（多次）都有日志但无摘要。**评分动作只需 1 分钟**，但需要你手动判断今天产出质量。打完后晨报恢复，明早 08:00 能正常产出。

---

### 自我批评

**原文（模板话）**：<i>"需要加强风险管理，提升系统稳定性。"</i>

**修后**：<i>今晚 22:00 前在 cron 环境跑 `which openclaw && openclaw agent --agent finance-bull-analyst --prompt "test"`，exit code ≠ 0 则立刻修绝对路径，明早 9:15 盘前数据到的时候这条管道必须通。</i>


---
_自动智能填充 @ 21:35 · source: 2026-06-27_21-30-49.md_

