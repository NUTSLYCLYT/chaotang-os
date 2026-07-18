# 朝堂 OS · 唯一事实源融合与全朝廷闭环施工蓝图

> 日期：2026-07-14
> 状态：`SUPERSEDED_AS_EXECUTION_SEQUENCE / REFERENCE_INPUT_ONLY`
> 历史状态：2026-07-14 曾为 `REVIEWED_GO` 规划；不代表当前获准实施或发布 READY
> 当前产品约束：[`PROJECT_PRODUCT.md`](../product/PROJECT_PRODUCT.md)定义可信复杂任务超级助手，[`R0/R1 PRD`](../product/releases/product-r0-trusted-kernel/PRD.md)定义合同第一 Offer
> 当前实施入口：M0–M10 计划获批 amendment；本文 C0–C10 与旧 Step 0–12 只保留事实源收敛参考，不拥有排期
> 历史依据：[`CHAOTANG_CONVERGENCE_GUIDE.md`](../product/CHAOTANG_CONVERGENCE_GUIDE.md)、[`旧 Step 0–12 blueprint`](../../.harness/changes/chore-evidence-driven-shangshufang-workflow-20260714/blueprint.md)、[`entry-inventory.md`](../../.harness/changes/chore-shangshufang-step0-contract-baseline-20260714/entry-inventory.md)、[`adr.md`](../../.harness/changes/chore-shangshufang-step0-contract-baseline-20260714/adr.md)

## 0. 结论：能融合，但只能按“一个内核、多个适配器”融合

当前多套任务事实源可以融合，且必须融合；但不能采用“把所有旧表互相同步”的方式。正确目标是：

- 只保留一个正式写内核：backend canonical workflow；
- 上书房是唯一正式 ingress；
- `DecisionTask` 是 D1/D2 唯一任务根；
- 事件账本是状态变化的审计事实；
- `FinalMemorial` 是唯一正式奏折；
- `EmperorDecision` 是唯一圣裁事实；
- `ShiguanArchive` 是唯一正式归档事实；
- 蜂群、六部、锦衣卫、钦天监、御史都是能力插件或质量节点，不是第二任务系统；
- 军机处、大殿、国力仪表盘、史馆页面都是读模型，不拥有主线终态；
- 旧 `/api/chaotang`、compat registry、frontend local DB 先做只读适配，再停止写入，最后退役。

历史稿曾用“老板决策工作台”概括产品。当前产品身份已由产品宪法替换为“可信复杂任务超级助手”；本文继续有效的仅是“一条可恢复、可审计的 canonical 流水线，多个 Agent 不得互抄状态”这一工程约束。

## 1. 大神会审

### Karpathy：先把系统压成可评测的最小状态机

多事实源问题不是“接口太多”，而是同一个词在不同链里含义不同：registry 的 `done`、旧 task 的 `completed`、上书房的 `direct_completed`、正式奏折的 `ready_for_decision` 被 UI 混成同一个“完成”。解决顺序必须是先冻结 canonical 状态语义和黄金回放，再迁入口；否则每迁一个接口都会制造新歧义。

高杠杆建议：所有旧链只能输出 `LegacyObservation`，不能直接写 canonical 终态。影子期比较“同一输入在新旧链的归一化结果”，差异进入评测数据，不做双向同步。

### Deming：质量属于流程，不属于最后一个御史按钮

如果各部可以无 task、无 assignment、无 evidence ref 地直接回奏，御史再严格也只能检查一段丢失生产过程的文本。质量必须从建案时就进入 schema：每次路由、派单、尝试、回奏、阻断、裁决都有 owner、版本和证据。

高杠杆建议：以“正式奏折晋升率、错误晋升率、补证后通过率、任务可恢复率、跨租户拒绝率”为闭环指标，不以 Agent 数量、token 数量或页面数量衡量进度。

## 2. 为什么现在会有多套事实源

| 事实面 | 当前根对象 | 当前终态权 | 问题 | 目标处置 |
| --- | --- | --- | --- | --- |
| 正式上书房链 | `DecisionTask` | task/review/formal memorial/decision/archive | 最接近目标，但 ingress、tenant、worker、状态仍需加固 | KEEP，成为唯一内核 |
| `/api/chaotang` 旧链 | registry + `tasks/decrees/memorials` + JSON run | 可建案、派单、批阅、知识反馈 | 绕过 canonical outbox、质量门和正式奏折 | 读适配后 RETIRE |
| `/api/orchestration` / court compat | registry task / FALLBACK SSE | 可直接标 done、生成 sign-off hash | “登记完成”冒充“业务完成” | D0 或 adapter，正式写入口 RETIRE |
| `/api/swarm/run` | session JSON / daemon thread | 自己拥有 session 终态 | 无 canonical assignment/attempt 绑定 | 降为 execution adapter |
| `/api/swarm-runs` | `SwarmRun/SwarmTaskRun` | 蜂群执行事实 | 有价值，但必须受 canonical command 调用 | ADAPT，纳入内核 |
| frontend local decision store | 前端同名业务表 | 可写 task/decision/archive | 前端成为第二业务后端 | 停写并 RETIRE |
| finance/PACK/research 专线 | 各自新建 `DecisionTask/CourtReview` | 专线状态与 brief decision | profile 演变成第二 ingress/状态机 | 融为 workflow profile |

