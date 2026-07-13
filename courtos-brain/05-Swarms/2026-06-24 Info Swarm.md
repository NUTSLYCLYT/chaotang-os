首先，我需要理解任务：作为信息策展员，我有86条技术资讯，要按AI工程、系统架构、产品/创业、开源项目4类筛选。选出最有信号的12条（去重、跳过明显标题党），每条用一句话概括"为什么值得5秒注意"，按类目分组加emoji标头。

先快速浏览所有资讯，识别类目：

- **AI工程**：涉及AI模型、算法、训练、推理等。例如arxiv论文、AI框架、系统。
- **系统架构**：系统设计、基础设施、网络、云服务等。
- **产品/创业**：公司产品、创业公司、市场动态。
- **开源项目**：开源工具、库、框架。

我需要跳过明显标题党：比如那些明显是软文、不相关、或标题夸张的。例如：
- 资讯5：关于致命真菌感染猫和人，这属于健康/科学，不是技术资讯，跳过。
- 资讯10：Raspberry Pi Pico W作为USB Wi-Fi适配器，可能属于硬件，但标题党？需要判断。
- 资讯22：Neuro-Symbolic Drive，属于AI工程。
- 资讯24：Safe and Generalizable Hierarchical Multi-Agent RL，AI工程。
- 资讯50-57：InfoQ AI的中文文章，可能属于产品/创业或开源。
- 资讯60-63：MIT Tech Review的新闻，可能属于系统架构或AI工程。
- 资讯72-79：36Kr AI的新闻，可能属于产品/创业。

去重：确保每条资讯只算一次。例如，多个资讯可能指向同一个事件。

选出12条最有信号的：

1. 优先选近期、有深度、实用性强的。
2. 跳过标题党：比如"Everyone Is Wrong About AI Except Me"（资讯3）可能标题党，因为太主观；"Founding a company in Germany"（资讯1）可能太具体，不通用。
3. 信号强：能影响开发者、企业决策的。

列出潜在候选：

- **AI工程**：
  - 资讯11-28：arxiv论文，如"Systematic Exploration of 4-Expert Heterogeneous Mixture-of-Experts"（11），"Weight-Space Geometry of Offline Reasoning Training"（12），"A Survey on Federated Causal Discovery"（13）等。这些是高质量研究，信号强。
  - 资讯21：RIFT-Bench: Dynamic Red-teaming For Agentic AI Systems（AI安全）
  - 资讯22：Neuro-Symbolic Drive（AI模型）
  - 资讯23：Critique of Agent Model（AI代理）
  - 资讯24：Safe and Generalizable Hierarchical Multi-Agent RL（多智能体）
  - 资讯25：Reinforcement Learning Towards Broadly and Persistently Beneficial Models（AI对齐）
  - 资讯26：Can Language Model Agents be Helpful Circuit Explainers（可解释性）
  - 资讯27：Breaking the Filter Bubble（推荐系统）
  - 资讯28：Ensemble Feature Selection for Mental Health（应用）

- **系统架构**：
  - 资讯4：Minimus container images free（容器）
  - 资讯8：Bunny DNS free（DNS）
  - 资讯53：Spring 2.0发布（框架）
  - 资讯61：Web data infrastructure layer for AI（数据层）
  - 资讯62：Solar-powered platform for internet（硬件）
  - 资讯76：微信AI助手（产品）

- **产品/创业**：
  - 资讯9：Ashby hiring（公司招聘）
  - 资讯50：为什么大量企业Agent死在原型阶段（亚马逊云科技）
  - 资讯51：Anthropic解释Claude执行框架
  - 资讯52：ArrowJS 1.0发布（UI框架）
  - 资讯55：蚂蚁集团副总裁出席AICon
  - 资讯56：ElastiCache for Valkey持久化存储
  - 资讯72：仙工智能上市（港股）
  - 资讯77：临界点完成融资（灵巧手）
  - 资讯80-81：中概股和美股盘前

- **开源项目**：
  - 资讯6：Haystack: Open-Source AI Framework for Production Ready Agents（开源）
  - 资讯7：Too many R packages（R语言）
  - 资讯10：Raspberry Pi Pico W（硬件开源）
  - 资讯52：ArrowJS 1.0（开源UI框架）

跳过明显标题党：
- 资讯1：Founding a company in Germany – too specific, not broad signal.
- 资讯2：Reid Hoffman on SpaceX – opinion piece, not technical signal.
- 资讯3：Everyone Is Wrong About AI Except Me – subjective, likely title party.
- 资讯4：Minimus container images free – good, but might be too minor.
- 资讯5：Deadly fungus – health issue, not tech.
- 资讯6：Haystack – strong signal for AI engineering.
- 资讯7：Too many R packages – R语言，可能属于开源，但信号弱。
- 资讯8：Bunny DNS free – good for system architecture.
- 资讯9：Ashby hiring – product/创业.
- 资讯10：Raspberry Pi Pico W – hardware, might be too niche.
- 资讯11-28: arxiv papers – high signal.
- 资讯22-28: AI engineering.
- 资讯50-57: InfoQ AI – product/创业.
- 资讯60-63: MIT Tech Review – system/architecture.
- 资讯72-79: 36Kr AI – product/创业.

目标12条：我需要选12条，去重。

计划选：
1. AI工程：6条（从arxiv和关键产品）
2. 系统架构：3条
3. 产品/创业：2条
4. 开源：1条

但要确保总12条。

列出12条最有信号的：

1. [arxiv cs.LG] Systematic Exploration of 4-Expert Heterogeneous Mixture-of-Experts (11) – AI工程
2. [arxiv cs.L