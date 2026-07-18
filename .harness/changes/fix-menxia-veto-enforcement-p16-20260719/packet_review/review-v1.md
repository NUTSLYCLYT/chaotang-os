# P16 独立 Packet 复审报告 v1

| 字段 | 值 |
| --- | --- |
| Packet ID | P16 |
| Change ID | fix-menxia-veto-enforcement-p16-20260719 |
| B16 | e38b31f901256a565e6b7900dd7f88b28c100dd6 |
| H16 | 0269869bfd42d4a21e7dda32314863701b92e996 |
| 审查区间 | `git diff B16..H16` |
| 审查员 | 独立 Claude Code（review-only，隔离 worktree） |
| 审查日期 | 2026-07-19 |
| 结论 | NO_GO（1 HIGH，1 MEDIUM） |

## 0. 区间前置校验

| 校验 | 期望 | 实测 | 结果 |
| --- | --- | --- | --- |
| `git rev-parse H16^` | == B16 | `e38b31f901256a565e6b7900dd7f88b28c100dd6` | PASS |
| `git rev-list --parents -n 1 H16` | 单亲 | `0269869 e38b31f` | PASS |
| `git diff --name-status B16..H16` 路径数 | 23 | 23 | PASS |
| `git diff --check B16..H16` | 无输出 | 无输出 | PASS |
| 起始工作树 | 干净 | 干净 | PASS |

前置校验全部通过，审查在固定区间内进行。

## 1. Findings

### CRITICAL

无。

历史 Opus review `e59df3b…` 的 Menxia CRITICAL（封驳后仍进入执行）在**未指定部门覆盖**
的路径上确实已经关闭，证据见第 2 节。但见下方 HIGH：同一份封驳保护在另一条生产入口
上被本包新引入的旁路整体关掉，因此本包不能判为 GO。

### HIGH

#### H-1 `_EXPLICIT_OVERRIDE_MARKER` 让客户端可完全绕过门下省范围封驳

- 文件：`backend/src/menxia_veto.py:23-26`（常量）、`backend/src/menxia_veto.py:29-32`
  （`_route_has_scope_evidence` 无条件提前 `return True`）
- 触发链：`web/routers/chaotang.py:265-300`（`body.ministers` / `body.groups` 由客户端
  提供）→ `build_compat_dispatch_constraints` → `constraints["appliedDepartments"]` →
  `src/execution/canonical_court_dispatch.py:125-127,152-159`
  （`department_override=routing_departments`）→
  `src/chancellor/routing_service.py:150-152`（`_apply_department_override` 把
  `兼容入口明确指定参审部门` 写进 `route["reason"]`）→ `review_route` 判 `准奏`。

实测复现（纯函数探针，无写入）：

```
q = '我要去美国看世界杯决赛'
no-override  verdict: 封驳   departments: ['户部', '工部']
override reason: 涉及多部门：户部、工部 兼容入口明确指定参审部门：hu_bu。
override      verdict: 准奏   departments: ['hu_bu']
```

同一条**本包自己用来证明修复有效的**越界任务，只要调用方在
`/api/chaotang/decree/dispatch` 里多传一个 `ministers=["hu_bu"]`，门下省范围审查就
被整体跳过，`route_decision.risk_flags` 不含 `门下省封驳`，两处新增的 fail-closed 分支
根本不会被触发，任务继续走 `EmperorDecision` 写入、outbox 入队和部门/蜂群执行
（`canonical_court_dispatch.py:249-300` 及其后）。

这是本包**新引入**的行为：B16 的 `_route_has_scope_evidence` 没有任何 reason 短语提前
返回，覆盖后的 `selected = ['hu_bu']` 与原文做关键词比对无交集，仍会封驳。也就是说，
P16 在关闭 A 路径 CRITICAL 的同时，在 B 路径上把同一条治理规则关掉了：用户可见的失败
形态（越界任务被真实派给部门执行）依旧可达，只是换了一个由客户端控制的杠杆。

代码注释给出的动机（覆盖后的部门与原文天然无关键词交集，会误封驳合法任务）是成立的，
但补救方式过宽。正确做法是拿**覆盖前**的路由（或覆盖前后取并集）去做范围取证，而不是
在检测到覆盖时无条件放行；这样注释里举的“分析低温电池市场 + ministers=hu_bu”场景
仍然准奏（覆盖前的关键词路由本来就命中），而“世界杯决赛 + ministers=hu_bu”仍然封驳。

