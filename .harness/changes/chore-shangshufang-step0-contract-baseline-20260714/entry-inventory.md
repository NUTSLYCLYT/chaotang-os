# Step 0 正式入口清算

## 1. 结论先行

当前系统尚未满足“唯一正式任务主链”。扫描确认至少四类可写事实面并存：

1. `/api/shangshufang/*`：以 `DecisionTask` 为根、outbox 派单、`FinalMemorial` 晋升和 `ShiguanArchive` 归档的候选正式主链。
2. `/api/chaotang/*`：以 task registry、`tasks` / `decrees` / `memorials` 和 JSON run 为事实源的旧链。
3. `/api/orchestration/*`、`/api/court/*`、`/api/swarm/*`：兼容登记、独立执行和部门工具入口；部分只写 registry，部分独立写 swarm/session/知识资产。
4. `frontend/src/lib/db/courtos-decision-store.ts` 及本地 decision-loop/archive：前端服务层自行定义并写 `decision_tasks`、`emperor_decisions`、`shiguan_archives` 的第二套业务事实模型。

因此本清单只把已经具备明确 owner、事实表和正式消费者的入口标为 `KEEP`。尚未证明能复用同一 `DecisionTask.task_id`、同一状态机和同一正式奏折晋升门的入口均标为 `ADAPT`、`RETIRE` 或 `UNKNOWN`；`UNKNOWN` 不代表允许上线。

## 2. 取证边界

- 初始审计检查点：`d5df61cdd9cad2672d1a40486c4c3176c02c7355`，见 `/home/ubuntu/.gstack/projects/msxn-chaotang-os/checkpoints/20260714-101247-rc-freeze-step0.md`。
- 本清单写入前再次观测的 HEAD：`4a628abb0cc5e51ce3d20ad85600165219b495be`。
- 两次观测之间 HEAD、计划文件、测试文件和未跟踪 change 均发生变化，说明候选版本仍在并发写入。本清单是代码现状调查，不是不可变 RC 证明。
- 扫描范围：`backend/web/`、`backend/src/`、`frontend/src/`；主命令为任务 4 指定的 `rg`，再按 router、数据库写入和前端调用点定向复核。
- 处置词汇：`KEEP`=正式主链；`ADAPT`=保留能力但必须改为主链命令/投影；`READ_ONLY`=只允许查询/展示，不得生成业务事实；`RETIRE`=迁移消费者后关闭；`UNKNOWN`=证据不足且阻断指定步骤。

## 3. 候选唯一正式主链

| ID | 阶段 / 入口 | Owner 与事实源 | 已知消费者 | 处置 | 退役前置 / 约束 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| CAN-01 | 建案 `POST /api/shangshufang/draft-edict` | backend 上书房；写 `DecisionTask`、`CourtLoopRun`、`AgentSkillRun` | 上书房页面、治理引擎服务调用 | KEEP | D1/D2 必须由此创建唯一 `task_id`；补齐 response model、tenant 和幂等契约 | `backend/web/routers/shangshufang.py:890`；`frontend/src/features/shangshufang/api/index.ts:39`；`frontend/src/features/governance/lib/three-chamber-engine.ts:368` |
| CAN-02 | 确认与派单 `POST /api/shangshufang/confirm-edict` | backend 上书房；同事务写路由快照、审查、人工确认、timeline、`OutboxEvent` | 上书房正式下旨 | KEEP | 只接受服务端重算路由；确认幂等；提交后只由可靠 worker 消费 | `backend/web/routers/shangshufang.py:998`；`backend/src/execution/decree_dispatcher.py:35` |
| CAN-03 | outbox 消费 `route.council` | `backend/src/execution/outbox_worker.py`；写 swarm run/task/quality、review、timeline、`FinalMemorial` | status、军机处、圣裁 | KEEP | daemon 即时线程不能作为生产唯一 worker；必须有独立 supervisor、重试、DLQ 和租约证据 | `backend/src/execution/outbox_worker.py:286`；`backend/src/execution/outbox_worker.py:145`；`backend/src/execution/outbox_worker.py:156` |
| CAN-04 | 状态 `GET /api/shangshufang/tasks/{task_id}/status` | backend DB 投影；读 `DecisionTask`、`CourtReview`、`FinalMemorial`、timeline/route | 上书房轮询、军机处详情 | KEEP | 只读；必须执行 owner + tenant 校验；状态只由状态机事实投影 | `backend/web/routers/shangshufang.py:1326`；`frontend/src/features/shangshufang/ShangshufangPage.tsx:1467` |
| CAN-05 | 正式奏折晋升（内部） | `formalize_memorial()`；唯一写 `FinalMemorial`，每 task 唯一、内容 hash、质量/来源硬门 | status、裁决 | KEEP | 禁止任何 HTTP/UI 直接写正式奏折；仅通过 quality + provenance 门 | `backend/src/formal_memorial.py:39`；`backend/src/formal_memorial.py:86` |
| CAN-06 | 圣裁 `POST /api/shangshufang/tasks/{task_id}/decision` | backend 上书房；写 `EmperorDecision`、状态、timeline，满足门时写归档 | 上书房、军机处 | KEEP | 必须 owner + tenant + 授权角色；采纳/归档只允许人工确认且 `FinalMemorial=ready_for_decision` | `backend/web/routers/shangshufang.py:1370`；`backend/web/routers/shangshufang.py:513` |
| CAN-07 | 史馆归档（内部） | `_archive_task()`；写 `ShiguanArchive` 并把 task/formal memorial 置 archived | status、史馆召回 | KEEP | 只能由 CAN-06 的状态转换触发；不得从任意 archive API 绕过 | `backend/web/routers/shangshufang.py:468` |
| CAN-08 | 军机处展示 / 大殿展示 | backend canonical status + frontend read model | `/junjichu`、上书房 briefing | READ_ONLY | 页面只能投影 CAN-01–07，不能另建任务、另写裁决或拼“正式奏折” | `frontend/src/app/(dashboard)/junjichu/page.tsx:2801`；`backend/web/routers/dadian.py:344` |

