首先，任务是作为信息策展员，从38条技术资讯中选出最有信号的12条，按四类：AI工程、系统架构、产品/创业、开源项目。然后每条用一句话概括"为什么值得5秒注意"，最后按类目分组加emoji标头。

关键点：
- 去重：确保12条是唯一的，没有重复。
- 跳过明显标题党：避免那些看起来不真实或吸引眼球但没实质内容的。
- 每条一句话概括"为什么值得5秒注意"：要简洁、有信号，突出为什么在5秒内值得用户注意。
- 按类目分组：AI工程、系统架构、产品/创业、开源项目。
- 输出格式：Markdown，直接输出，不要前言。
- 总长 ≤ 800字。
- 不要复述原标题，要说"so what"：强调实质影响，而不是标题本身。
- 链接用markdown格式：[标题](url)

先分析每条资讯，分类并筛选。

列出所有38条资讯，我需要快速分类：

1. [HN Front] window.showDirectoryPicker opens up a whole new world - 这是浏览器API，可能系统架构或AI工程？window.showDirectoryPicker是浏览器的文件选择API，用于文件系统访问。可能系统架构。

2. [HN Front] Why Drawing Tablet Brands Won't Collaborate on Linux Floss Drivers - 画板品牌不合作Linux开源驱动。开源项目。

3. [HN Front] Manticore Search 27.1.5: Auth, sharding, conversational and faster vector search - 搜索引擎更新，开源项目。

4. [HN Front] Codex logging bug may write TBs to local SSDs - OpenAI Codex的bug，AI工程（因为Codex是AI模型）。

5. [HN Front] Investors get real-time view of UK bond market activity for the first time - 金融新闻，可能产品/创业？但更偏向市场，不是技术资讯核心。

6. [HN Front] GLM 5.2 vs. Opus - 模型比较，AI工程。

7. [HN Front] Deno Desktop - Deno是Rust语言的运行时，桌面应用支持。系统架构或产品/创业。

8. [HN Front] Danish privacy activist Lars Andersen raided by police - 事件，可能不相关，标题党？跳过。

9. [HN Front] Sakana Fugu - 一个AI产品？Sakana.ai的Fugu，可能AI工程。

10. [HN Front] Good results fine tuning a local LLM like Qwen 3:0.6B to categorize questions - LLM微调，AI工程。

11. [MIT Tech Review] The Download: record-breaking subsea tunnels and flexible data centers - 亚海隧道和灵活数据中心，系统架构（基础设施）。

12. [MIT Tech Review] Inside the world’s deepest and longest subsea road tunnel - 类似11，系统架构。

13. [MIT Tech Review] The Download: AI bottleneck debates, and BCI trials take off - AI瓶颈讨论和脑机接口试验，AI工程。

14. [MIT Tech Review] A startup claims it broke through a bottleneck that’s holding back LLMs - 启动公司声称突破LLM瓶颈，产品/创业（初创公司）。

15. [MIT Tech Review] The inevitable weakness of metrics - 指标弱点，可能AI工程或通用。

16. [MIT Tech Review] Brain-computer interface trials are taking off - 脑机接口试验，产品/创业（医疗AI）。

17. [MIT Tech Review] The Download: a new hunt for dark matter and Kenya’s case for going solar - 暗物质和太阳能，不直接技术，跳过。

18. [MIT Tech Review] Geoengineering still faces major practical challenges - 地球工程，不直接技术，跳过。

19. [36Kr AI] 映界科技：一支00后团队的空间智能“赌注” | 水下项目 - 中国公司，具身智能，产品/创业。

20. [36Kr AI] 氪星晚报｜赢创计划全球裁员3200人；台积电28nm较年初减产25%；三星电子向韩国所有员工开放ChatGPT和Codex - 企业新闻，产品/创业（裁员、芯片）。

21. [36Kr AI] 圆桌论坛：在没人相信之前，乘风破浪的创er | 36氪WAVES2026新浪潮 - 会议，产品/创业（创业故事）。

22. [36Kr AI] 圆桌讨论：在番禺，我们造了什么？｜36氪WAVES2026新浪潮 - 类似21，产品/创业。

23. [36Kr AI] HORWIN号外品牌创始人兼CEO周维：为进化而生，HORWIN的全球出行愿景 | 36氪WAVES2026新浪潮 - 人物，产品/创业。

24. [36Kr AI] 补齐市场信息差！36氪股市舆情交流群开放，实物抽奖等你来！ - 股市，可能不相关，跳过。

25. [36Kr AI] 云鲸智能创始人兼CEO张峻彬：十年 | 36氪WAVES2026新浪潮 - 人物，产品/创业。

26. [36Kr AI] 广州市番禺协诚实业有限公司副总经理龙德洋：真正的城市服务，藏在分分秒秒的坚守里 - 人物，可能不直接技术。

27. [36Kr AI] 36氪首发 | 联想之星险峰联合领投，AI算力中心感知与效能管理方案商完成天使轮融资 - 融资新闻，产品/创业（AI算力）。

28. [36Kr AI] 36氪首发 | 核心团队曾攻关国家重点大飞机装配，航空航天智能装备商完成数千万元融资 - 融资，产品/创业（航空航天AI）。

29. [36Kr AI] 英特尔CEO陈立武：已投资人造金刚石晶圆公司，看好芯片散热应用前景 - 英特尔新闻，系统架构（芯片）。

30. [36Kr AI] 热门中概股美股盘前普跌，哔哩哔哩跌超1% - 金融，跳过。

31. [36Kr AI] 美股大型科技股盘前多数下跌，SpaceX跌超3% - 金融，跳过。

32. [36Kr AI] 香港交易所宣布优化客户按金规定 - 金融，跳过。

33. [