根因不是“历史代码太多”，而是缺少四个全局不变量：唯一任务 id、唯一状态机、唯一终态写者、唯一正式奏折晋升门。

## 3. 目标架构

本文件不是当前施工权威。下方 C 子步骤与旧 `.harness/changes/chore-evidence-driven-shangshufang-workflow-20260714/blueprint.md` 的 Step 0–12 映射只用于理解和复用历史证据；Step 0–12 不再拥有当前顺序。任何采纳必须由 M0–M10 Owner 在显式 amendment 中分配 milestone、owner、schema、迁移、测试与回滚。

```text
                         ┌──────── D0 咨询（无业务副作用）
用户 / API / 页面 ──────┤
                         └──────── D1/D2 正式命令
                                      │
                                      ▼
                            Canonical Ingress
                     identity + tenant + idempotency
                     processing_depth + hard gates
                                      │
                                      ▼
                               DecisionTask
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
          EventLedger / Outbox                    Versioned Route/Plan
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      ▼
                       DepartmentAssignment / NodeAttempt
                         │          │          │
                         ▼          ▼          ▼
                       刑部        锦衣卫      其他部/蜂群
                         └──────────┬──────────┘
                                    ▼
                    Opinion + Evidence + ResultRef
                                    │
                             军机处候选汇总
                                    │
                          御史确定性质量/权限门
                           ┌────────┴────────┐
                           ▼                 ▼
                       BLOCKED          FinalMemorial
                           │                 │
                         补证               圣裁
                           │                 │
                           └──同一 task──────┤
                                             ▼
                                      ShiguanArchive
                                             │
                                  读模型 / 国力指标 / 翰林 eval
```

### 3.1 唯一事实表与唯一写者

| 事实 | canonical owner | 唯一写者 | 其他系统权限 |
| --- | --- | --- | --- |
| 正式任务 | `DecisionTask` | canonical ingress / state service | 只读或提交 command |
| 路由与计划 | `ChancellorRouteDecision`、版本化 deliberation | routing/planning worker | 不能覆盖旧版本 |
| 派单 | `DepartmentAssignment` | planning transaction | department 只能领取/回报 |
| 执行尝试 | `NodeAttempt` / `SwarmRun` | execution worker | UI 只读 |
| 部门回奏 | `DepartmentOpinion` + `EvidenceItem/ResultRef` | department adapter | 军机处只汇总 |
| 质量结果 | `QualityResult` | yushi gate | 模型不能 override hard gate |
| 正式奏折 | `FinalMemorial` | formalization service | API/UI 无直接 INSERT |
| 圣裁 | `EmperorDecision` | authorized decision service | 大殿/军机处只是客户端 |
| 归档 | `ShiguanArchive` | decision state transition | 史馆 UI 只读/追加复盘事件 |
| 指标 | read projections | projector/reconciliation jobs | 不反写业务终态 |

这里采用“事件 + 事务聚合快照”，不是两个权威源：

- workflow event 是不可变生命周期事实；
- `DecisionTask` 是带 `aggregate_version` 的事务聚合根和当前 snapshot，不是可被任意 router 修改的第二日志；
- 每次 transition 必须以 `expected_version` CAS 更新 snapshot，并在**同一数据库事务**追加唯一键 `(task_id, aggregate_version)` 的 event；任一写失败则整体回滚；
- read projection 只由版本化 reducer 从 event/snapshot/assignment 生成，禁止 UI 或 worker自行拼终态；
- reducer 必须有 `reducer_version`、event upcaster、全量重建、漂移检测和受审计 repair command；发现 snapshot/event version 不一致时 fail closed，不自动互相覆盖；
- router、worker、迁移脚本均不得绕过 transition service 直接更新 canonical status。

### 3.2 事件账本

事件账本保存发生过什么，不以最终文本覆盖过程。首批事件至少包括：

```text
task.created
edict.confirmed
routing.decided
planning.requested / planning.completed / planning.blocked
assignment.created / assignment.claimed
attempt.started / attempt.failed / attempt.completed
evidence.attached / evidence.rejected
opinion.submitted
quality.blocked / quality.passed
memorial.formalized
decision.recorded
archive.created
escalation.requested / task.cancelled
```

每个事件必须含 `event_id, task_id, tenant_id, actor_type, actor_id, service_principal_id, initiated_by, authorization_context_hash, event_type, aggregate_version, idempotency_key, correlation_id, causation_id, trace_id, occurred_at, payload_schema_version`。敏感正文放受控对象存储/结果引用，账本默认只存摘要、hash 与引用。

## 4. 融合原则

### 4.1 合并能力，不合并终态写权

- `swarm_execution_loop`、各部 agent、锦衣卫采证可继续复用；外面包 assignment/attempt adapter。
- 旧页面可以继续存在；数据改读 canonical projection。
- legacy 历史可以被召回；映射为 `LegacyObservation`，永不自动变成新的正式事实。
- finance/PACK/research 保留专业输入和模板；改成 `workflow_profile`，不能自己建任务或定义状态机。

### 4.2 不采用永久双写

允许的迁移方式只有：

1. 新写 canonical；
2. 同事务写 canonical event/outbox；
3. projector 异步生成读模型；
4. 影子读取旧系统进行对账。

