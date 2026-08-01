# Single Chancellor Runtime Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Represent consultation, drafting, and decree execution as three isolated Runtime Skills of one product-runtime Chancellor Agent while preserving every current frontend and HTTP contract.

**Architecture:** Add a small `app.agents.chancellor_runtime` package containing immutable Skill definitions, a fail-closed registry, a single `ChancellorAgent` dispatcher, and adapters around the three existing graph factories. Existing APIs select a fixed Skill after request validation; models may never override that selection. The existing graphs, draft authority, ministry/evidence flow, and response mapping remain authoritative.

**Tech Stack:** Python 3.11+, Pydantic v2, FastAPI, LangGraph, pytest, Ruff.

## Global Constraints

- Read and preserve `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.
- Do not change frontend files, BFF routes, or the three existing backend API request/response contracts.
- Do not merge the existing consultation, drafting, and execution LangGraphs.
- Do not load development-time `.agents/skills/*/SKILL.md` in the product runtime.
- `consult` cannot access ministries, bureaus, Junjichu, Jinyiwei, MCP, or Shiguan writes.
- `draft_decree` cannot execute a decree or access ministries, Jinyiwei, or MCP.
- `execute_decree` retains the current one-time draft authority and approved-route boundary.
- MCP remains reachable only through bureau evidence requests → Evidence Protocol → Jinyiwei.
- Register `follow_up` as disabled metadata only; do not implement triggers, notifications, persistence, or UI.
- Preserve unrelated worktree changes, including the pre-existing `.gitignore` modification.
- Do not commit, push, merge, deploy, or create external resources without separate current-task authorization.
- Final acceptance requires the critical runtime/API regression suite to pass 11 consecutive runs; any failed run resets the consecutive-pass count and blocks acceptance.

---

## File Structure

- Create `backend/app/agents/chancellor_runtime/models.py`: enums and immutable invocation/audit contracts.
- Create `backend/app/agents/chancellor_runtime/skills.py`: Runtime Skill definition and canonical four-Skill registry data.
- Create `backend/app/agents/chancellor_runtime/registry.py`: fail-closed lookup and entrypoint enforcement.
- Create `backend/app/agents/chancellor_runtime/agent.py`: the single dispatcher and sanitized runtime errors.
- Create `backend/app/agents/chancellor_runtime/adapters.py`: lazy adapters around existing graph factories.
- Create `backend/app/agents/chancellor_runtime/__init__.py`: stable public API.
- Create `backend/tests/test_chancellor_runtime_registry.py`: registry, entrypoint, and metadata tests.
- Create `backend/tests/test_chancellor_runtime_agent.py`: dispatcher, isolation, and adapter tests.
- Modify the three existing API modules only at their graph invocation seam.
- Create `docs/decisions/0035-single-chancellor-runtime-skills.md`: adopted architecture decision.
- Create `docs/product/tasks/2026-07-31-single-chancellor-runtime-skills.md`: Ready task and delivery evidence owner.
- Modify `backend/AGENTS.md`: replace the obsolete “independent Chancellor agents” description with the single-Agent/multi-Skill boundary.

---

### Task 1: Record the Adopted Runtime Architecture and Ready Product Contract

**Files:**
- Create: `docs/decisions/0035-single-chancellor-runtime-skills.md`
- Create: `docs/product/tasks/2026-07-31-single-chancellor-runtime-skills.md`
- Modify: `backend/AGENTS.md`

**Interfaces:**
- Consumes: approved design `docs/superpowers/specs/2026-07-31-single-chancellor-runtime-skills-design.md`
- Produces: accepted ADR 0035 and a `Ready` task whose allowed paths cover only this plan.

- [ ] **Step 1: Create ADR 0035**

Write an ADR with this exact decision:

```markdown
# Single Chancellor runtime skills

## Status

Accepted — 2026-07-31

## Context

The product presents one Chancellor, while consultation, drafting, and formal
execution currently use independent graphs and API seams. The separation is a
necessary safety boundary, but treating those capabilities as separate product
agents causes identity, authorization, context, and audit semantics to drift.

## Decision

The product runtime has one Chancellor Agent with versioned Runtime Skills:
`consult`, `draft_decree`, `execute_decree`, and a disabled future
`follow_up` registration.

Existing entrypoints deterministically select one allowed Skill. Models may
suggest a later Skill but cannot execute a transition. Existing graphs remain
separate handlers. Formal execution still requires the current owner-scoped,
one-time draft authority and approved route. MCP remains available only through
bureau evidence requests, the Evidence Protocol, and Jinyiwei.

Runtime Skills are Python-owned product capability contracts. They do not load
or depend on development-time `.agents/skills/*/SKILL.md`.

## Consequences

The product identity becomes coherent without weakening isolation or rewriting
stable graphs. A small registry and dispatcher become shared infrastructure that
must fail closed and remain API-compatible. `follow_up` stays disabled until a
separate product task defines triggers, owner-scoped inputs, and presentation.

## Verification

- `cd backend && .venv/Scripts/python.exe -m pytest`
- `cd backend && .venv/Scripts/python.exe -m ruff check .`
- `node scripts/check_harness.mjs`
```

