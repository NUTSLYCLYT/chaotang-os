首先，用户是明朔，一个AI开发者/蜂群指挥家，有RTX 5090 32GB硬件。偏好零成本本地方案，关注AI Agent、量化交易、内容生产。最近复盘显示2026-05-18和2026-04-06的评分，但要避开已讨论过的内容。

我需要从110条原始信息中提炼今日晨报。输出必须严格按指定的5主题结构：国际形势、股票投资、医疗科技、AI前沿+GitHub、新能源上下游。然后是3个行动建议。

关键步骤：
1. **去重**：检查同一新闻多次出现的合并。原始信息中，有些条目可能重复（例如，国际形势中1-30条，股票投资31-46条，医疗科技47-80条，AI前沿81-91条，新能源92-96条，开源97-106条，市场行情107-110条）。我需要合并重复的。
2. **过滤**：删除广告/营销/低质量内容。例如，原始信息中有些是视频链接、广告、或低质量新闻（如“Cava CEO”等）。
3. **个性化排序**：按用户关注领域优先排序：AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化。所以，每个主题下要优先这些。
4. **每条精炼总结**：1句话，20-40字。
5. **保留原始URL**：必须包含。
6. **避开最近复盘**：2026-05-18和2026-04-06的复盘内容。2026-05-18的复盘是“评分: 8/10”，无评语；2026-04-06是“评分: 9/10”，评语“今天修了637次崩溃还建了进化系统,很硬核”。所以，要确保不包含这些内容。

先分析原始信息，按主题分组：

- **国际形势 (1-30)**：29条新闻。
- **股票投资 (31-46)**：10条新闻（31-46）。
- **医疗科技 (47-80)**：34条新闻（47-80）。
- **AI前沿 (81-91)**：11条新闻（81-91）。
- **新能源 (92-96)**：5条新闻（92-96）。
- **开源 (97-106)**：10条新闻（97-106）。
- **市场行情 (107-110)**：4条新闻（107-110）。

用户关注领域：AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化。所以，在输出中，要优先这些。

**去重和过滤**：
- 检查重复：例如，国际形势中，条目14和15可能相关（Bolivia crisis），但不同来源。原始信息中，有些条目可能有重复内容。
- 低质量：例如，股票投资中37-46是视频或低质量新闻；医疗科技中47-80有大量技术新闻；AI前沿有GitHub链接。
- 广告：例如，开源中97-106是GitHub repo，可能有广告，但用户偏好零成本本地方案，所以保留但过滤掉不相关。
- 最近复盘：2026-05-18的复盘是“评分: 8/10”，无评语；2026-04-06是“评分: 9/10”，评语“今天修了637次崩溃还建了进化系统,很硬核”。所以，要避开这些内容。在原始信息中，没有直接提到这些，但要确保不包含类似事件。

**个性化排序**：
- 对于每个主题，按用户关注领域排序。
  - 例如，国际形势：优先AI相关、量化投资相关、GPU优化相关。
  - 股票投资：量化投资相关。
  - 医疗科技：AI Agent相关（如AI在医疗）。
  - AI前沿+GitHub：直接相关（AI Agent框架、LLM本地部署）。
  - 新能源：GPU优化相关（如AI训练）。

**每条精炼总结**：20-40字，一句话。

**输出格式**：
- 日期：2026-05-23（今天）
- 5主题结构：
  1. 🌐 国际形势：3-5条，每条有事件标题、来源、一句话事实、影响分析、风险/机会。
  2. 📈 股票投资：3-5条A股/美股要闻，每条有标题、来源、事件/数据、板块联动、价值判断。
  3. ⚕️ 医疗科技：3-4条，每条有标题、来源、进展事实、临床/商业含义。
  4. 🤖 AI前沿 + GitHub：分两小节
     - 突破：2-4条，一句话突破点 + 影响
     - 工具 / GitHub 高星：2-4条，repo名 + 链接 + 什么、star增长、解决什么
  5. ⚡ 新能源上下游：3-4条，每条有标题、来源、行业进展、产业链位置 + 影响
- 🎯 今日3个行动建议：3条，每条1句，有"so what"，具体可执行。

**严格保留原始URL**：每个条目必须有URL。

**绝不发明事实**：只基于原始信息。

先处理每个主题，提取关键点。

**Step 1: 国际形势 (1-30)**
- 优先：AI相关、量化投资相关、GPU优化相关。
- 例如：
  - 条目1: Bolivia protests (fuel shortages) – 可能影响经济，但用户关注AI/量化，可能不直接相关。
  - 条目2: EU rejects UK single market – 无直接AI相关。
  - 条目3: Indian youth protest – 无。
  - 条目4: Tulsi Gabbard resigns – 政治，可能影响全球，但用户偏好零成本本地方案，可能不优先。
  - 条目5: Trump on anti-weaponisation fund – 政治。
  - 条目6: Pakistan army chief to Tehran – 地缘政治。
  - 条目7: Richard Desmond lawsuit – 法律。
  - 条目8: Barney Frank risks – 金融。
  - 条目9: Israeli blockade traps Hajj pilgrim – 人道危机。
  - 条目10: Premier League finale – 体育。
  - 条目11: Everest record – 体育。
  - 条目12: Mahmoud Khalil appeals – 法律。
  - 条目13: US judge dismisses indictment – 法律。
  - 条目14: Bolivia in crisis – 社会 unrest。
  - 条目15: Regional Mediators for US-Iran deal – 地缘政治。
  - 条目16: Israeli settler violence – 人道。
  - 条目17: Europeans debate Putin envoy – 地缘政治。
  - 条目18: South Sudan Ebola risk – 公共卫生。
  - 条目19: Hate crimes in UK – 社会。
  - 条目20: Europeans wary of Trump troops in Poland – 地缘政治。
  - 条目21: All-female Senate delegation – 军事。
  - 条目22: Rubio pressure on NATO – 政治。
  - 条目23: US Marine Corps tests drone command – 军事技术。
  - 条目24: Congressional report on aircraft losses – 军事。
  - 条目25: Libya and Syria join Turkey's exercise – 军事。
  - 条目26: Trump's about-face on troops in Poland – 政治。
  - 条目27: US should learn from Ebola outbreaks – 公共卫生。
  - 条目28: 'The Boys' TV series – 文化。
  - 条目29: Book on US military – 军事。
  - 条目30: Movie review – 文化。

