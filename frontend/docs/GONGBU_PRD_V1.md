# 工部 PRD v1 · 建设其他部门的工程中台

> 出品：窗口 A · Claude Opus 4.8 · 工部产品总设计（总设计院 + 产品御史）
> 配套：[GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md](./GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md)
> 边界：本文只做设计/PRD/任务卡/验收标准，不改业务代码。实现交窗口 B（Codex）。
> 现状基线：`gongbu-client.tsx` + `operating-loop/lib/department-build-workflow.ts` 已落地一版。

---

## 0. 一句话定位

**工部不是部门页，是「建设其他部门的操作系统」。** 其他部门各自盖房子之前，工部先建好施工队、图纸库、验收标准、预算审批、监理流程；之后每建一个部门都是复制成熟工法。

衡量工部成功的唯一标准：**建完户部后，建兵部/锦衣卫/史馆/礼部/太医院的边际成本持续下降。**

---

## 1. 现状评审（对照 §4.1 六大能力）

| 能力 | 要求 | 现状（已落地） | 缺口（窗口 B 待补） |
|---|---|---|---|
| ① 建设需求池 | 哪些部门/模块要建 | ✅ `DEPARTMENT_BUILD_TASKS` 3 条（户部/锦衣卫/史馆） | 缺兵部/礼部/太医院种子卡；缺「需求→任务卡」录入入口 |
| ② Workflow 编排 | 每个任务经哪些阶段 | ✅ 10 态状态机 + 看板渲染 | 看板只显示「是否 active」，**不显示每条任务当前停在哪一态**；缺 blocked/rework 可视化 |
| ③ 智能体分工 | 四类角色做什么 | ✅ `assignees`（claude/codex/secondary/human） | 分工卡只读样板任务；缺「按当前阶段高亮该谁动手」 |
| ④ 工程进度 | 做/阻塞/待验收/归档 | ⚠️ 有状态字段，无进度聚合视图 | 缺「进行中 N / 阻塞 N / 待验收 N / 已归档 N」概览条 |
| ⑤ 验收标准 | 每模块怎么算完成 | ✅ `acceptanceCriteria` 逐条展示 | 验收态无「勾选/通过率」；缺全局 DoD |
| ⑥ 复用模板 | 建完复制到他部 | ⚠️ 数据结构可复用，无「另存为模板/一键起新部门」动作 | 缺模板库与复制入口 |

**结论**：工程底座扎实（契约 + 渲染完整），产品缺口集中在 **②④⑤⑥ 的"状态可见性与复用闭环"**。v1 目标就是补齐这四点，而非加新视觉。

---

## 2. 工部页面信息架构 v1（IA）

路由：`/manor-dept/works`。沿用现有暗色工程风（不动 globals.css、不重写视觉）。区块从上到下：

```text
A. 战情室头（DepartmentWarRoom tone="works"）         —— 保留
B. 开发司令部头条 + [开发总控][立刻下旨]              —— 保留
C. 建设进度概览条（新）  进行中/阻塞/待验收/已归档 计数 + 各态点击筛选
D. 建设任务池（左 1.15fr）                            —— 增：每卡显示当前 workflowStatus 徽标 + 「另存为模板」
E. Workflow 状态看板（右 0.85fr）                     —— 改：高亮"当前任务停留态"，blocked/rework 用 danger/warn 色
F. 开发助手台（DEV_ASSISTANTS）                       —— 保留
G. 标准开发闭环（OPERATING_LOOP 6 步）                —— 保留
H. 智能体分配（按当前阶段高亮"该谁动手"）             —— 增：阶段→负责窗口映射
I. 验收标准（必建面板/用户价值/验收清单 + 通过率）    —— 增：验收态显示 x/y 已勾
J. 模板库（新）  建完的部门可"复制为新部门建设任务"
K. 工部开发队（DEV_TEAM）                             —— 保留
```

新增区块 **C / J** 是 v1 的核心增量；D/E/H/I 是在既有区块上加"状态可见性"。**不新增页面、不改路由、不动 5 列网格之外的全局布局。**

---

## 3. Workflow 状态机字段规范（权威版）

与 `department-build-workflow.ts` 的 `WorkflowStep` 完全对齐，作为所有部门建设的统一语言：

| # | status | label | 输入 | 输出 | 验收门（gate） | 主责窗口 |
|--:|---|---|---|---|---|---|
| 1 | idea | 想法 | 一句话需求 | 问题定义 | 值不值得做说清楚 | 人工 / Claude |
| 2 | prd | PRD | 问题定义 | 用户·场景·价值·边界 | 用户路径 + 不做什么都明确 | **Claude A** |
| 3 | design_review | 设计评审 | PRD | 页面结构·核心路径 | 核心路径能走通 | **Claude A** |
| 4 | tech_plan | 技术方案 | 页面结构 | 文件边界·API·状态机 | 能分配给窗口 | Claude A → Codex B |
| 5 | assigned | 已分配 | 技术方案 | 任务卡·窗口边界 | 每个窗口知道改哪里 | Claude A |
| 6 | building | 开发中 | 任务卡 | 代码/文档 diff | 实现不越界 | **Codex B/D** |
| 7 | integrating | 集成 | 多窗口 diff | 可运行版本 | 类型/路由不冲突 | **Codex B** |
| 8 | qa | 验收 | 可运行版本 | 问题清单·修复 | build 通过 + 核心路径可演示 | Codex B + Claude A |
| 9 | accepted | 已验收 | QA 通过 | 验收记录 | 用户可确认 | 人工 |
| 10 | archived | 已归档 | 验收记录 | 史馆复盘 | 下次能复用 | 次级模型 |

