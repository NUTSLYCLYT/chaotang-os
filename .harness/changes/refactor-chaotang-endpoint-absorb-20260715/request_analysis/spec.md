# 规格说明：refactor-chaotang-endpoint-absorb-20260715

## 背景

P2 已用 tripwire 和观测守门关住 parallel legacy writer。P3 在同一任务分支内按端点
逐步把旧链吸收到 canonical 主链。P3a 先处理风险最低的史官读端点；其旧实现同时读
冻结王座投影与旧复盘存储，事实源分裂，且来源标签被硬编码。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `scribe.py` 同时依赖冻结王座列表与旧复盘读 API | 变更前源码；P3a RED structural test，2026-07-15 | Backend / 已验证 | 否 |
| 已确认事实 | canonical `ShiguanArchive` 保存正式奏折快照、人工裁决、来源与 synthetic 标记；`FinalMemorial` 可为早期空快照补齐正式内容 | `backend/src/db/models.py`、`backend/web/routers/shangshufang.py::_archive_task` | Backend / 已验证 | 否 |
| 已确认事实 | 两表尚无 `tenant_id`，非 default 租户不可安全读取 | 模型定义与 `test_non_default_tenant_cannot_read_unscoped_canonical_archives` | Backend / 已验证 | 否 |
| stop-gate 事实 | `FinalMemorial`/`ShiguanArchive` 描述当时奏折，不是事后结果；旧实现却把 memorial `summary` 投成 lesson | `test_scribe_canonical_outcome_red.py` RED | Backend / 已验证 | 是（P3a 原实现） |
| stop-gate 事实 | 真实历史 lessons/playbook/authored_at 仍在 mutable `Retrospective`；拒绝路径可没有 archive | 模型、reject 路径与 RED 回归 | Backend / 已验证 | 是（P3a 原实现） |
| 已确认事实 | 当前 `manor.py` 自仓库导入以来没有 `chaotang_orchestrator` 或其它生产派发调用 | 当前源码 + 历史 `git show`/`git log -S`，2026-07-15 | Backend / 已验证 | 否 |
| 已确认事实 | `direct.py` 的 `mode=court` 仍在线程中调用 `assemble_flow/run_chaotang_task` | P3c RED 2 failed / 2 passed | Backend / 已验证 | 否 |
| 已确认事实 | P2 只有单次独立进程快照，canonical 三阶段均为 `0.0`；没有新链上升与旧链连续窗口归零证据 | P2 `ci_result/ci_summary.md`，P3d 复核 2026-07-15 | P3d 门禁 | 是（仅阻塞物理拆除） |

## 数据流与调用链

P3a 旧链：`scribe -> throne memorial projection + legacy retrospective -> response`。

P3a 修复链：`legacy Retrospective --显式幂等 backfill--> append-only
ArchiveOutcomeEvent -> scribe latest terminal outcome per task -> optional archive/formal
title snapshot -> same response envelope`。奏折正文只提供标题上下文，绝不提供 lesson。

P3b 新链：`chaotang taskDetail -> canonical task projection -> legacy response shape`；
`chaotang stream -> ordered DecreeExecutionEvent replay/current snapshot -> frontend
same-shape adapter -> BattleStream`。未迁移的活动 queue 只作为 P3d 前传输桥，不覆盖
canonical 终态或跨用户权限判断。

P3c 新链：`POST /api/direct/execute (mode=court) -> equal-shape canonical dispatch
adapter -> DecisionTask + ChancellorRouteDecision + CourtReview + EmperorDecision +
DecreeExecutionEvent + OutboxEvent（同事务） -> commit -> dispatch_after_commit ->
outbox_worker`。简单任务进入 `route.direct`，复杂会审进入 `route.council`；响应仍含
`task_id/status/result/mode/latency_ms`。`manor.py` 没有可迁写链。

P3d 默认链：`decree/dispatch -> canonical dispatch adapter -> outbox_worker`；旧
`_spawn_run` 只在 `FENGQUN_LEGACY_CHAOTANG_DAEMON=1` 时可达。`study/run` 的
`live + asyncRun` 尚没有可保持最终 edict/launch-loop 契约的 outbox consumer，默认
fail closed 为 `legacy_study_async_daemon_disabled`；同一 rollback flag 可临时恢复。
由于拆除证据不足，旧函数与 `_RUNSTATE_TO_TASKSTATUS` 保留在代码中。

