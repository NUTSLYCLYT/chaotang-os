# P16 独立 Packet 复审报告 v2

| 字段 | 值 |
| --- | --- |
| Packet ID | P16 |
| Change ID | fix-menxia-veto-enforcement-p16-20260719 |
| B16 | e38b31f901256a565e6b7900dd7f88b28c100dd6 |
| H16-v2 | 885b3ab16e5fe15be77843cef9aa16b042e42178 |
| 审查区间 | `git diff B16..H16-v2` |
| 审查员 | 独立 Claude Code（review-only，隔离 worktree） |
| 审查日期 | 2026-07-19 |
| 前序 | `packet_review/review-v1.md`（H16 = 0269869…，`PACKET_REVIEW_NO_GO`，1 HIGH / 1 MEDIUM） |
| 结论 | GO（0 CRITICAL / 0 HIGH / 0 MEDIUM） |

## 0. 区间前置校验

| 校验 | 期望 | 实测 | 结果 |
| --- | --- | --- | --- |
| `git rev-parse H16-v2^` | == B16 | `e38b31f901256a565e6b7900dd7f88b28c100dd6` | PASS |
| `git rev-list --parents -n 1 H16-v2` | 单亲 | `885b3ab e38b31f` | PASS |
| `git diff --name-status B16..H16-v2` 路径数 | 25 | 25 | PASS |
| `git diff --check B16..H16-v2` | 无输出 | 无输出 | PASS |
| `packet_review/review-v1.md` 在区间内且原样 NO_GO | 是 | 362 行，末行 `PACKET_REVIEW_NO_GO`，未被修改或隐藏 | PASS |
| 无 `approval-v1.json` | 无 | 该目录只有 `review-v1.md` | PASS |
| 起始工作树 | 干净 | 干净 | PASS |

`0269869..885b3ab`（v1 头 → v2 头）的净增量仅为：`routing_service.py`、`menxia_veto.py`
两个实现文件的修复，`test_menxia_veto.py` / `test_chaotang_dispatch_decision_fact.py`
新增 3 条用例，四份证据文档更新，外加新增的 `review-v1.md`。候选没有借复审之机夹带
无关改动。

## 1. Findings

### CRITICAL

无。

### HIGH

无。review-v1 的 H-1 已真正关闭，证据见第 2 节。

### MEDIUM

无。review-v1 的 M-1 已由两层新增回归覆盖（纯函数 + 真实 REST 端点），证据见 2.2。

### LOW

#### L-1（v1 遗留，未修）SSE 成功白名单含两个永不出现的状态

`frontend/src/lib/api/adapters/chaotang-canonical-stream.ts:33` 的 `SUCCESS_STATUSES`
仍含 `'reviewed'` 与 `'direct_completed'`；后端 `_WIRE_STATUS` 把 `direct_completed`
映射为 `report_ready`，且从不产出 `reviewed`。两条死分支，方向安全（白名单只会更严），
仅可读性问题。

#### L-2（v1 遗留，未修）`menxia_veto_pending` 不进 `_WIRE_STATUS` 的残留代价未写进文档

`summary.md` / `spec.md` 的“非目标 / 未验证项”仍未列出“其它以 `TaskStatus` 为准的
界面会显示空白状态”。我复核了 `frontend/src/features/throne/lib/plain-language.ts`
的穷尽 switch 无 default（未知值返回 `undefined`，渲染为空、不伪报成功），故仍是 LOW。

#### L-3（v1 遗留，未修）两处封驳 memorial 字面量重复且已漂移

`backend/src/execution/canonical_court_dispatch.py:177-219` 与
`backend/web/routers/shangshufang.py:1101-1152` 仍是两份手写 memorial，compat 版缺
`risk_register` 和 `formatted_memorial`。当前前端两处都容错（`?? []`、可选字段），
无害；但必填字段清单靠人工同步，建议抽 `build_menxia_veto_memorial()`。

#### L-5（新）职责范围证据部门与实际执行部门可以不是同一批