异常态：`blocked`（阻塞，需记录卡在哪、等什么）、`rework`（返工，验收未过打回）、`cancelled`（取消，记录原因）。

**规范要求**：每条任务卡的 `status` 必须落在上表 13 态之一；看板必须能定位每条任务"现在停在哪一态"（现状缺口 ②）。

---

## 4. 任务卡模板（canonical · 所有部门建设统一格式）

权威字段 = `DepartmentBuildTask`。新建任意部门建设任务，照此填写：

```yaml
id: build-<dept>-<slug>            # 唯一，kebab
title: 建设<部门><能力> v<n>
targetDept: hubu|bingbu|jinyiwei|shiguan|libu|taiyi|command-center
ownerDept: gongbu                  # 恒为工部
status: idea|prd|...|archived      # §3 状态机
priority: P0|P1|P2
businessGoal: 一句话商业目标（为什么值得建）
userValue:                         # 3-4 条，决策者视角
  - ...
requiredPanels:                    # 该部门页必须出现的区块（= 验收锚点）
  - ...
acceptanceCriteria:                # 可机检 + 可演示，必含 "npm run build 通过"
  - /manor-dept/<route> 正常显示
  - ...
  - npm run build 通过
assignees:                         # 四窗口分工
  - { role: 产品设计, ownerModel: claude,    responsibility: ... }
  - { role: 工程实现, ownerModel: codex,     responsibility: ... }
  - { role: 批量材料, ownerModel: secondary, responsibility: ... }
  - { role: 最终裁断, ownerModel: human,     responsibility: ... }
budgetLevel: low|medium|high       # 交户部测算的初值
riskLevel: low|medium|high
commandDraft: 让军机处立项建设...   # 一键下旨草稿（接圣旨流）
nextHref: /command-center?task=<id>&intent=<urlencoded>
budgetHref: /manor-dept/finance
archiveHref: /archive
```

**填卡三问**（窗口 A 写卡时必答）：① 这件事不做会怎样？② 验收靠哪个 URL + 哪几条可演示？③ 哪个窗口动哪些文件、不碰什么？

---

## 5. 验收标准规范

### 5.1 全局完成定义（DoD，每张卡都适用）
1. `npm run build` 通过（窗口 B 跑，非 Claude）。
2. 目标路由可正常显示，无明显溢出。
3. `requiredPanels` 全部出现。
4. 至少 1 条可演示的核心路径（点击→看到结果）。
5. 不改 globals.css / 冻结视觉资产 / 他窗口文件。

### 5.2 阶段门（gate，对应 §3）
- **prd/design_review 门**（Claude A 把）：用户路径走得通、边界写清、不做什么列明 → 才可进 tech_plan。
- **tech_plan/assigned 门**（Claude A 把）：文件边界互不重叠、每窗口知道改哪里 → 才可进 building。
- **qa 门**（Codex B + Claude A）：build 通过 + 核心路径可演示 + 验收清单逐条勾 → 才可 accepted。

### 5.3 验收可见性（v1 缺口）
验收态卡片显示 `通过 x/y`，全勾才允许标 accepted。窗口 B 实现为 `acceptanceCriteria` 上叠加 `checked: boolean`（mock 即可）。

---

## 6. 工部建设各部门的复用模板

统一工法：**工部提计划 → 户部评预算/ROI → 军机处立项 → 工部组织 Claude/Codex 执行 → QA 验收 → 史馆归档 → 上书房次日建议。** 各部门只换"目标能力 + requiredPanels + 验收路由"：

| 目标部门 | route | 建设主题（businessGoal 摘要） | requiredPanels 模板 | 种子卡 |
|---|---|---|---|---|
| 户部 finance | /manor-dept/finance | 经营预算与资源配置中台 | 建设预算总览·待批项目·ROI与风险矩阵·现金流压力·户部建议 | ✅ build-hubu-v1 |
| 锦衣卫 guard | /manor-dept/guard | 投资情报暗线 | 情报雷达·证据链·交户部测算·风险标记·史馆草档 | ✅ build-jinyiwei-invest-intel |
| 史馆 shiguan | /shiguan | 开发复盘档案 | 开发档案·QA证据·复盘评分·下次建议·模板复用 | ✅ build-shiguan-dev-archive |
| 兵部 ops | /manor-dept/ops | 作战调度与资源占用 | 战局总览·任务队列·资源占用·阻塞看板·调度建议 | ⬜ 待建（见 §7 GB-04） |
| 礼部 libu | /libu | 招商话术与对外材料 | 话术库·材料模板·对外档案·合规校验·一键生成 | ⬜ 待建 |
| 太医院 physician | /manor-dept/physician | 团队/系统健康风控 | 健康总览·风险预警·团队执行·处置建议·复诊 | ⬜ 待建 |