P3e 默认链：`taskDetail -> DecisionTask/SwarmRun/event ledger`，不再读取
`Task.result_json`；`tasks/persist` 与 `archive/*/retrospective` 写端点在完成原有 ID、
认证/所有权检查后返回稳定只读错误；`memorial review` 只提交正式裁决链，详情从
`DecisionTask + EmperorDecision` 投影批阅结果。所有 production legacy writer ID 从
runtime allowlist 移除，仅保留 pytest 专用 writer。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `GET /api/scribe/lessons` | latest terminal `ArchiveOutcomeEvent`；archive/formal 只补标题 | 史馆页 | 维持 `{success,data:{lessons}}`；DB 故障显式 503；不把 summary 当 lesson |
| `GET /api/scribe/archive-docs` | 同一 outcome 投影 | CourtDoc adapter / 史馆卡片 | success→green；blocked/reject→red/unsigned；无 archive 的拒绝案也保留 |
| P3b taskDetail/stream | `DecisionTask` / latest `SwarmRun` / ordered `DecreeExecutionEvent` | 军机处页 / BattleStream | 原响应 shape；canonical SSE 经前端 adapter 映射；正常/失败/权限测试 |
| `POST /api/direct/execute`，`mode=court` | canonical routing decision + transaction outbox | direct API 兼容调用方 | 原五字段 data shape；正常 council/direct、DB 失败、认证与 P0-B 门测试 |
| `POST /api/chaotang/decree/dispatch` | 默认 canonical routing + transaction outbox；flag=1 才回旧 daemon | 军机处旧页面调用 | 原九字段 data shape；默认 canonical、rollback legacy、失败/权限测试 |
| `POST /api/chaotang/study/run` live async | 无等价 canonical consumer，默认关闭旧 daemon | 非当前前端调用；兼容调用方 | 明确失败码；flag=1 保留既有异步 SSE 契约 |
| `POST/PATCH /api/chaotang/tasks/*persist` | 无 legacy writer；canonical task 只读投影 | 已无活跃前端写调用；历史兼容调用方 | 保留认证、ID 与 owner 门；稳定返回 `legacy_task_projection_read_only` |
| `POST /api/chaotang/archive/{id}/retrospective` | 无等价 canonical 写契约 | 已无活跃前端调用；历史兼容调用方 | 合法请求稳定返回 `legacy_retrospective_store_read_only`；GET 历史读保持 |
| `POST /api/chaotang/memorials/{id}/review` | `EmperorDecision` + 正式 task/archive/event 链 | 朝堂批阅页 | 不再双写 reviews/JSON；详情从 canonical decision 投影同形 review |

## 范围

- P3a→P3e 五个顺序检查点，共用本 change 与 `task/p3-chaotang-endpoint-absorb` 分支。
- P3a：首次实现被 stop-gate BLOCK 后，批准补齐 outcome ledger、迁移、离线 backfill、
  两个史官读端点及其测试/证据；不借机改王座或决策 UI。
- P3b：taskDetail 与 stream canonical 投影及最小前端 adapter。
- P3c：迁移实际存在的 direct court 写链；manor 经源码/历史核实无派发，不改文件。
- P3d：仅在 P2 计数证据满足时物理拆 daemon；否则只关 feature flag。
- P3e：清空已吸收 writer 白名单并将 legacy 表写路径只读化。

## 非目标

- 不修改冻结的 `backend/web/routers/throne.py`。
- 不裁决庄园产品去留。
- 不迁移 `direct.py` 的纯 LLM / swarm 模式；它们不调用 chaotang orchestrator。
- 不把正式奏折、裁决 reason 或 synthetic retrospective 伪装成真实 outcome。
- 不在 P3e 前合并或宣告顶层 P3 完成。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| synthetic / FALLBACK / DEMO 归档 | 不进入史官真实旧案列表 | canonical tests |
| archive snapshot 缺失 | outcome 仍保留；标题可回退 `FinalMemorial`/task id | no-archive rejected test |
| 同 task 多次 outcome | 追加 correction + supersedes；稳定投影最新一条，旧事件保留 | correction regression |
| non-default tenant | 因表无 tenant 字段而 fail closed 返回空 | tenant isolation test |
| canonical DB 不可用 | 显式 503，不把故障伪装成“没有历史” | failure contract test |
| 未认证且启用认证 | 401，不进入投影 | auth test |
| canonical task 属于其他用户 | 详情统一“不存在”，stream 404；不得回退旧 queue | P3b ownership tests |
| canonical DB 不可用 | 详情显式 fail；stream 503；不得伪装空成功 | P3b failure tests |
| 终态 task 重放 | 严格按 event sequence 输出 canonical events，最后输出 terminal snapshot | P3b SSE test |
| 尚无 canonical row 的活动 study-live | P3d 前临时沿用 queue；前端 adapter 保持旧事件同形 | study-live regression |
| direct court 路由为 council | 原五字段响应，status=`edict_recorded`；事务内写 route/review/timeline/outbox | P3c council test |
| direct court 路由为 direct | 原五字段响应，status=`direct_completed`；outbox=`route.direct`；canonical SSE 终态 | P3c direct test |
| direct court canonical DB 不可用 | fail closed，稳定错误码 `canonical_dispatch_failed`，不回落旧 orchestrator | P3c failure test |
| direct execute 的跨用户边界 | task ID 为服务端随机自建且请求模型不接受目标 ID；P0-B 门显式豁免并说明原因 | P0-B derived attack-surface gate |
| P2 观测证据不足 | 不删除 `_spawn_run`、study daemon、`_RUNSTATE_TO_TASKSTATUS`；默认 flag=off | P2 evidence audit + structural diff |
| chaotang decree 默认派单 | 不调用 `assemble_flow/_spawn_run`，不写 legacy Decree/Task；同形返回 canonical status | P3d default-path test |
| rollback flag=1 | 旧双写/daemon 路径仍可运行并受原 tripwire 约束 | S10 legacy rollback tests |
| study live async 且 flag=off | 不创建线程，返回 `legacy_study_async_daemon_disabled` 并记 blocked event | P3d gate test |
| owned legacy task persist 请求 | 完成 owner 校验后稳定拒绝，不写 `Task/Decree` | P3e task projection tests |
| other-user persist 请求 | 仍返回无权，不用统一只读错误掩盖权限门 | P0-B behavioral gate |
| taskDetail 没有 SwarmRun 但有旧 `Task.result_json` | 只返回 canonical task 状态与空 result，不泄漏旧 payload | P3e canonical detail test |
| memorial review 成功 | 只写 formal decision chain；legacy DB/JSON writer 即使不可用也不影响成功 | P3e memorial adapter test |
| production legacy writer ID | tripwire 默认 fail closed；allowlist 只含两个 pytest ID | P3e exact allowlist tests |
| 紧急恢复旧 daemon | 同时 `FENGQUN_LEGACY_CHAOTANG_DAEMON=1` 与 `FENGQUN_LEGACY_WRITE_TRIPWIRE=0` | rollback-only S10/H1 tests |

