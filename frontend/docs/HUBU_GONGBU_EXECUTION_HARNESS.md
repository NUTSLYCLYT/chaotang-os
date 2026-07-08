# 户部 x 工部执行 Harness

> 工作舱：`/home/ubuntu/workspace/chaotang-web-lyt`
> 当前版本：2026-06-01
> 目标：确保“工部建设体系 + 户部预算中台”真正形成可演示、可验收、可复制的经营闭环，并把朝堂 OS 推向 2026 年最佳产品标准。

## 1. Harness 定义

这里的 Harness 不是单个测试脚本，而是一套完整约束系统：

```text
产品目标
  -> 领域模型
  -> 页面能力
  -> 数据契约
  -> AI/员工分工
  -> 验收标准
  -> QA 路径
  -> 复盘归档
```

它的作用是防止项目变成“页面很多但闭环不强”。所有后续开发都必须能回答：

```text
这个功能是否让经营闭环更强？
是否能被户部评估预算？
是否能被工部复制建设？
是否能被军机处立项执行？
是否能被史馆归档复盘？
```

## 2. 当前已完成内容

### 2.1 户部建设预算数据模块

文件：

```text
src/features/operating-loop/lib/build-budget.ts
```

已提供：

- `DepartmentBuildBudget`
- `BuildBudgetRisk`
- `BuildBudgetStatus`
- `BUILD_BUDGET_SUMMARY`
- `DEPARTMENT_BUILD_BUDGETS`
- 风险标签和状态标签

当前内置四条建设预算任务：

| ID | 任务 | 状态 | 价值 |
|---|---|---|---|
| `build-hubu-v1` | 建设户部经营预算中台 v1 | 待批 | 让户部服务所有部门建设预算 |
| `build-gongbu-workflow` | 工部 Workflow 建设中台 | 已准 | 成为后续部门复制模板 |
| `build-jinyiwei-intel` | 锦衣卫风险雷达二期 | 退回补充 | 控制数据源和误报风险 |
| `build-shiguan-review` | 史馆复盘归档模板 | 待批 | 沉淀经验，反哺每日建议 |

### 2.2 户部页面增强

文件：

```text
src/app/(dashboard)/manor-dept/[deptCode]/hubu-client.tsx
```

已新增：

- 建设预算面板。
- 待批建设项目列表。
- ROI、风险、回收周期、现金余量。
- `军机立项` 链接。
- `交工部执行` 链接。
- 桌面端悬浮经营面板。
- 移动端折叠式预算面板。

### 2.3 每日经营建议接入

文件：

```text
src/features/operating-loop/lib/daily-brief.ts
```

已新增：

- 户部来源经营信号：`signal-hubu-build-budget`
- 每日建议：`op-rec-hubu-budget-first`

用户在上书房看到后，可以把“先审户部建设预算与 ROI”转成圣旨，交军机处处理。

## 3. 产品主线

第一阶段只认这一条主线：

```text
上书房发现经营问题
  -> 户部评估预算/ROI/风险
  -> 工部制定建设计划
  -> 军机处立项拆解
  -> 各窗口/员工执行
  -> QA 验收
  -> 史馆复盘归档
  -> 次日上书房继续建议
```

如果一个新功能不能进入这条链路，先降级为 P2，不进入本轮主线。

## 4. 领域模型

### 4.1 建设预算任务

```ts
interface DepartmentBuildBudget {
  id: string;
  title: string;
  targetDept: string;
  ownerDept: string;
  status: 'pending_review' | 'approved' | 'needs_rework';
  requestedBudget: string;
  estimatedRoi: string;
  paybackWindow: string;
  cashflowPressure: string;
  priority: 'P0' | 'P1' | 'P2';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  command: string;
}
```

### 4.2 必须保持的语义

- `ownerDept`：谁负责建设，当前主要是工部。
- `targetDept`：要建设哪个部门。
- `requestedBudget`：预算申请。
- `estimatedRoi`：预期回报，不等同利润，可以是效率、复用、风险降低。
- `cashflowPressure`：现金流压力。
- `recommendation`：户部给决策者的判断。
- `command`：可转军机处的立项指令。

