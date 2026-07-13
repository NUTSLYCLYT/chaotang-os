# 上书房 → 蜂群全链路生产化蓝图

> 状态：计划已确认，运行时部分实施。本文是后续多会话工作的唯一总控蓝图；每次只领取一个最小闭环。

> 2026-07-14 已完成两个先行纵切面：结构化 `DecreeExecutionEvent` 账本，以及受质量/来源门保护的一旨一条 `FinalMemorial`。它们为 Step 2、7、8、11 提供局部实现证据，不代表这些步骤整体完成；tenant、完整状态机、常驻 worker、DAG、黄金样例、浏览器与生产演练仍按原依赖执行。

## 1. 目标与完成定义

目标不是承诺“零缺陷”，而是让以下上线条件 **100% 有证据**：

1. 一个正式执行 API / command model、一个 canonical command/task ID、一个路由事实源；允许多个 UI 入口。
2. 规定端点/对象的授权矩阵全部通过，且静态扫描未发现绕过 scoped repository 的裸 ID 查询。
3. 每个合法状态转移都有持久化事件；非法、重复、乱序转移被拒绝。
4. worker 采用 at-least-once delivery 并可重启恢复；受控 DB 写以唯一约束/CAS 去重，支持幂等键的外部系统达到 effectively-once，不支持者进入人工确认或 reconciliation。
5. 部院/蜂群节点开始、进度、结果、错误逐节点持久化，部分失败不丢失已完成成果。
6. timeout、cancel、retry、deadline 贯穿模型和工具调用，不只包裹外层函数。
7. 御史质量门可解释、可回放；影子模式达标后才能阻断正式圣裁。
8. status/sourceLabel/engineTier 来自同一后端读模型；LIVE 页面不再本地伪造部院或圣裁结果。
9. 圣裁有人工确认、状态前置条件、幂等和审计；归档只接收已裁决的完整证据链。
10. Alembic 能从受支持基线升级；备份、回滚、重启恢复、多租户、并发、真实浏览器与可观测性验收全部通过。

任何一项缺少命令、退出码、日志/数据库/浏览器证据，整体状态只能是 `VERIFIED_PARTIAL`。

## 2. 已确认现状、推测与未知

### 已确认事实

- 正式前端入口在 `frontend/src/features/shangshufang/ShangshufangPage.tsx`，API 适配器是 `frontend/src/lib/jiqun-api.ts`。
- 正式 API 在 `backend/web/routers/shangshufang.py`：draft 会建决策/朝会记录，confirm 会重路由并在 council 分支同事务写 outbox；direct 分支目前生成回执但未执行真实 agent。
- 权威路由实现是 `backend/src/chancellor/routing_service.py`，但旧 `backend/web/routers/chaotang.py` 仍保留另一套内存任务 + daemon thread + 旧表链路，军机处等页面仍可能调用它。
- `backend/src/execution/decree_dispatcher.py` 以进程内线程派发；`backend/src/execution/outbox_worker.py` 有批处理、重试和 stale-processing 回收函数，但未发现生产常驻 scheduler。
- `backend/src/swarm_execution_loop.py` 并发执行部院，`backend/src/swarm_persistence.py` 主要在循环结束后落完整结果；进程中断会留下恢复盲区。
- `backend/src/chancellor/decree_status.py` 用映射投影历史状态，但 outbox 失败未形成完整用户可见状态。
- `backend/src/db/models.py` 的新决策/朝会/圣裁/史馆对象缺少完整 tenant 所有权；正式查询和旧任务列表存在按 ID 读取而未验证所有权的对象级授权风险。
- `backend/alembic/versions/001_initial.py` 只覆盖旧核心表，`backend/web/main.py` 仍以 `Base.metadata.create_all` 补建当前表，无法证明生产数据库可重复迁移。
- 前端在读取真实状态后仍本地运行部院评审、御史审核、综合报告和“圣裁”；轮询超时后缺少明确失败/继续等待状态。
- 已有 `.harness/changes/docs-chancellor-junjichu-orchestration-design-20260713/` 详细描述部院/官署编排；本蓝图引用它，不另造第二套领域设计。

### 推测（实施前必须用数据验证）

