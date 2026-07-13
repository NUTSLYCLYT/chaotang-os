首先，用户是明朔，一个AI开发者/蜂群指挥家，硬件是RTX 5090 32GB。偏好零成本本地方案，关注AI Agent、量化交易、内容生产。不看模板化官话，要行动建议。最近复盘是2026-05-18和2026-04-06，避免重复昨天的内容。

我需要从37条原始信息中提炼今日晨报。原始信息分为：国际形势、股票投资、AI前沿、市场行情。

任务：
1. 去重：合并同一新闻多次出现的。
2. 过滤：删除广告/营销/低质量的。
3. 个性化排序：按用户关注领域优先排序（AI Agent框架、LLM本地部署、量化投资、独立开发SaaS、GPU优化）。
4. 每条用1句话精炼总结（20-40字）。
5. 必须保留原始URL。
6. 避开最近复盘里已讨论过的内容（2026-05-18和2026-04-06）。

输出格式严格按5主题结构：
- 🌅 明朔晨报 · 2026-06-09
- 🌐 国际形势
- 📈 股票投资
- ⚕️ 医疗科技
- 🤖 AI 前沿 + GitHub
- ⚡ 新能源上下游
- 🎯 今日 3 个行动建议

先分析原始信息，去重和过滤。

**步骤1: 去重和过滤**

列出所有原始信息，检查重复和低质量。

- **国际形势 (1-6)**:
  1. 中国第九批赴南苏丹（朱巴）维和步兵营完成指挥权交接 — 中国赴南苏丹（朱巴）维和步兵营13日在首都朱巴联合国特派团中国营地举行指挥权交接仪式。这标志着中国第八批赴南苏丹（朱巴）维和步兵营圆满完成为期一年的维和任务，第九批维和步兵营正式走上战位，开始履行维和使命。 [URL]
  2. 习近平将向《生物多样性公约》第十五次缔约方大会第二阶段高级别会议开幕式致辞 — 外交部发言人华春莹14日宣布：国家主席习近平将于12月15日以视频方式向《生物多样性公约》第十五次缔约方大会第二阶段高级别会议开幕式致辞。 [URL]
  3. 学习进行时｜二十大后重要外交活动，这些关键词习近平总书记反复提及 — 二十大后重要外交活动，这些关键词习近平总书记反复提及 [URL]
  4. 中国多家驻土机构参加土耳其创新周 — 土耳其创新周活动12日和13日在伊斯坦布尔金角湾会议中心举办，多家中国驻土机构参加。 [URL]
  5. 匈牙利说就解冻恢复基金与欧盟达成协议 — 匈牙利区域发展与欧盟资金利用部长瑙夫劳契奇13日在新闻发布会上表示，匈牙利与欧盟就解冻其数十亿欧元欧盟恢复基金达成协议。 [URL]
  6. 刚果（金）首都暴雨致141人死亡 — 刚果（金）首都金沙萨12日夜间至13日凌晨遭遇暴雨，多个地区发生洪涝和山体滑坡，导致至少141人死亡。 [URL]

  没有明显重复。过滤：所有都是新闻，但用户关注AI/量化等，国际形势可能不直接相关，但要保留。用户偏好AI相关，所以国际形势中选与科技或经济相关的。

- **股票投资 (7-14)**:
  7. 每次牛市破灭后，总有一批蓝筹悄悄创新高 [URL]
  8. 26年5月 ai梳理展望 [URL] — 26年5月可能指2026年5月
  9. 伊利股息复投回报率测算 [URL]
  10. 腾讯双管齐下的AI战术：守得住，也打得开 [URL]
  11. 一种错觉、一个规律，一份数据，别慌价值投资仍有效 [URL]
  12. 当心股市的线性外推风险 [URL]
  13. 经验分享（二）：价值投资不该迷信基本面，这才是真正的价值投资！ [URL]
  14. 光通信的下一个焦点：Scale-Up 里的 NPO [URL]

  过滤：低质量？可能都是投资观点。用户关注量化交易，所以选相关。8、10、14可能更相关。

- **AI前沿 (15-30)**:
  15. BadHost 漏洞使 AI 代理、评估器和 LLM 网关面临风险 — [URL]
  16. 蚂蚁国际推出移动智能体协议AMP，海外AI支付迈向统一标准 — [URL]
  17. Notion 封禁 Anthropic，并用模型降智把 Opus 4.8 送上热搜！12小时后紧急澄清系笔误 — [URL]
  18. 不卷Token总量，华为云改卷token生产力：Agentic Infra背后，AI云竞争进入下半场 — [URL]
  19. Token日生成数百万亿，传统负载均衡不够用了：F5 开始做Token级调度 — [URL]
  20. 全球近1.8万人参赛，科研智能体同台竞技，第四届世界科学智能大赛初赛收官、复赛开启 — [URL]
  21. 借助广度优先引擎，Shopify 将 GraphQL 执行速度提升了 15 倍 — [URL]
  22. 云知声U2，重新计算通用大模型的商业价值 — [URL]
  23. 生殖学博士入局脑机接口，想做一款缓解女性经期情绪问题的脑机"发箍"｜早期项目 — [URL] — 医疗科技
  24. 「百奥几何」完成数亿元战略融资，打造生命科学"微观世界模型"｜36氪首发 — [URL] — 医疗科技
  25. 8点1氪丨苹果推出全新Siri AI；ROKID回应“智能眼镜偷拍空姐”事件；OpenAI秘密提交IPO文件 — [URL] — AI和科技
  26. 世界杯官方比赛用球再度“中国制造”：全球产业链迁移下，广东工厂为何仍留在赛场中央？｜最前线 — [URL] — 产业链
  27. 氪星晚报｜追觅质押嘉美包装2.47亿股，向兴业银行贷款提供担保；黄仁勋：SK海力士到2030年将晶圆产能翻倍的计划还不够 — [URL] — 企业新闻
  28. 腾讯汤道生评价姚顺雨、混元 3和元宝 — [URL] — AI
  29. 改变全球速度的AI，付款却卡在上一个时代 — [URL] — AI
  30. 产品观察 | 小米创始员工范典创业AI硬件，做了台“无摩擦”的睡眠床头灯 — [URL] — AI硬件

  过滤：低质量？23、24是医疗科技；26、27、28、29、30可能相关。用户关注AI Agent，所以AI前沿中选AI相关。