## 4. 必须适配到主链的能力

| ID | 入口 / 能力 | 当前 owner 与事实源 | 当前消费者 | 处置 | 适配完成定义 | blocks_steps | 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ADP-01 | `POST /api/swarm-runs`、`/serial`、`/{id}/retry` | swarm-runs；写 `SwarmRun`、`SwarmTaskRun`、quality 并挂 `CourtReview` | 军机处/内部蜂群 | ADAPT | 改成只接受已存在 canonical `task_id/review_id/command_id`；不得创建第二 DecisionTask 或第二正式奏折；重试幂等 | Step 8 | `backend/web/routers/swarm_runs.py:202`、`:235`、`:360` |
| ADP-02 | `POST /api/shangshufang/tasks/{task_id}/swarm-deepen` | 上书房；当前可自行补建 `CourtReview` 并同步跑蜂群 | 上书房“深挖” | ADAPT | 变成 canonical command：追加同一任务的新 assignment/attempt；不得绕过 confirm/outbox 或重写已晋升奏折 | Step 8 | `backend/web/routers/shangshufang.py:1457` |
| ADP-03 | 锦衣卫 `POST /api/intel/evidence/fill-gap` | 锦衣卫知识/证据 + `DecisionTask` 缺口 | awaiting_evidence 任务 | ADAPT | 只写 EvidenceItem/事件，随后由状态机重新排队；要求 task owner + tenant + evidence provenance | Step 6, Step 8 | `backend/web/routers/jinyiwei.py:170` |
| ADP-04 | `POST /api/court/dept/swarm-dispatch` 与信号 dispatch | orchestration compat；registry/兼容结果 | 部门页面、情报页 | ADAPT | 转换成 canonical task command/assignment；若无 canonical task，先走 CAN-01；不得以 registry done 代表奏折完成 | Step 5, Step 8 | `backend/web/routers/orchestration_compat.py:298`、`:332` |
| ADP-05 | 各部专线：工部 feasibility、礼部 recruit、礼部 compliance report | orchestration/swarm routers；工具结果、session/文件 | 部门功能页 | ADAPT | 定义为 department adapter 输出，绑定 assignment/attempt/evidence；不能独立晋升正式奏折 | Step 6, Step 7 | `backend/web/routers/orchestration_compat.py:367`、`:389`；`backend/web/routers/swarm.py:560` |
| ADP-06 | `POST /api/court/decision-judgment` | 大殿；当前判断/展示契约 | 大殿页 | ADAPT | 若是建议则保持 read-only；若是实际裁决必须调用 CAN-06 且传显式人工确认，不另写裁决事实 | Step 9 | `backend/web/routers/dadian.py:344` |
| ADP-07 | 旧 tasks/memorials/archive 查询 | chaotang DB + registry + JSON run + review store | 旧任务页、奏折页、史馆页 | ADAPT | 迁移成 canonical read projection；历史数据只读映射并标 legacy source，不再混入在飞状态 | Step 9, Step 11 | `backend/web/routers/chaotang.py:449`、`:616`、`:1465` |

## 5. 明确退役的并行写链

