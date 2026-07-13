首先，任务是作为信息策展员，从75条技术资讯中选出最有信号的12条（去重、跳过明显标题党）。然后，每条用一句话概括"为什么值得5秒注意"。最后，按类目分组：AI工程、系统架构、产品/创业、开源项目。加emoji标头。

我需要先理解类目：
- AI工程：可能包括AI模型、训练、推理、系统等
- 系统架构：系统设计、基础设施、云、分布式系统等
- 产品/创业：新公司、产品、创业故事、市场动态
- 开源项目：开源工具、库、框架等

现在，分析75条资讯，跳过明显标题党（比如那些看起来像广告、不相关或标题党），去重（确保每条唯一）。

先快速浏览所有条目，标记哪些是标题党或不相关：

1. [HN Best] If you're a button, you have one job – 这个是UI设计，可能系统架构或产品
2. [HN Best] GPT-5.5 Codex reasoning-token clustering may be leading to degraded performance – AI模型问题
3. [HN Best] Better Models: Worse Tools – AI工具
4. [HN Best] Command and Conquer Generals natively ported to macOS, iPhone, iPad using Fable – 开源工具（Fable是.NET）
5. [HN Best] Google Books (or similar) all book scans – $200k bounty (2025) – 产品/创业（数据收集）
6. [HN Best] Meta data center water discharges suspended for contaminating water supply – 系统架构（数据中心）
7. [HN Best] Leaking YouTube creators' private videos – 安全问题
8. [HN Best] Zig: All Package Management Functionality Moved from Compiler to Build System – 开源（Zig语言）
9. [HN Best] Potential session/cache leakage between workspace instances or consumer accounts – 安全
10. [HN Best] Explanation of everything you can see in htop/top on Linux (2019) – 系统架构（Linux工具）
11. [HN Best] Astrophysicists Puzzle over Webb’s New Universe – 科学，不相关
12. [HN Best] The bottleneck might be the air in the room – 有趣，但可能不技术
13. [HN Best] Maybe you should learn something – 一般建议
14. [HN Best] Odin, Wikipedia and engagement farming – 互联网，可能不直接技术
15. [HN Best] Giant trees have no trouble pumping water to top branches: new research – 生物学，不相关
16. [HN Front] The Engineer in the Half-Space – 一般文章
17. [HN Front] Show HN: KiCad in the Browser – 开源（KiCad是PCB设计）
18. [HN Front] Cannabis Users Face Substantially Higher Risk of Heart Attack – 医疗，不相关
19. [HN Front] Introduction to Compilers and Language Design – AI工程（编译器）
20. [HN Front] Pi square is nearly 10 – 数学，不相关
21. [HN Front] Scientist who cleaned space toilet on work now leading Mars exploration – 科学，不相关
22. [HN Front] Claude Design System Prompt – AI工程（Claude）
23. [HN Front] Knowledge Should Not Be Gated – 一般
24. [HN Front] Fast Software, the Best Software (2019) – 系统架构
25. [HN Front] Reducing Assumptions, Exploding Your Code – 开源/工程
26. [InfoQ AI] 苹果首次将私有云计算平台扩展至谷歌云 – 产品/创业（云服务）
27. [InfoQ AI] Claude Code 80%的提示词说删就删，Anthropic用Fable 5打了个样：AI行业的“降本”才刚刚开始 – AI工程（Fable）
28. [InfoQ AI] Agent 上岗之后，企业如何治理硅基团队？ – 产品/创业（AI治理）
29. [InfoQ AI] 从 Coding 到 Anything，Agent 正在重写工作流 – AI工程
30. [InfoQ AI] 拒绝天价账单！OpenAI、Anthropic 自研芯片，剑指英伟达“暴利”护城河 – 产品/创业（硬件）
31. [InfoQ AI] 大晓机器人首席科学家陶大程：世界模型的使命不是完整复制世界，而是精准支撑行动 – 产品/创业（AI）
32. [InfoQ AI] 从生成到交付，音视频 Agent 要有生产级开发套件 – AI工程
33. [InfoQ AI] Java 实时系统扩容：事件驱动设计的隐性权衡 – 系统架构
34. [InfoQ AI] 一人公司创业，如何找对方法论、选准装备库？ – 产品/创业
35. [InfoQ AI] 用户太蠢不配用 Fable？被Anthropic的回应气笑了：最贵的模型，最憋屈的体验 – AI工程（Fable）
36. [MIT Tech Review] A device that revives eyeballs from dead donors could make eye transplants possible – 医疗，不相关
37. [MIT Tech Review] The Download: a smoking “endgame” and a new Elizabeth Bear story – 一般
38. [MIT Tech Review] The UK’s generational tobacco ban might not work. I’m supporting it anyway. – 政策，不相关
39. [MIT Tech Review] Achieving operational excellence with AI – AI工程
40. [MIT Tech Review] Teaching AI to run with the turbines – AI工程
41. [MIT Tech Review] The Download: a startup has a solution for AI’s groupthink problem – 产品/创业
42. [MIT Tech Review] Why California’s carbon manure math doesn’t add up – 环境，不相关
43. [MIT Tech Review] LLMs are stuck in a groupthink groove. This startup is trying to get them out. – 产品/创业（AI）
44. [36Kr AI] 硬氪首发 | 港大教授成立的忆生科技获数亿天使轮融资，致力于为机器人造一套记忆系统 – 产品/创业（AI）
45. [36Kr AI] 硬氪首发 | 清华车辆学院师兄弟创业具身智能，已完成数亿元天使融资，将落地汽车产业 – 产品/创业（具身智能）
46. [36Kr AI] 硬氪首发 | 小米前高管唐沐创业咖啡机器人，完成数亿