# 朝堂 AI 员工系统 · 完整方案（2026-06-28）

> 北极星:**用户说一句话 → 拿到一份能用的真交付物 → 省一个初级岗**。
> 三句话定调:**抄架构不抄 skill · 1 引擎 × N 配置 · 先证一个再铺开**。
> 本方案 = 你的设想 + GitHub 实证资源 + 最前沿 agent 架构,合成"能照着盖"的图。

---

## 〇、最前沿理念地基（站在巨人肩上,不重新发明）

| 理念 | 来源 | 怎么用进朝堂 |
|---|---|---|
| **Building Effective Agents** | Anthropic(2024.12) | 朝堂 = **orchestrator-workers**(丞相派各司) + **evaluator-optimizer**(质门/接地校验循环)。多数环节用**确定性 workflow**,只在真需要时才放开 agent 自主——别一上来全自治。 |
| **12-Factor Agents** | HumanLayer(GitHub ~9k★) | 拥有你的 prompt、拥有你的上下文窗口、**工具=结构化输出**、拥有控制流、**小而专的 agent**、**human-in-loop 是一等公民**、错误紧凑可恢复。逐条对照建司。 |
| **Context Engineering > Prompt Engineering** | 2025 共识 | 司的质量在"喂进去什么真数据+规则",不在 prompt 辞藻。SSOT(本仓已有 contracts/reality-state)就是上下文地基。 |
| **Eval-Driven Development** | Anthropic/前沿 | 司的进步靠 eval,不靠感觉。本仓已有 `core/courtos/evals` + eval-harness skill,做实它。 |
| **Tools 是最大杠杆** | Anthropic《Writing tools for agents》 | 工具设计比 prompt 重要。有界、声明式、带 schema、错误信息对 agent 友好。 |
| **Earned Autonomy** | 安全前沿 | 自治是挣来的:全程人确认 → 攒出 outcome 兑现记录 → 才逐级抬 L0→L4。 |
| **Artifact-centric** | 前沿产品观 | 交付物(报告/文件)是产品,不是聊天。Agent 产 work product,不是 message。 |

---

## 一、技术栈选型（GitHub 实证 · 每个都说为什么）

### 1. Agent 引擎 → **Vercel AI SDK `ai`**（~25k★）抽两个原语,塞进现有 orchestrator
- 用 `tool()`(Zod schema 有界工具) + `stopWhen`(`stepCountIs`/`hasToolCall` 封顶 agent loop) + `prepareStep`(步间换模型/工具)。
- LiteLLM 接法:`createOpenAICompatible({ baseURL:'http://localhost:4444' })` → 你现有 callLLM/Claude 不变。
- **为什么不全家桶**:Mastra(~25k★,有 suspend/resume)、LangGraph.js(JS 落后 Python)、Claude Agent SDK(是写代码的 harness + 有 LiteLLM 绕过 bug,形状不对)——引入全家桶 = 第二 runtime,撞铁律9。**只抽原语,HITL/持久化继续用自己的。** Mastra 当"设计参考"读它 suspend/resume,不 import。
- 仓内现状:`callLLM`(router) + `decision-loop` + `agent-harness` 已是雏形,AI SDK 只补"标准化的有界工具循环"。

### 2. 人工确认 + 持久化 → **现有 gate.ts(策略) + 先 30 行 Turso,崩了再上 Restate**
- 策略 SoT 已有:`features/governance/lib/gate.ts`(L0-L4 + blast-radius)。**不引框架重造 gate。**
- 缺的只是**"挂起→重启存活→几天后人解锁→继续"的持久等待**。
- **先 30 行**:Turso 建 `approvals(id,status,resume_token,created_at)` + `awaitApproval(id)` 包装,跑通真闭环。
- **崩了再上 Restate**(`restatedev/restate`,单二进制自托管,awakeable 专为人工审批)——**盒子交付选它**,不选 Inngest(不能自托管)/Temporal(过重集群)。
- **位置**:碰真实资产的审批等待**放后端 jiqun :8081**(铁律9),审计落现有 `tasks`/archive,不建第二台账。

### 3. 真数据源 / 工具 → 每司一个真源,净新增密钥仅 1 个（Exa）
| 司 | 接什么 | 仓库/来源 | 成本 |
|---|---|---|---|
| **户部** 估值 | Yahoo Finance MCP | `Alex2Yang97/yahoo-finance-mcp` | $0 无需密钥 |
| **锦衣卫+兵部** 情报/竞品 | **Firecrawl(本环境已装)** | `firecrawl/firecrawl-mcp-server` | 已有 |
| **钦天监** 研究/预测 | Exa MCP | `exa-labs/exa-mcp-server` | 1k 次/月免费 |
| **礼部** 营销 | Buffer MCP(**只草稿/排期,过确认门**) | 官方 Buffer MCP | 免费档 |
| **全司→交付物** | `docx` + `pdf-lib`(或内置 docx/pdf Skill) | `dolanmiu/docx`·`Hopding/pdf-lib` | $0 纯 TS |
- **统一包 `SourceAdapter`**:每个数据源强制带 `sourceLabel`(LIVE/FALLBACK)+ 缓存计数 → 换 API 只动一处,且飞轮能审计"这条结论真数据从哪来"(落铁律2)。
- 红线:**Financial Datasets 是付费**别当免费;**Bing Search API 已死(2025-08)**别用;**礼部发布是单向门**必过人工门、token 仅 env。
- MCP 接法:后端 jiqun 用 MCP-over-stdio 自然;前端 BFF 可直连底层 REST。