| ID | 入口 / 事实面 | 为什么不能成为正式主链 | 当前消费者 | 处置 | 退役前置 | blocks_steps | 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RET-01 | `POST /api/chaotang/decree/dispatch` | 自建随机 task id、启动 daemon thread、写 registry，并双写 `decrees + tasks`；不走 canonical route snapshot/outbox/formal memorial | `frontend/src/lib/api/chaotang.ts`、旧 API client | RETIRE | 消费者迁 CAN-01/02；历史查询完成 ADP-07；对外调用量为零并设置 410/feature flag | Step 5, Step 11 | `backend/web/routers/chaotang.py:221`；`frontend/src/lib/api/chaotang.ts:286` |
| RET-02 | `POST/PATCH /api/chaotang/tasks[/...]/persist` | 浏览器/前端服务可直接 upsert task 结果，绕过状态机、质量门和事件账本 | `frontend/src/lib/server/jiqun-task-persistence.ts:104` | RETIRE | 用 canonical worker/event projection 替代；完成一次性 legacy 数据映射 | Step 3, Step 11 | `backend/web/routers/chaotang.py:382`、`:418` |
| RET-03 | `POST /api/chaotang/memorials/{run_id}/review` | 裁决写 chaotang review store，批准后直接反馈知识，不要求 `FinalMemorial` | 旧奏折详情 | RETIRE | UI 迁 CAN-06；旧 review 只读保留；禁止知识反馈先于正式归档 | Step 7, Step 9, Step 11 | `backend/web/routers/chaotang.py:700`；`frontend/src/lib/api/chaotang.ts:294` |
| RET-04 | `POST /api/court/junjichu/cases`、`/orchestrate`、`/orchestrate/all`、`/orchestrate/sign-off` | 创建/完成 registry 兼容任务或返回 FALLBACK hash，不产生 canonical DecisionTask/正式奏折 | 军机处/chaotang adapter；部分已称弃用 | RETIRE | 所有建案/圣裁消费者迁 CAN-01/06；保留期内明确 410 计划与遥测 | Step 5, Step 9, Step 11 | `backend/web/routers/court_compat.py:168`、`:197`、`:221`、`:251` |
| RET-05 | `POST /api/orchestration/run` | 建 registry task 并输出 FALLBACK SSE 后直接 done；多个底部 dock 把它当“三省审议” | 翰林、钦天、史馆、太医、庄园等 | RETIRE | 咨询改 D0；正式任务改 CAN-01/02；迁移所有 dock，禁止 FALLBACK done 冒充正式完成 | Step 1, Step 5, Step 9, Step 11 | `backend/web/routers/orchestration_compat.py:142`；`frontend/src/features/shangshufang/hooks/useOrchestrationRun.ts:82` |
| RET-06 | 前端 `courtos-decision-store` / `local-decision-loop` / `archive-store` 业务写入 | 前端层自行写 `decision_tasks`、`emperor_decisions`、`shiguan_archives`，与 backend 同名事实模型并行 | 当前直接生产 import 未发现；仍有 archive/learning 类型耦合和测试资产 | RETIRE | 证明生产调用为零；迁出共享类型；保留纯 fixture/builder 时改名为 non-authoritative；删除 DB 写能力 | Step 2, Step 3, Step 11 | `frontend/src/lib/db/courtos-decision-store.ts:405`、`:827`、`:936`；`frontend/src/core/courtos/archive/archive-store.ts:197` |
| RET-07 | `/api/court/shangshufang/*` 前端旧路径 | Next rewrite 原样转发，backend 只注册 `/api/shangshufang/*`；主页面仍用旧路径函数，造成前后端契约漂移 | `ShangshufangPage`、`/junjichu` 经 `jiqun-api.ts` | RETIRE | 所有消费者迁 `features/shangshufang/api/index.ts` canonical adapter；专项合同测试与真实 E2E 通过 | Step 4, Step 9 | `frontend/src/lib/jiqun-api.ts:535`、`:560`、`:574`；`frontend/next.config.ts:63`；`backend/web/routers/shangshufang.py:64` |

## 6. 尚未裁决的独立业务闭环