禁止：canonical 写成功后再“尽力”写旧表、旧表回调反写 canonical、两个系统互相补状态。若迁移期必须兼容旧查询，使用 canonical → legacy-shaped projection，不使用双主写。

### 4.3 ID 与关联策略

- 新任务只生成 canonical `task_id`；所有 assignment、attempt、run、review、memorial、decision、archive 都带该 id。
- legacy id 不改写为 canonical id；建立 `LegacyIdMap(source_system, source_tenant_id, legacy_id, canonical_id?, migration_status)`，前三项构成唯一键。
- 纯历史记录没有充分证据时不创建 canonical task，只作为 legacy observation 展示。
- 同一用户请求靠 idempotency key 防止重复建案，不靠标题/文本模糊去重。

### 4.4 状态策略

canonical 状态必须由单一 state transition service 修改；router、worker、UI 不得自由写字符串。旧状态只映射到读模型：

| legacy 状态 | canonical 解释 | 是否可自动执行 |
| --- | --- | --- |
| registry `done` | `legacy_observed_complete` | 否 |
| `direct_completed` 无 receipt | `legacy_receipt_unverified` | 否 |
| JSON run completed | `legacy_run_completed` | 否 |
| formal memorial ready | `awaiting_emperor_decision` | 是，仍需授权人工裁决 |
| legacy approved | `legacy_decision_observed` | 否，不自动生成正式归档 |

## 5. 前置硬门

任何 P1+ 功能/融合 PR 开工前必须同时满足：

1. 固定 clean、已推送、不可变候选 SHA；禁止在持续移动的 ext 脏树直接迁移事实源。
2. P0-B 行为门 xfail 数为 0，且 attack-surface coverage test 通过。
3. 测试数据库/目录 tripwire 通过，测试不会触碰生产或用户开发 DB。
4. `prod:doctor` 不为 STOP；若只做隔离测试实现，可保持生产 STOP，但不得执行接管/部署。
5. backend OpenAPI 为跨语言契约事实源；前端 adapter 不再维护另一套路径真相。
6. 每个 PR 有 RED→GREEN、verification-loop、回滚和 change record。
7. schema migration 必须在隔离 PostgreSQL 演练；`create_all()`/启动补列不得作为生产迁移权威。

若硬门未满足，只允许文档、characterization test、只读 inventory、隔离迁移演练，以及**直接关闭该硬门的 P0 修复**。例如 C1A 建立可信 tenant/actor 归属、C1B 清零 P0-B，均不受“P0-B 必须先为 0”这一条件循环阻断；但不得夹带 profile、页面或新 Agent 功能。`prod:doctor=STOP` 时可以在独立测试环境完成 C1/C2 的实现和验证，但不得接管 3050、部署或把结果标为生产 READY。

## 6. 施工依赖图与权威步骤映射

```text
C0A 基线/清单 → C0B 遥测 → C0C 观察 → C0D UNKNOWN 裁决       [权威 Step 0]
  → C1A tenant/actor expand+回填+quarantine
  → C1B scoped repository/RBAC
  → C1C Alembic parity/约束/兼容                                  [权威 Step 1A–1C]
  → C1D/C2 状态机、事件、outbox、worker                            [权威 Step 2–3]
  → C3 assignment/attempt/外部效果安全/唯一路由                    [权威 Step 4–6]
       ├─ C4A additive status schema → C4B 完整投影 → C4C 前端切换 [权威 Step 8–9]
       ├─ C5 仅刑部 profile；其他专线只做 containment              [权威产品首发约束]
       └─ C6A shadow → C6B 标注/阈值 → C6C enforce
                                      → C6D 圣裁/归档               [权威 Step 7A–7C、11]
  → C7 legacy observation/影子对账
  → C9A pre-cutover 30/30 + 故障/消费者验证
  → C8A stop-write
  → C9B post-stop-write 复验/观察
  → C8B 410 + 支持窗口
  → C9C post-410 复验/观察
  → C8C code removal
  → C9D post-removal 复验                                           [权威 Step 10、12]
  → C10 刑部封闭试点/发布                                           [权威 launch 全部安全/发布门]
```

| 本文融合步骤 | 权威 Step | 约束 |
| --- | --- | --- |
| C0 | 0 | 只建立基线、遥测和裁决，不宣称运行闭环 |
| C1A–C1C | 1A–1C | tenant 回填先于 scoped accessor 完成声明 |
| C1D、C2 | 2、3A–3B | 事件/snapshot 单事务，worker 只宣称 at-least-once |
| C3 | 4–6 | DAG、deadline/cancel、外部效果安全、唯一路由 |
| C6A–C6C | 7A–7C | 观察期不可压缩为一个 PR |
| C4 | 8–9 | additive contract 先行；LIVE 切换等待完整投影 |
| C8/C9 | 10、12 | 回归先于停写，复验先于 410，观察先于删除 |
| C6D | 11 | 依赖 7C、完整读模型和人工确认 |
| C10 | launch S1–S10 | 指全部安全/发布门，不是六部全部上线 |

最大并发为 3：一个实现 PR、一个独立测试/评测、一个只读复审。共享 router、model、migration 的步骤不得并行写。

### 6.1 分支、worktree 与合入协议

