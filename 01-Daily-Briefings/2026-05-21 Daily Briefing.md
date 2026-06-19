首先，我需要仔细阅读用户提供的所有信息，理解明朔的用户画像和偏好，然后从118条原始信息中提炼出今日晨报。用户是明朔，一个AI开发者/蜂群指挥家，硬件是RTX 5090 32GB，偏好零成本本地方案，关注AI Agent、量化交易、内容生产等。最近复盘显示他昨天（2026-05-18）评分8/10，但没有评语，所以我要避开昨天讨论过的内容。

我的任务是：
1. 去重：合并同一新闻多次出现的
2. 过滤：删除广告、营销、低质量内容
3. 个性化排序：按用户关注领域优先（AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化）
4. 每条用1句话精炼总结（20-40字）
5. 保留原始URL
6. 避开最近复盘里已讨论过的内容（2026-05-18的复盘）

输出格式必须严格按5个主题结构：
- 🌅 明朔晨报 · 2026-05-21
- 🌐 国际形势（3-5条）
- 📈 股票投资（3-5条A股/美股）
- ⚕️ 医疗科技（3-4条）
- 🤖 AI前沿 + GitHub（分突破和工具应用）
- ⚡ 新能源上下游（3-4条）
- 🎯 今日3个行动建议（具体可执行，每条1句，有so what）

首先，我将原始信息分类到各个主题中。原始信息有118条，但有些是重复的或低质量的。

**步骤1: 分类原始信息**

我先快速扫描所有条目，按主题分组：

- **国际形势**：条目1-19（但14-19是中文新闻，需要处理）
- **股票投资**：条目20-43
- **医疗科技**：条目44-72（注意72是医疗科技）
- **AI前沿**：条目78-99（78是AI前沿）
- **开源**：条目102-111（102是开源）
- **市场行情**：条目112-118（是指数数据）

用户指定了5个主题：国际形势、股票投资、医疗科技、AI前沿+GitHub、新能源上下游。但原始信息中没有明确"新能源上下游"，我需要从内容中找相关条目。看原始信息：
- 条目33: Goldman Says Oil Drawdowns Hit Record Pace...（石油）
- 条目34-36: Cerebras AI chip（可能相关）
- 条目41: Gen Z shying away from cosmetics（可能不直接）
- 但用户要求"新能源上下游"，所以我得从原始信息中找新能源相关的内容。原始信息中：
  - 条目23: 能源替代背景下储能的超级预期差（一）（股票投资）
  - 条目33: 油价相关
  - 条目41: 油价影响
  - 条目42: SpaceX IPO（可能）
  - 但用户指定"新能源上下游"，我需要确保有3-4条。在原始信息中，可能没有直接的"新能源上下游"条目，但我会从相关领域提取。

用户说："按'用户关注领域'优先排序"，用户关注领域：AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化。所以，我需要聚焦这些。

在输出中，有"⚡ 新能源上下游"主题，但原始信息中可能不直接匹配。我得检查：原始信息中，条目23是"能源替代背景下储能的超级预期差"，条目33是油价，条目41是gas prices，条目42是SpaceX IPO（可能涉及太空能源）。我会尽量找相关条目。

**步骤2: 去重和过滤**

- 去重：同一新闻多次出现的合并。例如，条目14-19是中文新闻，可能重复。
- 过滤：删除广告、营销、低质量。例如，条目43是"我继承了房子"，可能太个人化；条目40是Vox的销售，可能低质量；条目72是医疗科技，但可能不直接相关。

**步骤3: 个性化排序**

按用户关注领域优先：
1. AI Agent框架
2. LLM本地部署
3. 量化投资
4. 独立开发SaaS
5. GPU优化

所以，在输出中，我应该优先突出这些主题的内容。

**步骤4: 每条精炼总结（20-40字）**

- 用一句话，客观，不堆砌术语。
- 保留原始URL。

**步骤5: 避开最近复盘**

