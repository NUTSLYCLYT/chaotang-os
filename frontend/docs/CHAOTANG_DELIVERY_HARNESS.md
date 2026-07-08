# 朝堂 OS 交付 Harness · 多智能体建设操作系统 v1

> 出品：窗口 A · Claude Opus 4.8 · 工部产品总设计
> 统一：[GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md](./GONGBU_HUBU_MULTI_AGENT_WORKFLOW.md)（方法论）+ [GONGBU_PRD_V1.md](./GONGBU_PRD_V1.md)（工部 PRD）
> 定位：这是把"想法 → 部门 → 最佳产品"工业化的**唯一操作系统**。任何窗口开工前先读本文 §2 的本窗口契约。
> 一句话：**Claude 出图纸与验收，Codex 施工与集成，次级模型补料，人工裁断；工部建中台，户部给预算，军机处立项，史馆复盘。**

---

## 0. 北极星：什么叫"2026 最佳产品"

不是功能最多，而是**用一套帝制隐喻把"老板经营决策 → 多智能体执行 → 闭环复盘"做成可演示、可信赖、可复制的操作系统**。

### 0.1 三条北极星指标（每周复盘必报）
| 指标 | 定义 | v1 目标 | 度量位置 |
|---|---|---|---|
| **建设边际成本↓** | 建第 N 个部门相对第一个的工时/token | 每部门递减 ≥20% | 史馆复盘 |
| **经营闭环时长↓** | 信号→圣旨→立项→交付→归档→次日建议 一圈 | ≤1 个工作日可演示 | operating-loop |
| **可演示完成率↑** | accepted 任务中"核心路径能现场点通"占比 | ≥95% | QA 验收记录 |

### 0.2 产品级"最佳"判据（验收老板用）
1. 老板打开**上书房**就看到今日该决策什么（经营信号+建议，一键下旨）。
2. **军机处**能把一句话变成任务、分派、看阻塞、裁断。
3. **工部**能把任意新部门当"工程"建出来，且越建越快。
4. **户部**能对每个建设任务给预算/ROI/风险。
5. **史馆**能复盘并把经验变成下次模板。
6. 全流程**可现场演示**，不靠口头脑补。

---

## 1. Harness 总览（一张图）

```text
            ┌──────────────────────────────────────────────┐
            │  北极星：建设边际成本↓ · 闭环时长↓ · 可演示率↑   │
            └──────────────────────────────────────────────┘
 上书房(经营信号/建议) ──下旨──▶ 军机处(立项) ──▶ 工部(建设中台)
        ▲                                            │
        │                                   拆 PRD/任务卡(Claude A)
   次日建议                                          │
        │                                   施工/集成(Codex B/D)
   史馆(复盘归档) ◀── QA验收(build+可演示) ◀── 户部(预算/ROI 闸门, Claude C)
            ▲                                        │
            └───────────── 模板复用(建完→复制) ◀──────┘
```

每条边都有：**输入 → 产物 → 验收门 → 主责窗口**（见 §3）。

---

## 2. 四窗口角色契约（开工前必读本窗口段）

> 铁律：四窗口**不同时改同一文件**（§9 冲突预防）。Claude 不搬砖，Codex 不拍架构。

### 窗口 A · Claude Opus 4.8 · 工部产品总设计（本文作者）
- **做**：PRD、信息架构、Workflow 字段、任务卡、验收标准、风险审查、最终产品评审。
- **不做**：大量改代码、跑 build、全仓搜索、mock 搬运。
- **可写文件**：`docs/**`、小范围 `gongbu-client.tsx`。
- **产出物**：PRD / 任务卡 / 验收单 / 复盘评语。

### 窗口 B · Codex · 工部工程实现
- **做**：实现工部页面、Workflow mock/contract、集成、修类型、跑 build。
- **可写文件**：`gongbu-client.tsx`、`features/operating-loop/**`、新增 `*-workflow.ts`。
- **产出物**：可运行 diff + build 通过 + 窗口收尾报告。

### 窗口 C · Claude Opus 4.8 · 户部经营/预算设计
- **做**：户部 PRD、预算/ROI/风险/优先级模型、建设任务审批字段。
- **可写文件**：`docs/**`、小范围 `hubu-client.tsx`。

### 窗口 D · Codex · 户部工程实现与集成
- **做**：落地户部预算字段、给建设任务补预算 mock、与 daily-brief/command-center 轻集成、跑 build。
- **可写文件**：`hubu-client.tsx`、`features/operating-loop/**`、必要时 `lib/contracts/dept.ts`。

### 次级模型 · 批量低风险料
- 任务卡初稿、mock、文案、checklist、字段表、日报、文案一致性检查。不碰架构、不改核心代码。