- [ ] **Step 2: Create the Ready product task**

Copy `docs/product/tasks/TEMPLATE.md`, set `Status` to `Ready`, and record:

```markdown
- 用户确认：用户于 2026-07-31 在当前 Codex 任务中确认单丞相多 Runtime Skill 设计。
- 目标：在不改变前端和 HTTP 契约的前提下，将现有三个丞相图注册为同一运行时丞相的隔离 Skill。
- 非目标：follow_up 实现、前端改动、Graph 合并、MCP 直连丞相。
```

Acceptance criteria must mirror the design document’s `## 验收标准`. Set allowed paths to:

```text
backend/app/agents/chancellor_runtime/**
backend/app/api/chancellor_consult.py
backend/app/api/chancellor_drafts.py
backend/app/api/decrees.py
backend/tests/test_chancellor_runtime_*.py
backend/tests/test_chancellor_consult_api.py
backend/tests/test_chancellor_drafts_api.py
backend/tests/test_decrees_api.py
backend/AGENTS.md
docs/decisions/0035-single-chancellor-runtime-skills.md
docs/product/tasks/2026-07-31-single-chancellor-runtime-skills.md
```

- [ ] **Step 3: Update the backend boundary documentation**

Document that `chancellor_runtime` is the single runtime identity/dispatch boundary, while `chancellor_consult`, `chancellor_draft`, and `chancellor` remain isolated handler graphs. Explicitly preserve the current per-entrypoint restrictions and ADR 0028.

- [ ] **Step 4: Verify governance documents**

Run:

```powershell
node scripts/check_harness.mjs
git diff --check -- docs/decisions/0035-single-chancellor-runtime-skills.md docs/product/tasks/2026-07-31-single-chancellor-runtime-skills.md backend/AGENTS.md
```

Expected: both commands exit `0`.

- [ ] **Step 5: Prepare a review boundary**

Review only the three Task 1 files. If the user has separately authorized commits, commit them as:

```text
docs: adopt single chancellor runtime skills
```

Otherwise leave them uncommitted and record that fact in the product task.

---

### Task 2: Add Immutable Runtime Skill Contracts and Fail-Closed Registry

**Files:**
- Create: `backend/app/agents/chancellor_runtime/models.py`
- Create: `backend/app/agents/chancellor_runtime/skills.py`
- Create: `backend/app/agents/chancellor_runtime/registry.py`
- Create: `backend/app/agents/chancellor_runtime/__init__.py`
- Test: `backend/tests/test_chancellor_runtime_registry.py`

**Interfaces:**
- Produces: `ChancellorSkillId`, `ChancellorEntrypoint`, `RuntimeService`, `RuntimeSkillDefinition`, `ChancellorSkillRegistry`, `build_default_skill_registry()`.
- Consumes: no graph, API, database, model, environment, or network dependency.

- [ ] **Step 1: Write failing registry tests**

Create tests covering canonical entrypoint mapping, disabled `follow_up`, duplicate IDs, and mismatch failure:

