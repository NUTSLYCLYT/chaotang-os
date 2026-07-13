首先，我需要理解任务：作为明朔的私人科技媒体主编，从128条原始信息中提炼今日晨报。用户画像显示明朔是AI开发者/蜂群指挥家，偏好零成本本地方案，关注AI Agent、量化交易、内容生产等。我必须严格遵守偏好：不看模板化官话，要行动建议不要罗列。

关键点：
- 去重：合并同一新闻多次出现的
- 过滤：删除广告/营销/低质量
- 个性化排序：按用户关注领域优先（AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化）
- 每条1句话精炼总结（20-40字）
- 保留原始URL
- 避开最近复盘已讨论过的内容（2026-05-18和2026-04-06的复盘）

输出格式必须严格按5主题结构：
1. 🌅 明朔晨报 · 2026-05-30
2. 🌐 国际形势（3-5条）
3. 📈 股票投资（3-5条A股/美股）
4. ⚕️ 医疗科技（3-4条）
5. 🤖 AI前沿 + GitHub（分"突破"和"工具应用"）
6. ⚡ 新能源上下游（3-4条）
7. 🎯 今日3个行动建议（具体可执行，每条1句，有"so what"）

先梳理原始信息，去重和过滤：

**步骤1: 去重和过滤**
- 检查原始信息中重复项：例如，条目114和109都是GitHub: harry0703/MoneyPrinterTurbo，合并为一条。
- 过滤广告/营销：例如，条目109-128是GitHub项目，但有些是营销内容（如"MoneyPrinterTurbo"可能有广告嫌疑），需谨慎。用户偏好零成本本地方案，所以优先实用工具。
- 低质量：如新闻中太泛的、无实质信息的。

**步骤2: 按用户关注领域优先排序**
用户关注领域（优先）：
1. AI Agent 框架
2. LLM 本地部署
3. 量化投资
4. 独立开发 SaaS
5. GPU 优化

所以，在输出时，每个主题要优先考虑这些。

**步骤3: 为每个主题提炼内容**
- 国际形势：选3-5条，按重要度（对用户可能影响）。用户关注量化投资、AI，所以选有经济/科技影响的。
- 股票投资：选3-5条A股/美股，价值导向（alpha机会、风险信号）。
- 医疗科技：3-4条突破/试验。
- AI前沿 + GitHub：分"突破"（新模型/技术）和"工具应用"（GitHub高星项目）。
- 新能源上下游：3-4条，按产业链分布。

**步骤4: 每条精炼总结（20-40字）**
- 一句话事实陈述
- 附加：影响分析、风险/机会（对用户）

**步骤5: 避开最近复盘**
- 2026-05-18复盘：无评语，但用户说"避免重复昨天的内容"。昨天是2026-05-18，所以不选5月18日的新闻（但原始信息是5月29日的，所以可能无重叠）。
- 2026-04-06复盘：提到"修了637次崩溃还建了进化系统"，所以避免AI系统崩溃相关（但原始信息中无直接重叠）。

**步骤6: 生成行动建议**
- 3条具体可执行建议，每条1句，有"so what"（对明朔有用）。
- 基于提炼的内容。

**开始处理原始信息：**

**先去重和过滤：**

- 条目1-32：国际形势（32条）
- 条目33-48：股票投资（16条）
- 条目49-82：医疗科技（34条）
- 条目83-102：AI前沿（20条）
- 条目103-108：新能源（6条）
- 条目109-128：开源（20条）

**去重：**
- 条目109和114：都是GitHub: harry0703/MoneyPrinterTurbo → 合并
- 条目119和113：都是GitHub: twentyhq/twenty → 合并
- 条也124和128：GitHub项目，但不同

**过滤：**
- 广告/营销：例如，条目109的"MoneyPrinterTurbo"可能有营销，但用户偏好零成本，所以保留实用工具。
- 低质量：如新闻中太泛的（例如，条目1-10中的一些国际新闻，可能对用户影响小）。

**按用户关注领域筛选：**

用户关注：
- AI Agent 框架：优先
- LLM 本地部署
- 量化投资
- 独立开发 SaaS
- GPU 优化

所以，在输出时：
- 国际形势：选有量化投资或AI影响的
- 股票投资：直接选
- 医疗科技：选有AI应用的
- AI前沿：核心
- 新能源：可能有GPU优化相关

**提炼每个主题：**

**1. 国际形势 (3-5条)**
- 选重要度高的：对量化投资、AI有影响的。
- 例如：
  - 条目17: Iran War Live Updates: Trump Puts Off 'Final Determination' on Iran Proposal → 影响油价和股市
  - 条目18: Russian Drone Hits Romanian Apartment Building → 涉及地缘政治，可能影响供应链
  - 条目23: How Russia is turning Ukraine’s drones against NATO → AI相关？无人机可能有AI
  - 条目24: Nearly 500,000 Russian soldiers killed in Ukraine → 战争影响经济
  - 条目30: As Trade Talks Begin, U.S.-Mexico Ties Falter → 量化投资相关
- 但用户偏好量化投资，所以选有经济影响的。
- 优先：条目17（伊朗谈判）、条目30（美墨贸易）、条目24（俄乌战争影响经济）

**2. 股票投资 (3-5条)**
- 条目33-48：股票相关
- 选价值高的：例如
  - 条目46: Oil slides, stocks climb as Trump puts off determination on Iran proposal → 量化机会
  - 条目48: Dell’s stunning 33% stock rally → AI相关
  - 条目47: ServiceNow’s stock soars → AI fears fade
  - 条目45: Gap and American Eagle shares both get crushed → 但用户可能不关注零售