另需注意：`_EXPLICIT_OVERRIDE_MARKER` 与 `_LIGHTWEIGHT_TASK_MARKER` 都是对另外两个模块
生成的中文 reason 文本做子串匹配。`_LIGHTWEIGHT_TASK_MARKER` 至少被新增的黄金案例参数化
测试间接锁住（`simple_02` / `simple_03` 断言准奏），`_EXPLICIT_OVERRIDE_MARKER` 没有任何
测试覆盖，上游改一个字就会静默改变治理边界。

- 影响：治理旁路，可由客户端请求体直接触发。
- 建议：改为对覆盖前路由做范围取证；并补一条锁死
  “越界任务 + 显式 ministers 仍然封驳”的回归。

### MEDIUM

#### M-1 `department_override` × 门下省交互完全没有回归覆盖

- 文件：`backend/tests/test_menxia_veto.py:12-42`、
  `backend/tests/test_chaotang_dispatch_decision_fact.py:62-70`
- 新增的黄金案例参数化测试走的是 `chancellor_decide_route(edict)` 原始路由，
  **不带** `department_override`；新增的 compat 回执测试其 docstring 明确写着
  “不带 constraints/department_override”。也就是说，本包新增的两条 marker 旁路中，
  真正危险的那条（H-1）在整个 23 路径里没有一行测试触碰。
- 后果：H-1 不是被权衡后接受的风险，而是无人观测的行为；`ci_result/ci_summary.md`
  的 DoD 表格里 “veto 阻止所有执行副作用 = PASS” 因此覆盖不全。
- 建议：为 `/api/chaotang/decree/dispatch` 带 `ministers`/`groups` 的越界命令补一条
  端到端断言（`triggered == []` + `task.status == menxia_veto_pending`）。

### LOW

#### L-1 SSE 成功白名单含两个永不出现的状态

- 文件：`frontend/src/lib/api/adapters/chaotang-canonical-stream.ts:33`
- `SUCCESS_STATUSES` 含 `'reviewed'` 与 `'direct_completed'`，但后端
  `backend/src/chaotang_task_projection.py:23-45` 的 `_WIRE_STATUS` 把
  `direct_completed` 映射成 `report_ready`，且从不产出 `reviewed`。两个条目是死分支。
- 白名单方向本身是对的（我已逐条核对可达 wire status：`submitted` / `running` /
  `report_ready` / `archived` / `failed` 及裸透传值），未发现把合法成功终态误判成
  `error` 的路径；仅为可读性问题。

#### L-2 `menxia_veto_pending` 不进 `_WIRE_STATUS` 的代价未写进变更文档

- 文件：`backend/src/chaotang_task_projection.py:31-45`
- 该取舍（宁可透传裸内部状态，也不给一个自信的错误映射）在代码注释里论证充分，我认可
  这个判断。但 `summary.md` / `spec.md` 的“非目标 / 未验证项”没有列出
  “其它以 `TaskStatus` 为准的界面会显示空白状态”这一残留后果。
- 我已核实这不会伪报成功：`frontend/src/features/throne/lib/plain-language.ts:17-31`
  的 `taskStateInPlainWords` 是穷尽 switch 无 default，未知值返回 `undefined`（渲染为空），
  且该函数当前无任何生产调用方。
- 顺带：该注释引用它作为“11 态白话映射”的依据，但函数已无调用方，注释略过时。

#### L-3 两处封驳 memorial 字面量重复，已经开始漂移

- 文件：`backend/src/execution/canonical_court_dispatch.py:177-219` 与
  `backend/web/routers/shangshufang.py:1101-1152`
- 两份手写 memorial 已不一致：compat 版缺 `risk_register` 和 `formatted_memorial`。
- 当前无害（`canonical-memorial-view.ts:65` 与 `canonical-read-model.ts:243` 都用
  `?? []`；`ShangshufangReviewMemorial.risk_register` 在
  `frontend/src/lib/jiqun-api.ts:236` 是可选字段），但两份必填字段清单靠人工同步维护，
  下次前端新增必填字段时只改一处就会在一条入口上崩。