- C0 固定的 candidate SHA 只是后续分支的共同父提交，不要求多人继续在 ext 同一个 worktree 写。
- 每个 C 步骤/子步骤从该父提交创建独立 worktree 和分支；变更开始时登记 task、lease、owner、允许路径与 base SHA。
- 同一时刻只有一个 migration/model owner；其他执行者只能读这些路径或在独立、不相交文件上工作。
- PR 合入前先吸收最新 integration branch，在更新后的 exact SHA 重跑本步骤验证；旧 SHA 的绿灯不能转移。
- 只由 integrator 按依赖顺序合入。Gitee required check 或外部 attestation authority 未配置时，状态保持 `IMPLEMENTED_LOCAL/EXTERNAL_REQUIRED`，不得自行宣布可发布。
- 工作树出现不明改动或 HEAD 漂移时停止写入，保存 checkpoint，确认 owner 后再继续；不得 reset/stash 他人改动。

## 7. 可冷启动执行步骤

### C0 — 固定候选、入口遥测与变更租约（强制拆为 C0A–C0D）

**目标**：先停止“边盘点边变化”，得到可重复调查的 exact SHA。

**上下文简报**：2026-07-14 同一轮调查中 HEAD 从 `d5df61c` 变化到 `4a628ab`、`059efe0`；当前 ext 工作区有多名执行者的改动。Step 0 inventory 已找到 4 类事实面，但不能当作 immutable RC。

**依赖**：无。
**强制拆分**：C0A clean base/inventory（文档/只读）；C0B telemetry runtime PR；C0C 按入口风险和 owner 批准的观察检查点；C0D UNKNOWN 裁决（文档/ADR）。不得合成一个 PR。
**主要路径**：C0A/C0D 只改根 `.harness/`；C0B 才可改网关/入口遥测；C0C 不改代码。

**任务**：

- 停止 ext 并发写入，为每个在途 change 指定 owner/worktree；
- 固定 clean base SHA、tree、diff paths；每个后续 PR 在自己的 exact SHA 生成证据，分支继续产生新提交不等于基线失效；
- 对 RET/UNKNOWN 入口加入调用事件或网关访问日志，禁止记录正文；
- 记录每个入口调用数、调用方、tenant、成功/失败和事实写入；观察期由入口风险、外部 owner ack、SLA/公告和 ADR 决定，14 天只可作为候选最短值；无生产遥测则标 BLOCKED；
- 把 inventory 的 8 个 UNKNOWN 逐项裁决为 ADAPT/READ_ONLY/RETIRE。

**验证**：

```bash
git status --short
git rev-parse HEAD^{tree}
node scripts/harness-doctor.mjs
node scripts/integration-lease-gate.mjs --candidate <exact-40-char-sha>
```

**退出条件**：C0A 有 clean base 与版本化 capability inventory；C0B 能覆盖 HTTP、worker、scheduler、admin/replay、DB/file/object-store/knowledge 写面；C0C 产生 owner 批准的观察证据；C0D 使 UNKNOWN=0。外部 attestation 未配置时明确标 `IMPLEMENTED_LOCAL/EXTERNAL_REQUIRED`，不伪装门已通过。
**回滚**：遥测开关可关闭；不停止旧入口。
**模型**：强推理复核，常规模型做 inventory/遥测。

### C1 — tenant 迁移、对象授权、schema parity 与 canonical 契约（强制 C1A→C1B→C1C→C1D）

**目标**：让所有后续迁移围绕一个不会漂移的任务契约。

**上下文简报**：backend 正式 prefix 是 `/api/shangshufang`，主页面部分函数仍调用 `/api/court/shangshufang`；多个 router 直接查询 `DecisionTask`，P0-B 存在跨用户面。ADR-005 已冻结 D0/D1/D2。

**依赖**：C0D，且所有阻塞 tenant 回填的 unknown 已有事实证据、owner 裁决和可执行规则并标记 resolved；仅分配 owner 或记录假设不解锁 C1。
**强制拆分 PR**：C1A tenant/actor expand+回填；C1B scoped repository/RBAC；C1C Alembic parity/contract；C1D state transition + OpenAPI/path adapter。
**主要路径**：`backend/src/db/`、`backend/web/routers/shangshufang.py`、`backend/web/routers/swarm_runs.py`、Pydantic schemas、frontend canonical adapter。

**任务**：

- C1A 新增 nullable tenant/actor、复合索引、来源盘点和分批回填；无法可靠归属的对象进入 quarantine/fail closed，禁止默认 tenant；输出 checksum、孤儿、锁时和可重跑报告；
- C1B 建立唯一 `get_task_for_actor(task_id, tenant_id, actor_id, permission)` scoped repository；覆盖新旧 endpoint，先为 P0-B 行为面逐条 RED，再最小 GREEN；
- C1C 在隔离 PostgreSQL 验证空库、生产快照副本、expand/contract、复合 FK/唯一约束、旧 app/new schema 与 new app/old schema，随后才停用生产 `create_all`/运行时补列；
- 为 draft/confirm/status/decision 冻结版本化 request/response/error/idempotency schema；
- canonical path 固定 `/api/shangshufang/*`；旧 path 在迁移期只做显式 307/adapter 或 410，不靠隐式 rewrite 猜测；
- 建立 `transition_task(command, expected_version)`，用 optimistic concurrency 和允许转换表替代自由 status 字符串；
- C1D 冻结状态/命令矩阵、canonical OpenAPI/path 与 optimistic concurrency；`processing_depth, aggregate_version, policy_version` 按已验证 migration 落地。

