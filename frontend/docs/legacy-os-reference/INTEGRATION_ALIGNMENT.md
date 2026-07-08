# 朝堂 OS — 前后端集成对齐方案

> 状态：草案 v1（2026-06-02）
> 目的：把当前**两套互不相连的平行系统**（前端 `web/` 朝堂 + 后端 `backend/` 东宫）对齐为一套可协作的分层架构。
> 本文档基于对 `backend/app/prince/models.py` 与 `web/lib/db/schema.ts`、`web/lib/repositories/decrees.types.ts` 的逐字段核实。

---

## 0. 现状一句话

文档承诺"三层分层架构（前台丞相 / 中台东宫 / 后台锦衣卫）"，但**代码层面前后端零交互**：

- 前端代码中搜不到对后端 `:8000` / `/api/v1/prince/*` 的任何调用。
- 两边都实现了"奏折 / 决策"概念，但**定义、枚举、存储完全不同**，无法直接互操作。
- 后端 CORS 已放行 `localhost:3000`，但前端从未调用——基础设施就位，契约缺失。

**根因**：两套系统对四个核心抽象（决策 / 奏折 / Agent / 裁决）各自独立建模，从未约定共享契约。

> 🔧 **2026-06-02 修正**：复核发现并非"绝对零交互"——`web/app/api/taizi-court/route.ts`
> 已存在一条**共享 SQLite 直读**路径：Python 后端（太子）把 `prince_*` 表写进与前端
> **同一个 `local.db`**，该路由直接读表呈现给皇帝。即"前端不调后端 HTTP"成立，但
> **数据层已有共享**。这与本文档主张的 HTTP BFF 是两种不同范式，详见 §5.3。

---

## 1. 核心抽象错位总览

| 抽象 | 后端东宫（Python/PostgreSQL） | 前端朝堂（TS/SQLite） | 错位性质 |
|------|------------------------------|----------------------|---------|
| **决策** | Agent 单次行动（发帖/发邮件/投广告）+ Policy 评估 | 重大经营议题（建设立项/投资/战役） | 粒度不同 |
| **奏折** | 定期 KPI 报告（日/周/告警），事后自动汇总 | 丞相对单份议题的综述+建议，事前协商 | **重名，实为两物** |
| **执行体** | 9 个营销运营 Agent | 10 位企业全域大臣 + 三省 + 八蜂群 | 组织模型不同 |
| **裁决** | `APPROVE/ESCALATE/BLOCK`（Policy 三态） | 自由文本 verdict + 领域层多套枚举 | 枚举无交集 |

> ⚠️ **命名陷阱**：后端 `prince_memorials` 与前端 `memorials` 都叫"奏折"，但
> - 后端 = 每日/每周 KPI 汇总报告（`memorial_type`, `kpi_json`, `alerts`, `suggestions`）
> - 前端 = 丞相对**某一份** decree 的综述（`decreeId`, `summary`, `recommendation`）
>
> 集成时**必须先重命名其中一个**，否则术语会持续误导。建议：后端的叫 **奏报 / Briefing**（定期简报），前端的叫 **题本 / Memorial**（单议题丞相意见）。

---

## 2. 字段级对照（精确）

### 2.1 "决策"对照

| 维度 | 后端 `prince_decisions` | 前端 `decrees` | 处理 |
|------|------------------------|----------------|------|
| 主键 | `id` Integer 自增 | `id` text(UUID) | 统一为 UUID text |
| 执行体 | `agent_name` String(50) | `submitter` text | 建映射表（见 §3） |
| 类型 | `decision_type`（post/email/ad） | 无（议题靠 content.meta） | 后端粒度，前端无对应 |
| 内容 | `decision_json` JSON | `content` text(JSON meta) | 都是 JSON，结构需约定 |
| 裁决 | `verdict` String(20) 枚举 | `verdict` text 自由文本 + `status` 枚举 | 建枚举转换层（见 §4） |
| 裁决理由 | `verdict_reason` Text | （并入 verdict 文本） | — |
| 优先级 | 无 | `priority` int 0–100 | 前端独有 |
| 时间 | `created_at` UTC datetime | `created_at`/`updated_at` ISO8601 text | 统一 ISO8601 |

### 2.2 "奏折"对照（注意：两物）

| 后端 `prince_memorials`（定期简报） | 前端 `memorials`（单议题题本） |
|-----------------------------------|------------------------------|
| `memorial_type` daily/weekly/alert | `decreeId`（必关联一份 decree） |
| `content` Markdown | `summary` 综述 |
| `kpi_json` / `alerts` / `suggestions` | `recommendation` 建议 |
| `read_by_emperor` / `emperor_decree` / `decree_at` | `status` drafted/submitted/endorsed/returned |

