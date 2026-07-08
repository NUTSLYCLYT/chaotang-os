# 下一步执行清单（2026-06-04）

> 诚实原则：本机 **docker 未起 + pip 网络被墙 + 远程是 gitee 非 github + 蜂群不走 Anthropic SDK**，
> 故 10 个工具里约 7 个无法在此机器安装——不是不做，是物理装不了，假装装好=自欺。
> 标 **[你]** 的需你在有 docker/网络/账号的机器执行；标 **[我]** 的我能在本仓库直接做。

## ⭐ 满分的真定义

满分 ≠ 装了 10 个工具。满分 = **证伪账本里有真血、且表因被现实打脸而改对过**。
其余工具都是为这个闭环服务的仪表盘。先通数据管道，再谈仪表盘。

---

## A. 真血闭环（最高优先，决定生死）

### A1. [你] 对接 IMA，把真实数据接进来
你说"数据都在 IMA 里"。接好后第一件事不是高兴，是**按 `下方 A2` 审它是不是真血**。
（现状：repo 内 IMA 很薄——battery_prices.yaml + chroma_db + 2 篇文档，无规模化失效/结局数据。）

### A2. [我，IMA 接好后执行] 真血审计 + 回填
我会写/跑 `scripts/ima_audit.py`：把 IMA 记录分拣为 真血/二手/营销，数出"真血记录数"，
列出能直接 `param_ledger.py settle` 的条目。阈值（大神定）：
- ≥30 条真血 → 通了，回填账本 + 跑 unknown_heatmap 找缺口
- 5–30 → 起步，建持续回流机制
- <5 → 管道没通，**停止建工具**，先解决"数据怎么流进来"

> 退出线：接入真实项目后 3 个月内真实 settle ≤5 → 判定管道未通。

---

## B. 工具安装（按优先级；命令可直接复制）

### B1. [你] 成本可见（最快见效）
- Claude Code 本体：`claude credits status` 看计费制；platform.claude.com 升级/申请 Programmatic Credits。
- 注意：**这是你 CC 账号的账，不是本 repo 的**（本 repo 走 deepseek/minimax，成本在 deepseek 后台看）。

### B2. [我] 本地成本/Token 遥测（适配本 repo 的 litellm 栈，离线可做）
在 `src/model_adapter.py` 的 call() 加 best-effort 记账：每次调用写
`traces/llm_cost.jsonl`（provider/model/in_tokens/out_tokens/latency/est_cost）。
→ 这样能回答"哪个蜂群/哪步最吃钱"，不依赖任何外部服务。**等你说"做"我就加（核心文件，改完跑测试验证）。**

### B3. [你] Agent 可观测（需账号/docker）
- Langfuse（开源自部署）：需 docker → `docker run langfuse/langfuse`；或用云版注册拿 key。
- Braintrust：注册拿 API key，SDK 埋 OpenTelemetry span。

### B4. [你] 本地模型路由网关（省钱 30-70%）
- Claude Code Router：`npm i -g @musistudio/claude-code-router`（需联网）；
  `ANTHROPIC_BASE_URL=http://127.0.0.1:3456`。简单任务路由到便宜模型。

### B5. [你] 语义代码检索
- grepai MCP：按官方仓库 `npm i` + 配进 `~/.claude` 的 mcpServers（需联网 + 首次索引）。

### B6. [你] eval 框架
- `git clone https://github.com/TribeAI/claude-evals`（需联网）；写 30-50 golden case。
  ——但你**本项目已经有更适配的 eval**：`opc_constraint_check.py` + `opc_golden.yaml`。先把这个喂真血，比装通用框架更对。

### B7. [你] 安全扫描
- gitee 无 GitHub Action。替代：本地跑 `bandit -r src/`（pip 通了之后）或迁 CI。
  ——你已有 `security-reviewer` agent，够用到有真问题再说。

### B8–B10. [你/可选] Sentry 错误追踪、Conductor 编排面板、Cache 命中面板
均需外部服务/docker/Anthropic SDK，对本 repo 优先级低，等数据闭环通了再回头。

---

## C. 一句话

**别再装仪表盘了，先接 IMA 通真血**。A1 是你这周唯一该做的事；
A1 一通，A2 我立刻执行（真血审计+回填），那才是这套系统第一次"出生"。
B 部分的工具，等你在有网络/docker 的机器上、且数据闭环已通时，照命令装即可——
在那之前装它们，是给一台没燃料的飞轮镶金边。
