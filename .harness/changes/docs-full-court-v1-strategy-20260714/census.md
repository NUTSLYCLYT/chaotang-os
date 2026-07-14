# FULL_COURT_V1 CAPABILITY CENSUS

> 审计日期：2026-07-14（Asia/Shanghai）
> 审计快照：`feature-chaotang-ext` / `4f77396314ab91a6d2b7099c83ed135c3dad1037`
> 方法：只读静态盘点；未运行真实模型、外部网络、高成本 runner、写数据库测试或发布命令。唯一写入是本报告。
> 口径：一项 capability 是可独立拥有入口、契约、状态或验收证据的产品/平台能力；前后端只是同一能力的证据面，不因文件多而重复计数。代码存在不等于跑通。
> 成熟度：L0 无实现；L1 静态/Mock/孤立原型；L2 有局部真实实现但未接主链或缺关键边界；L3 接入主链或真实 API 的部分闭环；L4 内测纵切及行为证据较完整；L5 候选上线；L6 生产上线。最终 GA/Beta/Internal 状态按要求全部留空。

## 1. Executive summary

### 1.1 结论

本次冻结出 **74 项 FULL_COURT_V1 capability**。仓库不是“没有功能”，而是功能实现远多于 canonical 集成成熟度：已有 DecisionTask、版本化路由、outbox、事件账本、候选/正式奏折、人工裁决和归档的真实数据库骨架，也有六部、锦衣卫、御史、钦天监、史馆、Provider、MCP 与发布控制面的局部实现；但尚不存在一条在租户、来源、失败恢复、常驻 worker、唯一状态机、删除和生产发布信任上都闭合的全朝廷链。

当前最重要的事实不是页面数、router 数或测试文件数，而是以下阻塞：

1. async outbox、同步 `swarm-deepen` 与 `/api/swarm-runs` 三条执行路径语义不同，只有 async 路径创建 `FinalMemorial`。
2. `SwarmRun.source_label` 继承拟旨输入标签而不是汇总每个真实部门产出的 provenance，既可能把真实执行误杀为 FALLBACK，也可能把规则 fallback 洗白成 LIVE。
3. `DepartmentMemorial` 仍只是 YAML 协议和临时 dict，没有 canonical 数据对象；御史主链调用的 `swarm_review.quality_gate` 与 `yushi_global_gate` 也不是同一权威。
4. DecisionTask 及大多数新主链表缺 `tenant_id`/数据库 FK；草稿、缓存、观测和部分检索还存在跨租户泄露或全局读取风险。
5. outbox 由请求后的 daemon thread 触发，没有常驻消费者、启动补捞接线或真正的指数退避调度。
6. Alembic、startup `create_all`、runtime `ALTER/ensure_*` 与 `tenant.py` 原生 DDL 同时拥有 schema 演进事实。
7. 前端无 BFF 实体，但仍有测试、guard、注释引用已删除的 `src/app/api/**/route.ts`；real client 失败可自动落 mock，production fallback 仍可达。
8. 邮件/企微工具存在“返回成功但没有真实外部效果”的实现；MCP 草稿队列无 tenant/user 归属，审批本身形成第二状态机。
9. 没有客户数据端到端删除实现；没有仓库托管 CI workflow/不可绕过 required check；外部 attestation、rollout anchor 与 break-glass 仍为 `EXTERNAL_REQUIRED`。

### 1.2 统计

| 指标 | 数量 | 解释 |
| --- | ---: | --- |
| 功能总数 | 74 | 本报告 capability registry 的审计单元 |
| L0 / L1 / L2 / L3 / L4 / L5 / L6 | 2 / 13 / 33 / 22 / 4 / 0 / 0 | 没有能力可据当前证据标 L5/L6 |
| 有真实局部实现 | 58 | 含真实代码/DB/API/确定性 gate；不代表闭环 |
| 完整真实且无关键 Mock/外部阻塞 | 18 | 仍不等于生产可用 |
| 明确依赖 Mock/Fallback/DEMO 或伪成功 | 28 | 包括 production 可达降级、空端点和外部效果 TODO |
| 存在重复实现/事实源 | 35 | 路由、部门 ID、状态、奏折、归档、检索、迁移等 |
| 未接入 DecisionTask 主链 | 43 | 观察视图、平台能力及孤立专署均计入 |
| 缺完整正常/失败/权限/恢复四象限测试 | 55 | “有测试文件”不等于四象限完整 |
| 无用户 UI 或只有隐式入口 | 23 | 例如国力、删除、租户成员管理、外部集成 |
| 无 canonical 后端 owner | 10 | 例如完整 DepartmentMemorial、删除、企微真实 connector |
| 安全/生产硬阻塞 | 14 | 租户、来源洗白、外部效果、删除、CI/attestation 等 |

仓库规模旁证：17 个 App Router 页面、76 个后端 router 文件、约 350 个 API decorator、293 个后端测试文件、279 个前端 node/integration/E2E 测试文件、36 个 flow YAML / 195 steps、71 个 runtime prompt 目录、Alembic `001`–`010`（含 `004b`）。这些数字只证明资产存在，不证明功能跑通。

## 2. Capability registry

表内缩写：`DT`=DecisionTask 主链；`2SM`=存在第二状态机；`T/S`=租户/数据安全风险；`M/F`=Mock/Fallback；`FF`=Feature Flag。`—` 表示未发现或不适用；“最终状态”按要求不判断。