修复后的语义是：门下省用**覆盖前**丞相路由取范围证据，通过后由 override 决定
**最终派给谁**。实测 `/api/chaotang/decree/dispatch` 的 `ministers=['hu_bu'] +
groups=['finlaw']` 展开为 `appliedDepartments = ['户部','刑部']`，而“分析低温电池市场”
的覆盖前路由是 `['兵部','工部']`——准奏的依据来自兵部/工部，实际执行的是户部/刑部。

这是 review-v1 明确推荐的方案（“拿覆盖前的路由做范围取证”）本身携带的性质，也是
兼容入口“ministers 是已校验过的执行约束”这条既有产品规则的直接后果，不构成治理旁路
（越界任务在任何 override 组合下都封驳，已实测）。仅建议在 `spec.md` 的边界节写明
这条语义，避免后续读者误以为“准奏 = 对最终执行部门做过职责校验”。

#### L-6（新）旁路回归本身不断言 override 确实被应用

`test_client_department_override_cannot_bypass_menxia_veto` 断言的是
`status == menxia_veto_pending` + 四类副作用为零。如果哪天 `ministers` 在上游被静默
丢弃、根本没进 `department_override`，这条测试仍会绿——它锁住的是“不被绕过”，不是
“override 真的经过了这条链路”。同文件的 `test_dispatch_commits_decision_fact_before_execution`
用同一份 `_BODY` 走合法命令并断言 `edict_recorded`，间接说明该请求形状可用，但同样
没有断言 `appliedDepartments`。我已用只读探针独立确认链路真实存在
（`build_compat_dispatch_constraints(... ministers=['hu_bu'], groups=['finlaw'] ...)`
→ `appliedDepartments = ['户部','刑部']` → `canonical_court_dispatch.py:158`
`department_override=routing_departments`）。建议后续补一条 `appliedDepartments`
断言，成本一行。

> review-v1 的 L-4（`spec.md` 引用不存在的 `apply_menxia_veto()`）本轮已修：新文案
> 改为“丞相生成未覆盖的 canonical route → 门下省以该原始路由审查职责范围 → 通过后
> 才应用客户端 `department_override` 执行约束”，与实现一致。

## 2. review-v1 阻断项关闭验证

### 2.1 H-1：`_EXPLICIT_OVERRIDE_MARKER` 范围例外是否彻底删除

**已关闭。**

- 常量与提前 `return True` 分支在 `backend/src/menxia_veto.py` 中已完全不存在。
  全仓 grep `EXPLICIT_OVERRIDE` / `兼容入口明确指定参审部门` 只剩
  `routing_service.py:115` 一处——那是 `_apply_department_override` 写进 route reason
  的展示文本，`menxia_veto.py` 不再读取任何 reason 短语来判 override。
- `ChancellorRoutingService.decide` 的顺序已改为：
  `chancellor_decide_route(edict)` → `review_route(route, text)`（覆盖前）→
  `_apply_department_override`（覆盖后）→ 封驳时打 `门下省封驳` risk flag
  （`routing_service.py:149-167`）。override 只改变最终参与部门，不再参与
  职责内/外结论。
- 剩余的 marker/字段旁路面盘点：`menxia_veto.py` 里只剩两条例外，都不由客户端约束驱动。
  - `_LIGHTWEIGHT_TASK_MARKER`：来源是 `chancellor_decide_route` 对**任务文本**的
    确定性分类（`shangshufang_loop.py:709`），不是请求体字段；且已被黄金案例参数化
    测试（`simple_02`/`simple_03` 断言准奏）间接锁住。
  - `any(dept in task_text for dept in selected)`：`selected` 现在恒为覆盖前部门，
    比对对象是任务原文本身，客户端无法用 `ministers` 注入。
- `review_route` 全仓唯一调用点就是 `routing_service.py:155`，没有第二条入口可绕。

### 2.2 M-1：override × 门下省交互的回归覆盖

**已关闭，两层。**

- 纯函数负例 `backend/tests/test_menxia_veto.py::test_explicit_department_override_is_not_scope_evidence`：
  直接喂入带 `兼容入口明确指定参审部门：hu_bu。` reason 的 route，断言仍 `封驳` 且
  veto reason 为“不属于任何部门真实职责范围”。这条正是对旧 marker 的定向锁死。