**验证**：

```bash
cd backend
python3 -m pytest -q tests/test_p0b_cross_user_behavioral.py
python3 -m pytest -q tests/test_shangshufang_contract_baseline.py
cd ../frontend
npx --yes tsx --test src/features/shangshufang/api/contract-baseline.nodetest.ts
pnpm exec tsc --noEmit
```

**退出条件**：C1A 未归属正式对象=0、quarantine 有 owner；C1B 跨租户矩阵全拒绝且 P0-B xfail=0；C1C migration 可重跑、schema parity/兼容全绿；C1D 非法转换 409、OpenAPI 与 path test 一致。C1A 完成前不得用 accessor 宣称 P0-B 已结构性清零。
**回滚**：保留旧 path adapter 一个观察期；schema additive，不删除旧列。
**模型**：强推理设计授权/状态机；常规模型迁 adapter。

### C2 — 事件账本、command 与两段 outbox

**目标**：让每一次路由、派单、阻断和裁决可重放，不再只保存最后文本。

**上下文简报**：现有 confirm 已有 `OutboxEvent`，但即时消费依赖 daemon thread；ADR-001 要求 planning 与 execution 两段 outbox；现有 timeline 可作为迁移输入，但需版本化和幂等不变量。

**依赖**：C1。
**建议拆分 PR**：C2A event schema；C2B planning worker；C2C execution outbox/recovery。
**主要路径**：`backend/src/execution/`、DB models/migrations、worker supervisor、event tests。

**任务**：

- 新增 append-only workflow event 与 aggregate version 唯一约束；
- confirm 事务原子写 task snapshot、`edict.confirmed`、`planning_requested`；
- planner 在事务外生成版本化 deliberation，再原子写 assignments + `execution_requested`；
- worker 使用 claim/lease/fencing/idempotency；daemon thread 仅作本地优化，不是可靠性来源；
- 定义 retry、timeout、cancel、dead-letter、人工恢复 command；
- 从事件重建 status projection，并与现行表状态做影子对账。

**验证**：并发重复 confirm、worker kill/restart、stale lease、重复 event、DLQ recovery 集成测试；隔离 PostgreSQL 跑 migration 与约束。
**退出条件**：断电/重启后 DB/outbox 无丢事件，并以 CAS 去重本地提交；明确只承诺 at-least-once delivery，不在 C2 宣称外部 exactly-once。外部 effectively-once 依赖 C3 的 provider/tool 幂等或 reconciliation；不支持幂等的高风险工具必须人工确认。
**回滚**：保留 canonical event/snapshot，通过 forward-fix reducer/projector 或 canonical 兼容投影恢复读取；新事件产生后禁止切回旧业务真源。
**模型**：强推理。

### C3 — 把蜂群与各部降为 canonical execution adapter

**目标**：保留 jiqun/六部能力，取消它们作为第二任务系统的权力。

**上下文简报**：`/api/swarm-runs` 已能持久化 run/task/quality，是优先复用能力；`/api/swarm/run` 使用 session JSON/daemon thread；`swarm-deepen` 能自行补建 review。目标不是重写算法，而是在部门边界 checkpoint。

**依赖**：C2。
**建议拆分 PR**：C3A assignment adapter；C3B retry/receipt；C3C legacy swarm entry containment。
**主要路径**：`backend/src/swarm_execution_loop.py`、`swarm_persistence.py`、`web/routers/swarm_runs.py`、department adapters。

**任务**：

- 每次执行必须输入 `task_id, assignment_id, attempt_id, plan_version, idempotency_key`；
- 各部只提交 schema-valid opinion/evidence/result ref，不能改 task 终态；
- direct 走 durable 单节点 assignment；无 execution receipt 不得 completed；
- council 为多个 assignment，军机处汇总但保留冲突；
- `swarm-deepen` 改为同 task 的新 command/attempt，不能补建第二 review 主线；
- `/api/swarm/run` 若仍有通用消费者，只作为底层 adapter；否则进入由 owner、调用量、SLA/公告和 ADR 批准的退役观察。

**验证**：单部成功、多部部分失败、超时重试、重复回报、旧 attempt 晚到、D1 动态升级 D2。
**退出条件**：所有正式 swarm run 都能反查 canonical task/assignment/attempt；零孤儿 run；worker restart 可恢复。
**回滚**：adapter feature flag；不恢复旧入口的终态写权。
**模型**：强推理设计，常规模型实现适配。

### C4 — 建立唯一读模型并迁移前端（C4A→C4B→C4C）

**目标**：上书房、军机处、大殿、史馆和国力仪表盘看同一组事实。

**上下文简报**：当前前端同时使用 canonical API index、`jiqun-api.ts` 旧 path、chaotang API、local decision store。大殿 UI/后端存在冻结边界，因此本步默认只改数据 adapter，不改大殿布局。

**依赖**：C4A additive schema 依赖 C1D；C4B 完整 projection 依赖 C2、C3、C6A，7C 字段只 additive 接入；C4C LIVE 前端切换依赖 C4B。
**强制拆分 PR**：C4A additive contract；C4B backend projection/replay；C4C frontend adapter 与 legacy read bridge。
**主要路径**：status/briefing APIs、frontend `features/shangshufang/api`、`jiqun-api.ts`、军机处 read hooks。