| ID | 中文名称 / 用户价值 / 当前入口 | 实现证据（前端；后端） | 数据 / API / 事件 / Agent·Flow·Prompt | 测试、依赖、FF、sourceLabel | L / 真实 / M/F | 重复与 canonical owner 候选 | DT / 2SM / T/S / 缺失 / Wave | 最终状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | 登录、登出、会话；让用户进入真实工作区；`/login` | `frontend/src/app/login/page.tsx`、auth libs；`backend/web/routers/auth.py` | user/session；`/api/auth/login|me|logout` | auth/security E2E；JWT；LIVE | L4 / 是 / 否 | demo emperor/chancellor/scribe 与后端 user/admin 语义重复；owner=`auth.py` | 否 / 是 / 中；角色词表待统一；W1 |  |
| AUTH-02 | 邀请与注册；受控入场；`/invite`、`/register` | invite/enter pages；`auth.py` | invite/user；verify-invite/register | invite smoke；LIVE | L4 / 是 / 否 | owner=`auth.py` | 否 / 否 / 中；邀请治理和恢复证据仍需补；W1 |  |
| AUTH-03 | 租户、成员与对象授权；隔离客户数据 | tenant contracts；`src/tenant.py`、admin/auth schemas | tenants/users/user_departments | P0-B、tenant tests；无统一 label | L2 / 局部 / 否 | 原生 sqlite users/tenants 与 SQLAlchemy 对象权威重复；owner 候选=SQLAlchemy scoped repositories | 部分 / 是 / **高**；无成员管理 UI，主链多数表无 tenant_id；W1 |  |
| AUTH-04 | 产品受众角色；个性化呈现 | `frontend/src/lib/contracts/tenant.ts` | entrepreneur/ai_enthusiast/ai_geek；无后端权限契约 | 视图测试；— | L1 / 否 / 是 | 与鉴权角色易混淆；owner=frontend view model | 否 / 是 / 中；不得当 RBAC；W1 |  |
| ING-01 | D0 咨询；低风险问答不建正式任务 | 上书房 ask；`shangshufang.py` chancellor-chat | chat payload；丞相单 Agent prompt | fallback reply；source LIVE/FALLBACK | L2 / 局部 / 是 | 与普通 chat/direct 多入口；owner 候选=canonical ingress | 否（设计如此）/ 是 / 中；缺 processing_depth、审计升级关联；W1 |  |
| ING-02 | 拟旨、润色与证据缺口；把原问结构化 | DecreeInput/ChancellorColumn；draft/polish endpoints | `DecisionTask.draft_edict_json`、AgentSkillRun | SSF E2E；LIVE/MIXED/FALLBACK | L3 / 是 / 是 | deterministic draft、LLM chat、local draft store 重复；owner=shangshufang draft service | 是 / 是 / 中；前端仍有本地合成；W1 |  |
| ING-03 | 确认旨意与 canonical DecisionTask；正式建案 | SSF confirm flow；`decision_task_kernel.py` | DecisionTask；confirm-edict；planning_requested | single-writer、contract baseline；多标签 | L3 / 是 / 是 | compat adapters 应只适配；owner=decision_task_kernel | 是 / 否 / **高**；缺 tenant_id/FK/CAS 完整证据；W1 |  |
| ING-04 | D1 直办；低风险单节点快速交付 | SSF direct UI；direct route、durable executor 规划 | CourtReview/direct memorial；`/api/direct/*` | direct tests；FALLBACK 可达 | L2 / 局部 / 是 | legacy direct executor、sync skip、规划 durable executor 重复；owner 候选=canonical single-node executor | 部分 / **是** / 中；真实执行 receipt/草案等待语义未冻结；W1–2 |  |
| ING-05 | D2 会办；多部门高风险决策 | SSF/Junjichu；council route | route→review→swarm | loop tests；MIXED | L3 / 是 / 是 | async/sync/swarm-runs 三路径；owner=outbox+DAG control plane | 是 / **是** / 高；需单一路径；W1–3 |  |
| EXEC-01 | 丞相版本化路由；唯一决定处理深度和部门 | route panels；`routing_service.py`、contracts | ChancellorRouteDecision/RouteDecisionV2 | 30 routing cases；LIVE/MIXED/FALLBACK | L4 / 是 / 是 | 关键词/部门映射至少六套；owner=`routing_service.py` | 是 / 是 / 中；部门选择仍分叉；W1 |  |
| EXEC-02 | Outbox 可靠派单；事务后不丢命令 | 状态 UI；`decree_dispatcher.py`/`outbox_worker.py` | OutboxEvent；planning/execution events | outbox tests；— | L3 / 是 / 否 | owner=execution outbox | 是 / 否 / 中；缺启动补捞与常驻消费；W1 |  |
| EXEC-03 | 常驻 Worker；跨 web 重启继续执行 | Junjichu 展示；当前 daemon thread | claim/retry/dead_letter | kill/restart 仅局部 stub；FF 隐式 env | L2 / 局部 / 是 | daemon 与目标独立 worker；owner=dedicated worker process | 是 / 是 / 高；无部署拓扑、heartbeat、优雅停机；W1 |  |
| EXEC-04 | 持久化 DAG/DepartmentAssignment；节点可恢复 | DAG panel；SwarmRun/SwarmTaskRun | 临时 route_plan、task output；无 DepartmentAssignment 表 | swarm tests；FENGQUN_LIVE_SWARM | L2 / 局部 / 是 | 一次性 swarm loop 与目标 DAG；owner=swarm persistence | 部分 / 是 / 中；缺计划/依赖/checkpoint canonical 对象；W1–2 |  |
| EXEC-05 | 重试、取消、幂等、deadline；失败可恢复 | retry UI 局部；outbox/provider/tool | attempts、idempotency key、status | 局部测试；provider env | L2 / 局部 / 是 | 各层各自重试；owner=control plane policy | 部分 / 是 / 高；无端到端 cancel/晚到结果/外部效果 reconciliation；W5 |  |
| EXEC-06 | 事件账本与统一 status；用户看到真实状态 | task status UI；`decree_status.py` | DecreeExecutionEvent；status API | ledger/status tests；多 source label | L3 / 是 / 是 | DecisionTask/CourtReview/Outbox/Swarm/Final 多状态映射；owner=event projection | 是 / **是** / 高；sequence=max+1 并发与 runtime ALTER；W1 |  |
| DEPT-01 | 六部/专署能力注册；让路由找到唯一 owner | liubu config；jiqun/swarm/department registries | dynamic Department(int/name)、static codes/slugs | registry sync；— | L2 / 局部 / 是 | 多 registry、多 ID；owner 候选=后端版本化 DepartmentCapability registry | 部分 / 是 / 中；需唯一 ID/别名表；W1 |  |
| DEPT-02 | 刑部：合同风险、证据、修订建议 | `/liubu/legal`；legal/xingbu engines | legal APIs、xingbu prompts、goldens | xingbu/legal redteam；MIXED | L3 / 是 / 是 | legal/xingbu/justice 命名与多 engine；owner=刑部 capability contract | 部分 / 是 / 高；未形成正式 DepartmentMemorial；W2–3 |  |
| DEPT-03 | 户部：财务、预算、成本、税务 | `/liubu/finance`；hubu routers/flows | finance loops/reports | 大量 hubu tests；MIXED/FALLBACK | L3 / 是 / 是 | 特殊 finance/research 入口与主链重复；owner=户部 contract | 部分 / 是 / 高；外部财务真源/tenant/正式分奏缺；W2–3 |  |
| DEPT-04 | 工部：技术、BOM、交付与回滚 | `/liubu/gongbu`；gongbu engine | feasibility/project reports | gongbu tests；MIXED | L3 / 是 / 是 | 前端纯函数/pack bridge 与后端 engine；owner=工部 contract | 部分 / 是 / 中；缺主链分奏对象；W2–3 |  |
| DEPT-05 | 兵部：销售、报价、客户判断 | `/liubu/market`；bingbu/quotation | quotation verdict、prospect | bingbu/quotation tests；MIXED | L3 / 是 / 是 | sales/war/bingbu 多 ID 与 direct cache | 部分 / 是 / **高**；外部承诺人工门/真实 CRM 证据不足；W2–3 |  |
| DEPT-06 | 吏部：组织、人事、任命 | `/liubu/personnel`；libu routers | recruit/appointment | libu tests；MIXED/FALLBACK | L2 / 局部 / 是 | libu_personnel/libu/动态 dept；owner=吏部 contract | 部分 / 是 / **高**；薪酬/隐私/劳动边界与各司缺；W2–3 |  |
| DEPT-07 | 礼部：品牌、公关、外部文案 | `/liubu/ritual`；rites configs | brand/comms drafts | 规则/前端 tests；FALLBACK | L2 / 局部 / 是 | lipu/libu_rites/li_bu_comms；owner=礼部 contract | 部分 / 是 / 高；无后端正式 owner/发布人工门闭环；W2–3 |  |
| DEPT-08 | 各司/专项办公室；细化专业分工 | `/liubu/[code]/[office]`；si_registry/agent_design | 12 司仅覆盖户刑兵工；runtime prompts | smoke/纯函数；MIXED | L2 / 局部 / 是 | UI specs、si registry、100+ agent docs；owner=DepartmentCapability 子能力 | 部分 / 是 / 中；吏/礼缺司，未持久化 assignment；W2 |  |
| INTEL-01 | 锦衣卫检索与证据池；给结论可追溯来源 | `/zhuanshu/jinyiwei`；jinyiwei agent/store | JinyiweiEvidence；intel APIs | endpoint/store tests；LIVE_SEARCH/CALLER/FALLBACK | L3 / 是 / 是 | 共享证据池与 swarm intel 输出分离；owner=jinyiwei_evidence_store | 部分 / 是 / 高；自动注入原任务缺；W2–3 |  |
| INTEL-02 | 来源等级、鲜度与地图信号；识别过期信息 | intel UI；vet/source grade | evidence grade/trust/sources | source-grade tests；turso/fallback | L3 / 是 / 是 | 前后端 label 词表不统一；owner=Jinyiwei provenance policy | 部分 / 是 / 中；鲜度事件/失效传播缺；W2–3 |  |
| INTEL-03 | 主动密折与补证；主动发现风险 | today-one-thing/fill-gap | fill-gap API、signals | 局部 tests；FALLBACK | L2 / 局部 / 是 | 人工 fill-gap 与主链 evidence request 分离；owner=DecisionTask evidence subscriber | 部分 / 是 / 中；不自动重跑/formalize；W2–3 |  |
| YUSHI-01 | 御史证据与质量门；阻止无证结论 | quality panels；swarm_review + yushi_global_gate | SwarmQualityResult/GateDecision | 两套测试；MIXED | L2 / 是 / 是 | **两套 gate 权威**；owner 候选=yushi_global_gate rules + 单一 GateDecision service | 部分 / 是 / 高；主链未调用全局御史；W1–3 |  |
| YUSHI-02 | 封驳、弃权与冲突；表达“不知道/不应放行” | Summon/Governance UI；gate outputs | blocking reasons/conflicts | 局部 tests；— | L2 / 局部 / 是 | 前端本地 runYushitaiAudit 重复 | 部分 / 是 / 中；缺 canonical abstain/conflict event；W2–3 |  |
| YUSHI-03 | Shadow→标注→Enforce；可量化误放误拦 | 无完整 UI；harness 规划 | policy/version/metrics 未统一 | golden 局部；FF 未落 OpenFeature | L1 / 否 / 是 | 多 gate flags；owner=quality policy | 部分 / 是 / 中；无样本窗口、owner、阈值批准；W3/8 |  |
| MEM-01 | DepartmentMemorial 分奏；保留每部门结构化证据 | 部门卡片；YAML+dict | **无类/表/API**；SwarmTaskRun.output_json 代存 | 协议 tests；MIXED | L1 / 否 / 是 | 与 ministry_outputs/court docs 重复；owner 候选=swarm persistence model | 部分 / 是 / 中；正式对象、schema、FK 全缺；W1–2 |  |
| MEM-02 | CourtReview 候选奏折；汇总冲突和分奏 | SSF/Junjichu；CourtReview | memorial_json/ministry_outputs | loop tests；多标签 | L3 / 是 / 是 | 至少 7 个构造点；owner 候选=CandidateMemorial service | 是 / 是 / 中；task 无唯一约束、latest-by-time；W1–3 |  |
| MEM-03 | FinalMemorial 正式奏折；唯一可裁决版本 | SSF formal view；formal_memorial.py | task unique、quality/provenance gate、content_hash | final gate tests；仅 adjudicable labels | L3 / 是 / 是 | legacy Memorial/CourtReview/flow outputs 有正式感；owner=FinalMemorial | 是 / 是 / 高；仅 async 路径 formalize，provenance 洗白；W1–3 |  |
| DEC-01 | 人工圣裁；人决定采纳/补证/复核/驳回 | VerdictActionBar；shangshufang decisions | EmperorDecision；decision API/events | verdict tests；继承 formal source | L3 / 是 / 否 | 确认下旨与最终圣裁混在同表，多构造点；owner 候选=emperor_decision_service | 是 / 是 / 高；缺 decision kind/unique/idempotency；W1–3 |  |
| DEC-02 | 补证、复核、驳回、再议；不丢原任务 | 五键局部；apply_task_decision | DecisionTask/CourtReview status changes | decision tests；— | L3 / 是 / 否 | 前端旧 action/status 词表不同；owner=canonical command service | 是 / 是 / 中；CAS、并发、TTL、旧裁决失效不足；W3–5 |  |
| DEC-03 | 局部问话与复裁期；定点追问而非全量重跑 | 局部文案/组件 | 无完整 canonical command/event | 无闭环测试 | L1 / 否 / 是 | inquire/followup/deepen 多概念 | 部分 / 是 / 中；缺对象、权限、计时器和恢复；W2–5 |  |
| ARCH-01 | 史馆追加式归档；保存当时证据与裁决 | `/shiguan`；ShiguanArchive | archive DB；adopt 时写 | archive tests；多标签 | L2 / 是 / 是 | DB、legacy archive、JSON/flow 多套；owner=ShiguanArchive service | 是 / 是 / 高；无 tenant_id/task unique/FK；W1–3 |  |
| ARCH-02 | 归档检索与相似召回；复用历史经验 | Shiguan search；governance/knowledge APIs | IMA/RAG/FTS/sqlite-vec | 多个局部 tests；MIXED/FALLBACK | L2 / 局部 / 是 | 多搜索权威；owner=KnowledgeRouter+tenant index | 部分 / 是 / 高；删除传播、版本/一致性缺；W2–5 |  |
| ARCH-03 | 结果回填与复盘；知道决定后来是否有效 | retrospective/outcome UI；kpi/shiguan_outcome | Retrospective/business_outcomes/JSONL | outcome tests；MIXED | L2 / 局部 / 是 | 多 outcome owner；owner=OutcomeRecorded event + ShiguanArchive | 部分 / 是 / 高；真实 provenance、tenant、不可篡改引用缺；W2–3 |  |
| ARCH-04 | 离线学习飞轮；反馈进入候选版本而非自动污染生产 | archive/flywheel panels；case_archive/nightly | pending/approved cases、prompt candidates | 局部 tests；MOCK/MIXED | L2 / 局部 / 是 | 前端/后端多飞轮；owner=backend harness evaluator | 部分 / 是 / **高**；数据投毒、审批、回滚、删除传播缺；W3/8 |  |
| HANLIN-01 | 翰林页面/人才与能力发现；管理评测资产 | 隐藏 feature pages；`hanlin.py` | endpoints 返回空/404/no-op | 无真实闭环 | L1 / 否 / 是 | UI 与空后端 | 否 / 否 / 中；无 auth、无真实 owner；W2/6 |  |
| HANLIN-02 | Golden cases 与离线评测；量化质量 | 多套 scripts/harness/dev evals | cases/baselines/runners | 大量碎片测试；真模型 runner 可写 | L2 / 局部 / 是 | 多 schema/runner；owner=backend harness | 部分 / 是 / 中；30 条正式工作流与合同统计门未统一；W1/3/8 |  |
| QINTIAN-01 | 钦天监预测；把判断变成可验证预测 | forecast UI/问答；qintianjian flow | forecast/signals/triggers | qintian tests；MIXED/FALLBACK | L2 / 局部 / 是 | qintianjian 与 qintian fallback surface | 部分 / 是 / 中；未被主链路由消费；W2–3 |  |
| QINTIAN-02 | 预测结算与命中率；校准模型可信度 | 无完整 UI | JSONL trigger 可核销，未形成统一 metric | 局部 tests | L1 / 局部 / 是 | outcome/KPI 重复 | 否 / 是 / 中；到期调度、settlement owner、分层准确率缺；W3/8 |  |
| QINTIAN-03 | What-if/批注；在不写事实时比较情景 | forecast components；qintian/chat compat | chat/what-if local state | 纯函数 tests；FALLBACK | L2 / 局部 / 是 | 前端模拟与后端 fallback | 否 / 是 / 低；无 DecisionTask 升级关联；W2/6 |  |
| GUOLI-01 | 国力仪表盘；展示经营能力与风险 | 前端无页面/导航；`guoli.py` | `/api/guoli/overview`、NO_DATA/LIVE | backend test | L1 / 后端局部 / 是 | 计划挂大殿但未接 | 否 / 否 / 低；无 UI/浏览器证据；W2/6 |  |
| EXT-01 | MCP 工具路由与人工草稿；安全接外部系统 | 无统一用户入口；tool_router/drafts | ToolDef/磁盘 drafts；tools/drafts APIs | tool router tests；MIXED | L2 / 局部 / 是 | 同名 tool 后注册覆盖；owner=namespaced ToolRegistry | 否 / **是** / **高**；草稿无 tenant/user，execute 只改状态；W1/7 |  |
| EXT-02 | 邮件草稿/通知；生成可审批沟通 | 无 UI；email MCP/slot_filling SMTP | prepare/send | 无真实 integration；伪 `sent` | L1 / 否 / **是** | mock/crm/email/SMTP 四套；owner=EmailConnector+external-effect outbox | 否 / 是 / **高**；授权、PII、退订、重试/幂等缺；W7 |  |
| EXT-03 | 企业微信/微信触达；受控客户沟通 | 无 UI；wechat_server.py | add/send handlers | 无测试；默认 mock | L0 / 否 / **是** | owner 候选=WeComConnector | 否 / 否 / **高**；wecom TODO，`TOOL_HANDLERS` 未定义；W7 |  |
| PROV-01 | Provider 配置与调用；选择可用模型 | 无直接 UI；provider.py/providers.yaml/ModelAdapter | provider/model call/run log | provider tests；LIVE/FALLBACK | L3 / 是 / 是 | `/api/models` 与 service router 另有硬编码 | 部分 / 是 / 中；统一 trace/timeout/credential policy；W1–2 |  |
| PROV-02 | Prompt 组合与版本；可回放角色行为 | prompt UI 局部；runtime_prompts/prompt_module/composer | 71 目录、154 keys、可写 prompt API | validator/composer tests | L2 / 局部 / 是 | runtime、代码 registry、prompt_module 三层 | 部分 / 是 / 中；版本事实源与审批/回滚缺；W1–2 |  |
| PROV-03 | 模型路由与 tier；按风险/成本选择模型 | UI engineTier 局部；model_tier/service router/flow defaults | model/tier policy | tier tests；fallback | L2 / 局部 / 是 | FLOW_MAP/关键词/active provider 多权威 | 部分 / 是 / 中；route decision 与实际调用映射不透明；W1–2 |  |
| PROV-04 | Token/成本/预算；控制单位任务成本 | 资源面板局部；ContextBudget/run_logger | token/cost records | resource tests；部分 API 为 0 | L2 / 局部 / 是 | 真调用记录与 models API 零值分离 | 部分 / 是 / 中；tenant/任务聚合、SLO/告警缺；W2/5 |  |
| UI-01 | 全局导航与移动端；找到主工作流 | dashboard layout/top nav | 无业务 API | welcome/mobile E2E | L3 / 是 / 否 | 移动端顶导隐藏且无等价主导航 | 否 / 否 / 低；全量移动体验证据缺；W6 |  |
| UI-02 | 大殿只读总览；查看优先级/风险 | `/dadian` | 冻结 dadian APIs | API/E2E；LIVE | L4 / 是 / 否 | owner 清晰，冻结边界 | 读投影 / 否 / 低；不应生成第二结论；W6 |  |
| UI-03 | 军机处工作台；查看 DAG、重试和冲突 | `/junjichu`、command-center | chaotang/swarm/governance APIs | 多 E2E；DEMO/MIXED | L3 / 是 / 是 | 页面同时执行本地 ministry/decision/audit | 部分 / **是** / 高；必须只消费后端读模型；W1/6 |  |
| UI-04 | 上书房工作台；建案、跟踪、圣裁 | `/shangshufang` | canonical + legacy aliases | 大量 E2E；多标签 | L3 / 是 / 是 | briefing/placeholder/candidate/formal 混合 | 是 / 是 / 高；去本地业务结论、状态/action 对齐；W1/6 |  |
| UI-05 | 六部/专署页面；查看专业工作 | `/liubu`、`/zhuanshu` | dept/intel APIs | smoke tests；MIXED/FALLBACK | L3 / 局部 / 是 | 静态 view builder 容易表现成已 LIVE | 部分 / 是 / 中；每页真实后端 owner/恢复测试不齐；W2/6 |  |
| UI-06 | 史馆页面；检索、回看、复盘 | `/shiguan` | 多 archive/knowledge APIs | release gates；MIXED | L3 / 局部 / 是 | 多归档事实源 | 部分 / 是 / 高；统一到 ShiguanArchive projection；W2/6 |  |
| UI-07 | sourceLabel 与降级披露；不伪造 LIVE | badges/banners/reality libs | 多后端标签 | source tests；多词表 | L2 / 局部 / **是** | LIVE/MIXED/FALLBACK/DEMO/LIVE_SWARM/BFF_LOCAL/LIVE_SEARCH 等 | 全局 / 是 / **高**；safeReal→mock production 可达，文本正则推可信度；W1 |  |
| DATA-01 | 业务数据库与 repository；唯一事务事实源 | 无 UI；SQLAlchemy + tenant sqlite | fengqun.db/25 models | DB tests；— | L2 / 是 / 否 | 两连接/多专项 DB；owner=SQLAlchemy repositories | 是 / 是 / **高**；主链 tenant/FK/URL parity；W1 |  |
| DATA-02 | Schema migration；可审计升级/回滚 | 无 UI；Alembic/create_all/ensure/tenant DDL | revisions 001–010 | migration tests | L2 / 是 / 否 | 至少四权威；owner=Alembic | 是 / 是 / **高**；autogenerate 白名单不覆盖新表、expand/contract 未证；W1 |  |
| DATA-03 | 结果缓存；降低重复执行成本 | 无 UI；direct_cache | command MD5→JSON/内存 | 无 tenant 安全测试 | L1 / 是 / 是 | owner 候选=tenant-scoped cache adapter | 否 / 是 / **高**；key 无 tenant/model/prompt/source，明文磁盘；W1/5 |  |
| DATA-04 | 搜索/向量/记忆；召回知识和历史 | 史馆/知识 UI；Chroma/sqlite-vec/FTS/IMA/RAGFlow | 多 index/store | 局部 tests；embedding fallback | L2 / 局部 / 是 | 多检索权威；owner=KnowledgeRouter+一个 local index | 部分 / 是 / **高**；tenant、删除传播、备份、版本迁移；W1–2/5 |  |
| OBS-01 | 结构化日志与 metrics；定位任务故障 | 观测 API；observability/production_events | 内存 metrics+JSONL | production observability tests | L2 / 是 / 否 | 与 KPI/trace/frontend audit 重复 | 部分 / 是 / **高**；全局 recent events、task preview PII、重启丢指标；W1/5 |  |
| OBS-02 | OpenTelemetry trace；跨服务关联 | 无 UI；自定义 TraceCollector | JSON 文件，非 OTel SDK/OTLP | 无真实 exporter 测试 | L1 / 否 / 是 | 自定义 trace 与目标 OTel | 部分 / 否 / 中；context propagation、collector、redaction 缺；W1/5 |  |
| OBS-03 | SLO、错误预算与告警；决定何时停扩张 | KPI API；kpi_tracker | kpi.db/3 个局部 SLO | no-data test | L1 / 局部 / 否 | 与 release snapshot 红黄绿重复 | 部分 / 是 / 高；无多窗口 burn、告警、值班、完整 SLI；W1/5 |  |
| DELIV-01 | CI 强制门；机器不可绕过验收 | 本地 scripts；无 tracked workflow | ci/eval scripts | 本地 tests | L1 / 局部 / 是 | 本地 gate 不能替 required check | 否 / 否 / **高**；无 Gitee/GitHub workflow/required check；W1/8 |  |
| DELIV-02 | Release/lease attestation；证明谁发布什么 | 控制面 scripts | signed checkpoints/hash chain | 大量 tamper tests | L2 / 本地是 / 否 | local signer 与目标外部 authority | 否 / 否 / **高**；EXTERNAL_REQUIRED，不能 READY；W7–8 |  |
| DELIV-03 | 不可变构建与运行身份；证明运行 commit | prod doctor/release package | artifact/build/runtime identity | nodetests | L3 / 本地是 / 否 | 当前 3050 身份与工作树证据仍须独立核对 | 否 / 否 / 中；当前脏树不能推导候选发布；W7 |  |
| DELIV-04 | Canary、回滚和灾备；小流量放行、故障恢复 | release commander/rollout scripts | release state/immutable build | 本地状态机 tests | L2 / 本地局部 / 是 | 无真实 canary 平台 | 否 / 是 / **高**；无 24h/72h、真实 N-1、外部 anchor；W7–8 |  |
| SEC-01 | 业务/合规审计；证明谁何时做了什么 | 多前端/后端/控制面视图 | event ledger、JSONL、audit DB | 各自 tests | L2 / 局部 / 否 | 多审计权威；owner=DecreeExecutionEvent+独立合规 sink | 部分 / 是 / **高**；tenant/actor/correlation/retention 统一缺；W1/5 |  |
| SEC-02 | 数据保留、导出与可验证删除；履行客户权利 | 无 UI/API | **无 deletion orchestrator** | 无测试 | L0 / 否 / 否 | owner 缺失 | 否 / 否 / **高**；主库/对象/索引/缓存/备份删除全缺；W1/5/7 |  |
| SEC-03 | 真实客户数据治理；授权、去标识、日志红线 | 文档硬门；局部 security helpers | 无统一 data inventory | 局部 tests | L1 / 局部 / 否 | 多存储无统一 purpose/retention | 全局 / 否 / **高**；DPA/consent/legal hold/客户原文隔离证据缺；W1/5 |  |
| SEC-04 | 工具、附件、SSRF、注入与 secret 安全；阻止越权执行 | 局部 UI 警示；tool_sandbox/security/provider gates | allowlist/sandbox/draft approval | SSRF/prompt/security tests | L2 / 局部 / 是 | 草稿审批不等于外部效果安全 | 部分 / 是 / **高**；附件恶意解析、PII、预算、egress、恢复四象限不全；W1/5/7 |  |

