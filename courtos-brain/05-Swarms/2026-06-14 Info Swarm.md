首先，任务是：我是信息策展员，有53条技术资讯，需要按4类筛选：AI工程、系统架构、产品/创业、开源项目。选出最有信号的12条（去重、跳过明显标题党）。然后每条用一句话概括"为什么值得5秒注意"。最后按类目分组，加emoji标头。

输出格式是Markdown，直接写，不要前言。总长不超过800字。

先看资讯列表，我需要理解每条的类别。类别是：
- AI工程：可能涉及AI模型、算法、工程实践等
- 系统架构：系统设计、基础设施、架构等
- 产品/创业：新产品、创业公司、市场动态
- 开源项目：开源工具、库、社区等

我需要先快速扫描53条，选出最有信号的12条。去重：有些条目可能重复，但这里看起来都是不同的。跳过明显标题党：比如标题太夸张、不实、或明显是垃圾信息。

列出所有条目，标记类别：

1. [HN Best] Honda Civics and the Evil Valet → 似乎关于汽车的AI，但标题党？可能AI工程或产品
2. [HN Best] Police officer investigated for using AI to 'create evidence' → AI应用，可能AI工程或产品
3. [HN Best] Amazon CEO's talks with U.S. officials triggered crackdown on Anthropic models → 政策、AI监管，可能AI工程
4. [HN Best] AI coding at home without going broke → AI工具，可能产品/创业
5. [HN Best] GLM 5.2 Is Out → 模型发布，AI工程
6. [HN Best] Noise infusion banned from statistical products published by Census Bureau → 数据隐私，可能系统架构
7. [HN Best] Treating pancreatic tumours may have revealed cancer's master switch → 医学，不相关？跳过
8. [HN Best] The experience of rendering Arabic typography and its technical debt → 字体渲染，系统架构
9. [HN Best] AI OSS tool repo goes archived over night after raising $7.3M Seed → 开源项目
10. [HN Best] Arch Linux Now Believes Malware Incident Under Control: More Than 1,500 Packages → 系统架构
11. [HN Best] Every Frame Perfect → 优化，系统架构
12. [HN Best] RTX 5080 and RTX 3090 Setup: 80 Tok/s on Qwen 3.6 27B Q8 → AI模型性能，AI工程
13. [HN Best] A low-carbon computing platform from your retired phones → 环保计算，可能系统架构
14. [HN Best] Israeli firm BlackCore suspected of meddling in New York and Scotland votes → 政治，跳过标题党
15. [HN Best] Leaving Mozilla → 人员变动，可能产品/创业
16. [InfoQ AI] 蚂蚁数科企业级 AGI 研发体系重塑实战｜AICon上海 → 企业级AI，产品/创业
17. [InfoQ AI] OpenAI GPT-5.5 与 Codex 正式登陆 Amazon Bedrock → 云服务，系统架构
18. [InfoQ AI] 面壁智能开源社区负责人井晨哲将在AICon上海站，分享高效端侧大模型的技术趋势与产业应用观察 → 开源项目
19. [InfoQ AI] AI驱动的网络钓鱼：技术演变与实施方式 → 安全，可能系统架构
20. [InfoQ AI] 分析的未来是多模态的，一切都关乎 Vibe ｜ 技术趋势 → 多模态AI，AI工程
21. [InfoQ AI] 我们如何利用 Cortex Code 将财务差异分析转变为实时智能工作流 ｜ 技术趋势 → 企业应用，产品/创业
22. [InfoQ AI] 5人2周肝出5.1k星！小米 MiMo Code开源但bug不断，开发者炸锅 → 开源项目
23. [InfoQ AI] 智源大会圆桌：大模型没有终局，具身智能可能是中国的 AlphaGo 时刻 → 未来趋势，AI工程
24. [InfoQ AI] Build 2026：Azure API Management 推出统一模型API并新增MCP内容安全能力 → 云服务，系统架构
25. [InfoQ AI] Snowflake 迈向 Agentic Enterprise 的关键一跃 → 数据平台，产品/创业
26. [MIT Tech Review] The Download: “reprogramming” aging, and the hidden sense of interoception → 医学，跳过
27. [MIT Tech Review] You do your own time → 故事，跳过
28. [MIT Tech Review] Why “reprogramming” is the buzziest approach to reversing aging right now → 医学，跳过
29. [MIT Tech Review] Inside interoception: The hidden sense of how you feel inside → 医学，跳过
30. [MIT Tech Review] The Download: soccer’s data renaissance and China’s big nuclear plans → 数据，跳过
31. [MIT Tech Review] Google DeepMind is worried about what happens when millions of agents start to interact → AI安全，AI工程
32. [MIT Tech Review] Job titles of the future: Nature’s drug designer → 未来工作，跳过
33. [MIT Tech Review] Inside soccer’s data renaissance → 数据，跳过
34. [36Kr AI] 增长停滞两年后，H&M重组全球架构，大中华区降级｜独家 → 企业重组，产品/创业
35. [36Kr AI] 高瓴出手了一家消费级柔性机器人公司，要把“大白”从电影搬进现实家庭｜硬氪首发 → 机器人创业，产品/创业
36. [36Kr AI] 曼联，要被卖了 → 足球，跳过
37. [36Kr AI] 36氪研究院 | AI时代留学就业白皮书：中国留学生全球就业趋势与人才价值重塑 → 教育，跳过
38. [36Kr AI] “宁王系”，排队 IPO → 中国公司，产品/创业
39. [36Kr AI] 读懂SpaceX的两万亿故事：为什么马斯克每一手棋，永远都可以提前摆好？ → SpaceX，产品/创业
40. [36Kr AI] 突发！Anthropic全球停用Claude 5 → AI模型，产品/创业
41. [36Kr AI] 36氪首发 | 核心材料成本