- 发布前先加固现有 Postgres outbox + worker，比立即换 Temporal 风险更低；只有并发、长流程和人工等待指标超过现实现界时再做框架 ADR。
- 部院任务拆成持久化 assignment/node 后，现有蜂群算法可保留大部分领域逻辑。
- sourceLabel 漂移主要来自多入口和前端本地合成，统一读模型后可消除。

### 未知问题

| 未知项 | blocks_steps |
| --- | --- |
| 生产实例数、worker/web 拓扑、优雅停机窗口 | 3B、12 |
| P50/P95/P99、并发、模型限流和成本上限 | 3A、4、5、12 |
| 生产数据规模、孤儿记录和 tenant 回填规则 | 1A–1C |
| 监控、告警、密钥、备份与灰度平台能力 | 3B、5、12 |
| direct 是真实单 agent 执行还是草案等待执行确认 | 6、9、11 |

未知项不得脑补；步骤 0 必须把它们转成 ADR 或明确阻塞项。

## 3. 架构裁决与旧设计关系

本蓝图是生产控制面总控；`.harness/changes/docs-chancellor-junjichu-orchestration-design-20260713/` 是领域编排子设计。以下冲突必须在 Step 0 形成 ADR，未裁决前 Step 4/6 为 `BLOCKED`：

| 冲突 | 必须裁决的问题 | 临时约束 |
| --- | --- | --- |
| 军机处落点 | confirm 事务内先落 JunjichuDeliberation，还是 worker 领取后生成计划 | 不新增第二种不可重放计划 |
| direct 语义 | 同步草案、同步真实执行，还是统一进入 durable executor | 不再把回执冒充真实执行 |
| 编排底座 | durable DAG 是否正式 supersede 旧设计“不重建底座” | 用恢复/并发/复杂度数据决定，不凭潮流换框架 |

旧设计任务 0.2（`recommended_departments` 已传入蜂群循环）视为**已完成基线并持续回归**，不得重新实现或覆盖。

## 4. 目标数据流与控制面

```text
上书房 draft -> canonical command -> 丞相 route -> 用户 confirm
  -> [ADR 候选 A] 同事务先落军机处计划，再写 state event + outbox
  -> [ADR 候选 B] 同事务写 state event + outbox，worker 后生成军机处计划
  -> durable worker claim（lease + fencing）
  -> DepartmentAssignment / 节点执行
  -> 部院 office/swarm nodes（checkpoint + retry + cancel）
  -> 御史质量门（shadow -> enforce）
  -> status read model / SSE or bounded polling
  -> 上书房只消费后端事实
  -> 皇帝人工确认 + guarded decision
  -> 史馆归档 + outcome feedback
```

该分支图不是已批准顺序。Step 0 裁决后必须删去落选分支并写回唯一目标数据流，Step 4/6 才能解锁。

核心设计理由：LLM 编排的不确定性应留在“节点产出”，可靠性必须由确定性的控制面承担。数据库事件/outbox 管至少一次交付，显式状态机管合法性，租约/fencing 管本地并发提交，幂等/对账管外部效果，质量门管证据，前端只管呈现与人类决策。

## 5. 分步实施计划

每个编号是一个阶段；其中 A/B/C 子步骤各自才是一个可独立审查、验证和回滚的 PR/运行检查点。领取前必须新建 change，补齐精确文件、接口签名、禁止修改范围、实际命令和预期输出；本总控蓝图不能直接替代冷启动任务规格。

### Step 0 — 冻结契约与可信基线

- **目标**：把现状、黄金样例、部署拓扑和非功能指标变成可执行基线。
- **前置**：无。
- **文件**：`backend/docs/` 或 backend change；`backend/tests/`；`frontend/src/lib/__tests__/`；根 change 索引。
- **实施**：冻结 draft/confirm/status/decision OpenAPI 快照及 sourceLabel/engineTier 的枚举、正交关系和 fallback 传播；收集 direct/council/fallback/失败黄金样例；记录生产拓扑、流量、时长、限流与数据规模；完成 LLM/tool threat model；裁决第 3 节 ADR。
- **验证**：后端契约测试、前端 adapter 测试、当前浏览器 happy path、DB 表/索引只读审计；所有命令及失败写入 CI 摘要。
- **回滚**：仅测试和文档，可整体回滚。
- **完成证据**：基线测试可稳定复现；未知项被回答或带 `blocks_steps` 记录。Step 0 的文档闭环完成不自动解锁仍被阻塞的后续阶段。