## 3. Duplicate implementation map

| 重复能力 | 当前实现/调用方 | 推荐 canonical owner | 其余处置 |
| --- | --- | --- | --- |
| 正式入口/任务链 | canonical Shangshufang；legacy chaotang；court compat；orchestration compat；swarm；direct；specialized pack/finance/research | `DecisionTask` + `decision_task_kernel` + canonical command API | compat 只做 adapter；swarm/direct 转 executor；停止旧写入后 observe→retire |
| 路由 | `routing_service`、`shangshufang_loop` rules、department router、decree swarm router、service router、flow/registry mappings | `ChancellorRoutingService` + 版本化 DepartmentCapability registry | 规则模块做策略插件；其他关键词表 archive/retire |
| 部门 ID/registry | finance/personnel/market/ops/legal/gongbu；personnel/finance/ritual/war/justice/works；hubu/libu/lipu/bingbu/xingbu/gongbu；动态 int/name；office slug | 后端版本化 registry，稳定 canonical code + alias table | 前端只消费；旧 ID 转 adapter；无调用后 retire |
| 执行路径 | async outbox、sync swarm-deepen、`/api/swarm-runs`、legacy swarm/direct | outbox→durable worker→DAG | sync 接口变 command adapter；旧 runner 只作测试/历史回放 |
| 质量门 | `swarm_review.quality_gate`、`yushi_global_gate`、前端 `runYushitaiAudit` | 单一 GateDecision service，规则 owner=`yushi_global_gate` | 前端只读；旧 gate 转 adapter 后 archive |
| 奏折 | legacy Memorial、SwarmTaskRun outputs、CourtReview.memorial、FinalMemorial、court_doc、shiguan flow output | DepartmentMemorial→CandidateMemorial/CourtReview→FinalMemorial | legacy 名称降级为 adapter/read-only；禁止表现为正式 |
| 裁决/状态 | 多处 EmperorDecision 构造；DecisionTask/CourtReview/Outbox/Swarm/Final/Event 各自状态；前端 11 态 vs 后端注释 5 态 | canonical command service + event-sourced status projection | 其他状态只作内部子状态；前端生成类型/映射 |
| 史馆/Outcome | ShiguanArchive、legacy archive/retrospective、chaotang_store JSON、shiguan_outcome JSONL、case_archive、前端 flywheel | ShiguanArchive + OutcomeRecorded/Retrospective event | JSON/索引作派生 adapter；前端 local store retire |
| 搜索/记忆 | Chroma、sqlite-vec、FTS5、TypedMemory、IMA/RAGFlow、MCP web/rag | KnowledgeRouter façade + 一个 tenant-aware local index | 外源 adapter；不可维护多份业务最终事实 |
| Provider/Prompt/模型 | providers.yaml/provider.py、`/api/models` hardcode、service router、flow defaults；runtime prompt/code registry/prompt_module | providers.yaml/provider.py；prompt composer + version registry | hardcode 仅 compatibility；未引用 runtime prompt archive |
| 邮件/企微 | mock MCP、CRM MCP、Email MCP、slot_filling SMTP、wechat mock | namespaced EmailConnector/WeComConnector + external-effect outbox | mock 仅 DEMO；旁路 SMTP retire |
| DB/schema | SQLAlchemy/Alembic、startup create_all、runtime ALTER/ensure、tenant.py DDL、多专项 DB | Alembic + scoped repositories | ensure 仅受控兼容窗口；运行时 DDL retire |
| 观测/审计 | in-memory metrics、production JSONL、custom trace、KPI DB、frontend audit、release ledger | OTel metrics/logs/traces；业务 event ledger；独立合规 sink | local files 转 exporter/adapter；明确 retention |
| Golden/flywheel | backend scripts、backend harness、frontend evals/dev contracts、多个 baseline | backend harness case schema/runner/evidence | 前端只做浏览器/contract consumer；旧资产迁移后 archive |
| 前端退役 BFF 引用 | 0 个实体 `app/api`/`route.*`，但 department-learning/recruit tests、SSE/security E2E、chaotang client 注释及多个 guards 仍引用 | 直接 typed backend client；backend OpenAPI 为契约事实源 | 失效测试重写为真实 backend boundary test；恒绿 guards retire/改造 |