### 每窗口"开工六问 / 收尾六报"（强制）
```text
开工：1 我负责什么 2 我不碰什么 3 读哪些文件 4 改哪些文件 5 验收标准 6 完成后给谁集成
收尾：1 改了哪些文件 2 实现了什么 3 没做什么 4 build 是否通过 5 有无风险 6 下一窗口接什么
```

---

## 3. Workflow 状态机 + 闸门（13 态，全部门统一语言）

| # | status | 输入 | 产物 | **验收门(gate)** | 主责 |
|--:|---|---|---|---|---|
| 1 | idea | 一句话需求 | 问题定义 | 值不值得做说清 | 人工/Claude |
| 2 | prd | 问题定义 | 用户·场景·价值·边界 | 用户路径+不做什么明确 | **Claude A/C** |
| 3 | design_review | PRD | 页面结构·核心路径 | 核心路径走得通 | **Claude A/C** |
| 4 | tech_plan | 页面结构 | 文件边界·API·状态机 | 能分配给窗口 | Claude→Codex |
| 5 | assigned | 技术方案 | 任务卡·窗口边界 | 每窗口知道改哪里 | Claude A |
| 6 | building | 任务卡 | 代码/文档 diff | 实现不越界 | **Codex B/D** |
| 7 | integrating | 多窗口 diff | 可运行版本 | 类型/路由不冲突 | **Codex B** |
| 8 | qa | 可运行版本 | 问题清单·修复 | build 通过+核心路径可演示 | Codex+Claude |
| 9 | accepted | QA 通过 | 验收记录 | 老板可确认 | 人工 |
| 10 | archived | 验收记录 | 史馆复盘 | 下次能复用 | 次级模型 |

异常态：`blocked`（记录卡在哪/等什么）· `rework`（验收打回）· `cancelled`（记原因）。
**禁止跳门**：未过 prd 门不进 building；未过 qa 门不标 accepted。

---

## 4. 任务卡系统（canonical）

权威字段 = `operating-loop/lib/department-build-workflow.ts` 的 `DepartmentBuildTask`。模板与"填卡三问"见 [GONGBU_PRD_V1.md §4](./GONGBU_PRD_V1.md)。

- **ID 规范**：`build-<dept>-<slug>`（部门建设）；`<DEPT>-NN-<slug>`（中台内部任务，如 GB-01）。
- **生命周期**：idea→…→archived，每次状态流转必须更新卡上 `status` 并在看板可见。
- **唯一真相**：任务卡是跨窗口契约；窗口 B/D 只按已 `assigned` 的卡施工，不自行扩范围。

---

## 5. 验收标准 + 质量闸门（防"假完成"）

### 5.1 全局 DoD（每卡通用）
1. `npm run build` 通过（Codex 跑）。2. 目标路由正常显示无溢出。3. `requiredPanels` 全出现。4. ≥1 条核心路径可现场点通。5. 不改 globals.css/冻结视觉/他窗口文件。

### 5.2 对抗式验收（关键卡 P0/P1 强制）
> 单一窗口自验 = 自己写自己审，盲区大。P0/P1 卡过 qa 门前，由**另一个窗口/模型**做对抗复核：
1. **怀疑论者**：默认"没真完成"，逐条挑 acceptanceCriteria 是否真能演示。
2. **越界审查**：是否动了不该动的文件 / 破坏冻结视觉。
3. **路径复演**：实际点一遍核心路径（截图为证），而非读代码臆断。
≥2 项通过才可 accepted；否则打回 `rework`。

### 5.3 验收可见性
验收态卡显示 `通过 x/y`，全勾才允许 accepted（见 PRD 任务卡 GB-03）。

---

## 6. 部门建设流水线（复制工法的顺序与依赖）

统一工法（每部门只换"目标能力+requiredPanels+验收路由"）：
```text
工部提计划 → 户部评预算/ROI → 军机处立项 → 工部组织Claude/Codex执行 → QA验收 → 史馆归档 → 上书房次日建议
```

| 顺位 | 部门 | route | 依赖 | 状态 |
|--:|---|---|---|---|
| 0 | 工部(中台自身) | /manor-dept/works | — | 底座已成，v1 补状态可见性/验收/复用（PRD §7 GB 卡） |
| 1 | **户部** finance | /manor-dept/finance | 工部中台 | 种子卡 build-hubu-v1（先做，它是其他部门的预算闸门） |
| 2 | 锦衣卫 guard | /manor-dept/guard | 户部(测算) | 种子卡 build-jinyiwei-invest-intel |
| 3 | 史馆 shiguan | /shiguan | 工部(复盘字段) | 种子卡 build-shiguan-dev-archive |
| 4 | 兵部 ops | /manor-dept/ops | 户部(资源) | 待建 GB-04 |
| 5 | 礼部 libu | /libu | — | 待建 |
| 6 | 太医院 physician | /manor-dept/physician | — | 待建 |

