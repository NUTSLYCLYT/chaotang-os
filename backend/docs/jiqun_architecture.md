# jiqun_ai 架构收敛说明

## 定位

`jiqun_ai` 是一个 AI 组织操作系统：用三省六部治理任务，用蜂群执行业务，用庄园补充专家，用大神提升判断，用红蓝对抗保证质量，用 IMA 沉淀知识。

## 分层

| 层级 | 配置 | 职责 |
| --- | --- | --- |
| Court 三省六部 | `config/flow_court.yaml` | 总入口、审议、派单、复核和回传 |
| Swarm 蜂群执行 | `config/swarm_orchestrator.yaml`、`config/flow_*.yaml` | 14 个业务蜂群按事件和质量门控联动 |
| Manor 庄园专家 | `config/manor_groups.yaml` | 横向专家能力池，默认 subagent，可升级 OpenClaw |
| Critic 红蓝对抗 | `config/global_tail_flow.yaml`、`runtime_prompts/critic/` | 质疑、找漏洞、找失败路径 |
| Persona 大神评审 | `config/review_committee.yaml`、`skills/personas/` | 战略、风险、产品、工程和商业本质评审 |
| Memory 知识沉淀 | `config/flow_ima.yaml` | 归档高质量结果、争论过程和复盘经验 |

## 名词边界

- Flow：工作流配置，一个可运行流程。
- Swarm：业务蜂群，由一个 flow 和多个子 agent 组成。
- Agent：flow 里的执行角色，通常对应 `runtime_prompts/<prompt_key>/`。
- Manor：专家庄园/能力池，可用 subagent 或 OpenClaw 运行。
- Court：三省六部治理层，负责理解、审议、派发、复核。
- Persona：大神视角，用于评审，不替代执行 agent。
- Critic：红蓝对抗/质疑角色，负责找失败路径。

## 运行时选择

默认使用 subagent。它轻、快、便宜、可观测，适合作为 14 个蜂群的主流程骨架。

OpenClaw 不替代所有 subagent，只承担长期、有工具、有记忆、有独立行动能力的庄园能力。当前策略是：

```text
普通 flow step -> subagent
QA / critic / persona review -> subagent
长期庄园 / 外部工具 / 跨任务记忆 -> OpenClaw
OpenClaw 不可用 -> fallback 到 subagent
```

## 标准尾部流程

核心蜂群应该逐步收敛到统一尾部：

```text
QA -> Critic 红蓝对抗 -> Persona 大神评审 -> Final Decision Memo -> IMA Archive
```

对应配置：

```text
config/global_tail_flow.yaml
config/review_committee.yaml
```

## 总注册表

系统制度入口是：

```text
config/jiqun_registry.yaml
```

它不替代具体 flow，而是登记这些关系：

- 14 个蜂群在哪些 flow 文件里。
- 每个蜂群包含哪些 agent。
- 每个蜂群属于哪条链路。
- subagent 和 OpenClaw 的边界。
- 庄园、大神评审、红蓝对抗、IMA 归档如何组合。
