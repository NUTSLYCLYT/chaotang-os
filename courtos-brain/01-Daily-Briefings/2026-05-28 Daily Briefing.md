首先，我需要仔细分析用户提供的所有信息，然后按照要求的格式输出明朔晨报。用户是明朔，一个AI开发者/蜂群指挥家，有RTX 5090 32GB硬件，偏好零成本本地方案，关注AI Agent、量化交易、内容生产等。我必须严格遵守偏好：不看模板化官话，要行动建议不要罗列。

先梳理原始信息（103条），按主题分类：
- [股票投资]：1-5条
- [医疗科技]：6-39条
- [AI前沿]：40-53条（注意：46-53是中文内容）
- [新能源]：71-75条
- [开源]：76-95条（注意：84-89是重复的GitHub条目）
- [市场行情]：96-103条（这些是实时行情数据）

用户要求：
1. 去重：同一新闻多次出现的合并（例如GitHub条目有重复）
2. 过滤：删除广告/营销/低质量内容
3. 个性化排序：按"用户关注领域"优先（AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化）
4. 每条1句话精炼（20-40字）
5. 保留原始URL
6. 避开最近复盘已讨论内容（2026-05-18和2026-04-06的复盘）

用户最近复盘：
- 2026-05-18：评分8/10，无评语（昨天）
- 2026-04-06：评分9/10，评语"修了637次崩溃还建了进化系统,很硬核"（4月6日）

所以，避免重复昨天（5月18日）的内容。从原始信息看，5月18日没有具体事件，但复盘是5月18日的，所以要确保不包含5月18日已讨论的。

现在，按用户关注领域优先排序：
1. AI Agent 框架
2. LLM 本地部署
3. 量化投资
4. 独立开发 SaaS
5. GPU 优化

我需要从103条中提取相关条目，去重、过滤后，按主题分组输出。

**步骤1: 去重和过滤**
- 检查重复：例如GitHub条目76-89有重复（如Lum1104/Understand-Anything出现两次），合并为一条。
- 过滤低质量：广告、营销内容（如"8点1氪"、"36氪首发"等可能有广告味）、不相关条目。
- 保留原始URL：每条必须有URL。

**步骤2: 个性化排序**
- 优先AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化。
- 例如：
  - AI Agent框架：从[AI前沿]中找（40-53条）
  - LLM本地部署：可能涉及开源工具（如GitHub）
  - 量化投资：股票投资部分（1-5条）
  - 独立开发SaaS：开源工具（如GitHub）
  - GPU优化：可能在AI前沿或开源中

**步骤3: 按输出格式组织**
输出必须严格按5个主题：
1. 🌅 明朔晨报 · 2026-05-28
2. 🌐 国际形势
3. 📈 股票投资
4. ⚕️ 医疗科技
5. 🤖 AI 前沿 + GitHub
6. ⚡ 新能源上下游
7. 🎯 今日 3 个行动建议

**关键：避免重复昨天内容**
- 2026-05-18复盘：无具体事件，但用户说"最近复盘"，所以确保不包含5月18日相关。从原始信息看，5月18日没有事件，但复盘是5月18日的，所以可能安全。但用户指定"避开最近复盘里已讨论过的内容"，所以检查：5月18日复盘无事件，所以不需过滤。

**开始提取内容**

先处理每个主题：

### 🌐 国际形势
- 从原始信息中找国际事件：可能包括新闻、市场动态。
- 例如：条目11（Trump says latest medical exam went 'PERFECTLY'）但这是医疗；条目14（The Enhanced Games）是科技；条目16（The world is on track to miss its health targets）是健康。
- 优先国际事件：可能从[AI前沿]、[医疗科技]中找。
- 用户关注：AI Agent、量化等，所以国际形势应聚焦全球科技/经济影响。
- 选3-5条：例如：
  - 条目14：The Enhanced Games fit right in with the rest of 2026’s longevity vibes（但这是2026年事件）
  - 条目16：The world is on track to miss its health targets（WHO报告）
  - 条目38：#ASCO26: Cancer immunotherapy's magic bullet era is fading（但这是医疗）
  - 条目40：Rethinking organizational design in the age of agentic AI（AI相关）
- 但用户偏好：避免官话，要行动建议。所以选有实际影响的。
- 选3条：例如：
  1. 条目40：AI组织设计变化（影响企业）
  2. 条目41：AI工作市场恐慌（量化投资相关）
  3. 条目42：AI对入门工作的影响（行动点）

### 📈 股票投资
- 从[股票投资]部分：1-5条
- 1. Snowflake stock soars (AI acceleration)
- 2. 个人财务故事（不相关）
- 3. Momentus stock triples (space company)
- 4. Micron investors partying (cheap stock)
- 5. Zscaler stock drops (disappointing outlook)
- 选3-5条：优先AI相关（Snowflake, Momentus）和量化机会（Micron）。
- 价值判断：alpha机会、风险信号等。

### ⚕️ 医疗科技
- 从[医疗科技]部分：6-39条
- 选3-4条突破/试验：例如
  - 条目6：Heart patch from stem cells (clinical trial)
  - 条目15：Colossal Biosciences growing chickens in 3D-printed shell (biotech)
  - 条目17：Drug manufacturing in orbit (space)
  - 条目24：Scoring gene importance with AI (biotech)
- 临床/商业含义：离落地多远、影响谁。