## 4. Canonical backbone gaps

```text
DecisionTask
  -> ChancellorRouteDecision
  -> OutboxEvent
  -> DecreeExecutionEvent
  -> DepartmentMemorial
  -> CourtReview
  -> FinalMemorial
  -> EmperorDecision
  -> ShiguanArchive
```

| 段 | 真实连通性 | 证据 | 缺口 |
| --- | --- | --- | --- |
| DecisionTask → ChancellorRouteDecision | 部分真实连通 | confirm 同事务写路由；single-writer/route tests | DecisionTask 无 tenant_id；部门选择仍由多套映射参与 |
| RouteDecision → OutboxEvent | 真实连通 | `enqueue_dispatch`、outbox tests | direct/council/specialized 入口不全走同一 durable command |
| OutboxEvent → DecreeExecutionEvent | 部分真实连通 | claim/process/timeline event | daemon thread；无常驻补捞、真正 backoff、重启运行证据 |
| DecreeExecutionEvent → DepartmentMemorial | **不连通** | 只有 SwarmTaskRun.output_json/ministry_outputs dict | DepartmentMemorial 正式对象、schema、tenant、FK、唯一性缺失 |
| DepartmentMemorial → CourtReview | 部分临时连通 | attach outputs 到 mutable CourtReview | 多构造点、无 candidate service、task 可多 review |
| CourtReview → FinalMemorial | 仅 async 路径真实连通 | formalize gate、task unique、tests | sync deepen/swarm-runs 不 formalize；source_label 继承导致洗白/误杀 |
| FinalMemorial → EmperorDecision | 部分真实连通 | adopt 强制 human_confirmed + formal ready | 确认下旨与最终圣裁混表，多入口、无 kind/unique/idempotency |
| EmperorDecision → ShiguanArchive | 部分真实连通 | adopt/approve/archive 写快照/event | 无 tenant_id/task unique/FK；重复归档和多史馆权威 |