**任务**：

- C4A 先建 additive `TaskStatusViewV1` schema；尚不存在的 quality/formal memorial/decision/archive 字段诚实为 absent/NO_DATA，不伪造；
- 后端 OpenAPI 生成或验证前端类型；删除重复手写 path owner；
- 主页面 draft/confirm/status/decision 全部经 canonical adapter；
- legacy 页面只读 canonical projection，并显示 `LEGACY_OBSERVATION/NO_DATA`；
- 国力仪表盘只读 ledger/projection；无样本保持 NO_DATA；
- `/dadian`、冻结的大殿前端目录和 `backend/web/routers/dadian.py` 不在默认授权范围；本步通过外部 canonical projection 保持兼容，任何直接改动必须另获用户批准；
- 用真实后端、隔离 tenant 的 Playwright 覆盖 draft→confirm→status→decision，不用 route mock。

**退出条件**：前端无 `/api/court/shangshufang/*` 生产调用；无 frontend business DB 写；不同页面同一 task 的状态一致。
**回滚**：保留 read adapter flag；不恢复本地业务写入。
**模型**：常规模型实现，强推理复核契约。

### C5 — 首发只实现刑部 workflow profile，其他专线做 containment

**目标**：保留专业场景，不保留专线状态机。

**上下文简报**：这些入口目前可自行创建 `DecisionTask/CourtReview`，使用专有 brief decision。它们的有价值部分是输入 schema、部门组合、证据清单和输出模板。

**依赖**：C1、C3。
**建议 PR**：只允许刑部合同 profile 实现 PR。PACK/finance/research 在 5 家试点、3 家复用、1 家付费、1 条证言之前不得投入完整 profile。
**主要路径**：profile registry、canonical ingress、各专业 schema；不扩首发导航。

**任务**：

- 定义 `workflow_profile_id/version`，只影响默认路由、schema、quality policy；
- profile 通过 CAN-01 建同一种 DecisionTask；
- brief decision 变成 CAN-06 的 UI adapter，不另写 `EmperorDecision`；
- profile-specific 文本只能生成候选回奏，正式晋升仍走统一质量门；
- 首发只 enable 刑部合同 profile；PACK/finance/research 只允许停止自建状态机/裁决、转 READ_ONLY/410/薄 adapter，以及保存不具运行能力的 schema inventory；完整实现进入 5/3/1/1 后独立解冻计划。

**退出条件**：任意 profile 不再自建状态机/裁决入口；同一任务只产生一个 FinalMemorial。
**回滚**：关闭 profile flag；不影响 canonical core。
**模型**：强推理定义 profile，领域 owner 验证。

### C6 — 御史门与圣裁归档（强制 C6A→C6B→C6C→C6D）

**目标**：让“候选汇总”与“可裁决正式奏折”不可混淆。

**上下文简报**：现有 `formalize_memorial()` 已有 source/quality/hash/每 task 唯一约束，是正确种子；需要补 tenant/actor、不可逆门、证据引用和状态并发。

**依赖**：C6A 依赖 C3/C5；C6B 依赖真实 shadow 数据；C6C 依赖 C6B 批准阈值；C6D 依赖 C6C、C4B 与统一状态机。
**强制拆分**：C6A schema + shadow（不阻断）；C6B 双人标注、最小样本量、误放/误拦阈值与批准记录；C6C 独立灰度 enforce/回退门；C6D FinalMemorial + decision + archive。观察期是运行检查点，不可压成一个 PR。

**任务**：

- 回奏 schema 必含结论、证据锚点、风险、置信度、缺证、异议、利益声明、告病、source label；
- C6A 只记录 high-risk 缺原文位置、FALLBACK/DEMO 等潜在阻断，不改变用户流程；
- C6B 由合同领域双人标注 owner 冻结样本/阈值；本文不编造样本量或准确率；
- C6C 达标并获批准后才把 high-risk 缺证、FALLBACK/DEMO 变成 hard block，并演练退回 shadow；
- 单向门规则默认慢审，LLM 只能解释不能降级；
- C6D 区分 candidate version、已裁决 formal version 和 current pointer；使用 partial unique constraint 保证同一 task 同时最多一个 current formal memorial，重审不覆盖旧版本；
- 圣裁执行对象授权、角色授权、expected version、人工确认；
- 三日复裁采用 `effective_at` 与撤回 command，不靠定时改文本；
- 归档同事务绑定 formal memorial + decision + evidence manifest。

**退出条件**：C6A 只能 `VERIFIED_PARTIAL`；C6B 有 owner/样本/阈值/批准；C6C 灰度证明误放/误拦在批准阈值内并能退 shadow；C6D 才证明伪 LIVE、缺证高风险、跨用户、重复和旧版本裁决被拒绝。
**回滚**：质量门可 shadow→enforce 分阶段；安全/归属门不可降级。
**模型**：强推理 + 合同领域双人标注 owner。

### C7 — Legacy 历史映射与影子对账

**目标**：不丢历史，但不让历史旧状态污染新事实。

**上下文简报**：旧数据分散于 tasks/decrees/memorials、registry、JSON run、frontend local DB。直接导入 canonical 会把不完整历史伪装成正式事实。

**依赖**：C1、C4。
**建议拆分 PR**：C7A inventory/export；C7B read-only legacy store；C7C reconciliation report。