### 🤖 AI 前沿 + GitHub
- 突破：AI Agent框架、LLM本地部署相关
  - 从[AI前沿]：40-53条
    - 40. Rethinking organizational design in the age of agentic AI
    - 41. AI jobs hysteria
    - 42. Entry-level work crisis
    - 43. Google I/O AI science shift
    - 44. Can AI learn to understand the world?
    - 45. Scaling creativity in AI
    - 46-53: 中文内容（可能AI相关）
  - GitHub高星：76-95条
    - 76. GitHub: Lum1104/Understand-Anything (knowledge graph)
    - 77. affaan-m/ECC (agent harness)
    - 78. rohitg00/ai-engineering-from-scratch (AI engineering)
    - 84. (重复)
    - 85. microsoft/agent-governance-toolkit (agent governance)
    - 86. (重复)
    - 87. twentyhq/twenty (open-source CRM)
    - 88. OpenStock (open-source market)
    - 89. thedotmack/claude-mem (persistent context)
    - 90. NangoHQ/nango (product integrations)
    - 91. openai/codex (coding agent)
    - 92. GraphiteEditor/Graphite (2D content)
    - 93. farion1231/cc-switch (multi-agent switch)
    - 94. iii-hq/iii (service composition)
    - 95. Hmbown/CodeWhale (DeepSeek v4 coding agent)
- 按"突破"和"工具应用"分：
  - 突破：2-4条（AI Agent框架、LLM本地部署）
  - 工具/GitHub高星：2-4条（star增长、解决什么问题）

### ⚡ 新能源上下游
- 从[新能源]部分：71-75条
  - 71. Paraguay solar tender
  - 72. Malaysia home solar rebate
  - 73. Colombia solar auction
  - 74. Australian solar tender
  - 75. Pexapark solar PPAs
- 按上游/中游/下游分布：例如
  - 上游：材料（如太阳能板）
  - 中游：组件（如电池）
  - 下游：应用（如电网）
- 选3-4条：71-75条都相关。

### 🎯 今日 3 个行动建议
- 基于以上5主题，给3条具体行动建议（每条1句，有"so what"）
- 例如：针对AI Agent框架，建议本地部署一个工具；针对量化投资，建议检查Snowflake股票；针对医疗科技，建议看stem cell patch进展。

**详细提取每条**

先去重和过滤：
- GitHub条目：76-95有重复（如Lum1104/Understand-Anything出现两次），合并为一条。
- 低质量：条目2（个人财务故事）、条目12（政治）、条目13（医疗）、条目29-39（医疗）可能有广告味，过滤掉。
- 量化投资：条目1-5是股票，保留。
- AI前沿：条目46-53是中文，但用户是中文，保留（但需过滤广告）。

**用户偏好：零成本本地方案**，所以优先本地部署、开源工具。

**输出结构：**

# 🌅 明朔晨报 · 2026-05-28

## 🌐 国际形势
- 选3条：例如
  1. 条目40: Rethinking organizational design in the age of agentic AI
  2. 条目41: AI jobs hysteria
  3. 条目42: Entry-level work crisis

## 📈 股票投资
- 选3条：1,3,4 (Snowflake, Momentus, Micron)

## ⚕️ 医疗科技
- 选3条：6,15,24 (heart patch, chicken growth, gene scoring)

## 🤖 AI 前端 + GitHub
### 突破
- 2条：例如
  - 条目43: Google I/O showed AI science shift
  - 条目44: Can AI learn to understand the world?
- 但用户关注AI Agent框架，所以选Agent相关：条目40,44,45

### 工具 / GitHub 高星
- 2-4条：例如
  - 78. rohitg00/ai-engineering-from-scratch (star 84%)
  - 85. microsoft/agent-governance-toolkit
  - 89. thedotmack/claude-mem
  - 95. Hmbown/CodeWhale

## ⚡ 新能源上下游
- 3条：71,72,73 (Paraguay, Malaysia, Colombia solar)

## 🎯 今日 3 个行动建议
1. 用CodeWhale本地部署DeepSeek v4进行量化回测，so what: 优化GPU资源利用率
2. 检查Snowflake的AI加速对量化策略的影响，so what: 识别alpha机会
3. 用Claude-Mem实现多会话持久化，so what: 提升Agent在本地部署的稳定性

**确保每条20-40字：**
- 例如：Snowflake stock soars 30% due to AI revenue growth (20-40字)

**严格保留URL：** 每条必须有原始URL。

**避开昨天内容：** 5月18日复盘无事件，所以安全。

**开始写：**

先做去重：
- GitHub: 76,86 同一repo (Lum1104/Understand-Anything) → 合并
- 78,81 同一repo (rohitg00/ai-engineering-from-scratch) → 合并
- 79,82 同一repo (anthropics

## 📈 趋势对比 (vs 昨日)

### 🔼 热度上升
- **Agent** 17 次 (+4)
- **Claude** 10 次 (+1)
- **Meta** 2 次 (+1)
- **芯片** 1 次 (+1)
- **上市** 1 次 (+1)

### 🔽 热度下降
- LLM 3 次 (-1)
- Rust 2 次 (-2)
- GPT 2 次 (-1)


## 💰 今日市场
- 📉 上证指数: 4093.73 (-1.09%)
- 📉 深证成指: 15736.47 (-0.83%)
- 📉 创业板指: 4045.77 (-0.19%)
- 📉 沪深300: 4908.17 (-0.66%)
- 📉 BNB: $648 (-1.29%)
- 📉 BTC: $74,436 (-1.85%)
- 📉 ETH: $2,022 (-2.49%)
- 📉 SOL: $82 (-1.50%)