## 风险与回滚边界

P3a 主要风险是把“当时建议”误装成“后来结果”，或迁移 mutable retrospective 时覆盖
历史。缓解：lesson/playbook 只来自 append-only outcome payload；内容哈希幂等回填，修订
追加 correction + supersedes；synthetic 跳过；legacy_unverified 诚实 unsigned；DB 故障 503。

P3b 主要风险是迁移读端点时让正在运行的旧任务断流，或在 canonical 权限校验失败后
回落 queue 造成越权。缓解：canonical 终态任务只读账本；canonical 尚未终态且旧 daemon
仍在产出，或 canonical row 尚不存在时，才允许活动 queue 桥；AccessDenied 与 DB
unavailable 均 fail closed。

P3c 主要风险是为保留同步“completed”假象而继续等待旧 daemon，或出现“派单成功但
canonical 事实未提交”的窗口。缓解：兼容响应只保留字段形状，不伪装完成状态；所有
canonical 事实与 outbox 同事务提交，提交后才触发 worker；失败不回落旧 orchestrator。

P3d 主要风险是无流量数据就删除 rollback 代码，或把尚无等价 consumer 的 study 异步
任务谎报为 canonical 成功。缓解：物理代码保留；默认 flag 关闭；decree 有等价 outbox
才迁移，study async 明确失败并留下 blocked event。P3e 后紧急恢复必须同时显式打开
daemon flag 并关闭 legacy-write tripwire，避免单一误配置恢复旧写链。

P3e 主要风险是删掉 legacy 双写后，批阅状态与任务详情仍从旧表回读，造成页面状态倒退；
或直接把写端点统一拒绝而丢失 owner 门。缓解：批阅详情改投影正式裁决，task detail 删除
`result_json` fallback；persist 端点先做 ownership 检查再返回只读错误；历史 GET 保持只读。

回滚按 P3a repair 原子 commit；若 ledger 已有数据，禁止直接 downgrade 丢账，应先停写、
回退读投影并保留表。临时恢复旧读链仍须按 P2 程序登记，不能静默加回 writer 白名单。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-15
- 批准范围：按既定 P3a→P3e 顺序继续执行
- P3a stop-gate 修复授权：用户要求按顶尖专家方式处理并按顺序执行；先修 P3a，独立
  review GO 前不推进新的决策按钮/UI 工作。
- 明确未批准：修改冻结王座；无流量证据物理拆除 P3d；P3e 前合并/宣告完成

## 验收标准

- 每步对应端点正常、失败、权限契约通过。
- 前端调用无 404 / 响应形状漂移，相关 contract audit 通过。
- golden cases 与三层 doctor 通过或与登记基线一致。
- P3a 生产代码不再出现旧复盘存储或冻结王座依赖。
- P3b taskDetail 不再读内存 registry / RunLog；终态 stream 不触碰旧 queue；前端
  BattleStream 继续消费稳定事件词表。
- P3c direct court 不再导入/调用 `chaotang_orchestrator`；normal council/direct、失败、
  认证、P0-B 与 outbox 相邻测试通过；manor 无写链的证据已登记。
- P3d 默认 decree 路径不调用旧 daemon/flow-store 双写；study async flag-off 不启动线程；
  rollback flag 测试通过；无证据时不得删除保留代码或 `_RUNSTATE_TO_TASKSTATUS`。
- P3e 后已吸收 writer 白名单清零；整包独立审查 GO 后才允许合并。

## 验证计划

每个检查点执行 TDD RED→GREEN、聚焦 pytest、相邻契约、结构 grep 与 diff review；
P3e 汇总后再执行全量 backend/frontend 测试、API contract audit、三层 doctor 与独立审查。
