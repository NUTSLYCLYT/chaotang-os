首先，我需要理解用户的需求。用户是明朔，一个AI开发者/蜂群指挥家，有RTX 5090 32GB硬件。他的偏好是零成本本地方案，关注AI Agent、量化交易、内容生产。他不看模板化官话，要行动建议。最近复盘显示他昨天（2026-05-18）评分8/10，但今天是2026-07-08（根据原始信息日期推断）。

我有184条原始信息，需要提炼成今日晨报。输出必须严格按5个主题结构：国际形势、股票投资、医疗科技、AI前沿+GitHub、新能源上下游。每个主题有具体要求：去重、过滤低质量、按用户关注领域优先排序、每条1句话精炼（20-40字）、保留原始URL、避开最近复盘内容。

先梳理用户关注领域（优先排序）：
- AI Agent 框架
- LLM 本地部署
- 量化投资
- 独立开发 SaaS
- GPU 优化

所以，我的输出要优先这些主题。避免重复昨天内容：昨天是2026-05-18，但今天是2026-07-08（从原始信息看，大部分是7月7日/8日的新闻），所以不需要担心重复，因为用户说"避免重复昨天的内容"，但昨天是5月18日，今天是7月8日，时间差大，应该没问题。不过，用户提到"最近复盘"有2026-05-18和2026-04-06，所以要确保不包含这些日期的讨论。但原始信息是7月7-8日的，所以可能无冲突。

步骤：
1. **去重**：检查原始信息中是否有重复条目。例如，有些条目在多个地方出现（如GitHub repo重复）。
2. **过滤**：删除广告、营销、低质量内容。例如，原始信息中有些是广告链接、低质量新闻、重复条目。
3. **个性化排序**：按用户关注领域优先。例如：
   - AI Agent 框架 → 优先
   - LLM 本地部署 → 次优先
   - 量化投资 → 重要
   - 独立开发 SaaS → 重要
   - GPU 优化 → 重要
4. **每条精炼**：20-40字，一句话。必须保留原始URL。
5. **避开最近复盘**：用户最近复盘是2026-05-18（评分8/10）和2026-04-06（评分9/10），但今天是7月8日，所以无重叠。确保不包含这些日期的讨论。
6. **输出格式**：严格按指定结构。

先扫描原始信息，按主题分类：

### 1. 国际形势 (1-50条)
- 重点：US-Iran冲突、Marine Le Pen、Trump、NATO等。
- 用户关注：可能影响AI/量化/投资，所以选有直接关联的。
- 优先：US strikes Iran (影响全球市场、AI供应链)，Marine Le Pen (政治影响)，Trump (政策)。
- 过滤：低质量新闻（如具体事件细节不重要）。

### 2. 股票投资 (51-74条)
- 重点：A股、美股、量化相关。
- 用户关注：量化投资，所以选有alpha机会或风险的。
- 优先：Rivian stock drop (EV), Micron stock fall (AI memory), GM-backed Momenta IPO (autonomous driving).

### 3. 医疗科技 (75-100条)
- 重点：FDA approvals, biotech news.
- 用户关注：AI在医疗应用，所以选有AI相关突破的。
- 优先：Vera Therapeutics kidney treatment (FDA approval), Compass Pathways depression drug.

### 4. AI前沿 + GitHub (109-175条)
- 重点：AI模型、工具、GitHub项目。
- 用户关注：AI Agent框架、LLM本地部署、GPU优化。
- 优先：GitHub高星项目（如AI job search, meeting assistants），AI突破（如Claude Science）。

### 5. 新能源上下游 (152-184条)
- 重点：太阳能、电池、电网。
- 用户关注：可能间接影响（如GPU用于新能源计算），但优先选有直接AI/量化关联的。

**关键：用户是AI开发者，所以AI前沿和GitHub部分要重点突出。**

现在，逐条处理原始信息，提取关键点：