### Step 1 — P0 所有权与迁移事实源（拆成 1A/1B/1C）

- **目标**：先关闭 IDOR，并让 schema 只由 Alembic 演进。
- **依赖**：Step 0，且 tenant 回填相关 blocking unknowns 已 resolved。
- **文件**：`backend/src/db/models.py`、`backend/web/routers/shangshufang.py`、`backend/web/routers/chaotang.py`、`backend/alembic/versions/*`、相关 auth/repository、`backend/tests/`。
- **实施**：**1A** 定义 tenant/actor/RBAC 契约，新增 nullable 列、复合索引和审计回填；无法可靠归属的记录 fail-closed/quarantine，禁止假定默认 tenant。**1B** 建立 scoped repository/auth dependency，覆盖新旧所有 endpoint，移除裸 ID 访问。**1C** 补齐 Alembic schema parity，验证 expand/contract 及旧 app/new schema、新 app/旧 schema兼容后，才停用 `create_all` 和运行时 ALTER。
- **验证**：类型/静态检查；migration revision chain、空库与生产快照副本；分批回填的锁时/校验和/孤儿报告；A/B 租户跨读、跨写、枚举 ID 全拒绝；复合 FK/索引；同租户回归；forward-fix 演练。
- **回滚**：兼容窗口保留 nullable 列；授权路径只允许 fail-closed，不得回滚到裸 ID 旧读。大表索引和 contract migration 独立发布。
- **完成证据**：授权矩阵全绿、迁移可重复、数据库无未归属对象。

### Step 2 — 单一生命周期状态机与命令幂等

- **目标**：统一 draft → confirmed → queued → running → quality_gate → awaiting_decision → decided/failed/cancelled。
- **依赖**：Step 1C。
- **文件**：`backend/src/chancellor/decree_status.py`、新建明确归属的 lifecycle 模块、`backend/web/routers/shangshufang.py`、models/migration、契约测试。
- **实施**：先冻结完整状态/命令矩阵，覆盖 draft edit/cancel、confirm、cancel_requested race、partial_success、blocked、dead_letter、人工等待 TTL、decision/deepen 并发及 direct/council 汇合；事件 envelope 包含 aggregate/event/version、tenant、actor、correlation/causation、occurred_at；confirm/decision/deepen 使用 idempotency key + CAS。
- **验证**：状态转移表参数化测试；重复/乱序/并发 confirm 与 decision；事务回滚后无半状态；OpenAPI 兼容检查。
- **回滚**：双写旧状态与新事件一段兼容期，读投影可切回旧映射。
- **完成证据**：每个状态有唯一含义；只重放 immutable events 可确定性重建读模型，不重新调用模型/工具。

### Step 3 — 请求上限与持久化 worker（拆成 3A/3B）

- **目标**：先保证真实调用有界，再证明 web 重启不丢任务且 DB/outbox 重复尝试可去重。
- **依赖**：Step 2；3B 另要求 worker 拓扑与停机窗口已 resolved。
- **文件**：`backend/src/execution/outbox_worker.py`、`backend/src/execution/decree_dispatcher.py`、worker 入口/部署配置、models/migration、测试。
- **实施**：**3A** 在实际 provider/tool 网络请求层设置请求级 timeout，TimeoutError 不得无界重跑；吸收旧设计 task 0.1。**3B** 再将派发移到独立常驻 worker；claim 事务在外部调用前释放；定义 worker identity、lease TTL/heartbeat、attempt、fencing CAS、backoff/jitter、租户公平性；stale/poison 隔离；提供 dead-letter 查询、告警、人工 replay/requeue；优雅停机有超时。
- **验证**：3A 用慢/不返回 provider 证明请求和进程可在上限内退出。3B 用有界 stub executor 覆盖 kill -9/restart、双 worker、before/after DB commit 崩溃、DB 写去重、队列/DLQ 告警和人工恢复；外部效果闭环留给 Step 5，不在本阶段宣称。
- **回滚**：feature flag 可退回单 worker，但保留持久化 outbox；禁止退回无恢复 daemon 作为生产默认。
- **完成证据**：3A 证明请求有界；3B 证明 DB/outbox 至少一次投递无事件丢失且本地提交可 CAS 去重，不宣称外部效果 exactly-once。