最近复盘：2026-05-18 评分8/10，无评语。所以，不要包括昨天讨论过的内容。但用户没有指定昨天具体讨论了什么，所以我会假设从原始信息中过滤掉可能重复的。

**步骤6: 输出格式**

严格按：
# 🌅 明朔晨报 · 2026-05-21

## 🌐 国际形势
...（3-5条）

## 📈 股票投资
...（3-5条）

## ⚕️ 医疗科技
...（3-4条）

## 🤖 AI 前沿 + GitHub
### 突破
...
### 工具 / GitHub 高星
...

## ⚡ 新能源上下游
...（3-4条）

## 🎯 今日 3 个行动建议
1. ...
2. ...
3. ...

现在，开始处理每个部分。

**先处理国际形势（条目1-19）**

- 条目1: US charges Cuba's Raúl Castro with murder... (BBC)
- 条目2: Rosenberg: Putin enjoys Xi's Chinese welcome... (BBC)
- 条目3: Sierra Leone becomes latest African country to receive deportees from US
- 条目4: Far-right Israeli minister condemned for taunting...
- 条目5: Ebola vaccine could take nine months...
- 条目6: Murder or accident? Mystery of Mango tycoon's hiking death...
- 条目7: Austrian ex-intelligence officer found guilty of Russia spying
- 条目8: US military jets and drones tracked near Cuba
- 条目9: Trump says Ukraine lacks leverage...
- 条目10: Lithuanian lawmakers shelter, Vilnius air traffic suspended due to drone incursion
- 条目11: Germany touts pan-German space command...
- 条目12: Italy rethinks EU defense-financing aid...
- 条目13: UN peacekeeping forces prepare to leave Lebanon
- 条目14: 中国第九批赴南苏丹（朱巴）维和步兵营完成指挥权交接 (中文)
- 条目15: 习近平将向《生物多样性公约》第十五次缔约方大会... (中文)
- 条目16: 学习进行时｜二十大后重要外交活动... (中文)
- 条目17: 中国多家驻土机构参加土耳其创新周 (中文)
- 条目18: 匈牙利说就解冻恢复基金与欧盟达成协议 (中文)
- 条目19: 刚果（金）首都暴雨致141人死亡 (中文)

