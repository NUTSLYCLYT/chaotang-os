# 工部优先 + 户部协同：四窗口多模型工作流

> 工作舱：`/home/ubuntu/workspace/chaotang-web-lyt`
> 第一目标：先把工部做成“建设其他部门的工程中台”，再让户部提供预算、资源、ROI、风险约束。
> 核心原则：Claude 优先做高价值判断和产品设计；Codex 承担大量读仓库、改代码、构建、批量消耗 token 的工程执行。

## 1. 总策略

我们当前不要同时铺开所有部门。正确顺序是：

```text
工部
  -> 建设 Workflow 中台
  -> 生成部门建设模板
  -> 先套到户部
  -> 再复制到兵部、锦衣卫、史馆、礼部、太医院
```

比喻一下：不要让每个部门各自盖房子。先建“工部施工队、图纸库、验收标准、预算审批、监理流程”。之后每建一个部门，都是复制成熟工法。

## 2. 模型使用原则

### 2.1 Claude Opus 4.8

适合做：

- 产品判断。
- PRD 重写。
- 复杂页面信息架构。
- 用户路径设计。
- 文案和商业价值提炼。
- 验收标准设计。
- 风险审查。

不要让 Claude 大量做：

- 全仓库搜索。
- 机械改很多文件。
- 反复跑 build。
- 大量 mock 数据搬运。

Claude 是“总设计院 + 产品御史”，不是搬砖工。

### 2.2 GPT-5.5 / Codex

适合做：

- 读仓库。
- 改代码。
- 拆模块。
- 跑命令。
- 修类型错误。
- 做集成。
- 大量消耗 token 的代码理解。
- 把 Claude 的方案落到文件里。

Codex 是“工部施工总包 + 集成负责人”。

### 2.3 次一等模型

适合做：

- 批量生成任务卡。
- 整理会议纪要。
- 生成 mock 数据。
- 生成测试用例初稿。
- 生成字段表。
- 检查文案一致性。
- 把大文档压缩成 checklist。
- 写日报。

不要让次级模型拍板架构，不要让它独立改核心代码。

## 3. 套餐容量分配

我不建议按“固定比例”死分，因为每个套餐和窗口的实际限额会变。用动态调度更稳：

```text
Claude token 留给：方向、PRD、页面结构、验收、复盘。
Codex token 用于：读代码、实现、构建、修错、集成。
次级模型 token 用于：批量低风险材料。
```

每日预算建议：

| 类型 | Claude 用量 | Codex 用量 | 次级模型用量 |
|---|---:|---:|---:|
| 方向决策 | 高 | 中 | 低 |
| PRD/信息架构 | 高 | 低 | 中 |
| 全仓库阅读 | 低 | 高 | 低 |
| 代码实现 | 中 | 高 | 低 |
| mock/文案/表格 | 低 | 中 | 高 |
| QA/构建/修错 | 中 | 高 | 中 |
| 最终评审 | 高 | 中 | 低 |

实际执行规则：

- Claude 剩余额度充足：让 Claude 先定“工部/户部产品形态”和验收标准。
- Claude 紧张：Claude 只审 Codex 的方案，不直接写长文。
- Codex 额度充足：让 Codex 多读仓库、多做实现、多跑 build。
- Codex 紧张：减少探索，严格按文件边界执行。
- 次级模型充足：所有任务卡、mock、检查清单都交给它。

## 4. 产品架构

### 4.1 工部定位

工部不是普通部门页，而是“建设其他部门的操作系统”。

工部应该包含六个能力：

```text
1. 建设需求池：哪些部门/模块要建。
2. Workflow 编排：每个建设任务经过哪些阶段。
3. 智能体分工：Claude、Codex、次级模型、人工分别做什么。
4. 工程进度：正在做、阻塞、待验收、已归档。
5. 验收标准：每个模块怎么判断完成。
6. 复用模板：建完户部后，复制到其他部门。
```

### 4.2 户部定位

户部不是纯财务图表，而是“经营预算与资源配置中台”。

户部应该回答：

```text
1. 现在有多少资源。
2. 哪些项目正在花钱。
3. 哪些项目值得继续投。
4. 哪些项目风险过高。
5. 工部建设其他部门需要多少预算。
6. 每个建设任务的 ROI 和优先级是什么。
```