**关键依赖**：户部必须先于其他部门有可用预算/ROI 模型，否则后续部门无法被"按预算和风险排优先级"。

---

## 7. 调度节奏 + Token 预算

| 时段 | Claude A/C | Codex B/D | 次级模型 |
|---|---|---|---|
| 上午 | 定方向、PRD、验收标准 | — | — |
| 中午 | （审 Codex 方案） | 实现工部/户部 | 起草任务卡/mock |
| 下午 | 审产品/财务是否跑偏 | 集成、修 build、QA | QA checklist/日报 |
| 晚上 | 复盘评语 | — | 史馆归档/日报 |

**动态预算规则（不死分比例）**：
- Claude 充足 → 先定产品形态+验收；Claude 紧张 → 只审 Codex 方案不写长文。
- Codex 充足 → 多读仓库/多实现/多跑 build；紧张 → 严格按文件边界执行。
- 次级充足 → 所有任务卡/mock/checklist 都给它。
- 模型路由实参见 [[project-model-routing]]（DeepSeek V3 worker / R1 reasoner / Codex 工程 / Claude Max 决策）。

---

## 8. 风控与冲突预防（硬约束）

| 风险 | 缓解（强制） |
|---|---|
| 多窗口改同一文件 | §2 文件边界；`daily-brief.ts` 是工部+户部共用 **热点**，改前在群里报锁，单窗口串行改 |
| 越界搬砖（Claude 写代码） | Claude 只产 docs/设计；越界产物转任务卡交 Codex（如 OL-INT-01） |
| 假完成 | §5.2 对抗式验收 + 截图复演 |
| 视觉资产被破坏 | 禁改 globals.css / design-tokens / keyframe；复用 GlassPanel+既有色板 |
| 端口打挂生产 | prod=3050 / dev=3002；**3001 禁用**；占端口先查清再处理，不默默 kill |
| 远端冲突 | 脏工作区不盲目 pull；先各窗口提交/推送 WIP，再同步（见 §10） |

---

## 9. 度量与复盘（史馆每晚归档）
每晚记录：① 今天建了什么 ② 哪个模型做了什么 ③ token 消耗是否合理 ④ 明天继续哪些 ⑤ 哪些模板可复用。
聚合到北极星三指标（§0.1），每周复盘判断"是否在变成 2026 最佳产品"。

---

## 10. 仓库同步纪律（Gitee origin）

> 本舱多窗口并发 + 远端 `origin`(gitee) 也在前进 → **同步是高风险动作，必须有序**。

**铁律**：
1. **先提交本窗口已完成、可 build 的改动**（按文件边界，只 add 自己的文件），不 stash/丢弃他窗口 WIP。
2. 同步前 `git status` 清点；脏工作区（他窗口未提交）时**不执行会触发 merge 覆盖的 pull**。
3. 同步用 `git fetch` 看清差异，再决定 `merge`/`rebase`；冲突文件逐个由"该文件 owner 窗口"解决。
4. 网络不稳（gitee pack 传输卡）时：重试 `git fetch`，或人工 `! git fetch origin`（可见进度），必要时 `--depth` 浅取。

**当前状态（2026-06-01）**：本地 master 含窗口 A 两提交（operating-loop 集成 + PRD）；远端 `bab8ba4` 领先本地基线；工作区有 B/C/D 未提交 WIP。**建议**：各窗口先各自提交自己边界内文件并推送，再统一 fetch+merge，由 owner 解冲突。

---

## 11. 启动清单（新建设循环 / 新部门，可复制）

```text
[ ] 1. 上书房产生信号/需求（或老板一句话）        → idea
[ ] 2. Claude A 写 PRD（用户/场景/价值/边界）      → prd 门
[ ] 3. Claude A 出页面结构+核心路径               → design_review 门
[ ] 4. Claude A 出文件边界/状态机/任务卡           → tech_plan/assigned 门
[ ] 5. 户部(C) 给预算/ROI/风险                     → 军机处立项
[ ] 6. Codex B/D 按卡施工（不越界）               → building
[ ] 7. Codex B 集成（类型/路由不冲突）            → integrating
[ ] 8. 对抗式验收 + build + 截图复演               → qa 门
[ ] 9. 老板确认                                    → accepted
[ ] 10. 史馆归档 + 抽取模板                        → archived → 复用到下个部门
```

> 本 harness 是活文档：每次纠错追加一条规则/一条对抗验收项，让系统越用越聪明。
> 下一步建议：窗口 B 领 PRD §7 的 GB-01/GB-02；窗口 C 出户部 PRD；同步纪律按 §10 执行。
