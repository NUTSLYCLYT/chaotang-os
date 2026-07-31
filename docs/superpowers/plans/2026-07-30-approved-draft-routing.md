# 拟旨批准路由绑定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户确认的拟旨部门及必选承办司成为正式下旨的一次性授权边界，保证财务报表旨意稳定执行为“户部 → 会计司”。

**Architecture:** 后端从已验证的结构化草案生成不可变 `ApprovedRouteSnapshot`，把它纳入指纹并登记到 owner 隔离的一次性授权。正式下旨原子消费该快照，在任何业务副作用前验证并直接采用批准部门顺序；各部仍按 ADR 0028 选司，但必须包含批准的必选司。浏览器只展示路由，不提交或重建可信路由字段。

**Tech Stack:** Python 3.11、Pydantic、LangGraph、FastAPI、pytest、TypeScript、React、Next.js、Node test runner。

## Global Constraints

- 财务场景固定批准 `department == "户部"`、`required_bureaus == ("会计司",)`。
- 正式下旨不得新增、删除、替换或重排批准部门。
- 部内实际选司必须包含全部必选司，可以按模型顺序保留同一部内额外真实司。
- 浏览器不得向下旨请求增加部门或司字段；可信快照只能由后端从已验证草案生成。
- 快照验证必须早于 report session、军机处开案、部级调用、司级调用、Excel 产物和史馆归档。
- 必选司连续两次未被部内选司包含时，必须在任何司级调用和业务成果前失败关闭。
- 不修改 ADR 0028、六部/39司名录、2000 字限制、Excel 工作簿契约、旧授权迁移或自动重放语义。
- 保留所有既有 dirty 改动；不得 commit、push、PR 或部署。

---

### Task 1: 拟旨部司模型与规范路由快照

**Files:**
- Create: `backend/app/agents/chancellor_draft/routing.py`
- Modify: `backend/app/agents/chancellor_draft/models.py`
- Modify: `backend/app/agents/chancellor_draft/graph.py`
- Test: `backend/tests/test_chancellor_draft_graph.py`

**Interfaces:**
- Produces: frozen `ApprovedDepartmentRoute(department: str, required_bureaus: tuple[str, ...])`。
- Produces: frozen `ApprovedRouteSnapshot(departments: tuple[ApprovedDepartmentRoute, ...])`。
- Produces: `build_route_snapshot(draft: DraftEdict) -> ApprovedRouteSnapshot` 与 `validate_route_snapshot(snapshot) -> ApprovedRouteSnapshot`。

- [ ] **Step 1: 写失败测试**

在 `test_chancellor_draft_graph.py` 中让 ready fixture 的部门项显式包含：

```python
{
    "department": "户部",
    "bureaus": ["会计司"],
    "role": "主审",
    "reason": "负责财务事项",
    "responsibility": "生成并校验管理层财务报表",
    "expected_output": "可下载 Excel",
}
```

新增真实财务旨意测试，断言 ready 草案为 `户部`/`会计司`；用表驱动覆盖 `户部会计司`
作为 department、未知部、空 bureaus、重复司、跨部 `营缮司`、重复部门，首次无效后纠正
成功、连续无效失败关闭。断言系统提示和 typed skeleton 明确六部与本部真实司层级。

新增 snapshot 测试，断言部门及司顺序保留且不可变；改变部门顺序或必选司会改变 fingerprint。

