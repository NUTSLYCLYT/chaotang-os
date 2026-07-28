# 司级证据协议有界自愈与局部降级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在司级模型内容纠正耗尽后安全丢弃违规响应并返回确定性 fallback，使其余下旨流程继续，同时保持真实模型传输失败仍整旨失败。

**Architecture:** 保留 `invoke_bureau_with_evidence` 作为唯一证据协议状态机，在调查后事实纠正的最终解析边界捕获明确列举的内容合规错误。捕获后记录 `model_synthesis_degraded:<node_id>` 并调用既有 `fallback(reason)`；模型调用本身的 `model_unavailable`、身份错误和未知错误不进入降级分支。

**Tech Stack:** Python 3.14、Pydantic、LangGraph、pytest、Ruff。

## Global Constraints

- 遵守 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。
- 不接受、包装、摘录或回显被拒模型响应。
- 不放宽 READY、事实声明、证据采用或证据绑定校验。
- 不修改 HTTP、前端、史馆或锦衣卫权限契约。
- 信封纠正和事实纠正各最多一次；现有调查、抽取和期限预算不变。
- 未经单独授权不提交、推送或追加真实付费模型调用。

---

### Task 1: 纠正耗尽后的司级局部降级

**Files:**
- Modify: `backend/tests/test_agent_evidence_protocol.py`
- Modify: `backend/app/agents/evidence_protocol.py`

**Interfaces:**
- Consumes: `AgentEvidenceSession.record_degradation(node_id: str) -> None`、既有 `fallback: Callable[[str], T]`。
- Produces: 调查后事实纠正若仍触发允许降级的 `EvidenceProtocolError`，返回 `_fallback(fallback, "model_synthesis_invalid")`。

- [ ] **Step 1: 写完整真实失败序列的 RED 测试**

在 `test_bare_opinion_then_investigation_can_correct_resumed_factual_dependency` 相邻位置新增：

```python
def test_resumed_correction_invalid_envelope_degrades_without_adopting_output() -> None:
    coordinator = Coordinator()
    session = AgentEvidenceSession(coordinator=coordinator)
    node = bureau_node_id("户部", "预算司")
    rejected_ready = _ready("The target market size is 300.")
    rejected_correction = '{"opinion":"SECRET-REJECTED-FACT 300"}'
    responses = iter(
        (
            '{"opinion":"Recommend hiring two quantitative developers."}',
            _gap(node),
            rejected_ready,
            rejected_correction,
        )
    )

    result = _invoke(session, lambda _messages: next(responses), node_id=node)

    assert result == {"opinion": "证据受限：model_synthesis_invalid"}
    snapshot = session.snapshot()
    assert snapshot.degradation_reasons == (f"model_synthesis_degraded:{node}",)
    assert snapshot.adopted_evidence_ids == ()
    assert "SECRET-REJECTED-FACT" not in result["opinion"]
```

- [ ] **Step 2: 运行 RED**

Run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_agent_evidence_protocol.py::test_resumed_correction_invalid_envelope_degrades_without_adopting_output -q
```

Expected: FAIL with `EvidenceProtocolError("uncited_fact_dependency")`.

- [ ] **Step 3: 写最小 GREEN 实现**

在调查后 `_resumed_dependency_correction` 的 `_parse_ready` 外增加明确白名单：

```python
_DEGRADABLE_SYNTHESIS_ERRORS = frozenset(
    {
        "uncited_fact_dependency",
        "unsupported_factual_dependency",
        "response_invalid",
        "adoption_invalid",
        "evidence_binding_invalid",
    }
)
```

并把纠正结果解析改为：

```python
try:
    ready = _parse_ready(
        corrected,
        legacy_parser,
        session,
        node_id,
        original_messages,
    )
except EvidenceProtocolError as corrected_exc:
    if str(corrected_exc) not in _DEGRADABLE_SYNTHESIS_ERRORS:
        raise
    session.record_degradation(node_id)
    return _fallback(fallback, "model_synthesis_invalid")