→ **结论：不存在字段映射，二者是不同实体。** 集成后应作为两张独立表共存，仅重命名消歧。

### 2.3 状态机枚举对照

| 实体 | 后端枚举 | 前端枚举 |
|------|---------|---------|
| 决策裁决 | `APPROVE` / `ESCALATE` / `BLOCK` | `pending`/`reviewing`/`approved`/`rejected`/`archived`（decree.status） |
| Agent 状态 | `idle`/`running`/`error`/`paused` | （前端无 Agent 状态表，靠 MinisterStatus 内存态） |
| 大臣立场 | 无 | `support`/`oppose`/`neutral`/`abstain` |
| 题本状态 | 无 | `drafted`/`submitted`/`endorsed`/`returned` |
| 领域裁决（户部） | 无 | `approve`/`adjust`/`hold`/`reject` |
| 领域裁决（兵部） | 无 | `engage`/`monitor`/`defer`/`retreat` |

---

## 3. 执行体映射：9 Agent ↔ 10 大臣

后端 9 个 Agent 偏**营销执行层**，前端 10 大臣覆盖**企业全域**。二者不是同一层级：

- 后端 Agent ≈ 前端"蜂群 Worker"层（具体干活的）
- 前端大臣 ≈ "部门主管/参谋"层（出意见、做裁决的）

建议映射表（落地为 `web/lib/integration/agent-minister-map.ts` + 后端 `app/prince/minister_map.py` 共用同一份 JSON）：

| 后端 Agent | 归属前端大臣/部 | 说明 |
|-----------|----------------|------|
| `social_media` / `content_creator` / `email_outreach` / `ads_manager` / `seo_optimizer` | 礼部（品牌/营销） | 5 个营销 Agent 统归礼部 |
| `analytics` | 钦天监（数据） | 直接对应 |
| `customer_service` | 吏部（人事/客服） | 部分对应 |
| `product_manager` | 工部（技术/产品） | 部分对应 |
| `growth_hacker` | 兵部（战略/增长） | 部分对应 |
| —（缺） | 户部/刑部/太医/史馆 | 后端暂无对应 Agent |

> 决策点：**后端是否扩出户部（财务执行）、刑部（合规）Agent**，还是这些部门保持"纯决策、无自动执行"？建议 V1 保持后端 9 Agent 不变，缺失部门标记为"人工/前端会审驱动"。

---

## 4. 裁决枚举转换层

前端领域裁决 → 后端 Policy 裁决，存在天然语义映射：

```
前端兵部     前端户部     →  后端 verdict
engage      approve      →  APPROVE
monitor     adjust       →  ESCALATE   (需进一步审批/调整)
defer       hold         →  ESCALATE
retreat     reject       →  BLOCK
```

落地建议：在 BFF 层放一个纯函数转换模块（前端 `web/lib/integration/verdict-map.ts`），**单向**把领域裁决归一为 Policy 三态后再落后端，避免在两端各写一份映射导致漂移。

---

## 5. 数据库与集成策略

### 5.1 三个可选方案

| 方案 | 描述 | 优点 | 缺点 | 适用 |
|------|------|------|------|------|
| **A. BFF 转发（推荐 V1）** | 前后端各保留自己的库；前端新增 `app/api/prince/*` 路由作为 BFF，转发并转换后端 `:8000` 数据 | 改动小、风险低、可渐进 | 双库需弱同步 | 当前阶段 |
| B. 统一 PostgreSQL | 前端弃 SQLite 改连后端 PG | 单一数据源 | 前端 Drizzle 方言迁移成本高 | 中期 |
| C. 事件总线 | 后端 Agent 执行完发 webhook/SSE 通知前端 | 实时性好 | 基础设施重 | 长期 |

### 5.2 推荐路径

**V1 = 方案 A**：前端不直连后端 PG，而是经 BFF 路由调用，统一在 BFF 做：
1. UUID/时间戳格式归一（int→uuid 不可逆，故新数据统一用 UUID；存量后端 int id 加前缀 `prince-{id}` 暴露给前端）
2. 裁决枚举转换（§4）
3. 术语消歧（后端 memorial → 前端展示为"奏报/Briefing"）

### 5.3 既存现状：两条集成路径并存（架构岔路，决策待定）

复核代码后，仓库里**已同时存在两种范式的雏形**，需要拍板留哪条为主：