### Step 4 — 军机处计划与 DepartmentAssignment 持久化 DAG

- **目标**：把“部院数组 + 一次性循环”升级为可查询、可恢复的节点图。
- **依赖**：Step 3B 且第 3 节 ADR 已裁决；领域拆分引用现有 `docs-chancellor-junjichu-orchestration-design-20260713`。
- **文件**：`backend/src/swarm_execution_loop.py`、`backend/src/swarm_persistence.py`、新 assignment/repository 模块、models/migration、tests、backend harness cases。
- **实施**：持久化计划版本、department/office/node、依赖、输入快照、能力/模型策略、状态、attempt、结果引用；每节点开始和完成即 checkpoint；恢复时只调度未完成且依赖满足的节点。
- **验证**：单部、跨部、空路由、部分失败、节点重试、计划版本不兼容；中途杀进程后已完成节点不重跑；DB 与事件序列一致。
- **回滚**：以 feature flag 按 command 选择旧 loop/新 DAG；结果 envelope 向后兼容。
- **完成证据**：任意运行可回答“谁、为什么、输入、状态、结果、下一步”。

### Step 5 — 端到端 deadline/cancel 与外部效果安全

- **目标**：控制实际模型/工具调用，而非只给外层函数计时。
- **依赖**：Step 4。
- **文件**：provider/agent/tool 调用层、`backend/src/swarm_execution_loop.py`、取消 API/事件、tests。
- **实施**：deadline 从 command 传播到 node/provider/tool；支持 cancel 的 provider 执行真实取消，不支持者拒收晚到结果并标记 abandoned；外部效果采用幂等或 reconciliation；落实 capability-based tool allowlist、参数 schema、高风险人工批准、egress/SSRF 防护、secret/PII 脱敏、预算/速率限制和响应认证。
- **验证**：慢 provider、断流、429/5xx、工具半成功、用户取消、prompt/indirect injection、SSRF、越权工具、敏感日志和预算滥用；确认本地资源有界且晚到结果不污染状态。
- **回滚**：策略可降级为保守串行/更长超时，但幂等键和取消记录不可撤掉。
- **完成证据**：所有外部调用都有截止时间、重试分类，以及真实取消或 abandoned/拒收晚到结果策略。

### Step 6 — 唯一路由与 direct/council 语义闭环

- **目标**：丞相路由是唯一事实源；direct 与 council 均符合 ADR 定义且可追踪，不把草案回执冒充执行完成。
- **依赖**：Step 4、5 且第 3 节 direct/军机处 ADR 已裁决。
- **文件**：`backend/src/chancellor/routing_service.py`、`backend/web/routers/shangshufang.py`、军机处/office orchestration 模块、黄金样例。
- **实施**：冻结 route contract（mode、departments、reason、confidence、policy version）；按 ADR 落地 direct；council 使用唯一版本化计划；人工 override 记录原建议与理由；保留并回归旧任务 0.2，删除剩余二次猜测路由。
- **验证**：固定 prompt 黄金样例、fallback、override、重复确认；route 与 assignments 一致。若 direct 为执行模式，必须有 provider/agent receipt；若为草案模式，必须停在 `awaiting_execution_confirmation`，不得标 completed/LIVE execution。
- **回滚**：路由策略按版本切换；旧策略只读保留用于重放。
- **完成证据**：同一 command 不存在两个相互矛盾的路线决定。

### Step 7 — 御史质量门（拆成 7A/7B/7C）

