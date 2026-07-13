首先，我需要理解任务：作为明朔的私人科技媒体主编，从188条原始信息中提炼今日晨报。用户画像显示明朔是AI开发者/蜂群指挥家，有RTX 5090 32GB硬件，偏好零成本本地方案，关注AI Agent、量化交易、内容生产、不看模板化官话，要行动建议。最近复盘是2026-05-18和2026-04-06，避免重复昨天的内容。

关键要求：
1. 去重：同一新闻多次出现的合并
2. 过滤：删除广告/营销/低质量内容
3. 个性化排序：按用户关注领域优先（AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化）
4. 每条用1句话精炼总结（20-40字）
5. 保留原始URL
6. 避开最近复盘已讨论过的内容（2026-05-18和2026-04-06）

输出格式必须严格按5主题结构：
- 🌅 明朔晨报 · 2026-07-02
- 🌐 国际形势 (3-5条)
- 📈 股票投资 (3-5条A股/美股)
- ⚕️ 医疗科技 (3-4条)
- 🤖 AI前沿 + GitHub (分突破和工具应用)
- ⚡ 新能源上下游 (3-4条)
- 🎯 今日3个行动建议 (具体可执行，每条1句，有so what)

先梳理原始信息，按主题分类：

1. **国际形势** (1-49条)：有29条
2. **股票投资** (51-74条)：有24条
3. **医疗科技** (75-108条)：有34条
4. **AI前沿** (109-152条)：有44条
5. **新能源** (153-157条)：有5条
6. **开源** (158-177条)：有20条
7. **市场行情** (178-188条)：有11条

注意：用户关注领域优先：AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化。所以AI相关的内容要优先。

**步骤1: 去重和过滤**

- 检查重复：例如，条目163和168都是GitHub: diegosouzapw/OmniRoute，合并为一条。
- 过滤广告/营销：例如，条目178-188是市场行情，但用户可能更关注量化投资，所以保留；条目122-127是中文内容，但要过滤低质量。
- 低质量：例如，条目120、121等可能太技术性，但用户是AI开发者，可能相关；条目129、130等是中文，但要保留如果相关。

**步骤2: 个性化排序**

- 优先用户关注领域：
  - AI Agent框架 (e.g., 109-112, 116-127)
  - LLM本地部署 (e.g., 111, 112)
  - 量化投资 (e.g., 51-58, 60-64)
  - 独立开发SaaS (e.g., 124, 125)
  - GPU优化 (e.g., 121, 122)

- 从原始信息中提取相关条目，按优先级排序。

**步骤3: 每条精炼总结 (20-40字)**

- 用一句话，客观，不堆砌术语。
- 保留原始URL。

**步骤4: 避开最近复盘内容**

- 最近复盘：2026-05-18 (评分8/10, 无评语) 和 2026-04-06 (评分9/10, 修了637次崩溃还建了进化系统)。所以，避免讨论类似内容。例如，2026-04-06涉及系统崩溃，所以过滤掉任何关于系统崩溃的新闻。

**步骤5: 输出结构**

- 严格按格式：5主题，每个主题有指定条目数。
- 今日3个行动建议：基于以上，具体可执行，每条有so what。

**开始提炼：**

**先处理每个主题，提取关键条目**

**1. 国际形势 (1-49条)**

- 重要事件：US blocks trade deal (5), Trump's stock purchases (10), AI model standards (9), etc.
- 优先用户：可能不直接相关，但AI相关（如9）。
- 过滤：删除低质量，如条目1-4, 6, 7, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45-49 (中文)
- 用户关注：AI Agent框架（条目9: White House accelerates AI model standards），量化投资（可能不直接）
- 选3-5条： 
  - 9. White House accelerates plans for AI model standards (FT) - 相关AI
  - 10. Trump made up to $1.4bn in stock purchases (FT) - 量化投资
  - 15. US opts not to renew Trump’s trade deal with Mexico and Canada (FT) - 经济
  - 23. Trump sees progress as US and Iran hold talks in Qatar (SCMP) - 国际
  - 24. Alibaba agrees to pay US$600 million to settle US probe (SCMP) - 企业
- 但用户偏好：关注AI Agent/量化交易，所以优先AI和量化。
- 精炼：每条20-40字，有影响分析和风险/机会。

**2. 股票投资 (51-74条)**

- 重点：量化投资、A股/美股
- 选3-5条： 
  - 51. 逆向投资和中石油的复盘 (Xueqiu) - 量化
  - 52. K型经济 (Xueqiu) - 经济
  - 53. 2026年半年交易总结 (Xueqiu) - 量化
  - 54. 你买的是红利，还是一个“稳赚不赔”的幻觉？ (Xueqiu) - 量化
  - 55. 有惊喜有隐忧 (Xueqiu) - 量化
  - 60. The Greenbrier Companies, Inc. (GBX) Q3 2026 Earnings Call (Seeking Alpha) - 股票
  - 61. Novacyt S.A. (NVYTF) Shareholder/Analyst Call (Seeking Alpha) - 股票
  - 62. Comcast Corporation (CMCSA) Discusses Strategic Separation (Seeking Alpha) - 股票
  - 63. Valero Energy: Refining Boom Can Outlive The Iran War (Seeking Alpha) - 股票
  - 64. KKR-Backed Musinsa Eyes 'Fast Growth' in China (Bloomberg) - 量化
  - 65. NZ House Prices Near Three-Year Low on Iran War Worries (Bloomberg) - 量化
  - 66. Asian Stocks to Drop After Chip Selloff (Bloomberg) - 量化
  - 67. Oil Extends Decline as Barrels Flow Through Strait of Hormuz (Bloomberg) - 量化
  - 68. KKR-Backed Musinsa Ramps Up Asia Store Push Ahead of IPO (Bloomberg) - 量化
  - 69. Traders Plot Worst-Case Scenario for Yen (Bloomberg) - 量化
  - 70. Opening a ‘Trump account’ for your children? (MarketWatch) - 量化
  - 71. Nvidia is betting on a trillion-dollar robotics boom (MarketWatch) - 量化
  - 72. ‘We were stunned’: My daughter... (MarketWatch) - 低质量，过滤
  - 73. CoreWeave, Nebius shares tumble as Meta stands to become a fresh threat (MarketWatch) - 量化
  - 74. This is the best time ‘in a generation’ to buy space and defense stocks (MarketWatch) - 量化