### 4.3 工部和户部关系

```text
工部提出建设计划
  -> 户部评估预算与 ROI
  -> 军机处立项
  -> 工部组织 Claude/Codex/员工执行
  -> QA 验收
  -> 史馆归档
  -> 上书房次日建议
```

## 5. Workflow 状态机

所有部门建设任务统一使用这个状态：

```text
idea              想法/需求
prd               PRD 已成形
design_review     设计评审
tech_plan         技术方案
assigned          已分配窗口/人员
building          开发中
integrating       集成中
qa                验收中
accepted          已验收
archived          已归档

blocked           阻塞
rework            返工
cancelled         取消
```

每个状态必须有输入、输出和验收。

| 状态 | 输入 | 输出 | 验收 |
|---|---|---|---|
| idea | 一句话需求 | 问题定义 | 值不值得做说清楚 |
| prd | 问题定义 | PRD | 用户、场景、价值、边界清楚 |
| design_review | PRD | 页面结构 | 核心路径能走通 |
| tech_plan | 页面结构 | 文件边界/API/状态机 | 能分配给窗口 |
| assigned | 技术方案 | 任务卡 | 每个窗口知道改哪里 |
| building | 任务卡 | 代码/文档 diff | 不越界 |
| integrating | 多窗口 diff | 可运行版本 | 类型不冲突 |
| qa | 可运行版本 | 问题清单/修复 | build 通过，核心路径可演示 |
| accepted | QA 通过 | 验收记录 | 用户可确认 |
| archived | 验收记录 | 史馆复盘 | 下次能复用 |

## 6. 文件边界

### 工部相关

```text
src/app/(dashboard)/manor-dept/[deptCode]/gongbu-client.tsx
src/app/(dashboard)/manor-dept/[deptCode]/department-war-room.tsx
src/features/operating-loop/**
src/features/command-center/components/*workflow*
docs/GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md
```

### 户部相关

```text
src/app/(dashboard)/manor-dept/[deptCode]/hubu-client.tsx
src/lib/contracts/dept.ts
src/lib/demo/scripts/finance-budget-analysis.ts
src/features/operating-loop/lib/daily-brief.ts
```

### 共用但慎改

```text
src/config/routes.ts
src/lib/api/chaotang.ts
src/app/(dashboard)/command-center/page.tsx
src/features/command-center/**
src/features/shiguan/**
```

四个窗口不要同时改同一个文件。

## 7. 四窗口分工

### 窗口 A：Claude Opus 4.8 · 工部产品总设计

角色：总设计院。

只做：

- 工部 PRD。
- Workflow 信息架构。
- 任务卡标准。
- 员工/智能体分工方式。
- 工部建设其他部门的模板。

不要做：

- 大量改代码。
- 跑 build。
- 改户部实现细节。

交付：

```text
1. 工部页面应该出现哪些区块。
2. 工部 Workflow 每一步字段。
3. 部门建设任务卡模板。
4. 工部如何调用 Claude/Codex/次级模型/员工。
5. 第一版验收标准。
```

直接 Prompt：

```text
你在 /home/ubuntu/workspace/chaotang-web-lyt 工作。你是 Claude Opus 4.8，负责“工部产品总设计”，不要大量改代码。

先读：
- AGENTS.md
- docs/GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md
- src/app/(dashboard)/manor-dept/[deptCode]/gongbu-client.tsx
- src/app/(dashboard)/manor-dept/[deptCode]/department-war-room.tsx
- src/config/routes.ts

目标：
把工部设计成“建设其他部门的工程中台”，不是普通部门页。

请输出：
1. 工部 PRD v1。
2. 工部页面信息架构。
3. Workflow 状态机字段。
4. 任务卡模板。
5. 工部如何建设户部、兵部、锦衣卫、史馆。
6. 验收标准。

限制：
- 不要重写全站视觉。
- 不要改 globals.css。
- 不要和其他窗口抢同一个文件。
- 如需改代码，只能小范围改 gongbu-client.tsx 或新增 docs。
```

### 窗口 B：Codex · 工部工程实现

角色：施工总包。

只做：

- 实现工部页面。
- 新增 Workflow mock/contract。
- 接入当前页面组件。
- 修类型错误。
- 跑 build。

