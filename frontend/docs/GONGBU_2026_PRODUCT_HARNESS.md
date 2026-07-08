# 朝堂 OS · 工部 2026 最佳产品 Harness

> 主舱：`/home/ubuntu/workspace/chaotang-web-lyt`
> 版本：v1
> 日期：2026-06-01
> 负责人：工部工程中台
> 目标：把朝堂 OS 建成 2026 年级别的 AI 一人公司操作系统产品，而不是一组漂亮页面。

## 0. 一句话

工部是朝堂 OS 的工程生产系统。它负责把用户的经营意图变成可开发、可预算、可验收、可复盘、可复制的产品能力。

```text
用户意图
  -> 上书房形成经营建议
  -> 工部拆成建设任务
  -> 户部评估预算与 ROI
  -> 军机处立项和裁断阻塞
  -> Codex / Claude / jiqun / gstack 执行
  -> QA 验收
  -> 史馆归档
  -> 次日继续给建议
```

## 1. 产品北极星

### 1.1 目标用户

第一目标用户是一人公司创始人，尤其是同时做：

- Web 产品。
- 金融 / 投资分析。
- 新闻 / 媒体内容。
- AI 自动化工作流。
- 小团队或多模型协作。

### 1.2 2026 最佳产品标准

朝堂 OS 必须达到五个标准：

| 标准 | 含义 | 验收 |
| --- | --- | --- |
| 经营闭环 | 不是聊天，而是把决策推进到执行和复盘 | 上书房 -> 工部/户部 -> 军机处 -> 史馆能跑通 |
| 工程闭环 | 每个想法都能变成任务、代码、验收、归档 | 工部建设任务有状态机、文件边界、验收标准 |
| 多模型协作 | Claude、Codex、次级模型、人工各做擅长的事 | 每个任务卡有明确 assignee 和边界 |
| 可复制 | 建完户部后，能复制到锦衣卫、史馆、礼部等 | 有部门建设模板和 workflow |
| 可验证 | 不是口头完成，必须构建、浏览器、截图或数据验证 | `npm run build`、gstack QA、史馆记录 |

### 1.3 不做伪产品

以下都不算完成：

- 只有页面，没有可执行任务。
- 只有 mock 图表，没有决策动作。
- 只有 AI 聊天，没有状态机。
- 只有计划，没有构建验证。
- 只有“看起来高级”，没有业务闭环。

## 2. 当前已完成工作

### 2.1 主舱确定

所有朝堂 Web 工作默认在：

```text
/home/ubuntu/workspace/chaotang-web-lyt
```

端口纪律：

```text
开发：3002
生产：3050
禁止：3001
```

### 2.2 工部页面已升级

文件：

```text
src/app/(dashboard)/manor-dept/[deptCode]/gongbu-client.tsx
```

已加入：

- 开发助手台。
- 标准开发闭环。
- 工部开发队。
- 建设任务池。
- Workflow 状态看板。
- 智能体分配。
- 户部样板任务验收标准。
- 去军机处立项 / 去户部预算 / 去史馆归档入口。

### 2.3 顶部导航已加入工部

文件：

```text
src/features/shangshufang/constants.ts
```

工部入口：

```text
/manor-dept/gongbu
```

### 2.4 Workflow 合同已新增

文件：

```text
src/features/operating-loop/lib/department-build-workflow.ts
```

已定义：

- `DepartmentBuildStatus`
- `DepartmentBuildTarget`
- `DepartmentBuildTask`
- `BuildAssignee`
- `WorkflowStep`
- `DEPARTMENT_BUILD_WORKFLOW`
- `DEPARTMENT_BUILD_TASKS`

首批样板任务：

- `build-hubu-v1`：建设户部经营预算中台。
- `build-jinyiwei-invest-intel`：建设锦衣卫投资情报暗线。
- `build-shiguan-dev-archive`：建设史馆开发复盘档案。

### 2.5 构建验证

已通过：

```bash
npm run build
```

## 3. 工部 Harness

### 3.1 工部职责

工部承担六件事：

1. 收建设需求。
2. 拆 PRD、设计、技术方案。
3. 分配 Claude、Codex、次级模型、人工。
4. 跟踪开发状态和阻塞。
5. 定义验收标准。
6. 把成功工法沉淀为模板。

### 3.2 工部页面必须长期保留的区块

| 区块 | 目的 | 数据来源 |
| --- | --- | --- |
| 建设任务池 | 当前要建哪些部门/能力 | `DEPARTMENT_BUILD_TASKS`，后续接真实 store |
| Workflow 状态看板 | 每个任务处于哪个阶段 | `DEPARTMENT_BUILD_WORKFLOW` |
| 开发助手台 | 去 jiqun、军机处、知识库、运行记录 | 固定入口 + 后续健康状态 |
| 智能体分配 | Claude / Codex / 次级模型 / 人工分工 | `BuildAssignee` |
| 验收标准 | 明确完成条件 | `acceptanceCriteria` |
| 工部开发队 | 人类角色和职责 | 静态角色，后续可接账号 |