- 用户关注：量化投资，所以选量化相关条目。
- 精炼：每条20-40字，有板块联动和价值判断。

**3. 医疗科技 (75-108条)**

- 重点：AI医疗、新药、临床试验
- 选3-4条：
  - 75. Statins and blood pressure drugs changing health risks of obesity (Statnews) - 医疗
  - 76. STAT+: Anthropic's Claude Science (Statnews) - AI医疗
  - 77. STAT+: Synthetic biology researchers think they've made a cell (Statnews) - 生物
  - 78. STAT+: Anthropic drug development goals (Statnews) - AI医疗
  - 79. STAT+: GLP-1s may help with peripheral artery disease (Statnews) - 医疗
  - 80. FDA says Zyn can market its pouches as safer than cigarettes (Statnews) - 医疗
  - 81. FDA approves Orca Bio’s T cell therapy for blood cancer (Statnews) - 医疗
  - 82. Opinion: What Ebola and Marburg are teaching us (Statnews) - 医疗
  - 83. Roundtables: Longevity’s Next Frontier (Tech Review) - 医疗
  - 84. Heat waves mess with your brain (Tech Review) - 医疗
  - 85. Stripe, Anthropic, OpenAI backing effort to stop respiratory infections (Tech Review) - AI医疗
  - 86. Brain-computer interface trials (Tech Review) - 医疗
  - 87. This man with ALS is first power user of brain implant (Tech Review) - 医疗
  - 88. Biological aging might help explain rising risk of early-onset cancer (Nature) - 医疗
  - 89. Meta-analysis of antihypertensive therapy (Nature) - 医疗
  - 90. Blood-based circular RNAs for early diagnosis of Alzheimer’s (Nature) - 医疗
  - 91. Innate immune responsiveness predicts enhanced cellular immunity (Nature) - 医疗
  - 92. Author Correction: Digital AVATAR therapy for distressing voices (Nature) - 医疗
  - 93. A genome-scale CRISPRi perturbation atlas (Nature Biotech) - 生物
  - 94. Editor’s pick: Liberate Bio (Nature Biotech) - 生物
  - 95. Editor’s pick: Trogenix (Nature Biotech) - 生物
  - 96. Prime editing for precise genome engineering (Nature Biotech) - 生物
  - 97. A retargeted recombinase for precise insertion of large DNA (Nature Biotech) - 生物
  - 98. Rethinking Your Product Lifecycle Strategy in Medtech (Fierce Biotech) - 医疗
  - 99. Securing MedTech's Digital Future (Fierce Biotech) - 医疗
  - 100. Puerto Rico makes its case as a biotech manufacturing hub (Fierce Biotech) - 医疗
  - 101. Why Medical Communications Often Drift from Strategy (Fierce Biotech) - 医疗
  - 102. Unlocking the Power of AI in the Biotech Industry (Fierce Biotech) - AI医疗
  - 103. Digital humans in pharma (Fierce Biotech) - AI医疗
  - 104. Merck scraps a Phase 2 Alzheimer's asset (Endpoints News) - 医疗
  - 105. FDA warns Genzyme's Irish site over quality questions (Endpoints News) - 医疗
  - 106. WuXi AppTec seeks injunction over China military list (Endpoints News) - 医疗
  - 107. FDA approves Orca Bio’s cell therapy (Endpoints News) - 医疗
  - 108. BridgeBio adds $1B as it prepares three more drug launches (Endpoints News) -

## 📈 趋势对比 (vs 昨日)

### 🆕 今日新出现
- **开源** (2 次提及)

### 🔼 热度上升
- **AI** 74 次 (+5)
- **融资** 6 次 (+4)
- **IPO** 4 次 (+2)
- **Meta** 3 次 (+1)
- **Linux** 2 次 (+1)

### 🔽 热度下降
- Agent 13 次 (-1)
- Claude 10 次 (-3)
- OpenAI 4 次 (-1)


## 💰 今日市场
- 📈 上证指数: 4112.45 (+0.53%)
- 📉 深证成指: 16119.17 (-0.66%)
- 📉 创业板指: 4260.72 (-1.74%)
- 📉 沪深300: 4958.98 (-0.28%)
- 📉 纳斯达克100: 26040.03 (-0.66%)
- 📉 标普500: 7483.23 (-0.22%)
- 📉 道琼斯: 52305.24 (-0.03%)
- 📈 BNB: $549 (+0.61%)
- 📈 BTC: $59,875 (+2.12%)
- 📈 ETH: $1,604 (+2.04%)
- 📈 SOL: $77 (+5.09%)