交付：

```text
1. 工部页面出现“建设任务池 / Workflow 看板 / 智能体分配 / 验收标准 / 复用模板”。
2. 有可复用的 department build task 数据结构。
3. 能从工部发起“建设户部”的任务草稿。
4. npm run build 通过。
```

直接 Prompt：

```text
你在 /home/ubuntu/workspace/chaotang-web-lyt 工作。你是 Codex，负责“工部工程实现”。

先读：
- AGENTS.md
- docs/GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md
- src/app/(dashboard)/manor-dept/[deptCode]/gongbu-client.tsx
- src/app/(dashboard)/manor-dept/[deptCode]/department-war-room.tsx
- src/features/operating-loop/lib/daily-brief.ts

允许修改：
- src/app/(dashboard)/manor-dept/[deptCode]/gongbu-client.tsx
- src/features/operating-loop/**
- 必要时新增 src/features/operating-loop/lib/department-build-workflow.ts

目标：
把工部做成建设其他部门的工程中台。

必须实现：
1. 建设任务池。
2. Workflow 状态看板。
3. Claude/Codex/次级模型/人工的分工卡。
4. 户部建设任务示例。
5. 每个任务的验收标准。
6. 入口按钮：去军机处立项 / 去户部评估预算 / 去史馆归档。

禁止：
- 不改 hubu-client.tsx。
- 不改 globals.css。
- 不大改 layout。

验收：
- npm run build 通过。
- /manor-dept/gongbu 或 /manor-dept/works 能正常显示。
- 页面不出现明显溢出。
```

### 窗口 C：Claude Opus 4.8 · 户部经营/预算设计

角色：财务战略官。

只做：

- 户部 PRD。
- 预算/ROI/资源约束设计。
- 工部建设任务如何被户部审批。
- 财务指标和风控逻辑。

不要做：

- 大量改代码。
- 抢工部实现。

交付：

```text
1. 户部如何服务工部建设。
2. 建设预算审批字段。
3. ROI 评估模型。
4. 项目优先级排序规则。
5. 户部页面需要补哪些区块。
```

直接 Prompt：

```text
你在 /home/ubuntu/workspace/chaotang-web-lyt 工作。你是 Claude Opus 4.8，负责“户部经营预算设计”，不要大量改代码。

先读：
- AGENTS.md
- docs/GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md
- src/app/(dashboard)/manor-dept/[deptCode]/hubu-client.tsx
- src/lib/contracts/dept.ts
- src/features/operating-loop/lib/daily-brief.ts

目标：
把户部设计成“经营预算与资源配置中台”，并服务工部建设其他部门。

请输出：
1. 户部 PRD v1。
2. 工部建设任务的预算审批模型。
3. ROI/风险/现金流/优先级字段。
4. 户部页面需要补充的区块。
5. 户部给军机处/上书房/史馆的数据。
6. 验收标准。

限制：
- 不重写页面。
- 不改全站视觉。
- 如果要改代码，只能小范围改 hubu-client.tsx 或新增 docs。
```

### 窗口 D：Codex · 户部工程实现与集成

角色：财务系统工程师。

只做：

- 把户部预算字段落地。
- 给工部建设任务补预算/ROI mock。
- 和 daily brief / command center 做轻集成。
- 跑 build。

交付：

```text
1. 户部页面显示建设预算、ROI、风险、待批建设项目。
2. 工部建设户部任务能看到预算建议。
3. 每日建议里能出现“户部建议先审批/调整预算”。
4. npm run build 通过。
```

直接 Prompt：

```text
你在 /home/ubuntu/workspace/chaotang-web-lyt 工作。你是 Codex，负责“户部工程实现与集成”。

先读：
- AGENTS.md
- docs/GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md
- src/app/(dashboard)/manor-dept/[deptCode]/hubu-client.tsx
- src/lib/contracts/dept.ts
- src/features/operating-loop/lib/daily-brief.ts
- src/app/(dashboard)/manor-dept/[deptCode]/gongbu-client.tsx

允许修改：
- src/app/(dashboard)/manor-dept/[deptCode]/hubu-client.tsx
- src/features/operating-loop/**
- 必要时 src/lib/contracts/dept.ts

目标：
让户部为工部建设任务提供预算、ROI、风险和优先级判断。

必须实现：
1. 建设预算面板。
2. 待批建设项目列表。
3. ROI/风险/现金流指标。
4. 至少一条“工部建设户部能力”的预算建议。
5. 链接到 /command-center 或 /manor-dept/gongbu。

禁止：
- 不改 gongbu-client.tsx 的主体结构。
- 不改 globals.css。
- 不重写路由。

验收：
- npm run build 通过。
- /manor-dept/finance 正常显示。
- 户部和工部在业务语义上能互相解释。
```