总判断：骨架可证明“有纵切”，不能证明“全链真实连通”。最先断在 `DepartmentMemorial`，最危险的语义分叉位于 CourtReview→FinalMemorial，最严重的横向边界缺口是 tenant/provenance。

## 5. Full-court dependency graph

```text
W1 单一底座
  tenant/RBAC + Alembic + canonical IDs
  + command/state/event contracts
  + provenance/sourceLabel
  + persistent worker/outbox
  + OTel/audit/deletion contracts
            |
            v
W2 全部能力接入
  DepartmentCapability/Assignment/Memorial
  + 锦衣卫/御史/钦天监/翰林/国力
  + provider/prompt/tool adapters
            |
            v
W3 逐项纵向跑通
  route -> node -> evidence -> gate -> candidate -> formal -> decision -> archive/outcome
            |
            v
W4 全朝廷组合联调
  multi-department conflicts + budget/deadline + tenant fairness
            |
            v
W5 失败与恢复
  timeout/cancel/retry/DLQ/restart/late-result/delete/backup-restore
            |
            v
W6 全量 UI
  one read model + mobile + honest source labels + no local business state
            |
            v
W7 外部集成
  Email/WeCom/MCP + external-effect outbox + canary/rollback + external authority
            |
            v
W8 质量评估与产品收敛
  30/30 workflow golden + domain goldens + SLO/cost/safety/real-user evidence
```