- 端到端负例 `backend/tests/test_chaotang_dispatch_decision_fact.py::test_client_department_override_cannot_bypass_menxia_veto`：
  走真实 `/api/chaotang/decree/dispatch`（`_BODY` 带 `ministers=['hu_bu']` /
  `groups=['finlaw']`，`rawCommand` 换成世界杯），断言
  `data["status"] == "menxia_veto_pending"`、`triggered == []`、
  `OutboxEvent` / `EmperorDecision` / `DecreeExecutionEvent` 三类计数均为 0。
  这正是 review-v1 建议的那条断言，且比建议更严（多锁 EmperorDecision）。
- 正例保留：同文件首测 `test_dispatch_commits_decision_fact_before_execution` 用同一
  `_BODY`（`rawCommand = 分析低温电池市场并形成决策建议`）断言 `edict_recorded` +
  `dispatch.queued` 事件存在。即“修复没有用全面拒绝掩盖旁路”这一点有独立正例把守。

### 2.3 修复前 RED 证据是否可信

**可信，且我独立复现，未采信 Codex CI 数字。**

我没有改动任何候选文件，而是在只读进程内重建 v1 头的实现语义（把 marker 提前返回包
在 `_route_has_scope_evidence` 外层），对同一条世界杯请求走
`chancellor_decide_route → _apply_department_override → review_route`：

```
v1-impl + post-override route -> 准奏
H16-v2 impl + pre-override route -> 封驳
```

与 review-v1 H-1 的复现完全一致，也与 `ci_summary.md` 记录的“v2 两条 override 旁路
回归（修复前）2 failed”自洽。GREEN 侧在 H16-v2 上实跑：聚焦 69 passed、backend 全量
2777 passed / 37 skipped。

### 2.4 生产路径真实行为（世界杯 + hu_bu / 低温电池 + hu_bu）

| 场景 | 期望 | 实测来源 | 结果 |
| --- | --- | --- | --- |
| `我要去美国看世界杯决赛` + `ministers=['hu_bu']`（真实 REST） | `menxia_veto_pending`，EmperorDecision / DecreeExecutionEvent / OutboxEvent / dispatch trigger 全零 | `test_client_department_override_cannot_bypass_menxia_veto`（69 passed 内） | PASS |
| `分析低温电池市场并形成决策建议` + 同一 override（真实 REST） | `edict_recorded`，正常入队 | `test_dispatch_commits_decision_fact_before_execution`（69 passed 内） | PASS |
| 覆盖前 / 覆盖后路由的 verdict 差异（纯函数探针） | 覆盖前才是正确判据 | 见下 | PASS |

```
'我要去美国看世界杯决赛'
  pre-override  ['户部','工部'] -> 封驳
  post-override ['hu_bu']       -> 封驳
'分析低温电池市场并形成决策建议'
  pre-override  ['兵部','工部'] -> 准奏
  post-override ['hu_bu']       -> 封驳   ← 若用覆盖后路由取证，合法任务会被误封驳
```

第二行正是这次修复必须“审覆盖前”而不是“审覆盖前后并集之外的任何写法”的量化理由：
拿覆盖后路由取证会引入新的假阳性，本包选对了方向。

## 3. 排序改动的副作用复查（新引入风险）

- **新增假阳性？** 唯一可能的新封驳来源是 `review_route` 的“路由没有任何候选部门”
  分支——现在 `departments` 取自覆盖前路由。我核到
  `shangshufang_loop.infer_departments`（`:196-197`）有兜底
  `if not departments: departments = ["户部","工部"]`，`chancellor_decide_route` 的
  direct 分支也有 `"丞相"` 兜底，覆盖前 `departments` 恒非空。因此不存在“客户端传了
  ministers、丞相自己没推出部门 → 新增封驳”的路径。backend 全量 2777 passed 亦无回归。
- **新增假阴性？** 覆盖前路由的部门集是丞相从原文推导的，只会比 override 后的集合
  更贴近原文；越界文本在任何 override 组合下都拿不到关键词证据（已实测）。
- **route decision 持久化一致性。** 封驳时 `route` 已是覆盖后的形状，
  `participants` / `primary_department` / `complexity_score` 都基于覆盖后部门写入
  `ChancellorRouteDecision`，与“最终参与部门”语义一致；`reason_summary` 被封驳文案
  整体替换（覆盖约束句被丢弃），但该决策不会派单，无下游消费歧义。