- **目标**：用结构化证据控制是否进入圣裁，而不是再生成一段“看起来正确”的文本。
- **依赖**：Step 6。
- **文件**：quality gate/audit 模块、models/migration、status contract、backend harness golden cases、tests。
- **实施**：**7A** 接入 shadow 与指标，不阻断。**7B** 由明确 owner 对风险分层样本离线标注，预先规定最小样本量、误放/误拦上限和批准记录。**7C** 达标后独立灰度 enforce，配置回退阈值；人工 override 必须有理由。
- **验证**：黄金正负样例、对抗输入、缺证据/冲突/降级引擎；7A 只能 `VERIFIED_PARTIAL`；7B 输出阈值决策；7C 证明不合格结果不能进入 awaiting_decision，并演练退回 shadow。
- **回滚**：enforce 可退回 shadow，审计数据继续保留。
- **完成证据**：阻断理由机器可读、人可解释、可重放。

### Step 8 — 统一 status 读模型与跨语言契约

- **目标**：一个 API 同时准确表达总状态、节点、重试、失败、sourceLabel、engineTier 和可执行动作。
- **依赖**：Step 2、3B、4、7A；7C enforce 字段以 additive contract 接入。
- **文件**：`backend/src/chancellor/decree_status.py`、`backend/web/routers/shangshufang.py`、OpenAPI 产物、`frontend/src/lib/jiqun-api.ts`、契约测试。
- **实施**：从事件/assignment/outbox 投影 status；禁止硬编码 LIVE；定义 terminal/blocked/retryable/nextActions；前端 TS/Zod 由 OpenAPI 生成或用快照验证，后端是事实源。
- **验证**：事件重放投影、outbox failed/stale、fallback/live、一半完成、cancelled；OpenAPI breaking-change gate；前后端 fixture 一致。
- **回滚**：API 版本化或 additive 字段；旧消费者兼容期内继续可读。
- **完成证据**：相同 command 在 DB、API 和日志中的状态/source 标签一致。

### Step 9 — 上书房前端消费唯一后端事实

- **目标**：移除 LIVE 流程中的本地部院/御史/圣裁合成，提供真实等待、失败、重试和确认体验。
- **依赖**：Step 8。
- **文件**：`frontend/src/features/shangshufang/ShangshufangPage.tsx`、`frontend/src/lib/jiqun-api.ts`、相关 components/hooks/tests。
- **实施**：页面只渲染 status read model；轮询到期进入明确“仍在运行/连接失败”而非静默停止；展示节点进度、降级来源、失败理由和 nextActions；圣裁按钮只在后端允许时出现。
- **验证**：前端 typecheck/lint/unit；Playwright 真实后端覆盖 direct、council、fallback、部分失败、超时、刷新恢复、重复点击；浏览器 console/network 零异常。
- **回滚**：新 UI 走 feature flag；不得恢复本地伪造 LIVE 结论，可回退为只读简版状态。
- **完成证据**：浏览器展示的每个关键结论都能追溯到 API/DB 证据。

### Step 10 — 合并旧入口，建立单一执行边界

- **目标**：军机处/状元建议等入口不再触发第二套内存执行链。
- **依赖**：Step 6、8、9。
- **文件**：`frontend/src/app/(dashboard)/junjichu/page.tsx`、AdvicePanel、`frontend/src/lib/api/chaotang.ts`、`backend/web/routers/chaotang.py`、路由注册与兼容 tests。
- **实施**：旧入口改为 canonical API adapter 或只读跳转；旧 dispatch 标记 deprecated，停止新建内存任务；历史读取沿用 Step 1B 已验证的 scoped repository。大典/王座属于冻结礼仪边界，触碰前需单独用户批准。
- **验证**：全仓调用点扫描；每个入口产生同一种 command/status；旧 URL 兼容；无进程内 task registry 新写入；真实浏览器入口回归。
- **回滚**：adapter 可回退页面导航，不能恢复不安全的旧任务写路径。
- **完成证据**：运行时只有一条正式执行路径，旧路径有可审计退役日期。

### Step 11 — 圣裁、史馆归档与结果反馈