- [ ] **Step 2: 运行 RED**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_chancellor_draft_graph.py -q
```

Expected: 因 `bureaus` 字段、名录校验、snapshot 类型和 fingerprint 绑定尚不存在而失败。

- [ ] **Step 3: 实现领域模型和快照**

`routing.py` 使用 frozen Pydantic model 或 frozen dataclass，并以 `MINISTRIES` 与
`bureau_profiles_for(department)` 校验：

```python
class ApprovedDepartmentRoute(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    department: str
    required_bureaus: tuple[str, ...]


class ApprovedRouteSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    departments: tuple[ApprovedDepartmentRoute, ...]
```

`DepartmentRecommendation` 增加 `bureaus: list[str]`，验证非空、无重复、全属于该部；
`DraftEdict` 验证部门无重复。`build_route_snapshot` 只接受已验证 `DraftEdict`，把
`bureaus` 映射为 `required_bureaus`。

更新 graph typed skeleton、安全 validation path、结构纠正与 system prompt。财务任务提示必须
要求 `department: "户部"` 与 `bureaus: ["会计司"]`，不得输出 `户部会计司`。

计算 fingerprint 时显式把 `route_snapshot.model_dump(mode="json")` 加入 canonical payload，
而不是仅依赖 draft 内的重复字段。

- [ ] **Step 4: 运行 GREEN 与静态检查**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_chancellor_draft_graph.py -q
backend\.venv\Scripts\python.exe -m ruff check backend/app/agents/chancellor_draft backend/tests/test_chancellor_draft_graph.py
```

Expected: 全部 PASS；无 lint 错误。

### Task 2: 一次性授权原子返回可信路由

**Files:**
- Modify: `backend/app/agents/chancellor_draft/authority.py`
- Modify: `backend/app/api/chancellor_drafts.py`
- Test: `backend/tests/test_chancellor_draft_authority.py`
- Test: `backend/tests/test_chancellor_drafts_api.py`

**Interfaces:**
- Consumes: Task 1 的 `ApprovedRouteSnapshot` 和 `build_route_snapshot`。
- Produces: `register(..., route_snapshot: ApprovedRouteSnapshot) -> None`。
- Produces: `consume(...) -> ApprovedRouteSnapshot | None`，匹配时原子删除并返回快照。

- [ ] **Step 1: 写授权失败测试**

更新 authority 测试为：

```python
snapshot = ApprovedRouteSnapshot(
    departments=(
        ApprovedDepartmentRoute(
            department="户部",
            required_bureaus=("会计司",),
        ),
    )
)
registry.register(
    owner_user_id="user-1",
    version=2,
    fingerprint="a" * 64,
    decree_text="生成财务报表",
    route_snapshot=snapshot,
)
assert registry.consume(
    owner_user_id="user-1",
    version=2,
    fingerprint="a" * 64,
    decree_text="生成财务报表",
) == snapshot
assert registry.consume(
    owner_user_id="user-1",
    version=2,
    fingerprint="a" * 64,
    decree_text="生成财务报表",
) is None
```

分别覆盖 owner/version/fingerprint/text 不匹配时返回 `None` 且不删除正确授权。API 测试断言
ready 草案由服务端生成并注册户部/会计司快照，non-ready 仍 revoke。

- [ ] **Step 2: 运行 RED**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_chancellor_draft_authority.py backend/tests/test_chancellor_drafts_api.py -q
```

Expected: 旧 `consume -> bool` 和旧 register 签名导致失败。

- [ ] **Step 3: 实现原子快照授权**

把 `_Authority` 扩展为包含 frozen snapshot。`consume` 必须在同一锁内比较、删除并返回快照，
不得先 bool consume 再二次查询。拟旨 API 只从 `validated.draft` 调用
`build_route_snapshot`；客户端 response 中的其他字段不能替代服务端派生。

- [ ] **Step 4: 运行 GREEN**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_chancellor_draft_authority.py backend/tests/test_chancellor_drafts_api.py -q
backend\.venv\Scripts\python.exe -m ruff check backend/app/agents/chancellor_draft/authority.py backend/app/api/chancellor_drafts.py backend/tests/test_chancellor_draft_authority.py backend/tests/test_chancellor_drafts_api.py
```

Expected: 全部 PASS。

### Task 3: 正式丞相图锁定批准部门

**Files:**
- Modify: `backend/app/agents/chancellor/graph.py`
- Modify: `backend/app/agents/junjichu/agent.py`
- Test: `backend/tests/test_chancellor_graph.py`
- Test: `backend/tests/test_junjichu_agent.py`
- Test: `backend/tests/test_junjichu_case_lifecycle.py`

**Interfaces:**
- Consumes: 必填 graph state `approved_route: ApprovedRouteSnapshot`。
- Produces: state `required_bureaus_by_department: dict[str, tuple[str, ...]]`。
- Extends: `run_junjichu_council(..., *, required_bureaus_by_department: Mapping[str, Sequence[str]], ...)`。

- [ ] **Step 1: 写锁定部门与零副作用失败测试**

在 chancellor graph 测试中使用批准户部/会计司快照，令路由模型建议吏部或工部，断言路由模型
不参与部门选择且结果只有户部。多部门快照断言部门顺序与军机处调用顺序完全一致。

构造未知部、跨部司、重复部门快照，断言在 evidence session、ministry 调用和
`lifecycle_observer.open_case` 前失败。单部门不创建军机处案件。

军机处测试断言 `required_bureaus_by_department` 按批准部门顺序逐项传给 ministry。

- [ ] **Step 2: 运行 RED**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_chancellor_graph.py backend/tests/test_junjichu_agent.py backend/tests/test_junjichu_case_lifecycle.py -q
```

Expected: graph 尚未接受批准快照，仍重新推断部门。

- [ ] **Step 3: 实现批准部门路由**

`ChancellorGraphState` 墅加必填 `approved_route`。`_decide_route` 第一条业务动作必须调用
`validate_route_snapshot`，然后直接派生：

```python
departments = [item.department for item in snapshot.departments]
route_type = "single" if len(departments) == 1 else "multi"
required_bureaus_by_department = {
    item.department: item.required_bureaus
    for item in snapshot.departments
}
```

不得让 `_deterministic_route`、route model 或 market normalization 改写批准部门。使用固定、
可审计的批准路由说明。只有快照校验完成后才能创建 evidence session 或 multi case。

single 分支把对应 required bureaus 传给 ministry；multi 分支把整张 map 传给军机处，军机处
按部门顺序传递。保留现有 positional 参数，新增参数使用 keyword-only。

- [ ] **Step 4: 运行 GREEN**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_chancellor_graph.py backend/tests/test_junjichu_agent.py backend/tests/test_junjichu_case_lifecycle.py -q
backend\.venv\Scripts\python.exe -m ruff check backend/app/agents/chancellor backend/app/agents/junjichu backend/tests/test_chancellor_graph.py backend/tests/test_junjichu_agent.py backend/tests/test_junjichu_case_lifecycle.py
```

Expected: 全部 PASS；批准部门不可漂移。

### Task 4: 部内必选司纠正与失败关闭

**Files:**
- Modify: `backend/app/agents/ministries/agent.py`
- Modify: `backend/app/agents/ministries/prompts.py`
- Test: `backend/tests/test_ministries_agent.py`
- Test: `backend/tests/test_accounting_report_cross_layer.py`

**Interfaces:**
- Produces: `invoke_ministry_agent(..., *, required_bureaus: Sequence[str], ...)`。
- Consumes: Task 3 从批准快照传入的本部必选司。

- [ ] **Step 1: 写必选司失败测试**

覆盖：

- 首次返回 `["审计司"]`、纠正后返回 `["会计司"]`，成功且仅在纠正后调用 bureau。
- 返回 `["会计司", "审计司"]`，保留顺序并允许额外真实司。
- 连续两次遗漏会计司，抛 `MinistryAgentInvocationError`，bureau、synthesis 和 report artifact
  均为零调用。
- 户部 required `营缮司`、重复司、空 required 被入口拒绝。
- 真实财务旨意最终只调用 `("户部", "会计司")` 并发布 Excel。

- [ ] **Step 2: 运行 RED**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_ministries_agent.py backend/tests/test_accounting_report_cross_layer.py -q
```

Expected: 旧 ministry 接口不接受 required bureaus，遗漏时会 fallback 或调用错误司。

- [ ] **Step 3: 实现一次安全纠正**

入口先验证 required 非空、无重复、均属于本部。解析第一轮合法选择后检查
`set(required_bureaus).issubset(selected_bureaus)`。缺失时只追加固定纠正提示，提示包含允许名录、
必选司和 JSON schema，不包含第一次原始响应；第二轮仍无效或缺失时设置
`failure_stage = "bureau"` 并抛出。

所有 required 校验必须位于 `capability_profiles_for`、`invoke_bureau_agent`、部级 synthesis 和
report generation 之前。受约束执行不得使用可能遗漏必选司的首司 fallback，也不得静默把必选
司注入模型结果。

- [ ] **Step 4: 运行 GREEN**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_ministries_agent.py backend/tests/test_accounting_report_cross_layer.py -q
backend\.venv\Scripts\python.exe -m ruff check backend/app/agents/ministries backend/tests/test_ministries_agent.py backend/tests/test_accounting_report_cross_layer.py
```

Expected: 全部 PASS；连续遗漏时没有司级或报表副作用。

### Task 5: 下旨 API 消费快照与跨层纵深校验

**Files:**
- Modify: `backend/app/api/decrees.py`
- Test: `backend/tests/test_decrees_api.py`
- Test: `backend/tests/test_decree_draft_gate.py`
- Test: `backend/tests/test_accounting_report_cross_layer.py`
- Test: `backend/tests/test_shiguan_archive_decree.py`

**Interfaces:**
- Consumes: Task 2 `consume() -> ApprovedRouteSnapshot | None`。
- Invokes: graph state `{"decree_text": str, "approved_route": ApprovedRouteSnapshot}`。
- Produces: response validation against approved departments and required bureaus。

- [ ] **Step 1: 写 API 副作用边界失败测试**

断言请求模型仍只接受 `decree_text`、`draft_version`、`draft_fingerprint`；注入 route 字段返回
422。授权失败或 snapshot 当前名录校验失败时，report session、graph、军机处 case、archive
均零调用。

成功时断言 graph 收到同一个可信 snapshot。让 graph 伪造不同 departments 或缺少会计司意见，
response 构建必须失败且不得归档。财务真实场景断言响应 departments 为 `["户部"]`，路径包含
`户部·会计司`，Excel artifact 可下载。

- [ ] **Step 2: 运行 RED**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_decrees_api.py backend/tests/test_decree_draft_gate.py backend/tests/test_accounting_report_cross_layer.py backend/tests/test_shiguan_archive_decree.py -q
```

Expected: API 仍把 consume 当 bool、过早创建 report session，graph 输入无 snapshot。

- [ ] **Step 3: 实现 API 门禁与最终一致性校验**

先 consume 并 `validate_route_snapshot`，再创建 report session、observer 和 graph。`None` 或无效
快照使用稳定脱敏的旧草案/授权错误映射。授权消费后执行失败不恢复。

`_build_response_from_graph_result` 接受 approved snapshot，验证实际 departments 完全等于批准
顺序，且每个 ministry opinion 的 bureau opinions 包含对应 required bureaus，再允许归档。

把批准快照作为内部 graph result 的审计字段；史馆现有 `participating_departments` 保存批准且
实际一致的部级顺序。本次不新增数据库列保存司级快照，以 fingerprint、拟旨版本和执行结果中
的司级意见形成可验证审计链，避免扩大史馆 schema。

- [ ] **Step 4: 运行 GREEN**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_decrees_api.py backend/tests/test_decree_draft_gate.py backend/tests/test_accounting_report_cross_layer.py backend/tests/test_shiguan_archive_decree.py -q
backend\.venv\Scripts\python.exe -m ruff check backend/app/api/decrees.py backend/tests/test_decrees_api.py backend/tests/test_decree_draft_gate.py backend/tests/test_accounting_report_cross_layer.py backend/tests/test_shiguan_archive_decree.py
```

Expected: 全部 PASS。

### Task 6: 前端分层展示部与必选司

**Files:**
- Modify: `frontend/src/app/study/chancellorDraft.ts`
- Modify: `frontend/src/app/study/chancellorDraft.test.ts`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`

**Interfaces:**
- Adds: `ChancellorDraftDepartment.bureaus: string[]`。
- Displays: 参与部门、必选承办司、角色、参与原因、负责事项和预计产出。

- [ ] **Step 1: 写前端失败测试**

所有完整 draft fixture 加 `bureaus: ["会计司"]`。可读草案测试断言 JSX 分别包含：

```text
参与部门
必选承办司
角色
参与原因
负责事项
预计产出
```

并断言使用 `item.bureaus.join("、")`，不再用 `{item.department} · {item.role}` 混排。保留
既有无 `<pre>`、无 `JSON.stringify`、唯一按钮、pending/error 和成功清草案守卫。

- [ ] **Step 2: 运行 RED**

```powershell
Set-Location frontend
node --test src/app/study/chancellorDraft.test.ts src/features/study-visual/DevStudyWorkspace.test.ts
npm run typecheck
```

Expected: 缺少 bureaus 类型及展示导致测试或 typecheck 失败。

- [ ] **Step 3: 实现最小类型与展示**

给 TypeScript 接口增加必填 `bureaus: string[]`。在同一 `<li>` 中分行渲染六项字段，多司按
批准顺序 `join("、")`，不得排序、去重、猜测或把路由字段加入下旨 request。

- [ ] **Step 4: 运行 GREEN**

```powershell
node --test src/app/study/chancellorDraft.test.ts src/features/study-visual/DevStudyWorkspace.test.ts
npm run typecheck
```

Expected: 全部 PASS。

### Task 7: 故障记录、全量验证与最终审查

**Files:**
- Create: `docs/failures/2026-07-30-draft-execution-route-drift.md`

**Interfaces:**
- Produces: 五标题故障记忆与完整验证证据。

- [ ] **Step 1: 写故障记录**

必须包含：

```markdown
## Summary
## Root Cause
## Prevention
## Detection
## Evidence
```

记录“拟旨部门未进入授权、正式流程重新推断、部司层级混写”的根因；预防措施为 typed
department/bureaus、fingerprint+authority snapshot、正式 graph 锁定部门、ministry 必选司门禁；
Detection 指向真实财务跨层测试和副作用为零的失败测试。

- [ ] **Step 2: 运行后端全量验证**

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests -q
backend\.venv\Scripts\python.exe -m ruff check backend
```

Expected: 全部 PASS，只有已知依赖弃用警告可记录。

- [ ] **Step 3: 运行前端全量验证**

```powershell
Set-Location frontend
npm test
npm run typecheck
npm run lint
npm run build
Set-Location ..
```

Expected: 全部退出码 0。

- [ ] **Step 4: 运行治理验证**

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: 全部退出码 0，ADR 0028 完整性不变。

- [ ] **Step 5: 最终范围审查**

逐项核对设计：

- 财务场景为户部/会计司；
- 部门不可漂移；
- 必选司遗漏连续两次时无司级、Excel、案件或归档副作用；
- 浏览器未提交 route；
- 2000 字、名录、ADR、Excel 和旧授权语义未改；
- 没有覆盖工作区其他 dirty 改动；
- 没有 Git 写操作。