**任务**：

- 建数据字典、行数/hash/孤儿/tenant 盘点；禁止复制客户正文到报告；
- 旧数据写入只读 `LegacyObservation` 或独立历史 schema，带 source system、source tenant、legacy id、完整性等级；`LegacyIdMap` 唯一键至少为 `(source_system, source_tenant_id, legacy_id)`；
- export 使用不可变 manifest、snapshot/version、checksum、断点与幂等重跑；无法归属/校验失败进入 quarantine；正文保留在受控存储，报告只含 hash/ref；
- 明确 retention、客户删除请求/DSAR、legal hold 与对象存储引用处理；
- 只有具备完整 task/decision/evidence 链的记录才可经人工批准建立 canonical link；
- link 必须以追加式 approval/revocation event 记录审批人、理由和引用；不得物理删除已被消费者引用的 link；
- 新旧链影子运行只比较归一化输出，不双写终态；
- 每日输出 mismatch：任务数、终态、正式奏折数、裁决数、孤儿数、跨 tenant 异常。

**退出条件**：历史可查；canonical 指标默认排除 legacy observation；全部旧写面已枚举和可测量，shadow mismatch 有 owner 和批准阈值。`legacy 新写入=0` 留给 C8A stop-write 后验证。
**回滚**：保留原库只读快照；以 revocation event 撤销 link，不物理删除历史或引用。
**模型**：强推理做数据迁移审查。

### C8 — 停写并退役旧入口（与 C9 验证检查点交错执行）

**目标**：从“逻辑上唯一”走到“物理上唯一”。

**上下文简报**：entry inventory 已明确 RET-01–07。删除前必须有替代 artifact、调用遥测和回滚，不以代码搜索零引用代替外部调用事实。

**依赖**：C8A 依赖 C3–C7 + C9A；C8B 依赖 C9B；C8C 依赖 C9C 和 owner 批准的支持窗口。
**强制策略**：`C9A pre-cutover → C8A stop-write → C9B复验/观察 → C8B 410 → C9C复验/观察 → C8C removal → C9D复验`。每个入口独立 change/检查点。

**任务**：

- `/api/chaotang/decree/dispatch`、tasks persist、legacy review 先拒绝新写并返回迁移指引；
- `/api/orchestration/run` 分流：纯咨询转 D0，正式任务转 canonical ingress；
- court compat 建案/签退入口 410；
- frontend local decision/archive store 删除生产写路径；
- owner 批准的观察窗口内零调用、无内部消费者、真实 E2E 通过后才可删除 router；
- capability inventory 是版本化动态阻断清单；C0D 新裁决出的 RETIRE 项自动进入 C8，不得只硬编码 RET-01–07。每项覆盖 HTTP、worker、scheduler、admin/replay、DB/file/object-store/knowledge 写面；
- 观察窗口由 owner ack、调用量、公告/SLA 和 ADR 决定，14 天不作为统一硬编码期限。

**退出条件**：网络层只有 canonical ingress/command 能创建或改变正式任务；静态扫描和运行遥测均无第二写者。
**回滚**：在 410 阶段可临时恢复 adapter；代码删除后只能恢复只读兼容，不恢复双主写。
**模型**：常规模型迁移，强推理做删除门复审。

### C9 — 30 黄金旨意、故障注入与切换前后对账（C9A–C9D）

**目标**：证明融合后不是“看起来统一”，而是真闭环。

**上下文简报**：正式验证集固定 10 D1、10 D2、10 失败/对抗/恢复；D0 另算。合同领域质量集独立，不与工作流 30 条混算。

**依赖**：C9A 依赖 C3–C7；C9B 依赖 C8A；C9C 依赖 C8B；C9D 依赖 C8C。删除旧链不得早于 C9A。
**任务**：

- 每次候选合并跑 30 条：确认数、DecisionTask 数、可解释终态数、预期 FinalMemorial 数、裁决/阻断数严格对账；
- 故障注入 worker kill、provider timeout、重复请求、乱序/晚到回报、DB 短断、重启恢复；
- 权限对抗跨用户/跨 tenant/旧 id 注入/客户端降级 hard gate；
- 来源对抗伪 LIVE、无证据 high-risk、模型 prompt injection；
- Playwright 保留 trace、截图、console/pageerror、前后端 release identity；
- 验证 rollback/forward-fix，不只测 happy path。

**退出条件**：C9A–D 每个检查点都用同一冻结数据集达到预期而非简单 HTTP 200；正式奏折落库数完全一致；零不可解释 orphan/duplicate；任何一步失败立即停止后续退役。
**回滚**：候选不晋级；不修改黄金预期迎合实现。
**模型**：独立强推理复审。

### C10 — 刑部封闭试点与上线

**目标**：用一个付费纵向切片验证系统价值，不同时推出全六部。

**上下文简报**：产品首发冻结为刑部合同审查。全朝廷能力只作为可靠性基础设施；大殿/军机处/六部拓扑默认按需展开。

**依赖**：C9D，以及 launch blueprint S1–S10 的全部安全、数据治理、发布身份和外部 trust anchor 门；不是六部全部完成。

**任务**：

