# 户部 PRD v1 · 经营预算与资源配置中台

> 出品：窗口 C · Claude Opus 4.8 · 户部经营/预算设计
> 上位：[CHAOTANG_DELIVERY_HARNESS.md](./CHAOTANG_DELIVERY_HARNESS.md) · 配套：[GONGBU_PRD_V1.md](./GONGBU_PRD_V1.md) / [GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md](./GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md)
> 边界：窗口 C 只产设计/PRD/字段/验收，不大改代码（可小改 `hubu-client.tsx` 或新增 docs）。实现交窗口 D（Codex）。
> 现状基线：`operating-loop/lib/build-budget.ts`（预算契约，窗口 D 已建）+ `hubu-client.tsx` 已渲染"户部建设预算"区。

---

## 0. 定位与北极星对齐

**户部不是财务图表，是「经营预算与资源配置中台」** —— 它是工部建设所有部门的**预算闸门**：没有户部的预算/ROI/风险判断，军机处无法"按预算和风险排优先级"。

对照 Harness §0 北极星，户部直接服务：
| 北极星 | 户部贡献 |
|---|---|
| 建设边际成本↓ | 给每个部门建设任务定预算上限、限范围（"先批 3 面板 1 链路，验收后再扩"） |
| 闭环时长↓ | 预算审批不卡壳：pending→approved/needs_rework 当日可裁 |
| 可演示完成率↑ | 每个待批项目都有预算/ROI/风险/建议动作，老板一眼能裁 |

---

## 1. 现状评审（对照方法论 §4.2 户部六问）

| 户部必答 | 现状（build-budget.ts 已有） | 缺口（窗口 D 待补） |
|---|---|---|
| ① 现在有多少资源 | ⚠️ 仅 `cashReserve 71%` | 缺"可用额度/已分配/runway"资源总览 |
| ② 哪些项目正在花钱 | ✅ status=approved（工部 Workflow 18万） | 缺"已批项目执行进度/烧钱速度" |
| ③ 哪些项目值得继续投 | ✅ `estimatedRoi`（2.8x 均值） | 缺 ROI 排序与"继续/暂缓"显式建议位 |
| ④ 哪些项目风险过高 | ✅ riskLevel + needs_rework（锦衣卫 1.6x/高/退回） | 缺风险×ROI 矩阵可视 |
| ⑤ 工部建设需多少预算 | ✅ `requestedBudget` 逐项 | 够用 |
| ⑥ 每个任务 ROI 与优先级 | ✅ estimatedRoi + priority | 缺**统一排序规则**（P×ROI×risk→顺位） |

**结论**：预算契约扎实（窗口 D 已落地审批字段 + 4 个预算项 + 汇总）。户部缺口是 **①资源总览 + ③④的"值不值得投"可视化 + ⑥优先级排序规则**。v1 补这三点，不加新视觉。

---

## 2. 户部页面信息架构 v1（IA）

路由：`/manor-dept/finance`，沿用 #F0C66A 帝金财务风（不改 globals.css）。区块：

```text
A. 战情室头（DeptOverview：minister/status/keyMetrics/risks）   —— 保留
B. 资源总览条（新）  现金储备/本周已批/待批额度/runway/平均ROI    —— 扩 BUILD_BUDGET_SUMMARY
C. 待批建设项目（核心）  每项：预算·ROI·回收期·现金流压力·风险·建议·[去军机处立项]
D. ROI × 风险矩阵（新）  四象限放置各项目，"高ROI低风险"优先、"低ROI高风险"暂缓
E. 已批项目执行（新）  approved 项目的烧钱进度/回收窗口
F. 户部建议（新）  本周经营建议（= BUILD_BUDGET_SUMMARY.recommendation 展开）
```

新增 B/D/E/F 是 v1 增量；C 在既有"户部建设预算"区上补排序与跳转。**不新增页面、不改路由、不动全局布局。**

---

## 3. 工部建设任务的预算审批模型（权威）

对齐 `build-budget.ts` 的 `DepartmentBuildBudget`，作为所有建设任务的预算语言：

### 3.1 审批状态机
```text
pending_review ──准──▶ approved        （进军机处立项 → 工部施工）
       │
       └──退──▶ needs_rework ──补齐──▶ pending_review
```
| 状态 | 含义 | 进入条件 | 出口动作 |
|---|---|---|---|
| pending_review | 待批 | 工部提交建设任务 + requestedBudget | 户部裁：准/退 |
| approved | 已准 | ROI 达标 + 风险可控 + 现金流可承受 | 生成 command → 军机处立项 |
| needs_rework | 退回补充 | 数据源/口径/误报方案缺失 或 ROI 过低 | 工部/锦衣卫补齐再报 |

### 3.2 字段规范（每个建设预算项必填）
`requestedBudget`(预算上限) · `estimatedRoi`(倍数) · `paybackWindow`(回收期) · `cashflowPressure`(低/中/高) · `priority`(P0/P1/P2) · `riskLevel`(低/中/高/紧急) · `recommendation`(显式"准/退/暂缓"+理由) · `command`(一键立项草稿) · `acceptanceCriteria`(验收锚点) · `assignedWindows`(产品/工程/集成/评审四窗口)。