### 3.3 状态机

统一使用：

```text
idea
  -> prd
  -> design_review
  -> tech_plan
  -> assigned
  -> building
  -> integrating
  -> qa
  -> accepted
  -> archived
```

异常分支：

```text
blocked
rework
cancelled
```

每个状态都必须回答：

| 状态 | 必答问题 |
| --- | --- |
| idea | 为什么值得做？不做会怎样？ |
| prd | 用户是谁？核心路径是什么？边界是什么？ |
| design_review | 页面怎么组织？第一屏解决什么？ |
| tech_plan | 改哪些文件？API/状态/数据怎么走？ |
| assigned | 谁负责？谁不碰？谁验收？ |
| building | 实现是否越界？有没有破坏旧功能？ |
| integrating | 多窗口 diff 是否冲突？类型是否稳定？ |
| qa | 构建、浏览器、截图、核心路径是否通过？ |
| accepted | 用户是否能确认业务价值？ |
| archived | 下次是否能复用？ |

## 4. 户部协同 Harness

### 4.1 户部职责

户部不是纯财务图表。户部负责为工部建设提供约束：

- 预算。
- ROI。
- 现金流压力。
- 风险等级。
- 优先级。
- 是否值得继续投。

### 4.2 工部与户部的标准交互

```text
工部提交 DevelopmentBuildTask
  -> 户部生成 BudgetAssessment
  -> 军机处根据预算与风险排序
  -> 工部执行
  -> 户部复核投入产出
  -> 史馆归档 ROI 结论
```

### 4.3 首个样板

```text
build-hubu-v1
```

验收标准：

- `/manor-dept/finance` 正常显示。
- 至少 3 个待批建设项目。
- 每个项目有预算、ROI、风险、建议动作。
- 至少一条项目能跳转军机处立项。
- `npm run build` 通过。

## 5. 多模型团队 Harness

### 5.1 Claude

定位：总设计院 + 产品御史。

负责：

- 产品判断。
- PRD。
- 信息架构。
- 用户路径。
- 文案和价值提炼。
- 验收标准。
- 风险审查。

不负责：

- 大规模仓库搜索。
- 机械改文件。
- 反复跑 build。
- 批量 mock。

### 5.2 Codex

定位：工部施工总包 + 集成负责人。

负责：

- 读仓库。
- 改代码。
- 拆模块。
- 跑命令。
- 修类型错误。
- 接入现有组件。
- 构建验证。

Codex 每次开始必须回答：

```text
1. 我要读哪些文件？
2. 我要改哪些文件？
3. 我不碰哪些文件？
4. 验收命令是什么？
5. 完成后交给谁？
```

### 5.3 次级模型

定位：低风险批量助理。

负责：

- 任务卡初稿。
- mock 数据。
- QA checklist。
- 字段表。
- 日报。
- 文案一致性检查。

禁止：

- 独立拍板架构。
- 独立改核心代码。
- 决定产品方向。

### 5.4 人工 / 创始人

负责：

- 判断商业方向。
- 确认预算。
- 裁断冲突。
- 验收关键体验。
- 决定优先级。

## 6. gstack / superpower Harness

### 6.1 什么时候用

| 时机 | 工具 | 目的 |
| --- | --- | --- |
| 需求不清 | `spec` | 生成明确规格 |
| 方案成形 | `plan-ceo-review` | 审商业价值和产品锋利度 |
| 开工前 | `plan-eng-review` | 审架构、边界、风险 |
| UI 完成 | `design-review` | 审视觉、层级、交互 |
| 功能完成 | `qa` / `qa-only` | 浏览器验收和修 bug |
| 性能关键 | `benchmark` | 性能基线 |
| 上线后 | `canary` | 生产巡检 |
| 收尾 | `context-save` / `learn` | 沉淀记忆 |

### 6.2 每次开发的固定流程

```text
1. 读 AGENTS.md 和相关 docs。
2. 读目标文件。
3. 明确文件边界。
4. 写最小实现。
5. npm run build。
6. 浏览器验证。
7. 记录结果。
8. 需要时跑 gstack review / qa。
```

### 6.3 验收门

任何功能进入“accepted”前必须满足：

- 类型通过。
- 构建通过。
- 关键页面能打开。
- 主要按钮有去向。
- 不破坏端口纪律。
- 不泄露密钥。
- 有可追溯的文档或复盘。