#### 国际形势 (选3-5条)
- 1. US strikes Iran after tankers hit → 影响：油价上涨，全球供应链紧张。用户可能关心：量化交易中能源风险。
- 2. Marine Le Pen runs for French presidency → 政治影响，但用户可能不直接相关。
- 3. Trump and NATO → 重申：US政策影响全球。
- 9. US launches new wave of Iran strikes → 重要：直接相关。
- 19. US strikes Iran despite promised pause → 重要。
- 22. Marine Le Pen to run for French Presidency despite criminal conviction → 重要。
- 39. US will lift sanctions on Turkey → 但用户可能不直接相关。
- 重点：选US-Iran冲突（影响全球市场），Marine Le Pen（政治），Trump（政策）。

**精炼：**
- US strikes Iran: 从9和19条，US新一波袭击伊朗，油价上涨。影响：量化交易中能源风险。
- Marine Le Pen: 22条，法国极右翼候选人参选，可能影响欧洲政治。
- Trump: 3条，US总统言论影响NATO，重申欧洲防务。

但用户偏好零成本本地方案，所以可能更关注技术影响。US-Iran冲突直接关联到全球供应链和AI硬件（如GPU）。

#### 股票投资 (选3-5条)
- 51-74: 重点是A股和美股。
- 64. GM-backed Momenta IPO → 中国自动驾驶公司，利好AI。
- 65. US Strikes Iran and Blocks Oil Sales → 油价上涨，影响能源股。
- 71. Rivian stock sale triggers worst rout → EV股下跌，量化风险。
- 73. Micron stock falls → AI内存市场可能见顶。
- 74. Adobe stock cheap → AI未来不确定。

**优先：** Micron (AI硬件), Rivian (EV), Momenta (自动驾驶)。

#### 医疗科技 (选3-4条)
- 75. FDA approves Vera Therapeutics kidney treatment → 重要：AI在医疗应用。
- 76-80: 但75是FDA批准，直接相关。
- 81. Ebola outbreak → 但用户可能不直接相关。
- 优先：Vera Therapeutics (FDA approval), Compass Pathways (depression drug).

#### AI前沿 + GitHub (选4条)
- 109-119: AI架构、OpenAI等。
- 113. LLMs stuck in groupthink → 重要：AI Agent框架。
- 114. Claude Science → Anthropic产品。
- 115-120: 但115是欧盟驾驶员监控，可能不直接。
- GitHub: 157-176: 高星项目，如AI job search, meeting assistants.
- 重点：AI Agent框架（113,114），GitHub工具（如157,158,159）。

#### 新能源上下游 (选3-4条)
- 152-184: 但152-156是太阳能。
- 152. Octopus Energy home batteries → 但用户可能不直接相关。
- 153. JinkoSolar → 太阳能。
- 优先：太阳能（影响AI硬件需求？）。

**用户偏好：** 量化投资，所以股票部分要突出。

**去重和过滤：**
- 例如，GitHub repo 167重复157，需合并。
- 低质量：如广告、营销内容（如"36氪首发"等），过滤掉。
- 日期：所有原始信息是2026-07-07/08，用户昨天是2026-05-18，所以无重叠。

**个性化排序：**
- 按用户关注领域：
  1. AI Agent 框架 → 优先
  2. LLM 本地部署 → 次
  3. 量化投资 → 重要
  4. 独立开发 SaaS → 重要
  5. GPU 优化 → 重要

所以，在输出中：
- 国际形势：选有AI/量化影响的。
- 股票投资：量化相关。
- 医疗科技：AI医疗应用。
- AI前沿：直接AI Agent。
- 新能源：可能间接，但选有AI关联的。

**每条精炼：** 20-40字，一句话。保留URL。

**行动建议：** 3条具体可执行，有"so what"。

开始提炼：

### 🌅 明朔晨报 · 2026-07-08