- 建议：抽一个 `build_menxia_veto_memorial()` 共享构造器。

#### L-4 `spec.md` 引用了不存在的函数名

- 文件：`.harness/changes/fix-menxia-veto-enforcement-p16-20260719/request_analysis/spec.md`
  “数据流与调用链”一节写 `apply_menxia_veto()`；实现里没有这个函数，实际是两处内联的
  `if "门下省封驳" in route_decision.risk_flags`。

## 2. 逐项审查结论（10 项）

### 2.1 两条生产入口是否在副作用前 fail closed

**部分通过（受 H-1 限制）。**

- `backend/src/execution/canonical_court_dispatch.py:160` 的封驳分支位于
  `chancellor_routing_service.decide()` 之后、`EmperorDecision` 写入
  （`:281`）、`record_timeline_event` 和 outbox 入队之前，`return` 直接短路。
- `backend/web/routers/shangshufang.py:1085` 的封驳分支同样紧跟 `decide()`，早于原
  `edict_for_review` / 会审 / 派单链路。
- 无副作用性质已核实：`chancellor_routing_service.decide`
  （`backend/src/chancellor/routing_service.py:130-209`）只写 `ChancellorRouteDecision`
  一行决策事实且自带幂等短路（`:143-146`）；`draft_edict`
  （`src/shangshufang_loop.py:593`）、`routing_plan_for`（`:730`）、
  `format_memorial_sections`（`:485`）均为纯函数，不触碰 db、不调用部门 engine。
  `direct_receipt_for` / `review_memorial_for` 被有意避开。
- 运行时证据：`backend/tests/test_direct_canonical_dispatch.py:158-190` 断言
  `triggered == []`（`decree_dispatcher.dispatch_after_commit` 从未被调用），
  `receipt["outbox_event_id"] is None`。
- 遗留：H-1 下 `risk_flags` 里根本不会出现 `门下省封驳`，这两个分支不生效。

### 2.2 只匹配专属封驳信号 / Menxia scope 假阳性假阴性

**信号选择通过；scope 规则不通过（H-1）。**

- 两处都用 `"门下省封驳" in route_decision.risk_flags`，不用宽泛的
  `human_confirmation_required`。后者在 `routing_service.py:187` 由
  `route.get("humanSignoffRequired")` 推导，还有别的合法触发源；本包的取舍正确，普通人工
  确认任务不会被误拦。
- 假阳性方向：`backend/tests/test_menxia_veto.py:22-42` 用 33 条黄金案例参数化，
  锁住 `simple_02` / `simple_03` / `ambiguity_03` 不再被误封驳，同时保留 6 条已知缺陷
  案例仍被封驳。这条测试写得诚实（显式列出预期封驳集合，不靠模糊断言）。
- 假阴性方向：见 H-1。另外
  `menxia_veto.py:36`（`any(dept in task_text for dept in selected)`）是对部门名做子串
  匹配，原文里出现“户部”二字即视为范围取证——这是 PKT-2“显式部门点名优先”的产品规则，
  可接受，但与 H-1 叠加会进一步放宽边界。

### 2.3 `menxia_veto_pending` 持久化 / tenant lineage / writer inventory 8→10

**通过。**

- 两处 `CourtReview` 均显式传 `tenant_id=task.tenant_id`
  （`canonical_court_dispatch.py:227`、`shangshufang.py:1159`），未依赖隐式默认。
- `backend/tests/test_core_tenant_lineage_contract.py:37` 的 `CourtReview` 计数
  8→10 与实际新增两处一致。
- `backend/src/court_review_writer_inventory.py:15-16` 精确到
  `(文件, 函数) -> 次数`：`dispatch_compat_court_task` 1→2、
  `shangshufang_confirm_edict` 2→3，其余五项未动。
- 架构门是真门：`backend/tests/test_court_review_writer_inventory.py:52-56` 独立 AST 扫描
  `src/` 与 `web/` 全量，断言 `actual == Counter(baseline)` **且** `total() == 10`，
  多写少写都会红。

### 2.4 confirm 重试幂等 / review_id 稳定 / 正常路由兼容