```

不得捕获 `_call_and_parse`，因此 DeepSeek/SDK 异常继续以 `model_unavailable` 抛出。

- [ ] **Step 4: 运行 GREEN 与证据协议回归**

Run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_agent_evidence_protocol.py -q
```

Expected: 全部 PASS。

---

### Task 2: 失败关闭和上层流程回归

**Files:**
- Modify: `backend/tests/test_agent_evidence_protocol.py`
- Test: `backend/tests/test_bureaus_agent.py`
- Test: `backend/tests/test_ministries_agent.py`
- Test: `backend/tests/test_junjichu_agent.py`
- Test: `backend/tests/test_chancellor_graph.py`
- Test: `backend/tests/test_decrees_api.py`

**Interfaces:**
- Consumes: Task 1 的 `model_synthesis_invalid` fallback。
- Produces: 对传输失败、未知错误、二次违规和上层继续办理的回归证据。

- [ ] **Step 1: 写事实纠正传输失败仍整旨失败的测试**

新增一个四调用模型：前三次返回裸 opinion、gap、违规 READY，第四次抛出
`RuntimeError("provider failure")`。断言：

```python
with pytest.raises(EvidenceProtocolError, match="model_unavailable"):
    _invoke(session, model, node_id=node)
assert session.snapshot().degradation_reasons == ()
```

- [ ] **Step 2: 运行单测并确认直接 PASS**

Run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_agent_evidence_protocol.py -k "resumed_correction" -q
```

Expected: PASS；这是一条失败关闭保护测试，不要求生产改动。

- [ ] **Step 3: 运行跨层离线回归**

Run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_junjichu_agent.py tests/test_chancellor_graph.py tests/test_decrees_api.py -q
```

Expected: 全部 PASS。

- [ ] **Step 4: 运行静态检查**

Run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m ruff check app/agents/evidence_protocol.py tests/test_agent_evidence_protocol.py
```

Expected: `All checks passed!`

---

### Task 3: 故障记忆、产品状态和仓库验证

**Files:**
- Modify: `docs/failures/2026-07-28-decree-bare-opinion-false-acceptance.md`
- Modify: `docs/product/tasks/2026-07-28-fix-decree-model-invocation.md`

**Interfaces:**
- Consumes: Task 1/2 的 RED、GREEN 和扩大回归结果。
- Produces: 可审计的根因、预防、检测和剩余真实验收状态。

- [ ] **Step 1: 更新故障记忆**

在现有五个必需章节中补充：

- 根因：纠正耗尽后的内容合规错误被升级为整旨失败。
- 预防：只对白名单内容错误局部降级；传输和未知错误继续失败关闭。
- 检测：登记完整四响应降级测试和传输失败保护测试。
- 证据：链接设计、计划、实现和测试。

- [ ] **Step 2: 更新产品任务**

保持 `In Progress`，记录：

- 用户已批准“有界自愈 + 司级局部降级”。
- 离线 RED/GREEN、扩大回归和静态检查的实际结果。
- 后端需要重启加载最终改动。
- 再次真实付费验证需要单独授权；在成功前不得标记 Accepted。

- [ ] **Step 3: 运行仓库治理检查**

Run:

```powershell
node scripts/check_harness.mjs
git diff --check
```

Expected: harness PASS，`git diff --check` exit 0。

- [ ] **Step 4: 自审精确 diff**

Run:

```powershell
git diff -- backend/app/agents/evidence_protocol.py backend/tests/test_agent_evidence_protocol.py docs/failures/2026-07-28-decree-bare-opinion-false-acceptance.md docs/product/tasks/2026-07-28-fix-decree-model-invocation.md docs/superpowers/specs/2026-07-28-bounded-bureau-evidence-degradation-design.md docs/superpowers/plans/2026-07-28-bounded-bureau-evidence-degradation.md
```

Expected: 只包含本任务变更；不包含并发前端或其他任务文件。

- [ ] **Step 5: 不执行 Git 提交**

本计划不包含 `git add` 或 `git commit`。只有用户单独明确授权并在写操作前核对绝对工作区、
当前分支、HEAD 和 `git status` 后才能提交。