硬依赖：W2 不得绕过 W1 的 tenant/provenance/唯一 ID；W3 不得在 DepartmentMemorial/GateDecision 缺失时把 UI 结果标正式；W6 不能用 mock 证明后端；W7 不得在外部效果幂等/审批/审计未完成时发送；W8 的上线范围判断必须晚于真实质量、成本、稳定性和安全数据。

## 6. Development waves

### Wave 1：统一底座

- 冻结 74 项 capability ID、canonical owner、别名和唯一状态/命令词表。
- 将 tenant/actor/ownership 加入 DecisionTask 全链对象；统一 SQLAlchemy/Alembic migration authority。
- 修复 provenance：每个节点/证据输出持久化来源，formalization 以组合证据而不是 intake label 判定。
- 合并三条执行路径；建立常驻 worker、启动补捞、backoff、DLQ、fencing 和 checkpoint。
- 建立 DepartmentMemorial、GateDecision、decision kind、OutcomeRecorded 契约。
- 关闭前端 local task/quality/decision 写入和 safeReal 静默 mock；清理退役 BFF 假保障。
- 冻结数据流/威胁/删除/观测/外部信任基线。

### Wave 2：全部能力接入

- 六部及 12+ 各司全部映射到唯一 registry、Assignment、DepartmentMemorial。
- 锦衣卫证据池、御史门、钦天监预测、翰林评测、国力、史馆 outcome 全部通过 DecisionTask correlation 接入。
- Provider、Prompt、模型、成本与 MCP 只做节点 adapter，不拥有业务最终状态。