- 优先：条目46（油价影响）、条目48（Dell AI）、条目47（ServiceNow AI）

**3. 医疗科技 (3-4条)**
- 条目49-82：医疗
- 选有AI应用的：例如
  - 条目59: Colossal Biosciences is growing chickens in a 3D-printed artificial eggshell → AI？可能
  - 条目62-70: Nature Medicine papers → 有AI相关（如基因组分析）
  - 条目81: Replimune will again submit its melanoma drug for approval → 但可能不直接AI
- 优先：条目62（基因组分析）、条目63（Indigenous Americans genomics）、条目65（gut microbiome for Parkinson's）

**4. AI前沿 + GitHub (分突破和工具)**
- 突破：新模型/技术
  - 条目89: SQLite is all you need for durable workflows → 本地部署
  - 条目90: Notes from the Mistral AI Now Summit → AI框架
  - 条目91: The dead economy theory → 但可能不直接AI
  - 条目92: GTA 6 Developers Unionize → 无关
  - 条目93: Is AI causing a repeat of frontend’s lost decade? → 但用户关注AI Agent
  - 条目94: Citing 'severe' math deficits → 无关
  - 条目95: Boston Children’s uses AI to unlock new diagnoses → 直接AI应用
  - 条目96: How Braintrust turns customer requests into code with Codex → AI Agent
  - 条目97: Strengthening societal resilience with Rosalind Biodefense → AI
  - 条目98: A shared playbook for trustworthy third party evaluations → AI
  - 条目99-103: arXiv papers → AI模型
- 工具/GitHub高星：条目109-128
  - 选高星：例如条目110 (ECC), 111 (Taste-Skill), 112 (Stop Slop), 113 (Twenty), 116 (Crawl4AI), 122 (Rowboat), 124 (Codex), 125 (iii), 126 (LiteParse), 127 (Git AI), 128 (ccusage)
  - 用户偏好本地部署，所以选有本地部署工具的

**5. 新能源上下游 (3-4条)**
- 条目104-108：新能源
- 选有AI/GPU优化的：例如
  - 条目104: India installs 2.7 GW of rooftop PV → 但可能不直接AI
  - 条目105: Tindo’s solar manufacturing → 无关
  - 条目106: JCN launches hydrogen-powered backhoe loader → 无关
  - 条目107: Chinese PV Industry Brief → 但可能有材料
  - 条目108: Viessmann debuts monoblock air-to-water heat pump → 无关
- 用户关注GPU优化，新能源可能有计算需求，但这里少。选条目107（polysilicon prices）作为上游。

**行动建议 (3条)**
- 基于内容：例如
  1. 用Rowboat做本地AI协作者，提升量化交易效率（so what: 降低GPU成本）
  2. 试用ServiceNow的AI工具，减少诊断时间（so what: 量化投资中快速响应）
  3. 监控Dell股价，AI需求上升（so what: 量化机会）

**严格按格式输出：**

# 🌅 明朔晨报 · 2026-05-30

## 🌐 国际形势
- 选3条：例如
  1. Trump推迟伊朗最终决定，油价下跌，股市上涨 [来源]
  2. 俄罗斯无人机袭击罗马尼亚住宅区，北约谴责，地缘紧张升级 [来源]
  3. 俄乌战争中，英情报称近50万俄军死亡，西方经济承压 [来源]

## 📈 股票投资
- 3条：例如
  1. Dell股价飙升33%，AI需求拉动服务器市场 [来源]
  2. ServiceNow月度涨幅40%，AI恐慌缓解 [来源]
  3. 油价下跌，特朗普推迟伊朗谈判，美股获短期支撑 [来源]

## ⚕️ 医疗科技
- 3条：例如
  1. Boston Children’s医院用AI诊断40+罕见疾病 [来源]
  2. 新研究：肠道微生物可提前数年预测帕金森病 [来源]
  3. 3D打印人工蛋壳培育鸡苗，生物技术突破 [来源]

## 🤖 AI 前沿 + GitHub
### 突破
- **[标题]** [来源] — 一句话突破点 + 影响
### 工具 / GitHub 高星
- **[repo / 工具名]** [链接] — 什么、star增长、解决什么

## ⚡ 新能源上下游
- 3条：例如
  1. 中国多晶硅价格稳定，光伏产业链承压 [来源]
  2. JCN推出氢动力挖掘机，氢能应用启动 [来源]
  3. 以色列公司开发高效热泵，节能新方案 [来源]  (但原始中无以色列，条目108是Viessmann)

**行动建议：3条**

**精炼每条：20-40字**

开始写：

**国际形势 (3条)**
1. 条目17: Trump puts off Iran deal → 油价下跌，股市上涨
   - 一句话：特朗普推迟伊朗最终谈判，油价下跌，美股短期走强
   - 影响：中国科技股可能受益于油价波动
   - 风险

## 📈 趋势对比 (vs 昨日)

### 🔼 热度上升
- **AI** 67 次 (+16)
- **GitHub** 21 次 (+1)
- **OpenAI** 4 次 (+1)
- **GPT** 3 次 (+2)
- **Rust** 3 次 (+2)

### 🔽 热度下降
- Agent 7 次 (-7)
- LLM 4 次 (-4)
- Claude 4 次 (-5)