- **市场行情 (31-37)**:
  31. 📉 上证指数: 3963.25 (-0.36%) [URL]
  32. 📉 深证成指: 14952.40 (-0.27%) [URL]
  33. 📈 创业板指: 3874.84 (+0.24%) [URL]
  34. 📉 沪深300: 4735.25 (-0.17%) [URL]
  35. 📈 纳斯达克100: 25929.66 (+0.86%) [URL]
  36. 📈 标普500: 7405.73 (+0.30%) [URL]
  37. 📉 道琼斯: 50786.01 (-0.16%) [URL]

  这些是市场数据，用户关注量化交易，所以要包括。

**用户关注领域优先排序**:
- AI Agent 框架
- LLM 本地部署
- 量化投资
- 独立开发 SaaS
- GPU 优化

所以，在输出中，要优先这些主题。

**避开最近复盘**:
- 2026-05-18: 评分8/10, 无评语
- 2026-04-06: 评分9/10, 评语: 今天修了637次崩溃还建了进化系统,很硬核

昨天内容：2026-05-18。所以避免重复2026-05-18的内容。但原始信息中没有指定日期，所以假设今天是2026-06-09（因为标题是2026-06-09）。

在原始信息中，日期是2022-12-14 for some, but the user's context is 2026, so I think the "2026" in the URLs is the year. The user is in 2026, so the news is from 2026.

The user's name is NUTSLYCLYT, and the recent recap is for 2026-05-18, so today is 2026-06-09.

In the raw info, for example, item 25 has "8点1氪" which might be 8 AM, but the date is not specified. I'll assume the news is current as of 2026-06-09.

For filtering: remove low-quality, ads, etc.

**Identify key points for each section**:

1. **国际形势**: User cares about AI/tech, so pick relevant. Items 1,2,4,5 might be relevant. Item 6 is disaster, not tech-focused. Item 3 is diplomatic, not directly tech. So for international, focus on tech-related events.

   - Item 1: China's peacekeeping in South Sudan – not directly tech.
   - Item 2: Xi's speech on biodiversity – not tech.
   - Item 3: Diplomatic keywords – not tech.
   - Item 4: China institutions at Turkish innovation week – could be tech, but weak.
   - Item 5: Hungary and EU fund – economic, not tech.
   - Item 6: Congo flood – disaster.

   Since user prefers AI/quant, international might be less relevant. But the output has "国际形势" section, so I need to include 1-2 items that are tech-related. Item 4: China at Turkish innovation week – might be relevant for tech collaboration.

   I'll pick 1-2 items for international.

2. **股票投资**: User cares about quant trading. Items 7-14: 
   - 7: Blue-chip stocks in bull market – quant relevant.
   - 8: AI outlook for 2026 May – directly AI.
   - 9: Dairy stock dividend – not quant.
   - 10: Tencent's AI strategy – quant relevant.
   - 11: Value investing – quant.
   - 12: Linear extrapolation risk – quant.
   - 13: Value investing not迷信基本面 – quant.
   - 14: Optical communication – tech.

   For quant, pick 8,10,12,13. But user wants 3-5 items. Also, market data (31-37) is separate.

3. **医疗科技**: Items 23,24 are medical tech.
   - 23: Brain-computer interface for menstrual issues – medical.
   - 24: Biotech company funding – medical.

   Also, item 25 has "apple Siri AI" but not medical. So medical tech: 23,24.

4. **AI前沿 + GitHub**: This is the main section for AI. Items 15-30.
   - 15: BadHost vulnerability – security for AI.
   - 16: Ant International's mobile agent protocol – AI agent framework.
   - 17: Notion bans Anthropic – AI model.
   - 18: Huawei Cloud token productivity – AI cloud.
   - 19: F5 token-level scheduling – GPU/LLM deployment.
   - 20: World science AI competition – AI agents.
   - 21: Shopify GraphQL speed – performance.
   - 22: Yunzhi Sound U2 – LLM commercial value.
   - 23: Medical brain-computer interface – medical.
   - 24: Biotech funding – medical.
   - 25: Apple Siri AI, etc. – AI.
   - 26:

## 📈 趋势对比 (vs 昨日)

### 🆕 今日新出现
- **AI** (11 次提及)
- **融资** (3 次提及)
- **智能体** (2 次提及)
- **Agent** (2 次提及)
- **大模型** (2 次提及)

### 🔼 热度上升
- **LLM** 1 次 (+1)
- **Anthropic** 1 次 (+1)
- **IPO** 1 次 (+1)
- **OpenAI** 1 次 (+1)
- **机器人** 1 次 (+1)


## 💰 今日市场
- 📉 上证指数: 3963.25 (-0.36%)
- 📉 深证成指: 14952.40 (-0.27%)
- 📈 创业板指: 3874.84 (+0.24%)
- 📉 沪深300: 4735.25 (-0.17%)
- 📈 纳斯达克100: 25929.66 (+0.86%)
- 📈 标普500: 7405.73 (+0.30%)
- 📉 道琼斯: 50786.01 (-0.16%)
