# 任务：docs-chancellor-junjichu-orchestration-design-20260713

**2026-07-13 架构复审后重排**：原稿把户部/吏部并列为 P0 试点、task 0.2 指向 `route_swarms()`、超时当成加参数的一行改动——复审(见 spec.md 各处"复审修正"标注)发现这三处都需要改：吏部单独起步做主试点，户部三司需要真新工程往后放；覆盖入口其实已经存在于 `run_swarm_execution_loop`，缺的是调用方 `_execute_council()` 没传；超时需要下推到引擎级调用，不是 executor 层加参数。以下是重排后的版本。

分四阶段，每阶段可独立验证、独立提交，不要求一次做完。阶段间有依赖顺序(阶段2依赖阶段1建立的单一事实源，阶段3依赖阶段2的司级契约)。

## 阶段 0（先修底座，跟五层结构无关，任何时候都该做）

### 任务 0.1 — 蜂群调用超时（真新工程，不是加参数）
- 目标：司级/部门级蜂群调用有真实的墙钟上限，卡死的引擎调用不会拖死整个 council 流程。
- **不要做的事**：不要只在 `future.result(timeout=N)` 外面套 try/except——`TimeoutError` 是 `Exception` 子类，会被 `swarm_execution_loop.py:817-824` 现有的通用 `except Exception:` 接住，然后**串行无界重跑同一个引擎**，等于把挂起从并发换成串行，没有真的设上限；而且 `ThreadPoolExecutor` 的 `with` 块退出会 `join` 住卡死的线程，池子本身也走不掉。
- 正确做法：把超时下推到每个引擎自己发起网络/LLM 调用的地方——`ModelAdapter.call()` 的请求级 timeout、Tavily 客户端(`jinyiwei_search.py`)的请求级 timeout。同时把 `TimeoutError` 从 `swarm_execution_loop.py:817-824` 的通用 except 里单独摘出来，标记该部门/司为"未完成"，不落入串行重跑分支。
- 输入：`swarm_execution_loop.py:795-824`(并发提交+异常处理)、`ModelAdapter` 的 HTTP 客户端配置、`jinyiwei_search.py`。
- 输出：每个真实网络调用点有 timeout 配置；`_run_departments_cross_referenced` 对 TimeoutError 单独处理，不重跑。
- 验收：mock 一个 sleep 超过阈值的引擎调用，验证整体流程在 N 秒内返回（不是等到线程池 teardown 卡住），其余部门结果不受影响，且没有触发无界串行重跑。

### 任务 0.2 — 消灭两套独立关键词表分叉（retarget：改 `_execute_council`，不改 `route_swarms`）✅ 已完成(2026-07-13)

**(复审补充修复)** `route_plan["swarm_tasks"]` 是 `selected_swarms` 的姊妹字段，覆盖生效时只改了 `selected_swarms` 没同步改 `swarm_tasks`，导致审计记录里两个字段自己打架（`swarm_tasks` 停留在关键词路由算出的旧部门，其中还包含吏部两个 swarm_id 的误判，比最初发现的范围更大）。已一并修复并加测试覆盖。
- **(复审修正)** 原任务写的是给 `route_swarms()` 加 `department_override` 参数——错了，这个覆盖入口已经存在于 `run_swarm_execution_loop(params["department_ids"])`(`swarm_execution_loop.py:856-876`)，传入后会完全绕开 `route_swarms()` 的关键词扫描。真正缺的是调用方从来没传这个参数。
- 目标：`outbox_worker._execute_council()` 把 `infer_departments()` 算出的部门列表传给 `run_swarm_execution_loop`。
- 输入：`outbox_worker.py:85-113`(`_execute_council`，`draft_payload` 已经在作用域里，含 `recommended_departments` 字段，来自 `shangshufang_loop.py:132/464`)。
- 输出：`run_swarm_execution_loop` 调用处新增 `"department_ids": draft_payload.get("recommended_departments")`。
- 输出（顺带修）：同一处改动要把 `selected_swarms` 审计记录里丢失的元蜂群名字补回去（复审发现的既有次生漏洞：覆盖生效时 `swarm_execution_loop.py:865-876` 会整体重写 `selected_swarms`，元蜂群从记录里消失，但仍照常执行）。
- 验收：同一条圣旨走完整链路，审计记录的 participants 和实际执行的 department_ids 完全一致；`selected_swarms` 记录里能看到元蜂群仍然在案。

## 阶段 1（军机处最小实现）

### 任务 1.1 — 丞相润色
- 目标：`draft-edict` 阶段追加一次 LLM 调用，把 `raw_question` 改写成更清晰可执行的 `refined_edict`。
- 输入：现有 `shangshufang.py:776` 的 draft-edict handler，复用 `ModelAdapter`。
- 输出：`DecisionTask` 新增 `refined_edict` 字段。
- 验收：口语化/模糊的原始圣旨经润色后，字段结构、动词、范围更明确（人工抽检 10 条对比）。

