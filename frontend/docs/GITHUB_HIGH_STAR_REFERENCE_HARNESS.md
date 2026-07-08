# GitHub 高星项目参考 Harness

> 目的：下载并研究高星 AI 工作流 / 多智能体 / AI 应用平台项目，为朝堂 OS 的 2026 最佳产品目标服务。
> 下载目录：`/home/ubuntu/workspace/github-reference-repos`
> 原则：只借鉴产品结构、架构边界、交互模式、验收方法，不复制代码。

## 1. 本轮已下载项目

| 项目 | 本地目录 | 朝堂 OS 参考价值 |
|---|---|---|
| Dify | `/home/ubuntu/workspace/github-reference-repos/langgenius_dify` | AI 应用平台、Workflow、RAG、模型管理、LLMOps |
| Flowise | `/home/ubuntu/workspace/github-reference-repos/FlowiseAI_Flowise` | 可视化 Agent Flow、节点编排、组件市场 |
| LangGraph | `/home/ubuntu/workspace/github-reference-repos/langchain-ai_langgraph` | 长流程状态机、持久执行、人类介入、记忆 |
| CrewAI | `/home/ubuntu/workspace/github-reference-repos/crewAIInc_crewAI` | 角色化智能体团队、任务协作、Crew/Flow 分层 |
| AutoGen | `/home/ubuntu/workspace/github-reference-repos/microsoft_autogen` | 多智能体对话、协作协议、Agent runtime |
| OpenHands | `/home/ubuntu/workspace/github-reference-repos/All-Hands-AI_OpenHands` | AI Coding Agent、开发任务执行、评测与企业化 |
| Semantic Kernel | `/home/ubuntu/workspace/github-reference-repos/microsoft_semantic-kernel` | 插件、函数调用、企业编排、语义内核 |
| Open WebUI | `/home/ubuntu/workspace/github-reference-repos/open-webui_open-webui` | AI 工作台、用户/知识/模型体验 |
| AnythingLLM | `/home/ubuntu/workspace/github-reference-repos/Mintplex-Labs_anything-llm` | Workspace + RAG + 企业知识库 |
| n8n | `/home/ubuntu/workspace/github-reference-repos/n8n-io_n8n` | 工作流自动化参考；本轮网络中断，checkout 不完整，需重试 |

## 2. 当前核心目标审查

朝堂 OS 当前北极星不变：

```text
让老板每天知道：
今天该决策什么、
该投多少钱、
谁去执行、
何时验收、
结果如何复盘。
```

所以参考高星项目时，不看“功能多不多”，只看它们是否能加强这条主闭环：

```text
上书房建议
  -> 户部预算/ROI/风险
  -> 军机处立项执行
  -> 工部建设交付
  -> 史馆复盘归档
  -> 反哺上书房
```

## 3. 借鉴矩阵

### 3.1 Dify：AI 应用平台能力

Dify 的核心启发：

- Workflow 是一等对象。
- 应用、模型、工具、数据集、日志、监控分层清晰。
- 从原型到生产，需要观测、版本、调用日志、数据集和 API。

朝堂 OS 应吸收：

```text
1. 把“圣旨/任务/复盘”做成可观察的运行对象。
2. 每次下旨都留下输入、模型、工具、结果、成本、评分。
3. 上书房建议不是静态文案，而是基于历史运行数据生成。
4. 工部建设模板要有版本号和运行日志。
```

不要照搬：

```text
不要把朝堂 OS 做成通用 LLM App Builder。
我们要做经营操作系统，不是又一个 Dify。
```

### 3.2 Flowise：可视化 Agent Flow

Flowise 的核心启发：

- 节点化编排适合让用户理解“任务怎么跑”。
- Agent Flow 适合展示工具、模型、输入输出和路径。
- 组件市场可以降低扩展成本。

朝堂 OS 应吸收：

```text
1. 军机处可以展示“圣旨 -> 三省 -> 六部 -> 蜂群 -> 奏折”的节点图。
2. 工部建设其他部门时，可以生成 Workflow 图。
3. 每个节点要有状态：待命、运行、阻塞、完成、复盘。
```

不要照搬：

```text
不要让老板拖节点。
节点图给工部/开发者看，老板只看结论、风险和下一步。
```

### 3.3 LangGraph：长流程状态机

LangGraph 的核心启发：

- 长流程 Agent 必须有状态。
- 失败后可以恢复。
- Human-in-the-loop 是核心能力。
- Memory 分短期工作记忆和长期记忆。

朝堂 OS 应吸收：

```text
1. DepartmentBuildTask 状态机继续强化。
2. 军机处任务要支持暂停、恢复、返工、归档。
3. 上书房/军机处/史馆共享同一个 ExecutionCase。
4. 史馆长期记忆反哺上书房，军机处保留短期执行态。
```

建议下一步契约：

```ts
type ExecutionCaseStatus =
  | 'draft'
  | 'dispatched'
  | 'planning'
  | 'executing'
  | 'blocked'
  | 'reviewing'
  | 'report_ready'
  | 'archived';
```

### 3.4 CrewAI：角色化智能体团队

CrewAI 的核心启发：

- Agent 有角色、目标、背景、工具。
- Crew 负责任务协作。
- Flow 负责过程控制。

朝堂 OS 应吸收：

```text
1. Claude/Codex/次级模型/人工不是“窗口”，而是明确岗位。
2. 工部任务卡必须写清 ownerModel 和 responsibility。
3. 每个部门建设任务要有 Crew：产品、工程、预算、QA、复盘。
```