### Wave 3：逐项纵向跑通

- 为每项 capability 完成正常、失败、权限、恢复四象限和 sourceLabel 断言。
- 验证每个部门从任务输入到正式分奏、冲突、GateDecision、FinalMemorial、人工圣裁、归档/outcome。

### Wave 4：全朝廷组合联调

- 单部、跨部、空路由、冲突、缺证、预算超限、模型限流、部分成功、动态 D1→D2 升级。
- 验证只有一个 Driver、一个 route、一个 formal memorial、一个 decision fact source。

### Wave 5：失败和恢复

- kill/restart、DB/provider/tool/对象存储故障、429/5xx、超时、取消、晚到结果、重复投递、DLQ replay。
- 跨租户攻击、删除 saga、备份恢复、secret 轮换、日志脱敏和 incident drill。

### Wave 6：全量 UI

- 所有页面只消费统一 read model；补租户成员、国力、预测结算、外部集成审批与数据删除入口。
- 移动端、刷新恢复、重复点击、连接失败、FALLBACK/DEMO 显示与无障碍浏览器证据。

### Wave 7：外部集成

- Email/WeCom/MCP namespaced connector、external-effect outbox、幂等/对账、人工批准、收件人授权、速率和审计。
- 外部 attestation/required check、不可变 artifact、真实 canary、N-1 rollback。

### Wave 8：质量评估与产品收敛

- 30 条正式工作流 30/30；合同等领域 golden 采用独立样本/owner/统计门。
- 真实用户、质量、成本、SLO、误放/误拦、安全和删除证据齐备后，再判断 GA/Beta/Internal/Deferred/Retired。

