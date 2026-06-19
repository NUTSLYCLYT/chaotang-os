首先，我需要理解任务：作为信息策展员，从86条技术资讯中选出最有信号的12条（去重、跳过明显标题党），按AI工程、系统架构、产品/创业、开源项目4类筛选。然后每条用一句话概括"为什么值得5秒注意"，按类目分组加emoji标头。

先快速浏览所有资讯，识别类目：

- AI工程：涉及AI模型、算法、训练、部署等
- 系统架构：系统设计、基础设施、云服务等
- 产品/创业：新公司、产品发布、创业动态
- 开源项目：开源工具、框架、库等

我需要跳过明显标题党（比如新闻、非技术内容、重复、明显虚假标题）。去重：确保每条资讯只算一次。

列出所有资讯，标记类目：

1. [HN Front] VoidZero Is Joining Cloudflare → 云服务，系统架构？ (Cloudflare是CDN)
2. [HN Front] Ask HN: So what happened to Facebook "localhost" tracking? → 问题讨论，可能系统架构
3. [HN Front] AccessOwl (YC S22) is hiring an AI TypeScript Engineer → 产品/创业（AccessOwl是SaaS工具）
4. [HN Front] French-Iranian author Marjane Satrapi, author of 'Persepolis', dies at 56 → 无关，跳过
5. [HN Front] When su replaced login for becoming another Unix login → 系统架构（Unix）
6. [HN Front] Ian's Secure Shoelace Knot → 无关，跳过
7. [HN Front] Gaussian Point Splatting → AI/ML（图形学）
8. [HN Front] Show HN: Uruky (EU-based Kagi alternative) now has Image Search and URL Rewrites → 产品/创业（Uruky是工具）
9. [HN Front] UK media fails to disclose defence sector links in nearly 60% of cases → 无关，跳过
10. [HN Front] I built a vulnerable app and spent $1,500 seeing if LLMs could hack it → AI工程（安全测试）
11. [arxiv cs.LG] Early Detection of Alzheimer's Disease Using Explainable Machine Learning → AI工程（医疗AI）
12. [arxiv cs.LG] Novel Aspects of IEEE SA P3109 Arithmetic Formats for Machine Learning → AI工程（硬件）
13. [arxiv cs.LG] Position: Deployed Reinforcement Learning should be Continual → AI工程（RL）
14. [arxiv cs.LG] Pseudospectral Bounds for Transient Amplification in Coupled Gradient Descent → AI工程（优化）
15. [arxiv cs.LG] Do Transformers Need Three Projections? Systematic Study of QKV Variants → AI工程（Transformer）
16. [arxiv cs.LG] Inverse Critical Experiment Design via Gradient Optimization → AI工程（核反应堆？）
17. [arxiv cs.LG] Self-Distilled Policy Gradient → AI工程（RL）
18. [arxiv cs.LG] Bayes-Sufficient Representations in Supervised Learning → AI工程（机器学习）
19. [arxiv cs.LG] Unlocking Feature Learning in Gated Delta Networks at Scale → AI工程（LLM）
20. [arxiv cs.LG] LiftQuant: Continuous Bit-Width LLM via Dimensional Lifting → AI工程（量化）
21. [arxiv cs.AI] Toward Pre-Deployment Assurance for Enterprise AI Agents → AI工程（AI安全）
22. [arxiv cs.AI] Stumbling Into AI Emotional Dependence → AI工程（AI心理）
23. [arxiv cs.AI] Thinking Through Signs: PEEL as a Semiotic Scaffolding → AI工程（AI研究）
24. [arxiv cs.AI] SMAC-Talk: A Natural Language Extension of the StarCraft Multi-Agent Challenge → AI工程（多智能体）
25. [arxiv cs.AI] Consensus is Strategically Insufficient → AI工程（多智能体）
26. [arxiv cs.AI] VAMPS: Visual-Assisted Mathematical Problem Solving Benchmark → AI工程（数学问题）
27. [arxiv cs.AI] StepPRM-RTL: Stepwise Process-Reward Guided LLM Fine-Tuning → AI工程（硬件设计）
28. [arxiv cs.AI] Can Generalist Agents Automate Data Curation? → AI工程（数据）
29. [arxiv cs.AI] Characterizing initial human-AI proof formalization workflows → AI工程（证明）
30. [arxiv cs.AI] The Saturation Trap and the Subjectivity of Intervention Timing → AI工程（安全）
31. [arxiv cs.CL] POLARIS: Guiding Small Models to Write Long Stories → AI工程（NLP）
32. [arxiv cs.CL] Discourse-Role Labels as Presentation-Time Variables → AI工程（语言模型）
33. [arxiv cs.CL] Computational conceptual history of scientific concepts → AI工程（概念）
34. [arxiv cs.CL] SaliMory: Orchestrating Cognitive Memory for Conversational Agents → AI工程（对话）
35. [arxiv cs.CL] When Retrieval Doesn't Help: A Large-Scale Study of Biomedical RAG → AI工程（RAG）
36. [arxiv cs.CL] Expert-Aware Refusal Steering → AI工程（安全）
37. [arxiv cs.CL] A Systematic Analysis of Linguistic Features in AI-Generated Text Detection → AI工程（文本检测）
38. [arxiv cs.CL] ACAT: A Collaborative Platform for Efficient Aspect-Based Sentiment Dataset Annotation → AI工程（情感分析）
39. [arxiv cs.CL] Cross-Prompt Generalization in Detecting AI-Generated Fake News → AI工程（假新闻）
40. [arxiv cs.CL] MM-BizRAG: Rethinking Multimodal Retrieval-Augmented Generation → AI工程（RAG）
41. [arxiv cs.CV] Dive into the Scene: Breaking the Perceptual Bottleneck in Vision-Language Decision Making → AI工程（CV）
42. [arxiv cs.CV] Weakly Supervised Incremental Segmentation via Semantic Anchors → AI工程（CV）
43. [arxiv cs.CV] Intra-Modal Neighbors Never Lie: Rectifying Inter-Modal Noisy Correspondence → AI工程（CV）
44. [arxiv cs.CV] Optimal Transport Flow Matching by Design → AI工程（CV）
45. [arxiv cs.CV] When Seeing Is Not Believing -- A Benchmark for Search-Grounded Video Misinformation Detection → AI工程（CV）
46. [arxiv cs.CV] Reflection Separation from a Single Image via Joint Latent Diffusion → AI工程（CV）
47. [arxiv cs