映射：

```text
CrewAI Agent  -> 朝堂大臣/工部岗位
CrewAI Task   -> 工部建设任务
CrewAI Flow   -> 军机处/工部 Workflow
CrewAI Result -> 史馆复盘档案
```

### 3.5 AutoGen：多智能体协作协议

AutoGen 的核心启发：

- 多智能体不是并发聊天，而是有协议的协作。
- 角色、消息、终止条件、工具调用需要被明确。

朝堂 OS 应吸收：

```text
1. 四窗口协作要有消息协议：输入、输出、禁止、验收。
2. 军机处需要终止条件：何时算完成，何时返工。
3. 史馆记录每次协作的结论和失败原因。
```

### 3.6 OpenHands：AI Coding Agent

OpenHands 的核心启发：

- AI Coding Agent 要有 CLI、GUI、SDK、企业版分层。
- 软件开发不是只写代码，还包括评测、权限、协作、审计。

朝堂 OS 应吸收：

```text
1. 工部是 AI Coding Agent 的产品化入口。
2. 每次开发任务要记录 diff、build、QA、风险和复盘。
3. 企业用户需要权限、审计、协作、任务分享。
```

对工部最重要：

```text
工部不只是展示部门，而是“AI 开发与交付中台”。
```

### 3.7 Semantic Kernel：插件与企业编排

Semantic Kernel 的核心启发：

- 插件/函数调用是企业系统集成的核心。
- 编排层不应绑定单一模型。
- 业务能力要以插件暴露。

朝堂 OS 应吸收：

```text
1. 户部预算、史馆归档、军机立项都应成为可调用能力。
2. 模型只是执行者，业务插件才是稳定资产。
3. 后续每个部门都应该有 DepartmentSkill。
```

### 3.8 Open WebUI / AnythingLLM：知识工作台

核心启发：

- 用户需要 Workspace。
- RAG 不是技术点，而是知识资产管理。
- 权限、文档、会话、模型选择要可控。

朝堂 OS 应吸收：

```text
1. 史馆是长期知识库，不只是归档页。
2. 上书房回答问题时，应能引用史馆证据。
3. 每个公司/项目可以成为一个经营 Workspace。
```

### 3.9 n8n：工作流自动化

本轮 `n8n` checkout 不完整，不能作为代码参考，但产品方向仍有价值：

```text
1. 工作流节点市场。
2. 外部系统集成。
3. Trigger -> Action -> Condition -> Retry。
```

朝堂 OS 后续可以借鉴：

```text
外部信号触发：
  客户询盘 / 现金流异常 / 项目延期 / 舆情风险
自动进入：
  上书房建议 / 户部预算 / 军机处立项 / 史馆归档
```

## 4. 朝堂 OS 应形成的 2026 架构

参考这些高星项目后，朝堂 OS 不应做成“古风版 Dify/Flowise/n8n”。我们的差异化应该是：

```text
经营语义优先
  不是节点优先，不是模型优先。

老板决策优先
  先给结论、风险、预算、下一步。

部门职责优先
  上书房、户部、工部、军机处、史馆各有真实职责。

闭环优先
  建议 -> 预算 -> 立项 -> 执行 -> 复盘 -> 再建议。
```

## 5. 立刻落地的 P0 任务

### P0-1：统一 ExecutionCase

把现在散落的对象统一：

```text
DailyOperatingRecommendation
DepartmentBuildBudget
DepartmentBuildTask
BuildRetrospective
BattleStream task
```

统一成：

```ts
interface ExecutionCase {
  id: string;
  source: 'daily_brief' | 'hubu_budget' | 'gongbu_build' | 'manual';
  title: string;
  command: string;
  status: ExecutionCaseStatus;
  budget?: BudgetDecision;
  assignees: CaseAssignee[];
  acceptanceCriteria: string[];
  evidence: string[];
  retrospective?: CaseRetrospective;
}
```

### P0-2：军机处状态机升级

借鉴 LangGraph：

```text
draft
-> dispatched
-> planning
-> executing
-> reviewing
-> report_ready
-> archived
```

失败分支：

```text
blocked
rework
failed
cancelled
```

### P0-3：工部 Workflow 图

借鉴 Flowise：

```text
需求
-> PRD
-> 设计审查
-> 技术方案
-> 分配窗口
-> 开发
-> 集成
-> QA
-> 史馆归档
```

### P0-4：史馆证据链

借鉴 Dify LLMOps 和 OpenHands 评测：

```text
每次任务必须归档：
- 输入
- 模型/窗口
- 执行过程
- diff/build 结果
- 预算
- 风险
- 验收
- 复盘评分
- 下次建议
```

## 6. 不做清单

为了避免跑偏，明确不做：

```text
1. 不做通用拖拽式 AI App Builder。
2. 不做纯聊天工具。
3. 不做纯 Agent 框架。
4. 不做纯自动化平台。
5. 不让老板面对复杂节点图。
6. 不复制开源项目代码。
```

我们做的是：

```text
AI 经营操作系统。
```

## 7. 下一步执行建议

最符合顶尖执行的下一步：

```text
1. 新建 ExecutionCase 契约。
2. 让户部预算、工部建设、军机任务、史馆复盘都映射到 ExecutionCase。
3. 在军机处显示 ExecutionCase 统一状态。
4. 在史馆按 ExecutionCase 归档。
5. 在上书房按 ExecutionCase 结果生成次日建议。
```

这一步会把朝堂 OS 从“多个模块已打通”升级为“一个统一经营内核”。
