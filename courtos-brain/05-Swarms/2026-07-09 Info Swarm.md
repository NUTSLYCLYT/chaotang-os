首先，我需要理解任务：作为信息策展员，从91条技术资讯中选出最有信号的12条（去重、跳过明显标题党），然后每条用一句话概括"为什么值得5秒注意"，最后按类目分组（AI工程、系统架构、产品/创业、开源项目）加emoji标头。输出要直接是Markdown，不超过800字。

先快速浏览所有资讯，识别类目：
- AI工程：涉及AI模型、算法、系统等
- 系统架构：基础设施、云、分布式系统等
- 产品/创业：新公司、产品、市场动态
- 开源项目：开源工具、库、框架

我需要跳过明显标题党（比如太夸张、无实质内容的），去重（如果有重复条目）。

列出所有资讯的标题和简要内容（从提供的信息中提取）：

1. [HN Best] My Thoughts on the Bun Rust Rewrite → Bun是Rust框架，重写
2. [HN Best] I think I have LLM burnout → LLM burnout，可能标题党？有点主观
3. [HN Best] John Deere owners will get the right to repair equipment under FTC settlement → 修设备权利，FTC和解
4. [HN Best] Rewriting Bun in Rust → Bun重写为Rust
5. [HN Best] FAANG Simulator → 模拟FAANG公司
6. [HN Best] Cloudflare Drop → Cloudflare新服务
7. [HN Best] Grok 4.5 → OpenAI的Grok模型
8. [HN Best] Show HN: Microsoft releases Flint, a visualization language for AI agents → Microsoft的Flint语言
9. [HN Best] GPT‑Live → OpenAI的GPT Live
10. [HN Best] EU now one step away from reviving private message scanning rules → EU隐私规则
11. [HN Best] TypeScript 7 → TypeScript新版本
12. [HN Best] Chatto is now open source → Chatto开源
13. [HN Best] Mistral's Robostral Navigate: a state of the art robotics navigation model → Mistral的机器人导航模型
14. [HN Best] Decoding the obfuscated bash script on a Uniqlo t-shirt → Uniqlo T恤脚本
15. [HN Best] GitLost: We Tricked GitHub's AI Agent into Leaking Private Repos → GitHub AI泄露私有仓库
16. [arxiv cs.LG] TriRoute: Unified Learned Routing for Joint Adaptive Attention, Experts, and KV-Cache Allocation → 机器学习路由
17. [arxiv cs.LG] A Quiet Failure in Calibrated Virtual Screening → 药物发现
18. [arxiv cs.LG] NEST: Tackling Dataset-Level Distribution Shifts → 数据集分布偏移
19. [arxiv cs.LG] D2PO: Optimizing Diffusion Samplers via Dynamic Preference → 扩散采样优化
20. [arxiv cs.LG] Deep Reinforcement Learning for Reliability Based Bi-Objective Portfolio Optimization → 金融优化
21. [arxiv cs.LG] STAGformer: A Spatio-temporal Agent Graph Transformer → 微移动需求预测
22. [arxiv cs.LG] WHERE to Generate Matters: Budget-Aware Synthetic Augmentation → 联邦学习
23. [arxiv cs.LG] Inertia-1: An Open Exploration of Wearable Motion Foundation Models → 可穿戴运动模型
24. [arxiv cs.LG] Fingerprint, Not Blueprint: How Positional Schemes Set the Default Spectral Algebra of Attention → 注意力机制
25. [arxiv cs.LG] LLM-Guided Task-Semantic Field Factorization for Industrial Process Forecasting → 工业过程预测
26. [arxiv cs.AI] AgentLens: Production-Assessed Trajectory Reviews for Coding Agent Evaluation → 代码代理评估
27. [arxiv cs.AI] When Does In-Context Search Help? A Sampling-Complexity Theory of Reflection-Driven Reasoning → 代理推理
28. [arxiv cs.AI] LLM-powered reasoning in agent-based modeling → 代理建模
29. [arxiv cs.AI] QANTIS: Hardware-Calibrated Sequential POMDP Belief Updates on IBM Heron → 量子处理器
30. [arxiv cs.AI] Cost-Effective Agent Harnesses for Abstract Reasoning and Generalization on ARC-AGI-1 → 代理能力
31. [arxiv cs.AI] Evaluating SageMath-Augmented LLM Agents for Computational and Experimental Mathematics → 数学代理
32. [arxiv cs.AI] The Harness Effect: How Orchestration Design Sets the Token Economics of Enterprise Agentic AI → 企业代理经济
33. [arxiv cs.AI] Grounding Spatial Relations in a Compact World Model → 世界模型
34. [arxiv cs.AI] Large Behavior Model: A Promptable Digital Twin of the Retail Customer → 顾客行为模型
35. [arxiv cs.AI] Learning social norms enhances compatibility in dynamic human-AI coordination → 人机协调
36. [arxiv cs.CL] Audio Sentiment Analysis via Distillation and Cross-Modal Integration → 音频情感分析
37. [arxiv cs.CL] Healthier LLMs: Retrieval-Augmented Generation for Public Health Question Answering → 医疗问答
38. [arxiv cs.CL] Ad Headline Generation using Self-Critical Masked Language Model → 广告标题
39. [arxiv cs.CL] Gradient-Based Speech-to-Text Alignment for Any ASR Model → 语音转文本
40. [arxiv cs.CL] LLMs Silently Correct African American English → 非洲裔英语偏见
41. [arxiv cs.CL] Comprehensive Evaluation of Large Language Model Responses → LLM响应评估
42. [arxiv cs.CL] MILES: Modular Instruction Memory with Learnable Selection → 代理记忆
43. [arxiv cs.CL] Riemannian Geometry for Pre-trained Language Model Embeddings → 语言模型嵌入
44. [arxiv cs.CL] Behavior Leverage Imbalance in Multi-Teacher On-Policy Distillation → 代理行为
45. [arxiv cs.CL] From Text to Parameters: Predicting Item Parameters from Embedding Regularization → 项目参数
46. [arxiv cs.CV] Pixel-Precise Explainable Stress Indexing: A Semantic Segmentation Framework for Disease Severity Quantification → 农作物疾病
47. [arxiv cs.CV] CoFINN: Conservation Flux Informed Neural Networks for Physics Problems → 物理问题
48. [arxiv cs.CV] AI for Cultural Heritage Textiles: Fine-Tuned Latent Diffusion for Novel Ulos Motif Synthesis → 文化遗产