## 5. 页面 Harness

### 5.1 户部必须回答的问题

用户进入 `/manor-dept/finance`，必须能在 10 秒内看懂：

```text
1. 当前有多少建设项目待批。
2. 总申请预算是多少。
3. 平均 ROI 是多少。
4. 哪些项目优先做。
5. 哪些项目风险高。
6. 哪个项目可以交军机处立项。
7. 哪个项目可以交工部执行。
```

### 5.2 工部必须回答的问题

用户进入 `/manor-dept/gongbu` 或 `/manor-dept/works`，必须能看懂：

```text
1. 工部如何建设其他部门。
2. 当前建设任务池有哪些。
3. Workflow 走到哪一步。
4. Claude、Codex、次级模型、员工如何分工。
5. 每个任务怎么验收。
6. 如何复制到下一个部门。
```

### 5.3 上书房必须回答的问题

用户进入 `/court-briefing`，必须能看懂：

```text
1. 今天最该处理什么经营问题。
2. 为什么现在要处理。
3. 建议召集哪些部门。
4. 一键如何转成圣旨。
```

## 6. 验收脚本

### 6.1 产品演示脚本

```text
1. 进入 /court-briefing。
2. 找到“先审户部建设预算与 ROI”。
3. 点击建议，生成圣旨草稿。
4. 下旨进入 /command-center。
5. 军机处显示任务进入执行链路。
6. 打开户部 /manor-dept/finance。
7. 查看建设预算、待批项目、ROI、风险和现金余量。
8. 点击“军机立项”。
9. 点击“交工部执行”进入 /manor-dept/gongbu。
10. 工部继续拆任务和分配窗口。
```

### 6.2 工程验收命令

```bash
npm run build
```

必须满足：

```text
1. Next 编译成功。
2. TypeScript 通过。
3. 静态页面生成完成。
4. /manor-dept/finance 在构建列表中存在。
5. /manor-dept/gongbu 或 /manor-dept/works 在动态静态参数中存在。
```

### 6.3 页面视觉验收

桌面端：

```text
1. 户部原 PRD 背景图仍然存在。
2. 建设预算面板不遮挡核心财政指标太多。
3. 待批项目卡片文本不溢出。
4. “军机立项”和“交工部执行”可见。
5. 金色用于预算/重点，蓝色用于工部/执行。
```

移动端：

```text
1. 不显示右侧悬浮大面板。
2. 页面底部显示移动端预算面板。
3. 三列指标不撑破屏幕。
4. 项目卡片按钮能换行。
```

## 7. 数据质量 Harness

每条建设预算任务必须包含：

```text
1. 明确目标部门。
2. 明确建设责任部门。
3. 明确预算。
4. 明确 ROI。
5. 明确风险等级。
6. 明确建议动作。
7. 明确可转军机处的 command。
```

禁止出现：

```text
1. 只有标题，没有预算。
2. 只有预算，没有 ROI。
3. 只有 ROI，没有风险。
4. 只有文案，不能转行动。
5. 页面展示字段和数据字段含义不一致。
```

## 8. 四窗口协作 Harness

### 8.1 Claude A：工部产品总设计

输入：

```text
docs/GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md
docs/HUBU_GONGBU_EXECUTION_HARNESS.md
src/app/(dashboard)/manor-dept/[deptCode]/gongbu-client.tsx
```

输出：

```text
1. 工部 PRD。
2. 工部 Workflow 字段。
3. 部门建设模板。
4. 工部验收标准。
```

禁止：

```text
不改户部工程实现。
不重写视觉系统。
```

### 8.2 Codex B：工部工程实现

输入：

```text
Claude A 的工部设计
docs/HUBU_GONGBU_EXECUTION_HARNESS.md
src/features/operating-loop/lib/build-budget.ts
```