```python
import pytest

from app.agents.chancellor_runtime import (
    ChancellorEntrypoint,
    ChancellorSkillId,
    ChancellorSkillRegistryError,
    build_default_skill_registry,
)


def test_default_registry_maps_each_live_entrypoint_to_one_skill() -> None:
    registry = build_default_skill_registry()
    assert registry.resolve(ChancellorEntrypoint.CONSULT).skill_id is ChancellorSkillId.CONSULT
    assert registry.resolve(ChancellorEntrypoint.DRAFT).skill_id is ChancellorSkillId.DRAFT_DECREE
    assert registry.resolve(ChancellorEntrypoint.EXECUTE).skill_id is ChancellorSkillId.EXECUTE_DECREE


def test_follow_up_is_registered_but_disabled() -> None:
    skill = build_default_skill_registry().get(ChancellorSkillId.FOLLOW_UP)
    assert skill.enabled is False
    assert skill.allowed_entrypoints == ()


def test_entrypoint_cannot_request_another_skill() -> None:
    registry = build_default_skill_registry()
    with pytest.raises(ChancellorSkillRegistryError, match="skill_not_allowed"):
        registry.require_allowed(
            ChancellorEntrypoint.CONSULT,
            ChancellorSkillId.EXECUTE_DECREE,
        )
```

Add a duplicate-ID test by constructing `ChancellorSkillRegistry((skill, skill))` and expecting `duplicate_skill_id`.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_runtime_registry.py -q
```

Expected: collection fails because `app.agents.chancellor_runtime` does not exist.

- [ ] **Step 3: Implement enums and immutable definitions**

In `models.py`, define exact string enums:

```python
from enum import StrEnum
from pydantic import BaseModel, ConfigDict


class ChancellorSkillId(StrEnum):
    CONSULT = "consult"
    DRAFT_DECREE = "draft_decree"
    EXECUTE_DECREE = "execute_decree"
    FOLLOW_UP = "follow_up"


class ChancellorEntrypoint(StrEnum):
    CONSULT = "POST /api/v1/chancellor-consult"
    DRAFT = "POST /api/v1/chancellor-drafts"
    EXECUTE = "POST /api/v1/decrees/chancellor"
    FOLLOW_UP = "INTERNAL follow_up"


class RuntimeService(StrEnum):
    CONSULT_MODEL = "consult_model"
    DRAFT_MODEL = "draft_model"
    DRAFT_AUTHORITY = "draft_authority"
    DECREE_GRAPH = "decree_graph"
    MINISTRIES = "ministries"
    JUNJICHU = "junjichu"
    EVIDENCE_PROTOCOL = "evidence_protocol"
    SHIGUAN = "shiguan"
    REPORT_ARTIFACTS = "report_artifacts"
    OWNER_SCOPED_FOLLOW_UP_READS = "owner_scoped_follow_up_reads"