---

## 二、架构:1 引擎 × N 配置（落"配置化司"）

```
runtime 引擎 execute(司配置, 任务):
  ① Agent Loop(AI SDK tool()+stopWhen)  收集上下文(SSOT规则+SourceAdapter真数据+记忆)→LLM→调工具→质门校验→封顶
  ② 有界工具集(声明式·Zod schema)        户部=[读财报,生成报告.pdf]·禁[付款];礼部=[读社媒,生成,排期草稿]·禁[直发]
  ③ 堆叠权限门(代码里·非prompt)          工具级+动作级(高风险?)+人确认级(gate.ts L0-L4)+审计
  ④ SSOT 上下文                          contracts/reality-state/primary-store,各司import,禁平行表
  ⑤ 子agent fan-out(会审)                丞相派各司并行→evaluator-optimizer 合议出奏折
  ⑥ SourceAdapter + sourceLabel          真数据带LIVE标,缺数据标灰,禁假冒
  ⑦ 交付物层(docx/pdf-lib)               输出=可下载report,不是聊天气泡
  ⑧ outcome兑现回填(史馆)                事后回填"判断对没对"→自学习飞轮+可信度加权

司 = 配置:{ 人设prompt, SourceAdapter数据源, 允许工具集, 输出schema, 自治等级 }
11司 = 1引擎 × 11配置(7强配填真源 / 2半配待数据 / 2弱配冻结)
```

---

## 三、落地路线图（先证一个,再铺开;每阶段有出口判据）

### Phase 0 · 地基（必须先,否则后面全空转）
- 修登录(prod next-server→后端 fetch 根因)+ 验一个真用户走通 ①上书房→⑧史馆 一圈。
- **出口**:真账号登入、走完闭环、史馆有这一圈记录。**没这步,Phase 1 没人能用。**

### Phase 1 · 可行性实验:户部 L2（一个司证明整盘）
- 抽 `execute(司配置)` 引擎(AI SDK tool loop + 现有 gate/SSOT/ledger 组装)。
- 建 2 工具:`SourceAdapter.读财报`(先 Turso,后 yfinance MCP)、`生成估值报告.pdf`(pdf-lib)。
- 户部产**第一份可下载真估值报告**(L1 人确认),找**一个真老板**用一次。
- **出口**(可行性三数):①他敢拿去做真决策吗 ②交付物改了多少 ③几天后判断兑现没。**这三数决定整个愿景可不可行。**

### Phase 2 · 接真源 + 复刻 7 强配司
- 做实 `SourceAdapter`(sourceLabel + 缓存)。接 yfinance/Firecrawl/Exa。
- 7 强配司各写一份配置(户/工/刑/锦衣卫/兵/丞相/礼部),复用引擎。2 半配待源、2 弱配明灰。

### Phase 3 · 持久审批 + 礼部发布(gated) + earned autonomy
- 30 行 Turso approvals 跑通"挂起→存活→解锁→继续"(后端 jiqun)。崩了上 Restate。
- 礼部 Buffer 草稿→人确认→排期(单向门全程 gated)。
- 按 outcome 记录逐级抬司的自治等级。

### Phase 4 · eval 飞轮 + outcome 兑现
- 做实 `core/courtos/evals`,每司一套 eval。史馆回填兑现,喂可信度加权,飞轮转起来。

---

## 四、红线（违反=回到玄学/不安全）
1. **抄架构不抄 skill**:Claude skill 带不进 app(官方确认),建运行态 capability=提示+工具束,不是 .md。
2. **权限 gate 在代码,不在 prompt**:别指望 LLM"小心"写主表/付款/发布。
3. **守铁律9**:碰真实产线资产转后端 jiqun,前端只做无副作用咨询。别在前端建第二 runtime/第二奏折。
4. **守铁律2/sourceLabel**:每个真数据经 SourceAdapter 带来源标,禁假冒 LIVE。
5. **先证一个**:别 11 司齐铺。户部 L2 一个真用户证言 > 11 个半成品。

---

## 五、一句话
**"替代员工"= 用 Vercel AI SDK 抽个有界工具循环、套上你已有的 gate/SSOT/ledger、给每个司接一个真数据源(净增 1 个密钥)、产出可下载交付物、按 Building-Effective-Agents 的 orchestrator-workers 编排——先用户部证明一个真用户愿意用,再复刻。** 工程,不是玄学。