**通过。**

- `web/routers/shangshufang.py:1035-1041` 把 `menxia_veto_pending` 加进
  `_TERMINAL_CONFIRMED_STATUSES`，重试命中 `:1042` 幂等短路，返回既有 review，
  不二次 INSERT。`backend/tests/test_shangshufang_loop_api.py:207-229` 断言两次
  `review_id` 相同且都 `success`。
- `review_id` 由 `make_id("review", task.id, "menxia-veto")` 确定性生成；compat 侧用
  `"compat-menxia-veto"` 后缀，与正常路径的 `compat-direct` / `compat-council`
  （`canonical_court_dispatch.py:261-263`）不冲突。
- compat 入口无重试撞键风险：`web/routers/chaotang.py:267` 的 `task_id`
  每次请求由 `secrets.token_hex(8)` 新生成。
- 正常 direct / council 路由未被改动：封驳分支之后的原代码逐字保留（diff 只在其前插入），
  backend 全量 2775 passed 无回归。

### 2.5 REST memorial 形状是否来自真实后端

**通过（含一处漂移观察，见 L-3）。**

- 必填字段齐全并被测试逐个锁死：`conflict_summary[].departments`
  （对应 `frontend/src/lib/jiqun-api.ts:255-259` 的必填 `string[]`，
  `canonical-read-model.ts` 无条件 `unique(item.departments).map()`）、
  `decision_options: []`、`evidence_gaps`、`next_best_action`、`source_label`。
- `quality_gate.passed: False` 与 `status: "blocked"` 同时填写；前端
  `explicitGate()` 只读严格布尔 `passed`，这一点被
  `test_shangshufang_loop_api.py:176` 与前端
  `canonical-read-model.nodetest.ts:147-193`（断言 `overallSignal === 'RED'`）双向锁住。
- fixture 真实性：`canonical-read-model.nodetest.ts` 里的 veto 对象注释说明是从真实
  confirm-edict 现场原样贴回，且刻意不再用 `memorial()+overrides` 手写——这正是上一轮
  “手写 fixture 比生产形状更完整、掩盖崩溃”的根因，本轮已纠正。我逐字节比对了该 fixture
  与 `shangshufang.py:1101-1152` 的生产构造，字段集一致。
- `next_best_action: "await_human_signoff"`、`decision_options: []`
  诚实反映“当前没有可点的放行动作”，未伪造按钮。

### 2.6 terminal SSE 语义

**通过。**

- `frontend/src/lib/api/adapters/chaotang-canonical-stream.ts:26-52` 由
  “非 failed 即 done” 的兜底反转为成功白名单：只有明确认识的成功状态发 `done`，
  `menxia_veto_pending` 发专属 `blocked`，其余（含未来任何新终态）落 `error`。
  方向正确——未知状态的默认从“伪报成功”变成“报错”，是 fail-closed。
- 我逐条核对了可达 wire status，未发现合法成功终态被误判为 `error`
  （council 完成后 `outbox_worker.py:223` 把 `task.status` 置为
  `awaiting_decision`/`awaiting_evidence` → `report_ready`，在白名单内；
  direct 走 `direct_completed` → `report_ready`；`edict_recorded` 阶段
  `execution.terminal` 尚未为真，不发终态事件）。
- `BattleStream.tsx:105-109,198,598-603,660,685-687,825-841` 把 `blocked` 与 `error`
  完全分离：独立事件类型、独立 streamStatus、金色而非红色圆点、
  “需人工确认” 而非 “异常终止”、独立 banner。语义分离到位。
- 后端配合：`chaotang_task_projection.py:315-330` 显式把
  `menxia_veto_pending` 判为 `terminal=True`，绕开 `execution.terminal`
  （封驳任务有 `ChancellorRouteDecision` 但无执行事件，`execution` 非 None 却永远读不到
  终止）。这个分支顺序上的坑注释交代清楚，`test_direct_canonical_dispatch.py:180-189`
  锁住 `terminal is True` 且刻意不锁具体 wire status 值。

### 2.7 浏览器当前实际挂载的 UI

**通过。**

- `JunjichuCenterWorkSurface` 确为当前挂载组件：
  `frontend/src/app/(dashboard)/junjichu/page.tsx:44` 导入、`:2988` 渲染。