- **participants/scoring 与最终 override 的一致性。** `_participants_for(route)` 在
  override 之后调用，`scoring` 来自 `route_department_task(confirmed_edict_text)`
  （始终基于原文，与 override 无关，B16 起即如此，本包未改）。
- **幂等 / 事务 / 并发。** `decide()` 的幂等短路在最前（`:143-146`），排序改动在其后，
  未影响命中路径；两条封驳分支仍在单 session 内改 `task.status` + `db.add(CourtReview)`
  后 `db.commit()`，compat 路径的 `executing` 中间态不落盘；`shangshufang_confirm_edict`
  的 `task.user_id` 权限检查仍在封驳分支之前。
- **错误路径。** 封驳分支的 `return` 位于 `EmperorDecision` 写入、`record_timeline_event`
  和 outbox 入队之前，逐行核对无遗漏；`routing_plan_for` / `draft_edict` /
  `format_memorial_sections` 均为纯函数，未触碰 db、未调用部门 engine，
  `direct_receipt_for` / `review_memorial_for` 被有意避开。

## 4. review-v1 其余通过项的重新审查

以下各项在 `0269869..885b3ab` 中均未被改动，我按 B16..H16-v2 全量 diff 重新逐条核对，
结论与 review-v1 一致，无回归：

| 项 | 结论 | 本轮复核要点 |
| --- | --- | --- |
| 两条生产入口副作用前 fail closed | PASS | `canonical_court_dispatch.py:160` 与 `shangshufang.py:1085` 的分支位置、`return` 早于所有写入；且本轮 H-1 关闭后这两条分支在 override 场景下**真正生效** |
| 专属 risk flag（不误用 `human_confirmation_required`） | PASS | 两处都是 `"门下省封驳" in route_decision.risk_flags` |
| tenant/writer 8→10 | PASS | `court_review_writer_inventory.py` 精确到 (文件,函数)；`test_court_review_writer_inventory.py` AST 全量扫描 + `total() == 10` 双断言；`test_core_tenant_lineage_contract.py` `CourtReview: 10` |
| confirm 重试幂等 | PASS | `menxia_veto_pending` 进 `_TERMINAL_CONFIRMED_STATUSES`；`test_confirm_edict_retry_on_vetoed_task_is_idempotent` 断言两次 `review_id` 相同 |
| REST memorial 必填字段 | PASS | `departments: []`、`decision_options: []`、`evidence_gaps`、`next_best_action`、`source_label`、`quality_gate.passed=False` 齐全并被断言逐个锁死 |
| SSE success whitelist / blocked / error | PASS | 兜底由“非 failed 即 done”反转为白名单；`menxia_veto_pending` 走专属 `blocked`；`BattleStream.tsx` 金色圆点 + “需人工确认” 与红色“异常终止”完全分离 |
| 当前实际挂载 UI | PASS | `JunjichuCenterWorkSurface` 由 `junjichu/page.tsx` 实际渲染；`aria-label="门下省封驳状态"` 面板被 Playwright 正面断言；上书房侧 `'vetoed'` 独立 kind，不复用“候选会审”措辞、不渲染“部门冲突”行 |
| 人工 override 未实现的诚实边界 | PASS | `decision_options: []`；`summary.md` / `spec.md` / `ci_summary.md` 三处均写明“当前没有可用的 Menxia override 执行器，不伪造按钮” |

**工部电池 HIGH 的处理仍然正确。** `spec.md` 的“范围外问题”行原样保留
“工部电池类 P0 关键词缺口仍持历史 HIGH …… 不得随本包宣称整体 NO_GO 已清零”。
本报告同样不宣称历史 Opus NO_GO 已整体清零：工部电池 HIGH 是独立后续 blocker。
同时它也不构成否定本包的理由——P16 的范围是 Menxia 封驳的执行与诚实呈现，边界写得
清楚，不该用一个明确声明在范围外的缺口去否决一个边界诚实的 Packet。

