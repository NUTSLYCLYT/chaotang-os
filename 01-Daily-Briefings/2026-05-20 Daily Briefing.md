首先，我需要理解用户的需求。用户是明朔，一个AI开发者/蜂群指挥家，有RTX 5090 32GB硬件。他的偏好是零成本本地方案，关注AI Agent、量化交易、内容生产，不看模板化官话，要行动建议。关注领域优先：AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化。最近复盘显示他昨天（2026-05-18）评分8/10，没有评语；之前（2026-04-06）评分9/10，提到修了637次崩溃还建了进化系统。

任务是：从154条原始信息中提炼今日晨报。要求：去重、过滤低质量/广告、按用户关注领域优先排序、每条1句话精炼（20-40字）、保留原始URL、避开最近复盘已讨论内容。

输出格式必须严格按5主题结构：
1. 🌅 明朔晨报 · 2026-05-20
2. 🌐 国际形势（3-5条）
3. 📈 股票投资（3-5条A股/美股）
4. ⚕️ 医疗科技（3-4条）
5. 🤖 AI前沿 + GitHub（分突破和工具应用）
6. ⚡ 新能源上下游（3-4条）
7. 🎯 今日3个行动建议（具体可执行，每条1句，有so what）

关键点：避免重复昨天内容（2026-05-18）。昨天他复盘时没提具体事件，但根据上下文，可能昨天有AI或量化相关事件。不过，用户说"最近复盘 (避免重复昨天的内容)"，所以我要检查原始信息中是否有2026-05-18的事件。从原始信息看，日期是2026-05-19和2026-05-20的，但用户复盘是2026-05-18，所以可能昨天没讨论具体事件。我会确保不重复。

步骤：
1. **去重和过滤**：原始信息有154条，我需要先去重（同一新闻多次出现的合并）。例如，条目136和132都是GitHub repo，可能重复。过滤广告/营销/低质量：比如一些是纯营销内容、重复的、低信息量的。

2. **个性化排序**：按用户关注领域优先：
   - AI Agent 框架
   - LLM 本地部署
   - 量化投资
   - 独立开发 SaaS
   - GPU 优化
   所以，输出时要优先这些主题。例如，在国际形势中，选与AI、量化相关的；股票投资中选量化相关；医疗科技中选AI应用；AI前沿是核心；新能源可能关联GPU优化。

3. **每条精炼**：20-40字，一句话。保留原始URL。

4. **避开昨天内容**：用户复盘2026-05-18，但原始信息中没有明确2026-05-18的事件（日期是2026-05-19和2026-05-20），所以可能安全。我会检查是否有事件在昨天讨论过，但用户说"最近复盘"是2026-05-18，没提具体事件，所以暂时不担心。

5. **输出结构**：严格按格式。先写标题，然后各部分。

先快速扫描原始信息，识别关键点：

- **国际形势**：条目1-36（36条）。选3-5条重要事件。用户关注AI/量化，所以选与AI、全球科技相关的。例如：
  - 条目10: Putin meets Xi (AI/地缘政治)
  - 条目18: Trump threatens attack on Iran (影响全球市场)
  - 条目25: Pentagon contract for counter-drone tech (AI/军事)
  - 条目12: US authorities say missionary contracted Ebola (健康，但可能不直接相关)
  - 条目19: As Ukraine Strikes Russian Oil Sites... (能源，可能关联量化)
  但用户偏好量化投资，所以选影响市场的事件。

- **股票投资**：条目37-52（16条）。选3-5条A股/美股。用户关注量化，所以选有量化信号的。例如：
  - 条目44: Asian Stock Losses Extend (影响量化)
  - 条目46: India measures to stem hit from oil shock (能源，量化相关)
  - 条目47: EU expedites US trade deal (地缘政治影响市场)
  - 条目48: Anthropic's hire led AI at Tesla (AI，量化机会)
  - 条目51: Are businesses passing on higher energy costs? (量化相关)

- **医疗科技**：条目53-76（24条）。选3-4条突破。用户关注AI，所以选AI医疗。例如：
  - 条目57: How AI helped treat newborn's rare disease (直接AI应用)
  - 条目61: Colossal Biosciences growing chickens in 3D-printed eggshell (生物技术，但AI相关？)
  - 条目66: Zero-shot de novo peptide sequencing (AI生物)
  - 条目70: Biotech news (可能太泛)

- **AI前沿 + GitHub**：条目82-154（73条）。这是重点！用户是AI开发者，所以优先。分两部分：
  - **突破**：AI模型、技术进展。例如：
    - 条目82: Elon Musk lost suit against OpenAI (AI法律)
    - 条目85: Musk v. Altman week 3 (AI)
    - 条目86: Chinese short dramas became AI content machines (AI生成内容)
    - 条目95: Forge - Guardrails for LLM tool-calling (AI Agent)
    - 条目97: JiuwenSwarm (AI Agent)
  - **工具/GitHub高星**：GitHub repo。例如：
    - 条目131: tinyhumansai/openhuman (个人AI)
    - 条目139: CloakBrowser (stealth browser)
    - 条目142: humanlayer/12-factor-agents (AI agent principles)
    - 条目144: medusajs/medusa (e-commerce, but AI? not directly)

- **新能源**：条目126-130（5条）。用户关注GPU优化，所以选与AI训练相关的。例如：
  - 条目126: Pakistan's PV capacity (太阳能)
  - 条目128: Carbon scraps solar gigafactory (太阳能)
  - 条目129: Rain impact on PV coating (太阳能)
  - 条目130: Banning China for PV systems (地缘政治)