用户关注：AI Agent、量化、内容生产。所以，国际形势中，可能相关的是地缘政治影响AI部署、量化交易（如市场波动）。

- 优先条目：20 (Europeans wary of Trump troops in Poland – 可能影响全球市场，量化交易相关)，23 (US Marine tests drone command – AI/军事技术)，24 (Congressional report on aircraft losses – 量化？)，26 (Trump's about-face – 影响经济)。

但用户偏好零成本本地方案，所以可能更关注本地化影响。

**Step 2: 股票投资 (31-46)**
- 优先量化投资。
- 条目31-46：SPOT, TENB, AT&S, Astral Foods, PTT, Abrego Garcia case, Cava CEO, AEW CEO, Equatorial, Atomic Monster, Space Capital, Nvidia VC, Consumer sentiment, Oil scenario, Home sale.

- 量化相关：条目42 (Nvidia poured $18.6B into VC), 条目43 (Consumer sentiment sinks), 条目44 (Oil scenario), 条目46 (Private credit risk).

- 价值：Nvidia VC is big for AI, consumer sentiment for quant trading.

**Step 3: 医疗科技 (47-80)**
- 优先AI Agent相关（如AI在医疗）。
- 条目47-80：Medicaid cuts, AstraZeneca drug approval, Parkinson's drug, mpox CDC page, Retro Biosciences valuation, Men's health office, Genentech research, AI in doctor's office, Enhanced Games, Colossal Biosciences chickens, WHO health targets, Drug manufacturing in space, Cruise ship hantavirus, Naming in medicine, Gene therapy cancer, Semaglutide trial, AI in medical education, Public health in house design, AI-guided lab redesign, Antivenoms, RNA-stabilizing motifs, Peptide sequencing, Potato pests, Lab data, TIDES manufacturing, Medical Affairs, Ohio pediatric research, Neurodegenerative treatment, NAMs, FDA clears hepatitis D drug, GOP asks to curb China biotech, AstraZeneca wins EU for breast cancer, Utah AI prescribing.

- AI相关：条目54 (AI in doctor's office), 63 (AI-induced never-skilling), 70 (Lab data), 71 (TIDES), 72 (Medical Affairs), 73 (Ohio), 74 (Neurodegenerative), 75 (NAMs), 76 (FDA clears hepatitis D), 77 (GOP on China biotech), 78 (AstraZeneca wins EU), 79 (Utah AI prescribing), 80 (FDA grants Datroway).

- 用户关注：AI Agent框架，所以AI在医疗的进展。

**Step 4: AI前沿 + GitHub (81-91 and 97-106)**
- AI前沿 (81-91): Google I/O, Roundtables on AI understanding, Scaling creativity, Anthropic's Code with Claude, Musk v. Altman trial, Elon Musk lost suit, Nemotron-Labs, Specialization beats scale, OlmoEarth, Introducing Ettin Reranker, PaddleOCR 3.5.
- GitHub (97-106): CodeGraph, OpenWA, Chrome DevTools for agents, oh-my-pi, Understand-Anything, RuView, rtk, Codex, OpenHuman, ccusage.

- 优先：AI Agent框架、LLM本地部署、GPU优化。
  - GitHub repo: CodeGraph (for local LLM), oh-my-pi (AI coding agent), Understand-Anything (knowledge graph), RuView (spatial intelligence), rtk (token reduction), Codex (coding agent), OpenHuman (personal AI), ccusage (token analysis).
  - AI前沿: Google I/O (AI science), Code with Claude (coding), Musk v. Altman (legal), Nemotron-Labs (text generation), etc.

**Step 5: 新能源上下游 (92-96)**
- 条目92-96: China invalidates First Solar patent, EBRD lends for battery storage, Women in Solar, Polysilicon prices flat, Slovakia plans energy communities.
- 优先：GPU优化相关（如AI训练），但新能源可能间接相关。用户关注GPU优化，所以可能有AI训练用的新能源。

**Step 6: 市场行情 (107-110)**
- 但用户关注量化投资，所以可能相关。但输出中是单独主题，要包括在股票投资或单独？输出结构中是"市场行情"在AI前沿后？不，输出结构是：国际形势、股票投资、医疗科技、AI前沿+GitHub、新能源上下游。市场行情107-110是加密货币价格，可能不直接相关，但用户偏好量化，所以可以放股票投资中？不，股票投资是A股/美股，市场行情

## 📈 趋势对比 (vs 昨日)

### 🆕 今日新出现
- **Rust** (2 次提及)

### 🔼 热度上升
- **AI** 44 次 (+3)
- **OpenAI** 4 次 (+2)
- **DeepMind** 1 次 (+1)

### 🔽 热度下降
- GitHub 10 次 (-1)
- Agent 5 次 (-1)
- Claude 4 次 (-1)


## 💰 今日市场
- 📉 BNB: $650 (-1.25%)
- 📉 BTC: $75,501 (-2.55%)
- 📉 ETH: $2,064 (-3.12%)
- 📉 SOL: $84 (-3.29%)