输出：

```text
1. 工部任务池。
2. Workflow 看板。
3. 智能体分工卡。
4. 部门建设模板。
5. build 通过。
```

### 8.3 Claude C：户部经营预算设计

输入：

```text
docs/HUBU_GONGBU_EXECUTION_HARNESS.md
src/features/operating-loop/lib/build-budget.ts
src/app/(dashboard)/manor-dept/[deptCode]/hubu-client.tsx
```

输出：

```text
1. 户部预算逻辑审查。
2. ROI 口径定义。
3. 风险分级口径。
4. 是否符合经营中台定位。
```

### 8.4 Codex D：户部工程实现与集成

输入：

```text
docs/HUBU_GONGBU_EXECUTION_HARNESS.md
src/app/(dashboard)/manor-dept/[deptCode]/hubu-client.tsx
src/features/operating-loop/lib/daily-brief.ts
src/features/operating-loop/lib/build-budget.ts
```

输出：

```text
1. 户部预算面板。
2. 建设预算数据。
3. 每日建议集成。
4. build 通过。
```

## 9. 2026 最佳产品标准

朝堂 OS 要成为 2026 年最佳产品，不能只靠视觉。必须同时做到：

### 9.1 价值明确

用户每天打开系统，不是“看看页面”，而是知道：

```text
今天该处理什么。
为什么现在处理。
谁来处理。
花多少钱。
风险多大。
什么时候验收。
结果如何复盘。
```

### 9.2 角色有用

每个部门必须有真实职责：

```text
上书房：发现问题，提出建议。
户部：预算、ROI、现金流、资源配置。
工部：建设 Workflow、复制部门、工程交付。
军机处：立项、拆解、调度、裁断。
史馆：归档、复盘、反哺建议。
锦衣卫：外部情报和风险。
兵部：执行调度。
礼部：表达、品牌、招商、对外材料。
太医院：系统健康和组织健康。
```

### 9.3 闭环强

每个功能必须进入闭环：

```text
建议 -> 命令 -> 执行 -> 验收 -> 复盘 -> 新建议
```

如果只停留在“展示”，不算核心功能完成。

### 9.4 可复制

工部建设户部完成后，要能复制到：

```text
工部建设锦衣卫
工部建设史馆
工部建设礼部
工部建设兵部
工部建设太医院
```

复制时只换：

```text
目标部门
业务目标
预算模型
风险模型
验收标准
页面区块
```

底层 Workflow 不应重做。

## 10. 下一步任务

### P0

```text
1. 工部读取 build-budget.ts，展示户部建设任务。
2. 军机处识别 intent 参数，把户部 command 变成可下旨草稿。
3. 史馆新增“建设预算复盘”模板。
4. 上书房每日建议点击后能完整进入军机处。
```

### P1

```text
1. 给每条建设预算任务增加 acceptanceCriteria。
2. 给每条建设预算任务增加 assignedWindows。
3. 户部预算面板支持筛选：待批 / 已准 / 退回。
4. 工部 Workflow 看板显示预算状态。
```

### P2

```text
1. 真实后端 API。
2. 用户可编辑预算。
3. 模型成本计入户部预算。
4. 每日自动生成经营建议。
```

## 11. 最终验收标准

本阶段只有满足以下条件，才算“完美实现”：

```text
1. /court-briefing 能看到户部预算建议。
2. /manor-dept/finance 能看到建设预算面板。
3. 至少 3 个建设项目有预算、ROI、风险和建议动作。
4. 至少 1 个项目能跳转军机处立项。
5. 至少 1 个项目能跳转工部执行。
6. 工部能解释如何建设其他部门。
7. npm run build 通过。
8. 所有新增内容进入经营闭环，不是孤立页面装饰。
```

## 12. 一句话北极星

```text
朝堂 OS 不是古风 Dashboard，而是让老板每天知道“该决策什么、该投多少钱、谁去执行、何时验收、结果如何复盘”的 AI 经营操作系统。
```