现在，去重和过滤：
- 去重：例如，条目132和136都是Imbad0202/academic-research-skills，合并为一条。
- 过滤：广告/营销：条目107,108,109等是营销内容，可能过滤；低质量：如条目100,101是中文，但用户偏好中文，不过要精炼；条目149是GitHub，保留。

用户偏好零成本本地方案，所以优先本地部署、开源工具。

**个性化排序**：按用户关注领域：
1. AI Agent 框架：优先
2. LLM 本地部署：优先
3. 量化投资：优先
4. 独立开发 SaaS：可能
5. GPU 优化：可能

在输出中：
- 国际形势：选3条，影响量化/AI
- 股票投资：选3条，量化相关
- 医疗科技：选2条，AI医疗
- AI前沿：突破和工具应用各2-4条
- 新能源：选2条，关联GPU优化

**行动建议**：3条具体可执行，有so what。例如：
1. 用Forge工具优化本地AI agent（so what: 提升LLM工具调用可靠性）
2. 监控亚洲股市波动（so what: 量化策略捕捉机会）
3. 测试Colossal Biosciences的3D打印鸡技术（so what: 本地化生物计算实验）

确保每条20-40字。

开始提炼：

### 1. 国际形势 (3-5条)
- 选：条目10 (Putin meets Xi), 条目18 (Trump threatens Iran), 条目25 (Pentagon counter-drone contract), 条目19 (Ukraine strikes oil sites)
- 精炼：
  - 条目10: "普京访华强化中俄能源合作，可能影响全球供应链稳定" [来源] -> 但用户关注量化，所以强调市场影响
  - 条目18: "特朗普威胁对伊朗发动袭击，引发中东地缘政治紧张，影响油价和全球风险偏好" [来源]
  - 条目25: "美国国防部500万合同采购反无人机技术，加速AI军事应用" [来源]
  - 条目19: "乌克兰袭击俄罗斯石油设施，导致能源价格波动，量化交易需关注油价波动" [来源]
  - 但用户偏好零成本，所以选本地化影响。

  优化：选3条，每条20-40字。

### 2. 股票投资 (3-5条)
- 选：条目44 (Asian stocks down), 条目46 (India oil shock), 条目47 (EU-US trade deal), 条目48 (Anthropic hire)
- 精炼：
  - 条目44: "亚洲股市连续四日下跌，通胀担忧推高债券收益率，量化策略需调整" [来源]
  - 条目46: "印度应对油价冲击，卢比贬值，量化交易可捕捉新兴市场波动" [来源]
  - 条目47: "欧盟加速美贸易协议，可能利好科技股，量化需监控关税变化" [来源]
  - 条目48: "Anthropic招募特斯拉AI前高管，AI技术进展或推动量化模型优化" [来源]

### 3. 医疗科技 (3-4条)
- 选：条目57 (AI treat newborn), 条目61 (3D-printed chickens), 条目66 (peptide sequencing), 条目70 (biotech news)
- 精炼：
  - 条目57: "AI帮助治疗罕见新生儿疾病，实现快速诊断，本地化部署潜力大" [来源]
  - 条目66: "零样本肽序列预测模型，加速药物研发，开源可降低研发成本" [来源]

### 4. AI前沿 + GitHub
- **突破** (2-4条):
  - 条目82: "Elon Musk败诉OpenAI诉讼，AI监管框架趋紧" [来源]
  - 条目95: "Forge开源工具提升本地LLM工具调用可靠性，减少崩溃" [来源] (用户有RTX 5090，本地部署)
  - 条目97: "JiuwenSwarm开源AI蜂群框架，支持多Agent协调" [来源]
  - 条目86: "中国短剧AI生成内容爆发，影响媒体行业" [来源] (但可能不直接相关)
  - 选2条：Forge和JiuwenSwarm (用户关注AI Agent)

- **工具/GitHub高星** (2-4条):
  - 条目131: "OpenHuman个人AI超级智能，私有化部署，零成本" [来源]
  - 条目142: "12-factor agents开源框架，提升AI应用生产性" [来源]
  - 条目144: "Medusa开源电商平台，支持AI集成" [来源] (但用户可能不直接相关)
  - 选2条：OpenHuman和12-factor agents

### 5. 新能源上下游 (3-4条)
- 选：条目126 (Pakistan PV), 条目128 (Carbon scraps), 条目129 (rain impact), 条目130 (banning China)
- 精炼：
  - 条目126: "巴基斯坦太阳能装机容量达51GW，推动分布式能源增长" [来源]
  - 条目128: "Carbon放弃法国光伏工厂，影响全球太阳能供应链" [来源]
  - 条目129: "雨水影响光伏涂层寿命，需优化本地化维护" [来源] (关联GPU优化？可能不直接)

用户关注GPU优化，所以选与AI训练相关的。但新能源中，可能条目126关联可再生能源，影响AI数据中心。

**行动建议** (3条):
1. 用Forge工具优化本地AI agent，提升工具调用可靠性（so what: 减少崩溃，提升量化交易效率）
2. 监控亚洲股市波动，捕捉短期机会（so what: 量化策略应对通胀压力

## 📈 趋势对比 (vs 昨日)

### 🔼 热度上升
- **AI** 61 次 (+3)
- **GitHub** 20 次 (+13)
- **Agent** 17 次 (+8)
- **OpenAI** 7 次 (+4)
- **Claude** 6 次 (+5)

### 🔽 热度下降
- 融资 3 次 (-1)


## 💰 今日市场
- 📉 BNB: $640 (-0.75%)
- 📉 BTC: $76,756 (-0.25%)
- 📉 ETH: $2,112 (-0.87%)
- 📉 SOL: $84 (-1.31%)