## 5. 实跑命令与结果（本轮独立执行，未采信 Codex CI 数字）

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `git rev-parse H16-v2^` / `git rev-list --parents -n 1 H16-v2` | 0 | `e38b31f…`，单亲 |
| `git diff --name-status B16..H16-v2 \| wc -l` | 0 | 25 |
| `git diff --check B16..H16-v2` | 0 | 无输出 |
| `python3 -m pytest -q backend/tests/test_menxia_veto.py test_chaotang_dispatch_decision_fact.py test_direct_canonical_dispatch.py test_shangshufang_loop_api.py test_core_tenant_lineage_contract.py test_court_review_writer_inventory.py -p no:randomly` | 0 | **69 passed in 8.96s** |
| `python3 -m pytest -q backend/tests -p no:randomly` | 0 | **2777 passed, 37 skipped, 4 warnings in 265.79s** |
| `pnpm install --frozen-lockfile`（frontend） | 0 | 完成，`pnpm-lock.yaml` 未改动 |
| `pnpm exec tsx --test`（3 个 canonical nodetest） | 0 | **18 pass, 0 fail** |
| `pnpm exec playwright test e2e/menxia-veto-blocked-state.spec.ts --project=chromium` | 0 | **1 passed (2.8m)** |
| `pnpm exec tsc --noEmit` | 0 | 无输出 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | Next 生产构建成功 |
| `pnpm harness:doctor`（frontend） | 0 | harness-doctor: 0 errors, 0 warning(s) |
| `python3 scripts/harness_doctor.py`（backend） | 0 | backend-harness-doctor: 0 errors, 0 warning(s) |
| `node scripts/harness-doctor.mjs`（root） | 0 | project-harness-doctor: 0 errors, 0 warning(s) |
| 覆盖前/覆盖后 verdict 探针（纯函数，无写入） | 0 | 见 2.4 表下代码块 |
| v1 实现语义重建探针（只读进程内，无文件改动） | 0 | 见 2.3，`准奏` → `封驳` |
| `build_compat_dispatch_constraints` 探针（纯函数） | 0 | `appliedDepartments = ['户部','刑部']` |

## 6. 测试生成的未跟踪产物

`backend/knowledge/docs/ima_archived/`（本轮全量套件运行期间生成）

由 `backend/tests/test_ima_knowledge.py` 的 `_ARCHIVED_DIR` monkeypatch 未覆盖全部
写入路径导致，泄漏到真实仓库目录。**已排除、未纳入本次提交、未清理。** 与 P16 无关，
属既有问题，按“范围外问题只记录不修复”处理（review-v1 已记录过同一现象）。

## 7. 结论

review-v1 的两条阻断项都真正关闭了，而且关闭方式是 review-v1 推荐的那一条——不是把
override 场景整体拒绝掉换取绿灯：

- H-1：`_EXPLICIT_OVERRIDE_MARKER` 从代码里彻底消失，`decide()` 改为先用覆盖前的
  丞相路由判职责范围、再应用执行约束。越界任务在任何 `ministers`/`groups` 组合下
  都封驳；合法的“分析低温电池市场 + override”仍然 `edict_recorded` 正常派单。我用
  只读探针量化确认了“审覆盖后路由”会把这条合法任务误封驳——修复选对了方向。
- M-1：纯函数负例 + 真实 `/api/chaotang/decree/dispatch` 端到端负例（附四类副作用
  计数归零）+ 保留的合法正例，三条一起把这个交互从“无人观测”变成“被咬住”。

排序改动没有引入新的假阳性/假阴性（覆盖前 `departments` 恒非空，已核到兜底逻辑），
持久化、幂等、事务、权限与错误路径均未受影响，backend 全量 2777 passed 无回归。
review-v1 判为通过的其余八项在本轮 diff 中未被触碰，重新核对结论一致；L-4 已修，
L-1/L-2/L-3 仍开放但都是可读性/文档级别，另有两条新记录的 LOW（L-5 语义说明、
L-6 断言强度），均不构成阻断。

工部电池 HIGH 仍是独立后续 blocker，本报告不宣称历史 Opus NO_GO 已整体清零；同时
它明确在 P16 声明范围之外，不用于否定这个边界诚实的 Menxia-only Packet。

放行。

PACKET_REVIEW_GO