- 5 家封闭客户、脱敏/授权合同、人工复核；
- 监控首次正确率、证据引用准确率、人工修改率、错误晋升率、任务恢复率、处理时长和成本；
- 达成 3 家复用、1 家付费、1 条证言；
- canary 只放刑部 profile；非首发部门从导航和直接路由受控隐藏；
- 发布由 immutable artifact + release commander + required check + 外部签名完成；
- 告警、值班、删除、备份恢复、事故响应和回滚演练到位。

**退出条件**：真实客户价值门和所有工程硬门同时通过；否则保持封闭试点。
**回滚**：关 profile/canary，保留任务只读和人工导出；不因回滚自动删除数据，但继续执行客户删除请求、retention 与 legal hold。
**模型**：强推理发布判定，业务 owner 最终批准。

## 8. 每个 PR 的固定 Harness

每个 A/B/C/D 子步骤才是一个 change/PR/运行检查点，并必须建立 `.harness/changes/<change-id>/`，至少包含 spec、tasks、CI summary、summary。本总控文件不能直接作为冷启动执行单；领取子步骤时必须冻结 absolute cwd、已确认存在的命令、PostgreSQL DSN tripwire、fixture/seed、预期退出码/关键计数、evidence artifact 路径和 rollback/forward-fix 命令。缺任一项只能标 `VERIFIED_PARTIAL`。行为变更固定顺序：

```text
调查证据
  → 失败测试/失败案例（RED）
  → 最小行为修改（GREEN）
  → 相关回归
  → verification-loop
  → diff/权限/幂等/恢复复核
  → exact SHA 证据
  → 独立审查
```

候选合并门：

- 每个状态转换至少一个失败测试；
- 每个权限面至少一个跨用户和跨 tenant 负例；
- 每个异步 command 至少验证幂等、重试、乱序和恢复；
- 每个正式奏折路径验证 quality/source/human gate；
- 每个前端路径有真实后端 E2E，不用 mock 证明上线；
- 每个 DB PR 有 PostgreSQL upgrade/restart/rollback 或 forward-fix 演练；
- 每项证据绑定 exact SHA，移动工作树结果作废重跑。

## 9. 指标与告警

### 9.1 闭环健康

| 指标 | 目标/门 | 说明 |
| --- | --- | --- |
| canonical 建案占比 | 100% | 所有新正式任务 |
| orphan assignment/run | 0 | 无 task/assignment 绑定即事故 |
| duplicate effective command | 0 | 重试不重复副作用 |
| 可解释终态率 | 100% | 每个终态有事件链 |
| worker restart 恢复率 | 100% 黄金集 | 不靠人工改 DB |
| legacy 新写入 | 0 | 进入 C8 后硬门 |

### 9.2 质量与价值

| 指标 | 初始要求 |
| --- | --- |
| 高风险结论证据锚点覆盖 | 100% 才可晋升 |
| FALLBACK/DEMO 正式晋升 | 0 |
| 跨用户/跨 tenant 成功访问 | 0 |
| 错误正式晋升 | P0 事故，立即冻结 |
| 御史封驳率 | 展示样本量；不以降低封驳率为目标 |
| 丞相押注胜率/告病率/钦天命中率 | 无数据时 NO_DATA，不补零 |

阈值要由黄金集与真实试点校准；文档不编造 P95、准确率或成本目标。

## 10. 反模式

严禁以下“假融合”：

1. 新旧表永久双写；
2. 给所有 endpoint 加一个 `task_id` 字段就宣布统一；
3. 把旧 `done` 直接映射 canonical `completed`；
4. 前端用本地 store 在后端失败时补一条“成功”；
5. 让军机处、御史或史馆各自维护 task status；
6. 把所有旧历史强行导入 `DecisionTask`；
7. 一次 PR 同时迁 API、状态机、数据库、UI、删除旧链；
8. 为赶进度放松归属、来源或正式奏折门；
9. 用 mock UI、dry-run 蜂群或 HTTP 200 声称端到端完成；
10. 在移动的 ext 脏树直接做 schema migration 或发布候选。

## 11. 计划变更协议

- **拆分**：一步超过一个独立状态迁移或无法单 PR 回滚时，拆 A/B/C 子步骤并更新依赖图。
- **插入**：发现 P0 安全/数据污染问题，可在当前步骤前插入修复；记录阻断步骤与证据。
- **跳过**：仅当证据证明能力已由另一个 verified change 完整覆盖；不能因“已有类似代码”跳过验证。
- **改序**：只有文件所有权无冲突、输入契约已冻结时允许并行/改序。
- **放弃**：保留 change、失败证据、数据迁移状态和回滚说明；不得删除审计记录。

## 12. 立即执行顺序

当前最优顺序不是继续扩 Agent，而是：

1. C0：停止 ext 并发写，固定 exact SHA，关闭 8 个 UNKNOWN；
2. C1A：tenant/actor expand、可靠回填、quarantine 与 PostgreSQL 演练；
3. C1B：把 DecisionTask 读取收口为 scoped repository，P0-B xfail 清零；
4. C1C：Alembic parity、复合约束和 expand/contract 兼容；
5. C1D：用 TDD 统一 canonical path、OpenAPI 和状态转换；
6. C2：事件账本与 durable planning/execution outbox；
7. 然后才进入蜂群 adapter；专业 profile 只做刑部。

这六步完成前，不新增部门、不扩导航、不做新大屏、不把 compat registry 的 done 当业务完成。
