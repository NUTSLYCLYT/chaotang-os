首先，我需要理解任务：作为信息策展员，我有101条技术资讯，要按4类筛选：AI工程、系统架构、产品/创业、开源项目。选出最有信号的12条（去重、跳过明显标题党），每条用一句话概括"为什么值得5秒注意"，然后按类目分组加emoji标头。输出是Markdown格式，总长≤800字。

先快速扫描所有资讯，识别类目：

- **AI工程**：涉及AI模型、算法、训练等。例如：arxiv论文、AI工具、模型发布等。
- **系统架构**：系统设计、基础设施、部署等。例如：分布式系统、云架构、边缘计算。
- **产品/创业**：新公司、产品、创业公司动态等。
- **开源项目**：开源工具、库、框架等。

我需要去重：检查是否有重复条目。从列表看，大部分是唯一的，但有些可能标题党（明显不相关或夸张）。

跳过明显标题党：例如，第10条"Should DayQuil Be Legal?"（关于日咳药的法律问题），第19条"Better way to tie gym shorts"（视频），第24条"Microsoft Can Track Users via Windows Device ID"（可能标题党，但内容是新闻），第36kr AI的条目可能有标题党。任务说"跳过明显标题党"，所以我要过滤掉那些不相关的、太泛的、或明显是软文的。

先列出所有101条，但只关注有信号的。

**步骤1: 识别最有信号的12条**

我将快速分类：

- **AI工程**：条目25-56（arxiv cs.LG, cs.AI, cs.CL, cs.CV），还有InfoQ AI的条目（如68,72等），MIT Tech Review的（74,75）。
- **系统架构**：条目75（MIT Tech Review），还有系统相关（如26,27等）。
- **产品/创业**：条目82-97（36Kr AI的条目），还有公司新闻。
- **开源项目**：条目6,9,12,26（CoMaps, OfficeCLI, 等），还有arxiv的开源相关。

具体筛选：

1. **跳过明显标题党**：
   - 第1条：How to sequence your own DNA at home – 可能太泛，不是AI相关。
   - 第10条：Should DayQuil Be Legal? – 无关AI。
   - 第19条：A better way to tie your gym shorts – 无关。
   - 第24条：Microsoft Can Track Users via Windows Device ID – 有新闻价值，但可能标题党？内容是具体新闻。
   - 第36Kr AI的条目：有些是市场新闻，如第82-97，可能标题党（如"瑞为技术暗盘破发"是股票新闻）。
   - 第101条：Import AI 460 – 但Import AI是订阅，可能有信号。
   - 任务说"跳过明显标题党"，所以我应该避免那些明显不相关的。

2. **选出12条最有信号**：基于AI工程、系统架构、产品/创业、开源项目四类。

从列表中，我选：

- **AI工程**（高信号）：
  - 27: arxiv cs.LG – Time series foundation models for electricity price forecasting (实用)
  - 28: arxiv cs.LG – QuantFlow for time-series forecasting (开源？)
  - 34: arxiv cs.LG – Weighted Conformal Prediction for EV motorsport (具体应用)
  - 35: arxiv cs.LG – Out-of-distribution generalization of risk aversion in LLMs (安全相关)
  - 40: arxiv cs.AI – SwarmResearch for coding agents (AI agent)
  - 43: arxiv cs.AI – Oyster-II for safety alignment (关键)
  - 50: arxiv cs.CL – Gemma 4 technical report (开源模型)
  - 52: arxiv cs.CL – Jointly improving dialect identification (多语言)
  - 53: arxiv cs.CL – PraMem for behavior prediction (长时序)
  - 54: arxiv cs.CL – LLMs in CBT-guided affective reasoning (医疗)
  - 55: arxiv cs.CL – Distill where the student goes (RAG)
  - 68: InfoQ AI – 智谱GLM-5.2上线 (开源模型)
  - 72: InfoQ AI – FinOps Agent for cost analysis (Azure)

- **系统架构**：
  - 75: MIT Tech Review – Foundational elements of AI architecture (IT leaders)
  - 26: Show HN – Fast Mac file manager (系统工具)
  - 74: MIT Tech Review – Your stake in OpenAI (但可能不直接系统架构)

- **产品/创业**：
  - 82-97: 36Kr AI条目（如瑞为技术上市、易控智驾）
  - 89: "龙虾" OpenClaw登顶GitHub (AI Agent)
  - 90: 前大疆员工做纺织机 (硬件创业)
  - 91: 华源智因获融资 (AI医疗)
  - 92: 行云科技业绩 (AI公司)

- **开源项目**：
  - 6: CoMaps – FOSS Offline Maps (开源)
  - 9: OfficeCLI – Office suite for AI agents (开源)
  - 26: Show HN – Mac file manager (开源)
  - 68: 智谱GLM-5.2 (开源模型)

我需要12条总。去重：确保唯一。

**精选12条**（去重后）：

1. **AI工程**:
   - 27: Time series foundation models for electricity price forecasting (arxiv)
   - 28: QuantFlow for time-series forecasting (arxiv)
   - 34: Weighted Conformal Prediction for EV motorsport (arxiv)
   - 35: Risk aversion in LLMs (arxiv) – safety
   - 40: SwarmResearch for coding agents (arxiv)
   - 43: Oyster-II for safety alignment (arxiv) – critical
   - 50: Gemma 4 technical report (arxiv) – open-weight model
   - 53: PraMem for behavior prediction (arxiv) – long-horizon
   - 54: LLMs in CBT (arxiv) – medical
   - 55: Distill