#### 1. 国际形势
- 选3条：
  - US strikes Iran (9,19) → 影响：油价上涨，量化交易中能源风险。
  - Marine Le Pen (22) → 政治影响，但用户可能不直接。
  - Trump and NATO (3) → US政策影响全球。
  - 但用户偏好：量化投资，所以US-Iran冲突最相关。

  **精炼：**
  - **[US新一波袭击伊朗]** [https://www.ft.com/content/c7dac217-4a77-4640-9aa4-17ae7b0d5c0c] — US对伊朗发动新袭击，油价飙升，量化交易需监控能源风险。
  - **影响分析**: 全球供应链紧张，AI硬件（如GPU）需求波动
  - **风险 / 机会**: 量化模型加入能源价格因子，捕捉短期波动

  - **[Marine Le Pen参选总统]** [https://www.aljazeera.com/video/newsfeed/2026/07/08/marine-le-pen-to-run-for-french-presidency-despite-criminal-conviction] — 法国极右翼候选人参选，可能影响欧洲AI政策。
  - **影响分析**: 欧洲监管趋严，本地化AI部署成本上升
  - **风险 / 机会**: 本地部署SaaS时，考虑欧洲合规要求

  - **[特朗普重申对欧洲防务]** [https://www.bbc.co.uk/news/articles/ckg06d3dgnlo?at_medium=RSS&at_campaign=rss] — Trump言论加剧NATO分歧，美国减少欧洲军事投入。
  - **影响分析**: 欧洲AI研发资金紧张，影响开源项目
  - **风险 / 机会**: 量化交易中，欧洲AI股短期承压

  但用户是AI开发者，可能更关注技术影响。US-Iran冲突直接关联到GPU供应链（伊朗石油影响能源价格，进而影响AI数据中心）。

  选：
  1. US strikes Iran (9)
  2. Marine Le Pen (22)
  3. Trump and NATO (3)

#### 2. 股票投资
- 选3条：
  - 71. Rivian stock drop → EV股下跌
  - 73. Micron stock fall → AI内存市场
  - 64. Momenta IPO → 自动驾驶
  - 65. US strikes Iran → 油价上涨，影响能源股

  **精炼：**
  - **[Rivian股价暴跌18%]** [https://www.marketwatch.com/story/rivians-stock-sale-triggers-worst-rout-for-the-shares-in-nearly-two-years-6791789e?mod=mw_rss_topstories] — Rivian因现金问题股价大跌，量化模型需调整EV持仓。
  - **板块联动**: A股新能源车 ↔ 美股EV股，中国电池厂受益
  - **价值判断**: 风险信号，短期波动大，但长期AI驱动需求

  - **[Micron股价下跌]** [https://www.marketwatch.com/story/microns-stock-falls-as-investors-wonder-if-the-memory-market-is-near-the-top-ab2d2feb?mod=mw_rss_topstories] — Micron内存股下跌，AI硬件市场可能见顶。
  - **板块联动**: 美股半导体 ↔ 中国AI芯片，国产替代加速
  - **价值判断**: 风险信号，GPU优化机会

  - **[Momenta港股IPO]** [https://www.bloomberg.com/news/articles/2026-07-07/gm-backed-momenta-set-for-hong-kong-debut-after-752-million-ipo] — GM-backed自动驾驶公司Momenta港股IPO，募资752M。
  - **板块联动**: A股自动驾驶 ↔ 美股AI芯片，中国供应链优势
  - **价值判断**: Alpha机会，量化模型可捕捉自动驾驶赛道

## 📈 趋势对比 (vs 昨日)

### 🆕 今日新出现
- **Apple** (3 次提及)
- **芯片** (2 次提及)
- **GPU** (2 次提及)

### 🔼 热度上升
- **AI** 73 次 (+1)
- **Agent** 13 次 (+1)
- **GPT** 6 次 (+3)
- **融资** 4 次 (+3)
- **LLM** 3 次 (+2)

### 🔽 热度下降
- OpenAI 6 次 (-2)
- Anthropic 5 次 (-1)
- Rust 4 次 (-1)


## 💰 今日市场
- 📉 上证指数: 3989.41 (-0.19%)
- 📉 深证成指: 15119.89 (-0.98%)
- 📉 创业板指: 3910.98 (-0.55%)
- 📉 沪深300: 4794.39 (-0.21%)
- 📉 BNB: $571 (-1.83%)
- 📉 BTC: $62,950 (-0.79%)
- 📉 ETH: $1,756 (-1.37%)
- 📉 SOL: $79 (-3.21%)