## 8. 次级模型任务池

把下面任务交给次级模型，节省 Claude 和 Codex 额度：

```text
1. 生成 20 条部门建设任务 mock。
2. 生成 10 条工部验收标准。
3. 生成 10 条户部预算审批文案。
4. 生成 10 条 ROI 风险解释。
5. 把 Workflow 状态机转成 Markdown 表格。
6. 把每日会议记录整理成任务卡。
7. 检查“工部/户部/军机处/史馆”文案是否一致。
8. 生成 QA checklist。
9. 生成演示脚本。
10. 生成日报。
```

次级模型 Prompt：

```text
你是低风险批量助理，不做架构决策，不改代码。

根据以下主题生成结构化材料：
主题：工部建设其他部门，户部负责预算与 ROI。

请生成：
1. 20 条部门建设任务 mock。
2. 每条包含 title、targetDept、workflowStatus、ownerModel、budgetLevel、riskLevel、acceptanceCriteria。
3. 10 条 QA 验收 checklist。
4. 10 条适合页面展示的短文案。

要求：
- 输出 Markdown 表格。
- 字段稳定。
- 不要扩展新架构。
```

## 9. 工部建设户部的第一条标准任务卡

```yaml
id: build-hubu-v1
title: 建设户部经营预算中台 v1
targetDept: finance
ownerDept: gongbu
workflowStatus: tech_plan
priority: P0
businessGoal: 让户部能为所有部门建设任务提供预算、ROI、现金流和风险判断。
userValue:
  - 决策者知道先投什么。
  - 工部知道建设资源边界。
  - 军机处能按预算和风险排优先级。
  - 史馆能复盘投入产出。
requiredPanels:
  - 建设预算总览
  - 待批建设项目
  - ROI 与风险矩阵
  - 现金流压力
  - 户部建议
acceptanceCriteria:
  - /manor-dept/finance 正常显示。
  - 能看到至少 3 个待批建设项目。
  - 每个项目有预算、ROI、风险、建议动作。
  - 至少一条项目能跳转军机处立项。
  - npm run build 通过。
assignedWindows:
  product: Claude C
  engineering: Codex D
  integration: Codex B
  review: Claude A
```

## 10. 每日调度节奏

### 上午：Claude 定方向

```text
Claude A：工部今天建什么，验收标准是什么。
Claude C：户部今天批准什么，预算风险是什么。
```

### 中午：Codex 执行

```text
Codex B：实现工部。
Codex D：实现户部。
```

### 下午：集成与 QA

```text
Codex B：统一解决冲突和 build。
Claude A：审产品是否跑偏。
Claude C：审财务逻辑是否合理。
次级模型：生成 QA checklist 和日报。
```

### 晚上：史馆归档

```text
记录：
- 今天建了什么。
- 哪个模型做了什么。
- 消耗是否合理。
- 哪些任务明天继续。
- 哪些模板可以复用到其他部门。
```

## 11. 顶尖执行标准

每个窗口开始前必须回答：

```text
1. 我负责什么？
2. 我不碰什么？
3. 我要读哪些文件？
4. 我要改哪些文件？
5. 我的验收标准是什么？
6. 我完成后给谁集成？
```

每个窗口结束时必须交付：

```text
1. 改了哪些文件。
2. 实现了哪些功能。
3. 没做什么。
4. build 是否通过。
5. 是否有风险。
6. 下一窗口应该接什么。
```

最高级的协作不是“模型越强越好”，而是每个模型都被限制在自己最擅长的位置上。

本轮一句话：

```text
Claude 负责把工部和户部想明白，Codex 负责把它们做出来，次级模型负责把低风险材料批量补齐。
```