| ID | 入口族 | 已知行为 / 风险 | 处置 | 决策所需证据 | blocks_steps | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| UNK-01 | 上书房 `pack-swarm-loop`、`finance-intel-loop/complete`、`research-budget-loop` | 每个入口可新建 `DecisionTask + CourtReview`，使用专用状态/brief decision；与 CAN-01 是否同一 ingress 尚未裁决 | UNKNOWN | 产品 owner 给出是否属于正式旨意；若属于，改为 CAN-01 的 profile/template，不得另建入口状态机 | Step 1, Step 5, Step 9 | `backend/web/routers/shangshufang.py:1594`、`:1834`、`:2251` |
| UNK-02 | `POST /api/shangshufang/briefs/{id}/decision[/advance]` | 写 `EmperorDecision` 并复用 `_apply_task_decision`，但以 review id 和另一套 action 请求契约进入 | UNKNOWN | 证明唯一授权 UI 与幂等键；决定收口为 CAN-06 adapter 还是退役 | Step 4, Step 9 | `backend/web/routers/shangshufang.py:2029`、`:2038` |
| UNK-03 | `POST /api/swarm/run` | 独立 session JSON/后台 thread；不是 canonical swarm-run 持久模型 | UNKNOWN | 调用量、生产消费者、是否仅底层 adapter；若保留需绑定 canonical attempt 并取消业务终态权 | Step 6, Step 8, Step 11 | `backend/web/routers/swarm.py:189` |
| UNK-04 | `POST /api/direct/execute`、`/feedback` | 通用直接执行器，可写任意 `save_to_file`，反馈链与 DecisionTask 无绑定 | UNKNOWN | 安全边界、生产消费者、文件写白名单；决定降为工具 adapter 或完全退役 | Step 6, Step 10, Step 11 | `backend/web/routers/direct.py:144`、`:214`、`:269` |
| UNK-05 | `POST /api/court/action`、`/register`、bureaus actions | court flywheel/注册/知识归档各有独立副作用 | UNKNOWN | 数据表/文件 owner、消费者、tenant 与 retention；不得进入正式状态统计 | Step 7, Step 11 | `backend/web/routers/court.py:67`、`:125`；`backend/web/routers/court_compat.py:67` |
| UNK-06 | governance bills、transition、scribe annals、shiguan verdict/retrospective | 兼容治理/史馆 API 多为独立或 FALLBACK 数据面，未证明与 canonical archive 一致 | UNKNOWN | 逐端点调用量和写入证据；史馆写操作必须绑定 CAN-07 archive id 或改只读 | Step 7, Step 9, Step 11 | `backend/web/routers/governance_compat.py:60`、`:94`、`:185`、`:276`、`:321` |
| UNK-07 | `finance-reporting-loop`、`finance-status-memorial`、`edict-return`、IM、polish | 部分为工具/显示持久化，名称含 memorial/return，但未证明是否形成正式业务事实 | UNKNOWN | 明确输出 schema、存储 owner、是否可影响 DecisionTask；正式奏折一律只能 CAN-05 | Step 4, Step 7, Step 9 | `backend/web/routers/shangshufang.py:872`、`:2113`、`:2157`、`:2183`、`:2236` |
| UNK-08 | chaotang study/run、archive knowledge feedback、teaching、quick summon、retrospective、proceed | 旧链学习/治理副作用仍可改变知识或释放 pause gate | UNKNOWN | 生产调用量、与 canonical event/archive 的映射和回滚方案 | Step 7, Step 8, Step 11 | `backend/web/routers/chaotang.py:798`、`:1609`、`:1667`、`:1740`、`:1910`、`:1991` |

## 7. 唯一主线产品边界

正式业务写路径应收敛为：

`D1/D2 ingress → DecisionTask → 人工确认 → ChancellorRouteDecision → OutboxEvent → Assignment/Attempt → DepartmentOpinion/Evidence → QualityResult → FinalMemorial → EmperorDecision → ShiguanArchive`

约束如下：

- D0 咨询可使用单 agent，但不得创建上述业务事实或产生外部副作用；升级后从 CAN-01 创建新 D1/D2 任务并记录升级事件。
- 蜂群是执行能力，不是第二任务系统。所有 swarm/session/run 必须绑定 canonical `task_id + assignment_id + attempt_id`。
- 军机处是编排和投影，不是事实源；大殿是裁决 UI，不是另一套裁决表；史馆是 CAN-07 的归档投影，不得接受自由写入。
- `FinalMemorial` 是唯一正式奏折表。候选汇总、部门回奏、finance brief、legacy memorial 都不得以名称或 UI 样式冒充正式奏折。
- 任何 `FALLBACK/DEMO` 结果不得通过正式裁决门。

## 8. Task 4 closeout 状态

- `KEEP / ADAPT / READ_ONLY / RETIRE` 已覆盖扫描中发现的主要建案、派单、状态、奏折、裁决和归档入口族。
- 仍有 8 组 `UNKNOWN`，均列出 owner 取证方向与 `blocks_steps`，所以 Task 4 的文档产物已形成，但业务入口清算尚未达到“全部 resolved”。
- 最大即时阻断是 RET-07：正式页面的 draft/confirm/status 主调用仍指向 `/api/court/shangshufang/*`，而 backend 注册事实是 `/api/shangshufang/*`。这正是“前后端对不上”的可复现证据，应在后续独立 TDD change 中先写失败测试再迁移 adapter。
- 在工作区停止并发写入并形成 clean、已推送、不可变候选 SHA 前，不得把本清单或任何测试结果解释为发布候选证明。