### 任务 1.2 — 军机处评议表 + 评议逻辑
- 目标：新建 `JunjichuDeliberation` 表和评议函数，输入 refined_edict + 六部/司花名册，输出 participants + output_standard。
- 输入：spec.md 的"军机处设计"章节数据结构。
- 输出：新模块（如 `src/junjichu_deliberation.py`），LLM 调用失败时 `fallback_used=True` 并退化到 `infer_departments()`。
- 验收：任务 0.2 里的一致性断言改成"审计记录 = 军机处 participants = 实际执行"，三者一致。

### 任务 1.3 — outbox_worker 接入军机处输出
- 目标：`_execute_council()` 用军机处的 participants 代替 `infer_departments()` 的结果（任务0.2打的补丁，改成消费军机处产出），作为传给 `department_ids` 的来源。
- 验收：council 全流程跑通，行为对现有已通过的测试不回归。

## 阶段 2（吏部试点——唯一 P0 起步试点）

**(复审修正)** 户部从本阶段移出：三道闸共享结构化输入、由统一函数做跨闸综合判定，拆司需要 case 拆分器 + 综合判定重写，是真新工程，风险和工作量都比吏部高。吏部两条引擎吃自由文本、无结构化耦合，是更干净的起步点，先用它验证整条链路骨架。

### 任务 2.1 — 吏部两司 SWARM_DEFS 注册
- 目标：新增 `libu_appointment_office_swarm`/`libu_recruit_office_swarm` 两条 entry，复用现有 `libu_appointment_vet`/`libu_vet` 引擎。
- 输出：两个新 adapter 函数，遵循 spec.md"智能体设计"章节的输出契约（含 `office_id`/`engine_tier`）。
- 验收：spec.md"吏部试点验收标准"里的"部分司参与"（只选招聘司）场景通过。

### 任务 2.2 — 吏部两司并发行为的显式决策（复审新增，不能默认忽略）
- 目标：军机处同时选中任免司+招聘司时，决定是否保留现有 `adapt_libu_personnel` 的"任免优先短路"语义（`real_department_engines.py:814-817`），还是接受两个引擎并发都跑、在部门汇总层再做取舍。
- 输出：显式的行为决策 + 对应实现（不管选哪个，都要有代码体现，不能停留在"没想过"）。
- 验收：两司同时命中关键词的圣旨端到端跑一次，行为符合决策文档，且有测试覆盖。

### 任务 2.3 — 部门层司报告聚合
- 目标：吏部 orchestrator 收集司报告，合并进 `memorial_json.ministry_outputs[].office_reports`。
- 输入：现有 `ministry_outputs_from_swarm()`(`shangshufang_loop.py:269-313`)。
- 输出：扩展该函数，新增 `office_reports` 子数组，不改动现有字段（前端兼容）。
- 验收：吏部试点端到端跑通，`office_reports` 结构正确，每条带正确 `office_id`。

## 阶段 3（户部第二试点 + 御史 shadow mode——吏部跑通后再排期）

### 任务 3.1 — 户部 payment case 拆分器（新增，复审发现的真实工作量）
- 目标：把 `_extract_payment_case()` 解析出的结构化 case，拆成会计司/出纳司/预算司各自需要的输入片段，让三个司可以独立调用各自的 gate 函数。
- 输入：`hubu_payment_preview.py:278-327`(`build_hubu_memorial`/三道 gate 函数的当前单体调用方式)。
- 输出：拆分器函数 + 三条新 SWARM_DEFS entry(`hubu_budget_office_swarm`/`hubu_treasury_office_swarm`/`hubu_accounting_office_swarm`)。
- 验收：三司能各自独立收到正确的输入片段，不依赖彼此执行顺序。

### 任务 3.2 — 户部跨司综合判定重写（新增，替代单体 `build_hubu_memorial`）
- 目标：部门汇总层重新实现跨司综合判定(traffic-light)逻辑，输入是三个独立司报告而不是一次性拿到全部三个 gate 结果。
- 验收：拆分后的综合判定结果与现状 `build_hubu_memorial()` 的输出**回归一致**（同样的输入，裁决结果不能变）。

### 任务 3.3 — 御史 shadow mode 挂载
- 目标：`output_standard.requires_yushi=True` 时，outbox_worker 在部门汇总后调用现有 `/api/yushi/review` 等价逻辑，只记录判断（`yushi_shadow_verdict` 字段），不阻断流程。
- 验收：跑一批历史 council 结果，能查到"如果强制拦截会不会被挡"的统计。

## 阶段 4（呈现层，可与阶段2/3并行）

### 任务 4.1 — engine_tier 呈现层标注
- 目标：史馆/上书房呈现回奏时，`engine_tier="llm_roleplay"` 的内容有显著视觉区分（不只是数据里有字段）。
- 验收：人工截图核对，用户能一眼看出"这段是真算的还是 AI 编的"。

---

**不在本轮任务列表里**：兵部/刑部/礼部/工部拆司（先验证吏部试点、视情况验证户部第二试点跑通再决定要不要推广），礼部 office-kit 前端工具是否接入这条链路（需要单独决策，见 spec.md 非目标）。