**复用动作（v1 缺口⑥）**：任一已 accepted 的部门卡支持「复制为新部门建设任务」，预填同结构、换 targetDept/route/requiredPanels。

---

## 7. 任务卡 Backlog（交窗口 B/D 实现，逐张可领）

> 全部为工部中台自身的工程任务（targetDept=gongbu / command-center），文件边界限定在 §6 工部相关，不碰户部实现。

```yaml
- id: GB-01-progress-overview
  title: 工部建设进度概览条
  status: tech_plan  priority: P0  owner: Codex B
  改文件: gongbu-client.tsx + operating-loop/lib/department-build-workflow.ts(只读)
  做: 在区块C加"进行中/阻塞/待验收/已归档"计数条，点击按 status 筛选任务池
  acceptanceCriteria: [四类计数与任务池一致, 点击可筛选, npm run build 通过]

- id: GB-02-workflow-current-state
  title: Workflow 看板显示每条任务当前态
  status: tech_plan  priority: P0  owner: Codex B
  做: 看板每态显示停留任务数；blocked→danger、rework→warn 配色；当前态高亮
  acceptanceCriteria: [每态显示任务数, 异常态有别色, npm run build 通过]

- id: GB-03-acceptance-checklist
  title: 验收清单可勾 + 通过率
  status: tech_plan  priority: P1  owner: Codex B
  做: acceptanceCriteria 叠加 checked(mock)，验收态显示 x/y，全勾才可 accepted
  acceptanceCriteria: [显示通过率, 未全勾不可标 accepted, npm run build 通过]

- id: GB-04-seed-cards-bingbu-libu-taiyi
  title: 补兵部/礼部/太医院种子建设卡
  status: prd  priority: P1  owner: 次级模型起草 → Codex B 落库
  做: 按 §4 模板各加 1 张种子 DepartmentBuildTask（§6 表）
  acceptanceCriteria: [三卡字段完整, 任务池可见, nextHref 可跳军机处, npm run build 通过]

- id: GB-05-template-reuse
  title: 部门卡"复制为新部门建设任务"
  status: idea  priority: P2  owner: Claude A 定交互 → Codex B 实现
  做: accepted 卡可一键复制，换 targetDept/route/requiredPanels 预填新卡
  acceptanceCriteria: [能从已建部门派生新卡, 新卡进 idea 态, npm run build 通过]

- id: OL-INT-01-operating-signals-panel
  title: 集成"今日经营简报"信号面板（含证据链）
  status: assigned  priority: P1  owner: Codex B
  背景: 窗口A越界先写了组件 src/features/operating-loop/components/OperatingSignalsPanel.tsx（已建，未引用，build 不受影响）
  做: 由 Codex 决定落位（建议工部"经营简报"入口 ImperialModal 承载），接 onDispatch→圣旨流
  acceptanceCriteria: [面板渲染signals+evidence+下旨按钮, 不破坏布局, npm run build 通过]
```

**优先级**：GB-01 / GB-02（状态可见性）→ GB-03（验收闭环）→ GB-04（种子扩容）→ OL-INT-01 → GB-05（复用）。

---

## 8. 风险审查（产品御史）

| 风险 | 说明 | 缓解 |
|---|---|---|
| 越界搬砖 | 窗口 A（我）已发生一次（手写 OperatingSignalsPanel） | 已纠正：转 OL-INT-01 交 Codex；此后 Claude 只出 docs/设计 |
| 看板"假完成" | active 集合让所有态看着像在跑，实则只 3 条任务 | GB-02 显示真实停留数，避免误读 |
| 户部耦合 | 工部卡引用 budgetHref/finance，但户部预算模型未定 | 由窗口 C（户部设计）出预算字段，GB-04 前对齐 |
| 验收口径漂移 | 各卡 acceptanceCriteria 风格不一 | §5 DoD 统一兜底，必含 build 通过 + 路由可显示 |
| 视觉资产被动 | 新区块若自造样式会破坏冻结风格 | 复用 section-eyebrow/GlassPanel/既有色板，禁改 globals.css |

---

## 9. 给各窗口的交接

- **窗口 B（Codex 工部实现）**：按 §7 backlog 从 GB-01 起领卡，文件限 §6 工部相关，每卡跑 build + 报"改了哪些文件/没做什么/风险/下一窗口接什么"。
- **窗口 C（Claude 户部设计）**：在 GB-04 之前交户部预算/ROI 字段，供工部卡 budgetLevel 对齐（见配套 doc §4.2）。
- **窗口 D（Codex 户部实现）**：消费窗口 C 字段，回填户部待批建设项目。
- **次级模型**：起草 GB-04 三张种子卡 + 各卡 QA checklist + 日报。

> 本轮一句话：工部底座已成，v1 补"状态可见性 + 验收闭环 + 复用模板"三件事，Claude 出图纸，Codex 施工。