用户关注领域：AI、量化、内容生产等，所以国际形势中，我需要选与这些相关的。例如：
- 条目11: Germany space command (可能相关，因为AI/quant）
- 条目10: Drone incursion (security, relevant for AI)
- 条目8: US military jets near Cuba (tensions, but not directly AI)
- 条目9: Trump on Ukraine (political, but might affect markets)

优先选3-5条，按重要度。但用户说"按事件重要度排"，不是重要度，而是按用户关注领域。用户关注领域中，国际形势可能影响AI/量化。

我选：
- 条目10: Lithuanian drone incursion (security, relevant for AI/quant)
- 条目11: Germany space command (EU push to supplant US tech, relevant for AI hardware)
- 条目8: US military jets near Cuba (tensions, might affect global markets)
- 条目9: Trump on Ukraine (political, but could impact quant strategies)
- 条目13: UN peacekeeping forces leave Lebanon (less relevant)

过滤掉低质量：条目5 Ebola vaccine is not directly relevant. 条目6 is personal mystery. 条目7 is spy scandal. 条目4 is Israeli incident.

For 明朔, as AI developer, international security events might affect his projects.

**股票投资（条目20-43）**

- 条目20: "年轻人不饮酒"等论调影响下的白酒未来投资判断
- 条目21: 手中持股，心中无股.
- 条目22: OCS：中国 AI 算力建设的特别意义
- 条目23: 能源替代背景下储能的超级预期差（一）
- 条目24: 美的集团最强的基本面是什么？
- 条目25: 光芯片三杰角色定位与后续走势推演
- 条目26: 两大央行的博弈
- 条目27: 随想276 黄金的避险属性失效了吗？
- 条目28: Hartford Equity Income Fund Q1 2026 Commentary
- 条目29: Vivos Therapeutics, Inc. (VVOS) Q1 2026 Earnings Call
- 条目30: Ioneer Ltd (IONR) Shareholder/Analyst Call
- 条目31: Palantir Technologies: Priced For Perfection
- 条目32: Why AMD Could Reach $1,000 Before 2030
- 条目33: Goldman Says Oil Drawdowns Hit Record Pace
- 条目34: Why Cerebras CEO Built The World's Largest Computer Chip
- 条目35: Jess Pegula on the Business of Tennis
- 条目36: Odd Lots: Why Cerebras Built The Largest Computer Chip
- 条目37: Nvidia’s Huang Ignites Asia Tech Rally
- 条目38: Sri Lankan Rupee Weakens to Three-Year Low
- 条目39: Your bond portfolio is facing a 'termite' infestation
- 条目40: Vox’s sale marks the end of an era for digital media
- 条目41: Gen Z may be shying away from buying cosmetics
- 条目42: Investors are flocking to an offshore crypto platform for SpaceX IPO
- 条目43: I inherited a house... (low quality, filter out)

用户关注：量化投资，所以选与量化、AI、股票相关的。

- 条目32: AMD could reach $1000 (tech stock)
- 条目33: Oil drawdowns (macro, relevant for quant)
- 条目34-36: Cerebras AI chip (directly AI)
- 条目37: Nvidia Huang ignites tech rally (AI)
- 条目26: 两大央行的博弈 (central bank, relevant for quant)
- 条目22: OCS: China AI computing power (AI)

过滤低质量：条目21 is vague, 条目40 is about Vox sale (not directly relevant), 条目41 is cosmetics (less relevant).

**医疗科技（条目44-72）**

- 条目44: Congressional Democrats try to force a vote to end Medicare AI prior authorization pilot
- 条目45: STAT+: Pioneering trial for treating genetic disease before birth
- 条目46: Surgeon general’s office issues warning on screen time for children
- 条目47: STAT+: Florida hospitals win $8 billion in extra Medicaid funds
- 条目48: STAT+: Scientists track cellular disruptions that lead to type 1 diabetes
- 条目49: Opinion: I saw Ebola as both doctor and patient
- 条目50: STAT+: Biotech execs, academic expert lament impact of FDA turnover
- 条目51: STAT+: Kennedy fires two leaders on preventive services task force
- 条目52: Colossal Biosciences is growing chickens in a 3D-printed artificial eggshell
- 条目53: The world is on track to miss its health targets
- 条目54: A plan to make drugs in orbit is going commercial
- 条目55: Here’s what you need to know about the cruise ship hantavirus outbreak
- 条目56: Here’s how technology transformed babymaking
- 条目57: HPV vaccines, 20 years on
- 条目58: Unintended consequences of legacy oversight in digital medicine
- 条目59: An AI framework for multi-disease detection via retinal imaging
-

## 📈 趋势对比 (vs 昨日)

### 🆕 今日新出现
- **智能体** (2 次提及)
- **Python** (2 次提及)

### 🔼 热度上升
- **芯片** 2 次 (+1)
- **IPO** 1 次 (+1)
- **Apple** 1 次 (+1)
- **CUDA** 1 次 (+1)
- **开源** 1 次 (+1)

### 🔽 热度下降
- AI 42 次 (-19)
- GitHub 11 次 (-9)
- Agent 4 次 (-13)


## 💰 今日市场
- 📉 上证指数: 4077.28 (-2.33%)
- 📉 深证成指: 15247.27 (-2.93%)
- 📉 创业板指: 3829.78 (-3.34%)
- 📉 沪深300: 4783.10 (-2.11%)
- 📈 纳斯达克100: 26270.36 (+1.54%)
- 📈 标普500: 7432.97 (+1.08%)
- 📈 道琼斯: 50009.35 (+1.31%)