- 状态来源链已核实为真实后端形状：`page.tsx:2837`
  `caseIdentity.status = displayTaskSummary?.status`，该值来自
  `read_task_projection`（`chaotang_task_projection.py:184`
  `_WIRE_STATUS.get(task.status, task.status)`），`menxia_veto_pending` 未映射故原样透传，
  与 `JunjichuCenterWorkSurface.tsx:24` 的比较值一致。
- 提示文案明确包含“未生成奏折，也未派发部门或蜂群执行”
  （`JunjichuCenterWorkSurface.tsx:34-42`）。
- 本轮 diff 未触碰任何未挂载的旧面板；前端改动仅落在
  `BattleStream.tsx`、`JunjichuCenterWorkSurface.tsx`、`canonical-memorial-view.ts`、
  `chaotang-canonical-stream.ts` 四个生产文件，全部在活跃链路上。
- 上书房侧新增独立 `'vetoed'` kind（`canonical-memorial-view.ts:11,216-222`），
  避免复用 `'candidate'` 的“候选会审”措辞编造未发生的会审；`reporter` 改 `门下省`、
  隐藏“部门冲突”行（`:92-97`）也都指向同一条诚实性原则。

### 2.8 测试是否会咬

**通过。**

- RED 根因（按 diff 逐条核实，非采信 Codex 结论）：
  writer inventory 测试断言 `total() == 10`，B16 基线为 8 且分项为 1/2，必红；
  SSE nodetest 期望 `type: 'blocked'`，B16 代码物理上产不出该值；
  黄金案例测试要求 `simple_02`/`simple_03`/`ambiguity_03` 准奏，B16 的
  `_route_has_scope_evidence` 无 marker 分支必封驳。ci_summary 记录的首跑
  2 failed / Playwright 1 failed / 探针 exit 1 与此一致。
  （降级说明：我未在 B16 检出物上实跑这些测试——那需要新建临时 worktree，
  超出 review-only 边界；RED 根因为逐行代码推导 + 与 ci_summary 交叉核对。）
- 无副作用：`triggered == []`。
- 幂等：两次 confirm 的 `review_id` 相等。
- 真实响应 fixture：见 2.5。
- writer / tenant AST：见 2.3，是全量扫描的真门而非样本断言。
- SSE：正反两例（成功白名单 + blocked 专属类型）。
- Playwright：`e2e/menxia-veto-blocked-state.spec.ts` 同时断言正面文案可见与
  负面文案 `toHaveCount(0)`（“作战流进行中 · 奏折待生成”、“已完成”、“异常终止”），
  这三条负断言是防伪报的关键，写法正确。
- 唯一覆盖缺口：M-1。

### 2.9 是否把不存在的人工 override 说成已实现

**通过。**

`summary.md` 边界节明确写“当前没有可用的 Menxia override 执行器；本包不伪造
‘覆盖封驳’按钮”；`spec.md` 非目标节、`ci_summary.md` 未验证项均重复列出。
代码侧 `decision_options: []` 与注释“不填假的‘覆盖封驳’之类的选项——那类动作现在没有
真实后端处理器，放出会是骗人的按钮”一致。文档也正确保留了工部电池 HIGH 为独立后续
阻断项，未宣称整份历史 NO_GO 已清零。这一项是本包做得最好的部分。

### 2.10 安全 / 并发 / 事务 / 错误路径 / 重复写 / 契约 / 范围夹带

- 事务原子性：两条封驳路径都在单个 session 内改 `task.status`、`db.add(CourtReview)`
  后 `db.commit()`；compat 路径先前 `add_compat_decision_task(..., status="executing")`
  的中间态在同一未提交事务内被覆盖，不会有 `executing` 泄漏落盘。
- 权限：`shangshufang_confirm_edict` 的 `task.user_id != _user_id(user)` 检查
  （`:1013`）在封驳分支之前，未被绕过。
- 重复写：writer inventory AST 门 + 幂等短路双重约束，未发现重复 `CourtReview`。
  封驳分支不写 `EmperorDecision`（正常路径 `:281` 才写），语义正确——没有派单就不该有
  御前决定事实。