class RuntimeSkillDefinition(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    skill_id: ChancellorSkillId
    version: str
    description: str
    enabled: bool
    allowed_entrypoints: tuple[ChancellorEntrypoint, ...]
    allowed_services: frozenset[RuntimeService]
    forbidden_actions: tuple[str, ...]
    authorization_policy: str
```

Use nonempty field validators for `version`, `description`, `forbidden_actions`, and `authorization_policy`.

- [ ] **Step 4: Implement canonical Skill metadata**

In `skills.py`, define exactly four immutable definitions. Required service sets:

```python
CONSULT_SERVICES = frozenset({RuntimeService.CONSULT_MODEL})
DRAFT_SERVICES = frozenset({
    RuntimeService.DRAFT_MODEL,
    RuntimeService.DRAFT_AUTHORITY,
})
EXECUTE_SERVICES = frozenset({
    RuntimeService.DECREE_GRAPH,
    RuntimeService.MINISTRIES,
    RuntimeService.JUNJICHU,
    RuntimeService.EVIDENCE_PROTOCOL,
    RuntimeService.SHIGUAN,
    RuntimeService.REPORT_ARTIFACTS,
})
FOLLOW_UP_SERVICES = frozenset({
    RuntimeService.OWNER_SCOPED_FOLLOW_UP_READS,
})
```

Use version `"1.0.0"` for the three enabled Skills and `"0.0.0-disabled"` for `follow_up`.

- [ ] **Step 5: Implement fail-closed registry**

`registry.py` must expose:

```python
class ChancellorSkillRegistryError(ValueError):
    pass


class ChancellorSkillRegistry:
    def __init__(self, skills: tuple[RuntimeSkillDefinition, ...]) -> None: ...
    def get(self, skill_id: ChancellorSkillId) -> RuntimeSkillDefinition: ...
    def resolve(self, entrypoint: ChancellorEntrypoint) -> RuntimeSkillDefinition: ...
    def require_allowed(
        self,
        entrypoint: ChancellorEntrypoint,
        skill_id: ChancellorSkillId,
    ) -> RuntimeSkillDefinition: ...


def build_default_skill_registry() -> ChancellorSkillRegistry: ...
```

`resolve` must reject zero matches with `entrypoint_not_registered` and multiple matches with `entrypoint_ambiguous`. Disabled Skills never resolve.

- [ ] **Step 6: Run focused tests and Ruff**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_runtime_registry.py -q
.\.venv\Scripts\python.exe -m ruff check app/agents/chancellor_runtime tests/test_chancellor_runtime_registry.py
```

Expected: all tests pass and Ruff exits `0`.

- [ ] **Step 7: Prepare a review boundary**

Review the new package for imports of `.agents/skills`, APIs, database, environment, or network; expected: none. Commit only if separately authorized, with:

```text
feat: define chancellor runtime skill registry
```

---

### Task 3: Add the Single Chancellor Dispatcher and Lazy Graph Adapters

**Files:**
- Create: `backend/app/agents/chancellor_runtime/agent.py`
- Create: `backend/app/agents/chancellor_runtime/adapters.py`
- Modify: `backend/app/agents/chancellor_runtime/__init__.py`
- Test: `backend/tests/test_chancellor_runtime_agent.py`

**Interfaces:**
- Consumes: `ChancellorSkillRegistry`, existing graph objects exposing `invoke(dict) -> dict`.
- Produces: `ChancellorInvocationResult`, `ChancellorAgent.invoke(...)`, and `GraphSkillHandler`.

- [ ] **Step 1: Write failing dispatcher tests**

Use a recording handler and assert that only the entrypoint-selected Skill runs:

```python
def test_agent_invokes_only_entrypoint_selected_skill() -> None:
    seen: list[dict[str, object]] = []

    def handler(payload: dict[str, object]) -> dict[str, object]:
        seen.append(payload)
        return {"reply": "ok"}

    agent = ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={ChancellorSkillId.CONSULT: handler},
    )
    result = agent.invoke(
        entrypoint=ChancellorEntrypoint.CONSULT,
        requested_skill=ChancellorSkillId.CONSULT,
        owner_user_id="user-1",
        request_id="request-1",
        payload={"messages": [{"role": "user", "content": "问"}]},
    )
    assert result.skill_id is ChancellorSkillId.CONSULT
    assert result.output == {"reply": "ok"}
    assert seen == [{"messages": [{"role": "user", "content": "问"}]}]
```

Also test:

- execute requested from consult fails before any handler call;
- missing handler raises sanitized `handler_unavailable`;
- disabled follow-up raises `skill_disabled`;
- handler exception raises `skill_invocation_failed` without including the original exception text;
- result records owner, request, Skill ID, version, and entrypoint but no raw exception.

- [ ] **Step 2: Run the dispatcher tests and verify RED**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_runtime_agent.py -q
```

Expected: imports fail because the dispatcher does not exist.

- [ ] **Step 3: Implement invocation contracts and dispatcher**

Use immutable Pydantic contracts:

```python
class ChancellorInvocationResult(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    owner_user_id: str
    request_id: str
    entrypoint: ChancellorEntrypoint
    skill_id: ChancellorSkillId
    skill_version: str
    output: dict[str, object]


SkillHandler = Callable[[dict[str, object]], dict[str, object]]
```

`ChancellorAgent.invoke` must:

1. call `registry.require_allowed(entrypoint, requested_skill)`;
2. reject disabled definitions;
3. resolve exactly one handler;
4. pass only `payload` to the handler;
5. require a plain dictionary result;
6. wrap unexpected failures as `ChancellorRuntimeError("skill_invocation_failed")` using `raise ... from exc`;
7. never include `str(exc)` in the safe message.

- [ ] **Step 4: Implement lazy graph adapter**

`adapters.py`:

```python
from collections.abc import Callable
from typing import Protocol


class InvokableGraph(Protocol):
    def invoke(self, payload: dict[str, object]) -> dict[str, object]: ...


class GraphSkillHandler:
    def __init__(self, graph_factory: Callable[[], InvokableGraph]) -> None:
        self._graph_factory = graph_factory

    def __call__(self, payload: dict[str, object]) -> dict[str, object]:
        result = self._graph_factory().invoke(payload)
        if not isinstance(result, dict):
            raise ChancellorRuntimeError("skill_result_invalid")
        return result
```

The factory must be lazy: construction happens only when the selected Skill is invoked.

- [ ] **Step 5: Run focused tests and Ruff**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_runtime_registry.py tests/test_chancellor_runtime_agent.py -q
.\.venv\Scripts\python.exe -m ruff check app/agents/chancellor_runtime tests/test_chancellor_runtime_registry.py tests/test_chancellor_runtime_agent.py
```

Expected: all pass.

- [ ] **Step 6: Prepare a review boundary**

Confirm that dispatcher payloads contain no model credentials, MCP registry, or service objects. Commit only if separately authorized:

```text
feat: add single chancellor runtime dispatcher
```

---

### Task 4: Route Consultation and Drafting Through the Single Agent

**Files:**
- Modify: `backend/app/api/chancellor_consult.py`
- Modify: `backend/app/api/chancellor_drafts.py`
- Modify: `backend/tests/test_chancellor_consult_api.py`
- Modify: `backend/tests/test_chancellor_drafts_api.py`

**Interfaces:**
- Consumes: `ChancellorAgent.invoke`, `GraphSkillHandler`, existing graph factories.
- Preserves: both HTTP request/response contracts, exception mappings, validation-before-graph-construction, consultation one-call behavior, and draft authority registration/revocation.

- [ ] **Step 1: Add failing API seam tests**

For each API, monkeypatch a new `get_chancellor_agent()` seam and record:

```python
class FakeChancellorAgent:
    def __init__(self, output: dict[str, object]) -> None:
        self.output = output
        self.calls: list[dict[str, object]] = []

    def invoke(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(output=self.output)
```

Consult assertions:

```python
assert call["entrypoint"] is ChancellorEntrypoint.CONSULT
assert call["requested_skill"] is ChancellorSkillId.CONSULT
assert call["owner_user_id"] == authenticated_user.id
```

Draft assertions must use `DRAFT`/`DRAFT_DECREE` and preserve the current message/version payload. Existing tests must still prove that invalid requests never construct the Agent.

- [ ] **Step 2: Run focused API tests and verify RED**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_consult_api.py tests/test_chancellor_drafts_api.py -q
```

Expected: new tests fail because `get_chancellor_agent` is absent or the API still calls graphs directly.

- [ ] **Step 3: Add per-API lazy Agent factories**

Consult factory:

```python
def get_chancellor_agent() -> ChancellorAgent:
    return ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={
            ChancellorSkillId.CONSULT: GraphSkillHandler(
                get_chancellor_consult_graph
            )
        },
    )
```

Draft factory uses `get_chancellor_draft_graph`. Keep the existing graph factory functions so current configuration wrapping and monkeypatch seams remain testable.

- [ ] **Step 4: Replace only the invocation seam**

Consult endpoint must call:

```python
result = get_chancellor_agent().invoke(
    entrypoint=ChancellorEntrypoint.CONSULT,
    requested_skill=ChancellorSkillId.CONSULT,
    owner_user_id=current_user.id,
    request_id=secrets.token_hex(16),
    payload={"messages": normalized_messages},
)
graph_result = result.output
```

Draft uses `DRAFT`/`DRAFT_DECREE` with the existing `messages` and `version`. All response validation and draft authority registration/revocation remain in the API unchanged.

- [ ] **Step 5: Preserve sanitized error mapping**

Catch `ChancellorRuntimeError` at the API seam and rethrow the API’s existing sanitized graph invocation error using `raise ... from exc`. Do not introduce a new public error kind or response field.

- [ ] **Step 6: Run focused and regression tests**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_runtime_agent.py tests/test_chancellor_consult_graph.py tests/test_chancellor_consult_api.py tests/test_chancellor_draft_graph.py tests/test_chancellor_drafts_api.py tests/test_chancellor_draft_authority.py -q
.\.venv\Scripts\python.exe -m ruff check app/agents/chancellor_runtime app/api/chancellor_consult.py app/api/chancellor_drafts.py tests/test_chancellor_runtime_agent.py tests/test_chancellor_consult_api.py tests/test_chancellor_drafts_api.py
```

Expected: all pass with no network calls.

- [ ] **Step 7: Prepare a review boundary**

Review that consultation has no new service imports and drafting still cannot invoke execution. Commit only if separately authorized:

```text
refactor: route chancellor consult and draft through skills
```

---

### Task 5: Route Formal Decree Execution Through the Single Agent

**Files:**
- Modify: `backend/app/api/decrees.py`
- Modify: `backend/tests/test_decrees_api.py`
- Modify: `backend/tests/test_decree_draft_gate.py`
- Test: `backend/tests/test_chancellor_runtime_agent.py`

**Interfaces:**
- Consumes: the dispatcher and a lazy handler wrapping `get_chancellor_graph(report_session=...)`.
- Preserves: authority consumption before graph construction, approved-route validation, lifecycle observer context, report session lifecycle, graph result mapping, archive/publish order, and all public errors.

- [ ] **Step 1: Add failing execution seam tests**

Add a fake Agent test that proves the API calls:

```python
assert call["entrypoint"] is ChancellorEntrypoint.EXECUTE
assert call["requested_skill"] is ChancellorSkillId.EXECUTE_DECREE
assert call["payload"] == {
    "decree_text": approved_text,
    "approved_route": approved_route,
}
```

Retain and extend draft-gate assertions so invalid/stale authority produces no Agent construction, graph invocation, case creation, report artifact, or Shiguan reply.

- [ ] **Step 2: Run execution API tests and verify RED**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_decrees_api.py tests/test_decree_draft_gate.py -q
```

Expected: new seam assertions fail while existing tests remain green.

- [ ] **Step 3: Build an execution-scoped Agent**

After authority consumption, route validation, report-session creation, and lifecycle observer context setup, construct:

```python
def get_execution_chancellor_agent(
    *, report_session: AccountingReportSession
) -> ChancellorAgent:
    return ChancellorAgent(
        registry=build_default_skill_registry(),
        handlers={
            ChancellorSkillId.EXECUTE_DECREE: GraphSkillHandler(
                lambda: get_chancellor_graph(report_session=report_session)
            )
        },
    )
```

Do not construct consult/draft graphs or expose their handlers in the execution request.

- [ ] **Step 4: Replace only the formal graph invocation**

Within the existing observer/report-session `try` block:

```python
runtime_result = get_execution_chancellor_agent(
    report_session=report_session
).invoke(
    entrypoint=ChancellorEntrypoint.EXECUTE,
    requested_skill=ChancellorSkillId.EXECUTE_DECREE,
    owner_user_id=current_user.id,
    request_id=run_id,
    payload={
        "decree_text": payload.decree_text,
        "approved_route": approved_route.model_dump(mode="python"),
    },
)
result = runtime_result.output
```

Create `run_id` once and reuse it for the report session and runtime audit identity. Preserve the type expected by the current graph; if it currently accepts the Pydantic route object, keep that object rather than serializing it.

- [ ] **Step 5: Preserve failure and side-effect order**

Map `ChancellorRuntimeError` to the existing `ChancellorGraphInvocationError`. Leave response normalization, audit enrichment, archive, report publication, observer failure recording, and `report_session.abort()` in their current order.

- [ ] **Step 6: Run formal-flow regressions**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_chancellor_runtime_agent.py tests/test_chancellor_graph.py tests/test_decrees_api.py tests/test_decree_draft_gate.py tests/test_shiguan_archive_decree.py tests/test_accounting_report_cross_layer.py -q
.\.venv\Scripts\python.exe -m ruff check app/agents/chancellor_runtime app/api/decrees.py tests/test_decrees_api.py tests/test_decree_draft_gate.py
```

Expected: all pass offline; no real DeepSeek, MCP, public network, or runtime database is used.

- [ ] **Step 7: Prepare a review boundary**

Confirm that the Skill router never sees MCP credentials and the existing bureau Evidence Protocol remains the only MCP path. Commit only if separately authorized:

```text
refactor: execute decrees through chancellor runtime skill
```

---

### Task 6: Complete Documentation, Full Verification, and Delivery Evidence

**Files:**
- Modify: `docs/product/tasks/2026-07-31-single-chancellor-runtime-skills.md`
- Modify only if required by verified architecture facts: `ARCHITECTURE.md`

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: fresh verification evidence and an `Implemented` product task ready for Codex acceptance.

- [ ] **Step 1: Self-review the full diff**

Check:

```powershell
git diff -- backend/app/agents/chancellor_runtime backend/app/api/chancellor_consult.py backend/app/api/chancellor_drafts.py backend/app/api/decrees.py backend/tests backend/AGENTS.md docs/decisions/0035-single-chancellor-runtime-skills.md docs/product/tasks/2026-07-31-single-chancellor-runtime-skills.md
```

Verify no frontend files, MCP config, ADR 0028, existing graph topology, or unrelated user files changed.

- [ ] **Step 2: Run complete backend verification**

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest
```

Expected: both exit `0`. Tests remain offline.

- [ ] **Step 3: Run repository harness verification**

From the repository root:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 4: Run the critical acceptance suite 11 consecutive times**

From `backend/`, run the same isolated suite in 11 separate processes:

```powershell
$acceptanceTests = @(
  "tests/test_chancellor_runtime_registry.py",
  "tests/test_chancellor_runtime_agent.py",
  "tests/test_chancellor_consult_api.py",
  "tests/test_chancellor_drafts_api.py",
  "tests/test_decrees_api.py",
  "tests/test_decree_draft_gate.py",
  "tests/test_chancellor_graph.py",
  "tests/test_shiguan_archive_decree.py",
  "tests/test_accounting_report_cross_layer.py"
)
$acceptanceResults = @()
for ($run = 1; $run -le 11; $run++) {
  & .\.venv\Scripts\python.exe -m pytest @acceptanceTests -q
  $code = $LASTEXITCODE
  $acceptanceResults += [pscustomobject]@{ Run = $run; ExitCode = $code }
  if ($code -ne 0) {
    $acceptanceResults | Format-Table -AutoSize
    throw "Critical acceptance run $run failed; 11 consecutive passes were not achieved."
  }
}
$acceptanceResults | Format-Table -AutoSize
```

Expected: runs `1` through `11` each report exit code `0`. Do not combine them into one pytest process. Record all 11 rows in the product task.

- [ ] **Step 5: Update the product task implementation report**

Record:

- actual files changed;
- self-review findings;
- every command and PASS/FAIL result;
- actual Skills used;
- confirmation that no network/MCP smoke was run;
- confirmation that frontend/API contracts remained unchanged;
- any remaining risk.

Set task status to `Implemented` only after every required test passes.

- [ ] **Step 6: Final review against acceptance criteria**

For each acceptance checkbox, cite a test name or command result. Confirm:

- one runtime `ChancellorAgent`;
- three enabled isolated Skills;
- disabled `follow_up` metadata;
- fixed entrypoint selection;
- unchanged graph topology and API contracts;
- preserved draft authority;
- preserved MCP isolation;
- auditable Skill ID/version/entrypoint/result metadata.
- 11 consecutive critical acceptance suite runs with exit code `0`.

- [ ] **Step 7: Prepare final commit boundary**

Print and recheck the absolute workspace, branch, HEAD, and `git status`. If and only if the user separately authorizes committing, stage only the task-scoped files and commit:

```text
feat: unify chancellor runtime skills
```

Never include the pre-existing `.gitignore` modification.