## 7. Proposed FULL_COURT_V1 frozen universe

本轮冻结的功能宇宙就是 registry 的 74 项：

- 身份与入口：`AUTH-01..04`、`ING-01..05`。
- 执行主链：`EXEC-01..06`、`MEM-01..03`、`DEC-01..03`。
- 六部与专署：`DEPT-01..08`、`INTEL-01..03`、`YUSHI-01..03`、`HANLIN-01..02`、`QINTIAN-01..03`、`GUOLI-01`。
- 史馆与学习：`ARCH-01..04`。
- Provider/工具/外部集成：`PROV-01..04`、`EXT-01..03`。
- 用户体验：`UI-01..07`。
- 数据、观测、交付与安全：`DATA-01..04`、`OBS-01..03`、`DELIV-01..04`、`SEC-01..04`。

这些能力都应保留为有效产品/平台能力，但重复实现不得保留多个 canonical writer。此后新增想法进入 `docs/plans/FULL_COURT_V2_BACKLOG.md`，不得静默扩充本表。

## 8. First ten Task Packets

| Task ID | Goal | Dependencies | In scope | Out of scope | Acceptance criteria | Verification | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FCV1-001 | 冻结 capability/ID/状态/source 契约 | 本 census 审查通过 | 74 IDs、部门 alias、command/status/source enums、owner | 实现功能 | 机器可读 schema 与前后端 fixture 一致，无第二词表 | schema tests、OpenAPI/TS contract diff | 中：冻结错误会放大迁移成本 |
| FCV1-002 | 统一 tenant/actor/ownership | 001；数据回填 ADR | 主链所有表、scoped repo、跨租户拒绝 | UI 重构 | A/B tenant 跨读写/枚举全拒绝；孤儿 quarantine；后台线程传 tenant | migration + auth matrix + production-path tripwire | 极高：回填和授权错误 |
| FCV1-003 | Alembic 成为唯一迁移权威 | 002 schema 设计 | metadata、revision parity、停 runtime DDL/create_all 生产路径 | 删除历史 DB | 空库/快照升级、expand-contract、forward-fix 可复现 | revision chain、schema diff、snapshot drill | 高：兼容窗口 |
| FCV1-004 | 修复 provenance/sourceLabel | 001 | per-node/evidence provenance、组合规则、formal gate | 提升模型质量 | fallback 不能洗白；真实输出不被 intake label 误杀；API/UI 一致 | 正反/混合/缺证/降级 contract tests | 极高：伪 LIVE |
| FCV1-005 | 合并三条执行路径 | 001、003、004 | command→outbox→worker→DAG；sync 仅 adapter | 新 workflow 框架 | 三入口产生同一事件序列/状态/正式奏折语义 | replay/idempotency/integration tests | 高：兼容调用方 |
| FCV1-006 | 常驻 Worker 与恢复 | 005；部署拓扑 ADR | claim/lease/heartbeat/backoff/DLQ/restart/shutdown | Temporal 替换 | kill -9/restart 不丢任务、不重跑已完成节点、人工 replay 可审计 | 双 worker、crash points、queue age alerts | 高：并发与外部效果 |
| FCV1-007 | 建立 DepartmentCapability/Assignment/Memorial | 001、005 | 六部/各司 registry、持久化 assignment、正式分奏 schema | 改专业 prompt 内容 | 每个路由 ID 唯一映射；每个节点有输入/输出/证据/状态/版本 | registry parity、single/multi dept、resume tests | 高：迁移多 ID |
| FCV1-008 | 统一御史 GateDecision | 004、007 | 合并两 gate、shadow metrics、abstain/conflict、formal gate | 立即全量 enforce | 主链只调用一个 gate；理由机器可读；前端只读；fallback/缺证 fail closed | golden/adversarial/replay + UI contract | 高：误放/误拦 |
| FCV1-009 | 收口奏折、裁决、史馆 | 005、007、008 | candidate service、FinalMemorial、decision kind/idempotency、archive/outcome | 搜索平台重写 | 一任务一正式奏折；并发裁决确定；归档 tenant/FK/unique；历史追加式 | concurrency/permission/archive integrity tests | 极高：正式事实重复 |
| FCV1-010 | 数据/外部效果安全基线 | 002–004 | direct cache tenant key、draft ownership、Email/WeCom 禁伪成功、删除 contract、PII redaction | 真正外部发送/canary | 无跨租户草稿/缓存；TODO 不返回 sent；删除 inventory 覆盖主库/索引/缓存/备份 | security tests、delete dry-run、log scan | 极高：客户数据与外部承诺 |

## 9. Evidence and limitations

主要证据源：

- `docs/product/CHAOTANG_CONVERGENCE_GUIDE.md`
- `.harness/changes/chore-evidence-driven-shangshufang-workflow-20260714/blueprint.md`
- `docs/plans/chaotang-os-launch-blueprint-2026-07-14.md`
- `.harness/manifest/capability-entry-inventory.json`
- `frontend/.harness/wiki/api-contracts.md`
- `backend/src/db/models.py`、`backend/web/routers/shangshufang.py`
- `backend/src/chancellor/*`、`backend/src/execution/*`、`backend/src/swarm_*`
- `backend/config/*`、`backend/runtime_prompts/*`、`backend/harness/*`
- `frontend/src/app/*`、`frontend/src/features/*`、`frontend/src/lib/*`
- 根/前端/后端 tests、release/control-plane scripts 与当前 Git/机器只读事实。

当前机器事实：Node `v22.23.1`、pnpm `10.33.0`、Python `3.14.4`；3050、8081、4444、Redis、Postgres 与 OTLP 端口有监听。监听仅证明进程存在，不证明身份、commit、artifact、tenant、数据质量或生产 READY。工作区在盘点开始前已有三份权威文档修改和多项未跟踪文件，本报告未触碰它们。

限制：本次没有执行会写账本/数据库/产物的测试，没有调用真实 provider、邮件、企微、MCP 外部服务，没有启动浏览器或发布流程。因此 L3/L4 只基于现存代码、契约和历史测试证据；任何运行时漂移、环境密钥、真实数据规模、成本/延迟与 24h/72h 稳定性仍需后续 Task Packet 产生新证据。
