# 户部经营预算中台 — 设计文档（窗口 C 交付）

> 角色：Claude Opus 4.8 · 户部经营/预算设计/投资分析
> 依据：`chaotang-web-lyt/docs/GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md`
> 实现位置：`chaotang-os/web`（主战场，采纳文档理念与数据契约）
> 日期：2026-06-01

---

## 1. 核心定位升级

| 维度 | 旧户部（财务仪表盘） | 新户部（经营预算中台） |
|---|---|---|
| 本质 | 看自己的钱 | 决定建设投资 |
| 数据 | 财务指标/预算/投资 | + 部门建设投资项 |
| 行为 | 展示 | 评估 → 裁决 |
| 价值 | 知道花了多少 | 知道该投什么、投多少、什么优先级 |

户部回答文档 4.2 节六问：
1. 现在有多少资源 → BudgetOverview
2. 哪些项目正在花钱 → spent 字段
3. 哪些值得继续投 → ROI 引擎
4. 哪些风险过高 → 风险矩阵
5. 工部建设其他部门要多少预算 → requestedBudget/approvedBudget
6. 每个建设任务的 ROI 和优先级 → scorePriority + rankBuildProjects

---

## 2. 决策闭环（文档 4.3 落地）

```
工部提建设需求 (EngineeringProject)
   │  mapEngineeringToBuild()
   ▼
户部建设投资项 (DepartmentBuildProject)
   │
   ├─ ① ROI引擎    computeROI / computePayback / NPV
   ├─ ② 风险矩阵    computeRiskExposure (预算规模 × 风险系数)
   └─ ③ 优先级评分  scorePriority → 0-100
   │
   ▼
户部裁决 recommendVerdict → approve / adjust / hold / reject
   │
   ▼
军机处立项 → 工部执行 → QA → 史馆归档 → 上书房次日建议
```

---

## 3. Workflow 状态机（文档第 5 节）

```
idea → prd → design_review → tech_plan → assigned
   → building → integrating → qa → accepted → archived
旁路：blocked / rework / cancelled
```

每个建设投资项带 workflowStatus，户部按状态分组展示进度。

---

## 4. 三大评估引擎

### ① ROI 引擎
- `computeROI(revenue, cost) = (revenue - cost) / cost × 100`
- `computePayback(cost, monthlyCashflow) = cost / monthlyCashflow`（月）
- 优质门槛：ROI > 20% 且 回本 < 18 月

### ② 风险矩阵
- `riskExposure = budget规模系数 × riskLevel系数`
- 红线：high 风险 × 大预算 → 敞口 > 70 → 触发 hold/reject
- 四象限（ROI × 风险敞口）：
  - 左上 高ROI低风险 → 绿「优先投」
  - 右上 高ROI高风险 → 黄「谨慎」
  - 左下 低ROI低风险 → 灰「观望」
  - 右下 低ROI高风险 → 红「否决」

### ③ 优先级评分
```
scorePriority = expectedRoi权重 0.4
              + strategicValue 0.3
              + (100 - riskExposure) 0.3
→ 0-100，决定 P0/P1/P2
```

---

## 5. 户部裁决规则（recommendVerdict）

| 条件 | 裁决 | 含义 |
|---|---|---|
| 评分 ≥ 75 且敞口 < 50 | approve | 批准，按申请预算 |
| 评分 60-75 | adjust | 批准但削减预算/分阶段 |
| 评分 40-60 或敞口 > 70 | hold | 缓议，需补充论证 |
| 评分 < 40 或 ROI 为负 | reject | 否决 |

---

## 6. 验收标准（文档第 9 节任务卡）

- [ ] /chaotang/hubu 切到「建设投资」视图正常显示
- [ ] 至少 3 个待批建设项目，每个有预算/ROI/风险/裁决
- [ ] ROI 风险矩阵四象限可视化
- [ ] 工部建设任务能映射为户部投资项
- [ ] 户部 AI 可对建设项目下裁决（approve/adjust/hold/reject）
- [ ] bun test 全绿，bunx tsc 零错误

---

## 7. 文件清单（本次 harness 产出）

```
lib/hubu-build.ts                              建设投资决策模型 + 三引擎纯函数
lib/__tests__/hubu-build.test.ts               TDD 25+ 测试
lib/build-bridge.ts                            工部→户部映射桥
lib/ai/hubu-build-verdict.ts                   户部AI建设裁决
components/court/hubu/build-project-list.tsx   待批建设项目列表
components/court/hubu/roi-risk-matrix.tsx      ROI风险矩阵
components/court/hubu/build-budget-overview.tsx 建设预算总览
app/chaotang/hubu/page.tsx                     新增「建设投资」Tab视图
```

---

## 8. 后续：复用为部门建设模板

户部建设投资模型一旦坐实，即成为工部建设**所有部门**的预算审批标准件：
- 建设兵部（竞争情报）→ 户部评估 ROI/风险
- 建设锦衣卫（安全）→ 户部评估
- 建设太医（系统健康）→ 户部评估

这正是文档"先建工法，再复制"的核心 —— 户部是所有建设决策的统一闸门。