## 7. 2026 产品打法

### 7.1 产品体验原则

朝堂 OS 要有东方叙事，但不能牺牲效率。

页面设计原则：

- 第一屏必须说明“现在该做什么”。
- 每个模块必须有动作按钮。
- 每个动作必须能进入下一环。
- 每个建议必须有原因和证据。
- 每个执行必须有状态和验收。
- 每个完成必须能归档。

### 7.2 信息架构

九大模块的关系：

| 模块 | 角色 |
| --- | --- |
| 上书房 | 今日经营建议入口 |
| 大殿 | 全局态势 |
| 工部 | 建设其他部门的工程中台 |
| 户部 | 预算、ROI、资源配置 |
| 军机处 | 立项、执行、阻塞裁断 |
| 锦衣卫 | 情报、风险、外部信号 |
| 史馆 | 归档、复盘、经验 |
| 礼部 | 品牌、传播、对外表达 |
| 庄园 | 业务场景和客户经营 |

### 7.3 第一条黄金路径

必须优先打通：

```text
上书房看到“建设户部经营预算中台”
  -> 工部打开建设任务
  -> 户部给预算和 ROI
  -> 军机处立项执行
  -> 工部验收
  -> 史馆归档复盘
```

## 8. 文件边界

### 8.1 工部允许优先改

```text
src/app/(dashboard)/manor-dept/[deptCode]/gongbu-client.tsx
src/features/operating-loop/**
docs/GONGBU_2026_PRODUCT_HARNESS.md
docs/GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md
docs/superpowers/plans/**
```

### 8.2 户部允许独立窗口改

```text
src/app/(dashboard)/manor-dept/[deptCode]/hubu-client.tsx
src/features/operating-loop/lib/build-budget.ts
src/features/operating-loop/lib/daily-brief.ts
```

### 8.3 慎改

```text
src/app/(dashboard)/layout.tsx
src/app/globals.css
src/config/routes.ts
src/features/command-center/**
src/features/shangshufang/constants.ts
```

改慎改文件前必须说明原因。

### 8.4 禁止

- 不改全局色板。
- 不重写 `globals.css`。
- 不把密钥写入代码。
- 不在 `3001` 启动主舱。
- 不让两个窗口同时改同一文件。

## 9. 每日作战节奏

### 上午：定方向

输出：

- 今日目标。
- 目标用户价值。
- 文件边界。
- 验收标准。

### 中午：工程实现

输出：

- 可运行 diff。
- mock/contract。
- 页面入口。
- 构建结果。

### 下午：QA 和集成

输出：

- 浏览器验收。
- 截图或接口证据。
- 问题清单。
- 修复记录。

### 晚上：史馆归档

输出：

- 今天做了什么。
- 哪些经验可复用。
- 哪些风险明天处理。
- 哪些任务进入下一状态。

## 10. 任务卡模板

```yaml
id:
title:
targetDept:
ownerDept: gongbu
workflowStatus:
priority:
businessGoal:
userValue:
  - 
requiredPanels:
  - 
acceptanceCriteria:
  - 
assignedWindows:
  product:
  engineering:
  integration:
  review:
budget:
  level:
  estimate:
  roi:
  risk:
links:
  commandCenter:
  budget:
  archive:
```

## 11. Definition Of Done

一个模块只有满足以下条件，才算真的完成：

1. 用户价值能一句话说清。
2. 页面第一屏能看懂下一步。
3. 至少一个核心动作能进入下一环。
4. 有稳定数据结构。
5. 有验收标准。
6. `npm run build` 通过。
7. 浏览器核心路径可访问。
8. 不泄露密钥。
9. 不破坏端口纪律。
10. 史馆或 docs 有记录。

## 12. 下一步执行顺序

### P0

1. 工部继续完善 `DevelopmentBuildTask` 展示和状态。
2. 户部接入预算、ROI、风险和待批建设项目。
3. 军机处识别 `task` / `intent` 查询参数，展示工部建设案。
4. 史馆新增开发复盘档案入口。

### P1

1. 锦衣卫投资情报暗线。
2. 工部 QA 结果卡。
3. gstack QA 记录入口。
4. 每日调度报告。

### P2

1. Notion / GitHub / Sentry / Slack 真实连接。
2. 多模型成本审计。
3. 生产 canary。
4. 部门建设模板自动生成。

## 13. 最终判断

朝堂 OS 要成为 2026 最佳产品，关键不是“多做页面”，而是把一人公司的经营、开发、预算、情报、执行、复盘连成闭环。

工部是这个闭环的发动机。
户部是资源约束。
军机处是裁断和执行。
史馆是记忆。
上书房是每日入口。

所有开发都必须围绕这条链路推进。