### 3.3 优先级排序规则（v1 缺口⑥，户部裁断的核心逻辑）
> 让"先投什么"有据可依，而非拍脑袋。综合排序键（越小越先）：
```text
sortKey = priorityRank(P0=0,P1=1,P2=2) * 100
        + riskRank(low=0,med=1,high=2,critical=3) * 10
        - roiBucket(roi>=3→0, 2~3→2, <2→4)        # ROI 越高越靠前
建议动作：
  - roi>=2.5 且 risk<=medium 且 P<=P1 → 准（approved）
  - risk>=high 或 roi<1.8           → 退（needs_rework，要求补口径）
  - 其余 → 限范围批（先批最小可演示集，验收后扩）
```
当前 4 项按此规则：工部Workflow(已准4.1x低险) > 户部v1(P0/3.2x/中) > 史馆(2.4x低险小投入) > 锦衣卫(1.6x/高险→退回补口径)。与窗口 D 现状一致 ✓。

---

## 4. 户部对外数据出口（服务全链路）

| 给谁 | 数据 | 用途 |
|---|---|---|
| **军机处** | approved 项目的 `command` + 预算上限 | 一键立项，带预算约束开工 |
| **上书房** | 待批/退回项目转经营信号（接 daily-brief.signals，source='finance'） | 老板次日优先裁决预算 |
| **史馆** | 项目 投入(requestedBudget) vs 产出(实际 ROI) | 复盘投入产出，校准下次预算 |
| **工部** | 每个建设任务的预算上限 + 范围限制 | 工部按预算定 requiredPanels 边界，控建设成本 |

**关键联动**：户部"退回补充"的项目（如锦衣卫）→ 上书房出"建议先补口径"信号 → 不浪费工部施工额度。这正是闭环时长↓的体现。

---

## 5. 验收标准

### 5.1 户部 DoD
1. `/manor-dept/finance` 正常显示，无溢出。2. 资源总览 + 待批项目 + ROI风险 + 户部建议 四类区块齐。3. 每个待批项目有 预算/ROI/风险/建议动作。4. ≥1 项目可跳军机处立项。5. `npm run build` 通过。6. 不改 globals.css/他窗口文件。

### 5.2 业务正确性（产品御史复核）
- 排序规则跑出来的顺位与 recommendation 不矛盾（高险低ROI 不应排在前/被建议"准"）。
- needs_rework 项目必须列明"缺什么"，否则工部无法补齐。
- 预算总额（totalRequested）≥ 各项之和；approved 不超 cashReserve 承受范围。

---

## 6. 任务卡 Backlog（交窗口 D 实现，文件限户部相关）

> 文件边界：`hubu-client.tsx` / `operating-loop/lib/build-budget.ts` / 必要时 `lib/contracts/dept.ts`。**不碰 gongbu-client.tsx 主体**。

```yaml
- id: HB-01-resource-overview
  title: 户部资源总览条
  status: tech_plan  priority: P0  owner: Codex D
  做: 区块B用 BUILD_BUDGET_SUMMARY 渲染 现金储备/本周已批/待批额度/runway/均ROI
  acceptance: [五项与数据一致, npm run build 通过]

- id: HB-02-priority-ranking
  title: 待批项目按 §3.3 规则排序 + 显式建议位
  status: tech_plan  priority: P0  owner: Codex D
  做: DEPARTMENT_BUILD_BUDGETS 按 sortKey 排序；每项显 准/退/限批 徽标 + recommendation
  acceptance: [顺位符合规则, 徽标与recommendation一致, npm run build 通过]

- id: HB-03-roi-risk-matrix
  title: ROI × 风险 四象限矩阵
  status: prd  priority: P1  owner: Claude C 定象限 → Codex D 实现
  做: 区块D 四象限放置各项目点，高ROI低风险高亮
  acceptance: [四项目落对象限, 不破坏视觉, npm run build 通过]

- id: HB-04-finance-signals-to-study
  title: 户部待批/退回 → 上书房经营信号
  status: idea  priority: P1  owner: Claude C 定字段 → Codex D 接 daily-brief
  做: 退回项目生成 source='finance' 的 OperatingSignal（接 §4 出口）
  acceptance: [上书房能看到户部信号, 一键下旨, npm run build 通过]
```

优先级：HB-01 / HB-02（资源可见 + 排序闸门）→ HB-03（矩阵）→ HB-04（上书房联动）。

---

## 7. 风险审查（产品御史）

| 风险 | 缓解 |
|---|---|
| 预算口径漂移 | §3.2 字段规范统一；金额单位统一"万" |
| 排序与建议打架 | §5.2 业务正确性复核：规则顺位必须和 recommendation 自洽 |
| 共用文件冲突 | `build-budget.ts`/`daily-brief.ts` 是热点，窗口 D 改前按 Harness §8 报锁，勿与窗口 B 同时改 |
| 视觉破坏 | 复用 #F0C66A 帝金 + GlassPanel，禁改 globals.css |
| 假完成 | P0 卡（HB-01/02）过 qa 走 Harness §5.2 对抗复核 + 截图复演 |

---

## 8. 交接
- **窗口 D（Codex 户部实现）**：从 HB-01/HB-02 起领卡，文件限户部相关，收尾报 Harness §2 六报。
- **窗口 A（工部）**：户部 §3 预算上限将约束工部任务卡 budgetLevel，GB-04 前对齐。
- **次级模型**：起草各预算项 recommendation 文案 + ROI 风险解释 + QA checklist。

> 本轮一句话：户部预算契约已成，v1 补"资源总览 + 优先级排序闸门 + 上书房联动"，让"先投什么"有据、"建设成本"有界。