| | **A. HTTP BFF**（本次新增） | **B. 共享 SQLite 直读**（既存 taizi-court） |
|---|---|---|
| 入口 | `web/app/api/prince/*` → `lib/integration/prince-client.ts` 调后端 `:8000` | `web/app/api/taizi-court/route.ts` 直读 `local.db` 的 `prince_*` 表 |
| 后端存储 | 保持 PostgreSQL | 后端须把 `prince_*` 写进前端的 SQLite `local.db` |
| 耦合度 | 松（HTTP 契约，可分离部署） | 紧（同库同表，须同主机/共享卷） |
| 实时性 | 请求即取，受后端在线影响 | 取决于后端写入节奏，前端永不依赖后端在线 |
| 适用 | 前后端分离部署 / 生产 | 单机演示 / 太子与前端同主机 |
| 字段归一/枚举转换 | 在 BFF 层集中处理 | **无**，前端直接吃后端原始表结构 |

**决策点（未定）**：
1. 留 A 为主、B 降级为本地演示快路径？还是两者共存分场景？
2. 若选 B，则 §2 的"主键 int↔uuid、时间戳 UTC↔ISO"差异会**直接暴露到前端**（后端 SQLAlchemy 模型须改写 SQLite 方言），成本不小。
3. 若选 A，taizi-court 路由应逐步迁移到 `prince-client`，避免两套读取逻辑漂移。

> 建议：**A 为主线契约，B 作为"无后端在线"的本地演示回退**——但这需要后端继续双写（PG + 可选 SQLite 导出），请确认。

---

## 6. 集成契约（API）

新增前端 BFF 路由（Next.js），内部 `fetch` 后端 `:8000`：

| 前端 BFF 路由 | 转发后端端点 | 转换职责 |
|--------------|-------------|---------|
| `GET /api/prince/briefing` | `GET /api/v1/prince/morning-brief` | 字段重命名、UTC→ISO |
| `GET /api/prince/agents` | `GET /api/v1/prince/agents/status` | agent_name → 大臣名（§3 映射） |
| `GET /api/prince/reports` | `GET /api/v1/prince/reports` | memorial→奏报术语 |
| `POST /api/prince/evaluate` | `POST /api/v1/policy/evaluate` | 领域裁决→Policy 三态（§4） |

统一响应信封（沿用项目约定）：`{ success, data, error, meta? }`。

环境变量：前端新增 `PRINCE_API_BASE`（默认 `http://localhost:8000`）、`PRINCE_API_KEY`（对应后端 admin 端点的 Bearer Token）。

---

## 7. 分阶段路线图

### Phase 0 — 术语与契约冻结（0.5 天，纯文档）
- [ ] 确认"奏报 vs 题本"重命名方案
- [ ] 冻结 §3 Agent↔大臣映射表、§4 裁决映射表为共享 JSON
- [ ] 确认 V1 走方案 A（BFF）

### Phase 1 — BFF 只读打通（1–2 天）
- [ ] 前端新增 `web/lib/integration/`（agent-minister-map.ts、verdict-map.ts、prince-client.ts）
- [ ] 实现 `GET /api/prince/agents`、`/api/prince/briefing` 两条只读 BFF 路由
- [ ] 上书房/大殿页接入：大臣状态卡改读真实后端 Agent 状态（替换 seed）

### Phase 2 — 写路径与裁决回环（2–3 天）
- [ ] `POST /api/prince/evaluate`：前端户部/兵部下旨时，把领域裁决送后端 Policy 评估
- [ ] 后端 `_execute_action()` 接真 API 或至少接 jiqun 蜂群 `:8081`
- [ ] 后端 `archive_memorials_task` / `cleanup_task` 补实现

### Phase 3 — 数据源去 mock（并行可做）
- [ ] 前端 seed 数据迁移：competitor/project/financial 从硬编码数组改为 DB/API
- [ ] 编排链路加 token 成本计数，回填后端 `prince_cost_tracking`

---

## 8. 风险与决策点（需人确认）

1. **奏折重命名**：影响 UI 文案与 API 字段，越早定越省事。
2. **主键策略**：后端存量 int id 如何对前端暴露（建议 `prince-{id}` 前缀，不改后端表）。
3. **后端是否补部门 Agent**（户部/刑部/太医），还是这些部门"纯前端会审、无后端自动执行"。
4. **数据真源归属**：营销执行类数据以后端为准，经营决策/会审类以前端为准——边界需画清。

---

## 附：核实依据

- 后端模型：`backend/app/prince/models.py`（6 表，整型主键、UTC、JSONB）
- 前端模型：`web/lib/db/schema.ts`（6 表，UUID 主键、ISO8601、SQLite）+ `web/lib/repositories/decrees.types.ts`
- 集成现状：`grep -r "localhost:8000\|/api/v1/prince" web/` → 无业务调用
- 后端 CORS：`backend/app/main.py` 已放行 `localhost:3000`