- **目标**：人类决策成为受状态机保护的可审计动作，归档形成学习闭环但不污染事实。
- **依赖**：Step 2、7C、8。
- **文件**：`backend/web/routers/shangshufang.py`、decision/archive service、models/migrations、前端确认 UI、tests。
- **实施**：decision 校验 awaiting_decision、质量门、actor、version、idempotency；保留接受/驳回/要求深化及理由；归档绑定 request/route/plan/results/audit/decision 的不可变引用；outcome 作为新事件，不回写篡改历史输出。
- **验证**：越权、重复、过期版本、质量未过、并发裁决、深化后旧裁决；归档完整性 hash/引用；浏览器人工确认。
- **回滚**：归档消费者可停用；已写审计事件不可删除，仅补偿。
- **完成证据**：每次圣裁可证明“谁在何时依据哪些证据作出什么决定”。

### Step 12 — 生产准入、灰度与灾难恢复

- **目标**：用真实环境证据决定上线，而不是以开发完成代替上线完成。
- **依赖**：Step 1–11 全部通过。
- **文件**：deploy/CI 配置、runbook、monitoring、backend/frontend harness、根 change CI 记录；具体归属在 Step 0 ADR 决定。
- **实施**：**12A** release-readiness PR（runbook、SLO、告警、retention/PII 删除与不可变审计协调、kill switch）；**12B** migration/备份恢复演练；**12C** canary 部署检查点；**12D** 独立 24h/72h 观察；**12E** 有批准人的 rollout 决策。另以容量数据定义 Temporal/外部引擎 ADR 的触发阈值。
- **验证**：真实浏览器 E2E；多租户隔离；并发/长任务；worker/web/DB/provider 故障注入；滚动发布；版本兼容；备份恢复；回滚演练；24h/72h 指标。外部平台不可用时对应检查点标 `BLOCKED`，不得用本地测试替代。
- **回滚**：按 feature flag、worker 版本、API 兼容层与数据库 forward-fix 分层回滚，禁止破坏性降级。
- **完成证据**：第 1 节十项 DoD 全有链接、命令、退出码、指标与责任人，才能标记 `VERIFIED_COMPLETE`。

## 6. 依赖与可并行性

| 阶段 | 硬依赖 | 可并行说明 |
| --- | --- | --- |
| 0 | 无 | 基线、威胁模型、ADR 可分工取证后统一裁决 |
| 1A → 1B → 1C | 0 + tenant 回填 unknowns resolved | 不并行修改同一 schema/auth 边界 |
| 2 → 3A → 3B → 4 | 1C；3B 需拓扑 unknowns resolved；4 另需 ADR | 串行建立状态、请求上限、交付、节点恢复 |
| 5 | 4 | 可与 7A 测试设计并行 |
| 6 | 4、5、ADR | 可与 8 的基础投影设计协调进行 |
| 7A → 7B → 7C | 6 | 观察期是运行检查点，不可压缩成代码合并 |
| 8 | 2、3B、4、7A | 7C 字段 additive 接入 |
| 9 | 8 | 可提前准备 fixture，不可提前切 LIVE |
| 10 | 6、8、9 | Step 1B 已完成旧 endpoint 授权 |
| 11 | 2、7C、8 | 与 10 可并行但协调前端确认 UI |
| 12A → 12B → 12C → 12D → 12E | 1–11 | 每个检查点独立状态和批准 |

- Step 10 的大典礼仪边界不在默认授权内。

## 7. 每步统一验证证据

| 证据面 | 最低要求 |
| --- | --- |
| 类型与静态检查 | 每个子 change 调查后填写仓库真实存在的具体命令，退出码 0；不得虚构“统一 typecheck” |
| 单元/契约 | 状态、权限、幂等、错误 envelope 有正反测试 |
| 数据库 | migration、约束、事件/对象一致性、跨租户隔离 |
| 运行日志 | command_id/tenant_id/node_id/attempt/fencing 可关联，无 secrets |
| 浏览器 | 真实后端、console/network、刷新恢复、重复操作与失败态 |
| 故障恢复 | kill/restart/timeout/429/重复投递/部分失败按步骤覆盖 |
| 声明 | CI 摘要列出未验证项；未覆盖即不得宣称完成 |

## 8. 第一实施闭环建议

下一次只实施 **Step 0：契约与可信基线**。原因是 Step 1 会改权限和数据库，必须先冻结当前行为、回答部署与数据迁移未知项，才能安全设计 tenant 回填和兼容窗口。Step 0 验证通过并再次确认后，才进入 Step 1。