- 契约兼容：`kind` 联合类型扩展为 `'vetoed'`，`tsc --noEmit` 通过说明无遗漏的穷尽分支；
  消费方（`ShangshufangPage.tsx:1466,1525`）只读 `view` / `shouldRetry`，不 switch `kind`。
- 无 schema migration、无新表、无 BFF 层新增（`src/app/api/**` 未触碰）。
- 范围夹带：`_EXPLICIT_OVERRIDE_MARKER` 是本包唯一一处与目标无关且无测试的行为扩大
  （代码注释自承“黄金案例之外的真实场景”），恰好也是 H-1。其余 22 个路径均在声明范围内。

## 3. 实跑命令与结果

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `git rev-parse H16^` / `git rev-list --parents -n 1 H16` | 0 | H16^ == B16，单亲 |
| `git diff --name-status B16..H16 \| wc -l` | 0 | 23 |
| `git diff --check B16..H16` | 0 | 无输出 |
| `python3 -m pytest -q backend/tests/test_menxia_veto.py test_chaotang_dispatch_decision_fact.py test_direct_canonical_dispatch.py test_shangshufang_loop_api.py test_core_tenant_lineage_contract.py test_court_review_writer_inventory.py -p no:randomly` | 0 | 67 passed in 10.04s |
| `python3 -m pytest -q backend/tests -p no:randomly` | 0 | 2775 passed, 37 skipped, 4 warnings in 277.72s |
| `pnpm install --frozen-lockfile`（frontend） | 0 | lockfile 未改动 |
| `pnpm exec tsx --test`（3 个 canonical nodetest） | 0 | 18 pass, 0 fail |
| `pnpm exec playwright test e2e/menxia-veto-blocked-state.spec.ts --project=chromium` | 0 | 1 passed (2.6m) |
| `pnpm exec tsc --noEmit` | 0 | 无输出 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | Next 生产构建成功 |
| `python3 backend/scripts/harness_doctor.py` | 0 | backend-harness-doctor: 0 errors, 0 warning(s) |
| `node scripts/harness-doctor.mjs` | 0 | project-harness-doctor: 0 errors, 0 warning(s) |
| `pnpm harness:doctor`（frontend） | 0 | harness-doctor: 0 errors, 0 warning(s) |
| 门下省 override 旁路探针（纯函数，无写入） | 0 | 见 H-1，`封驳` → `准奏` |

本包声称的全部验证命令我均独立复跑并全绿。**所有绿灯都成立，H-1 是这些绿灯没有覆盖到的
区域**——这也正是 M-1 的意义。

## 4. 测试生成的未跟踪产物

`backend/knowledge/docs/ima_archived/doc-d9b967bbc36e.md`

后端全量套件运行期间产生（`backend/tests/test_ima_knowledge.py` 的 `_ARCHIVED_DIR`
monkeypatch 未覆盖全部写入路径，泄漏到真实仓库目录）。**已排除、未纳入本次提交、未清理。**
该泄漏与 P16 无关，属既有问题，按“范围外问题只记录不修复”处理。

## 5. 结论

P16 是一个边界诚实、注释质量罕见地高、文档不吹牛的 Packet：它没有伪造人工 override
能力，没有宣称历史 NO_GO 整体清零，正确地把工部电池 HIGH 留作独立后续阻断项，并且在
REST / SSE / 状态投影 / 军机处真实挂载 UI 四个消费端把“治理阻断”这件事表达得一致而克制。
2.1–2.9 的绝大部分目标都达成了。

但它不能放行：为了修复一个真实的误封驳问题，本包在
`_route_has_scope_evidence` 里引入了一条无条件放行分支，使任何携带显式
`ministers`/`groups` 的客户端请求都能整体跳过门下省范围审查，而这条旁路在 23 个路径里
没有任何测试覆盖。结果是——同一条被本包当作修复证据的越界命令，换一个客户端参数就能重新
走完 outbox 入队和部门执行。本包主张的“两条生产入口都 fail closed”在这条路径上不成立。

修掉 H-1（改为对覆盖前路由取范围证据）并补上 M-1 的回归后，本包的其余部分已经具备放行
质量，预计复审可以很快转 GO。

PACKET_REVIEW_NO_GO
