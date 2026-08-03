# Independent Runtime Skills for All Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Junjichu, all six ministries, and all 39 bureaus exactly one versioned professional Runtime Skill that produces a layer-appropriate structured report without changing the approved decree evidence flow.

**Architecture:** Add a downstream runtime-skill domain with immutable definitions, a one-to-one registry, three report contracts, and a shared executor. Adapt the existing bureau, ministry, and Junjichu call paths incrementally; keep the Chancellor LangGraph topology, public APIs, evidence protocol, and archive behavior unchanged.

**Tech Stack:** Python 3.12, Pydantic, existing structured invocation helpers, LangGraph orchestration, pytest, Ruff, Node harness checks.

## Global Constraints

- Preserve `docs/decisions/0028-decree-evidence-flow-governance-baseline.md` byte-for-byte unless the current user separately authorizes a governance change.
- Add exactly 46 enabled downstream skills: one Junjichu skill, six ministry skills, and 39 bureau skills.
- Preserve the existing Chancellor `consult`, `draft_decree`, and `execute_decree` Runtime Skills.
- Keep the 39 bureaus out of the LangGraph node registry in this change; continue invoking them through the existing controlled ministry loop.
- Only bureau-layer skills may create evidence requests; ministry and council skills must not receive Evidence Protocol, Jinyiwei, MCP, or external-network service handles.
- Preserve current API request/response shapes, frontend behavior, one-time draft authority, final three recommendations, evidence adoption, and Shiguan `REPLY` semantics.
- Do not add new production writes, paid API calls, MCP sources, credentials, or external-network access.
- Treat facts, assumptions, and recommendations separately; use `sufficient | partial | insufficient` for evidence sufficiency and do not invent confidence percentages.
- Use TDD for each behavior change and preserve unrelated user changes.
- Before each Git write, print and verify absolute workspace path, branch, HEAD, and `git status`; commit, push, PR, merge, or deploy only with separate explicit user authorization.
- Final acceptance requires the same final code, configuration, and command set to pass 10 consecutive complete rounds; any failure or material change resets the count to round 1.

---

## File Map

**Create**

- `docs/decisions/0036-downstream-agent-runtime-skills.md`: records the new runtime dependency direction without changing ADR 0028.
- `docs/product/tasks/2026-08-03-independent-runtime-skills-for-all-agents.md`: product scope, allowed paths, acceptance, and implementation evidence.
- `backend/app/agents/runtime_skills/__init__.py`: public downstream Runtime Skill exports.
- `backend/app/agents/runtime_skills/models.py`: layer, service, definition, invocation, audit, and report models.
- `backend/app/agents/runtime_skills/registry.py`: one-to-one registration and lookup.
- `backend/app/agents/runtime_skills/executor.py`: service-policy enforcement, prompt composition, report validation, and audit production.
- `backend/app/agents/runtime_skills/roles/junjichu.py`: one council definition.
- `backend/app/agents/runtime_skills/roles/ministries.py`: six ministry definitions.
- `backend/app/agents/runtime_skills/roles/bureaus/libu.py`: six 吏部 bureau definitions.
- `backend/app/agents/runtime_skills/roles/bureaus/hubu.py`: seven 户部 bureau definitions.
- `backend/app/agents/runtime_skills/roles/bureaus/rites.py`: six 礼部 bureau definitions.
- `backend/app/agents/runtime_skills/roles/bureaus/bingbu.py`: six 兵部 bureau definitions.
- `backend/app/agents/runtime_skills/roles/bureaus/xingbu.py`: seven 刑部 bureau definitions.
- `backend/app/agents/runtime_skills/roles/bureaus/gongbu.py`: seven 工部 bureau definitions.
- `backend/tests/test_downstream_runtime_skill_models.py`: report and definition contract tests.
- `backend/tests/test_downstream_runtime_skill_registry.py`: count, uniqueness, one-to-one mapping, and permission tests.
- `backend/tests/test_downstream_runtime_skill_executor.py`: service isolation, report validation, degradation, and audit tests.
- `backend/tests/test_bureau_runtime_skills.py`: all 39 bureau definitions and bureau integration tests.
- `backend/tests/test_ministry_runtime_skills.py`: six ministry definitions and synthesis tests.
- `backend/tests/test_junjichu_runtime_skill.py`: council definition and sequential synthesis tests.
- `backend/tests/test_downstream_runtime_skill_compatibility.py`: old capability mapping and end-to-end compatibility tests.

**Modify**

- `backend/app/agents/bureaus/agent.py`: resolve and execute the bureau's bound skill while retaining the evidence envelope.
- `backend/app/agents/bureaus/prompts.py`: accept the selected Skill's professional method instead of capability-only fragments.
- `backend/app/agents/bureaus/capabilities.py`: expose compatibility aliases to new bureau Skill IDs.
- `backend/app/agents/ministries/agent.py`: resolve the ministry skill and synthesize typed bureau reports.
- `backend/app/agents/ministries/prompts.py`: consume the ministry Skill contract and report summaries.
- `backend/app/agents/junjichu/agent.py`: resolve the council skill and synthesize typed ministry reports.
- `backend/app/agents/junjichu/prompts.py`: consume the council Skill contract and preserve disagreements.
- `backend/app/agents/chancellor/graph.py`: adapt typed reports back to the current response contract; do not add graph nodes.
- Existing focused tests in `backend/tests/test_bureaus_agent.py`, `test_ministries_agent.py`, `test_junjichu_agent.py`, `test_chancellor_graph.py`, and `test_agent_evidence_protocol.py`: compatibility assertions only where required.

---

### Task 1: Record the Product and Architecture Boundary

**Files:**

- Create: `docs/product/tasks/2026-08-03-independent-runtime-skills-for-all-agents.md`
- Create: `docs/decisions/0036-downstream-agent-runtime-skills.md`
- Reference: `docs/superpowers/specs/2026-08-03-independent-runtime-skills-for-all-agents-design.md`

**Interfaces:**

- Consumes: confirmed design specification and immutable ADR 0028.
- Produces: a `Ready` product task and accepted architectural dependency direction for later tasks.

- [ ] **Step 1: Write the product task with the confirmed scope**

Use the repository task template and record: 46 one-to-one skills, no frontend/API change, allowed backend/test/doc paths, Codex-only choice if the user selects it at execution time, and all acceptance criteria from the design. Set `用户确认` to the current conversation date and basis; set status to `Ready` because the user explicitly approved the written specification.

- [ ] **Step 2: Write ADR 0036**

Record this decision exactly:

```markdown
## Decision

Adopt one immutable downstream Runtime Skill definition per Junjichu,
ministry, and bureau Agent. Definitions own professional methods and report
contracts; a shared executor owns invocation, validation, policy enforcement,
and audit. Existing Chancellor LangGraph topology and ADR 0028 remain unchanged.
```

- [ ] **Step 3: Verify the governance documents**

Run:

```powershell
rg -n "46|39|only bureau|仅司级|LangGraph|ADR 0028" docs/product/tasks/2026-08-03-independent-runtime-skills-for-all-agents.md docs/decisions/0036-downstream-agent-runtime-skills.md
git diff --check -- docs/product/tasks/2026-08-03-independent-runtime-skills-for-all-agents.md docs/decisions/0036-downstream-agent-runtime-skills.md
node scripts/check_harness.mjs
```

Expected: required boundaries are present, `git diff --check` emits no output, and harness reports PASS.

- [ ] **Step 4: Commit only if separately authorized**

Before committing, print `Resolve-Path .`, `git branch --show-current`, `git rev-parse HEAD`, and `git status --short`; verify this exact workspace. Then stage only Task 1 files and use `docs: record downstream runtime skill architecture`.

---

### Task 2: Define Runtime Skill and Report Contracts

**Files:**

- Create: `backend/app/agents/runtime_skills/models.py`
- Create: `backend/app/agents/runtime_skills/__init__.py`
- Test: `backend/tests/test_downstream_runtime_skill_models.py`

**Interfaces:**

- Consumes: existing Pydantic conventions and stable error handling.
- Produces: `AgentLayer`, `RuntimeService`, `RuntimeSkillDefinition`, `SkillInvocation`, `BureauReport`, `MinistryReport`, `CouncilReport`, and `SkillAuditRecord`.

- [ ] **Step 1: Write failing report-model tests**

```python
def test_bureau_report_distinguishes_data_gaps_from_findings() -> None:
    report = BureauReport(
        report_id="r-1", request_id="q-1", agent_id="hubu-accounting",
        skill_id="analyze-accounting-position", skill_version="1.0.0",
        subject="月结复盘", executive_summary="材料不足",
        evidence_sufficiency=EvidenceSufficiency.INSUFFICIENT,
        status=ReportStatus.DEGRADED,
        data_gaps=("缺少总账",), analysis=(), professional_findings=(),
        risks=(), recommendations=("补齐总账后复核",),
    )
    assert report.data_gaps == ("缺少总账",)
    assert report.status is ReportStatus.DEGRADED

def test_ministry_and_council_reports_reject_evidence_requests() -> None:
    assert "evidence_requests" not in MinistryReport.model_fields
    assert "evidence_requests" not in CouncilReport.model_fields
```

- [ ] **Step 2: Run the model tests and observe failure**

Run: `python -m pytest backend/tests/test_downstream_runtime_skill_models.py -q`

Expected: collection fails because `app.agents.runtime_skills.models` does not exist.

- [ ] **Step 3: Implement immutable definitions and three report models**

Use string enums for serialization and frozen Pydantic models/dataclasses for trusted definitions. The defining signatures must be:

```python
class AgentLayer(StrEnum):
    BUREAU = "bureau"
    MINISTRY = "ministry"
    COUNCIL = "council"

class RuntimeSkillDefinition(BaseModel):
    model_config = ConfigDict(frozen=True)
    skill_id: str
    version: str
    agent_id: str
    layer: AgentLayer
    purpose: str
    responsibility_scope: tuple[str, ...]
    data_requirements: tuple[str, ...]
    analysis_procedure: tuple[str, ...]
    required_findings: tuple[str, ...]
    allowed_services: frozenset[RuntimeService]
    forbidden_actions: tuple[str, ...]
    report_type: type[BaseModel]
```

Keep `evidence_requests` exclusively on `BureauReport`. Reject blank identifiers, empty methods, unsupported semantic versions, and completed reports with unresolved required fields.

- [ ] **Step 4: Run focused tests and lint**

Run:

```powershell
python -m pytest backend/tests/test_downstream_runtime_skill_models.py -q
python -m ruff check backend/app/agents/runtime_skills backend/tests/test_downstream_runtime_skill_models.py
```

Expected: all focused tests pass and Ruff reports no errors.

- [ ] **Step 5: Commit only if separately authorized**

After the required Git preflight, stage only Task 2 files and use `feat: define downstream runtime skill contracts`.

---

### Task 3: Build the One-to-One Registry and All 46 Definitions

**Files:**

- Create: `backend/app/agents/runtime_skills/registry.py`
- Create: `backend/app/agents/runtime_skills/roles/junjichu.py`
- Create: `backend/app/agents/runtime_skills/roles/ministries.py`
- Create: six files under `backend/app/agents/runtime_skills/roles/bureaus/`
- Test: `backend/tests/test_downstream_runtime_skill_registry.py`

**Interfaces:**

- Consumes: `RuntimeSkillDefinition`, `BUREAU_PROFILES`, and the six existing ministry identities.
- Produces: `DownstreamSkillRegistry.get_by_agent(agent_id)`, `get(skill_id)`, `ALL_DOWNSTREAM_SKILLS`, and `build_default_downstream_skill_registry()`.

- [ ] **Step 1: Write failing completeness and policy tests**

```python
def test_default_registry_has_exactly_46_one_to_one_bindings() -> None:
    registry = build_default_downstream_skill_registry()
    assert len(registry.skills) == 46
    assert len({skill.skill_id for skill in registry.skills}) == 46
    assert len({skill.agent_id for skill in registry.skills}) == 46
    assert sum(s.layer is AgentLayer.BUREAU for s in registry.skills) == 39
    assert sum(s.layer is AgentLayer.MINISTRY for s in registry.skills) == 6
    assert sum(s.layer is AgentLayer.COUNCIL for s in registry.skills) == 1

def test_only_bureau_skills_may_use_evidence_protocol() -> None:
    for skill in build_default_downstream_skill_registry().skills:
        assert (RuntimeService.EVIDENCE_PROTOCOL in skill.allowed_services) == (
            skill.layer is AgentLayer.BUREAU
        )
```

Also parameterize over every `BUREAU_PROFILES` identity and assert exactly one binding.

- [ ] **Step 2: Run the registry tests and observe failure**

Run: `python -m pytest backend/tests/test_downstream_runtime_skill_registry.py -q`

Expected: import or count failure before definitions exist.

- [ ] **Step 3: Implement the registry fail-closed checks**

```python
class DownstreamSkillRegistry:
    def __init__(self, skills: tuple[RuntimeSkillDefinition, ...]) -> None:
        self.skills = skills
        self._by_skill_id = _unique_map(skills, key=lambda item: item.skill_id)
        self._by_agent_id = _unique_map(skills, key=lambda item: item.agent_id)

    def get_by_agent(self, agent_id: str) -> RuntimeSkillDefinition:
        try:
            return self._by_agent_id[agent_id]
        except KeyError as exc:
            raise DownstreamSkillRegistryError("agent_skill_not_registered") from exc
```

Validate exact layer counts and compare the 39 bureau bindings to the authoritative bureau registry at default-registry construction time.

- [ ] **Step 4: Add all definitions from the approved design**

Use the 46 exact Skill IDs listed in the design. Each bureau definition must contain at least two data requirements, three ordered analysis steps, two required finding categories, and bureau-specific guardrails. Ministry definitions must allow only bureau invocation and report synthesis. The council definition must allow only sequential ministry invocation and report synthesis.

- [ ] **Step 5: Run completeness tests and inspect the inventory**

Run:

```powershell
python -m pytest backend/tests/test_downstream_runtime_skill_registry.py -q
$env:PYTHONPATH='backend'; python -c "from app.agents.runtime_skills import build_default_downstream_skill_registry as b; r=b(); print(len(r.skills)); print('\n'.join(sorted(s.skill_id for s in r.skills)))"
python -m ruff check backend/app/agents/runtime_skills backend/tests/test_downstream_runtime_skill_registry.py
```

Expected: tests pass, inventory starts with `46`, all IDs are unique, and Ruff passes.

- [ ] **Step 6: Commit only if separately authorized**

After Git preflight, stage only Task 3 files and use `feat: register skills for all downstream agents`.

---

### Task 4: Implement the Shared Executor and Audit Boundary

**Files:**

- Create: `backend/app/agents/runtime_skills/executor.py`
- Test: `backend/tests/test_downstream_runtime_skill_executor.py`

**Interfaces:**

- Consumes: `RuntimeSkillDefinition`, `SkillInvocation`, callable structured model adapter, and an explicit service map.
- Produces: `execute_runtime_skill(invocation, skill, services, model) -> SkillExecutionResult`.

- [ ] **Step 1: Write failing service-isolation and degradation tests**

```python
def test_executor_rejects_unapproved_service_before_model_call() -> None:
    called = False
    def model(_: list[object]) -> str:
        nonlocal called
        called = True
        return "{}"
    with pytest.raises(RuntimeSkillExecutionError, match="service_not_allowed"):
        execute_runtime_skill(invocation, ministry_skill, {RuntimeService.EVIDENCE_PROTOCOL: object()}, model)
    assert called is False

def test_insufficient_bureau_data_returns_degraded_report() -> None:
    result = execute_runtime_skill(invocation_without_required_data, bureau_skill, {}, model)
    assert result.report.status is ReportStatus.DEGRADED
    assert result.report.data_gaps
```

- [ ] **Step 2: Run tests and observe failure**

Run: `python -m pytest backend/tests/test_downstream_runtime_skill_executor.py -q`

Expected: import failure for the executor.

- [ ] **Step 3: Implement policy enforcement and typed parsing**

The executor sequence must be deterministic:

```python
def execute_runtime_skill(invocation, skill, services, model):
    _require_agent_binding(invocation.agent_id, skill.agent_id)
    _require_allowed_services(skill.allowed_services, services.keys())
    prepared = _prepare_minimal_context(invocation, skill)
    if prepared.missing_required_data:
        return _degraded_result(invocation, skill, prepared.missing_required_data)
    raw = model(_build_messages(prepared, skill))
    report = skill.report_type.model_validate_json(raw)
    return SkillExecutionResult(report=report, audit=_audit(invocation, skill, report))
```

Map invalid output to a stable `skill_report_invalid` code. Never include raw model output, credentials, service objects, or third-party exceptions in returned errors or audit.

- [ ] **Step 4: Run executor, model, registry, and Ruff checks**

Run:

```powershell
python -m pytest backend/tests/test_downstream_runtime_skill_models.py backend/tests/test_downstream_runtime_skill_registry.py backend/tests/test_downstream_runtime_skill_executor.py -q
python -m ruff check backend/app/agents/runtime_skills backend/tests/test_downstream_runtime_skill_*.py
```

Expected: all tests and Ruff pass.

- [ ] **Step 5: Commit only if separately authorized**

After Git preflight, stage only Task 4 files and use `feat: enforce downstream skill execution policies`.

---

### Task 5: Integrate All 39 Bureau Skills Without Breaking Evidence

**Files:**

- Modify: `backend/app/agents/bureaus/agent.py`
- Modify: `backend/app/agents/bureaus/prompts.py`
- Test: `backend/tests/test_bureau_runtime_skills.py`
- Modify tests: `backend/tests/test_bureaus_agent.py`
- Regression: `backend/tests/test_agent_evidence_protocol.py`

**Interfaces:**

- Consumes: registry lookup by normalized bureau Agent ID and existing `invoke_bureau_with_evidence`.
- Produces: internal `BureauReport`; preserves the existing outward `{"opinion": str}` adapter until higher layers migrate.

- [ ] **Step 1: Write failing one-to-one prompt and report tests**

```python
@pytest.mark.parametrize("department,bureau", ALL_39_IDENTITIES)
def test_each_bureau_invocation_uses_its_bound_skill(department: str, bureau: str) -> None:
    captured = capture_messages_for(department, bureau)
    skill = registry.get_by_agent(bureau_agent_id(department, bureau))
    assert skill.skill_id in captured.system_text
    assert all(step in captured.system_text for step in skill.analysis_procedure)

def test_bureau_report_keeps_evidence_requests_inside_evidence_protocol() -> None:
    result = invoke_bureau_agent(...)
    assert result.runtime_report.skill_id == "analyze-accounting-position"
    assert result["opinion"] == result.runtime_report.executive_summary
```

- [ ] **Step 2: Run the focused bureau tests and observe failure**

Run: `python -m pytest backend/tests/test_bureau_runtime_skills.py backend/tests/test_bureaus_agent.py -q`

Expected: new runtime-report assertions fail while existing tests remain informative.

- [ ] **Step 3: Resolve the bureau Skill and compose professional instructions**

Add a compatibility result type or adapter that retains `opinion` while carrying `runtime_report`. Pass only the Skill's professional method into the prompt. Keep the existing Evidence Protocol as the sole owner of investigation retries, claims validation, evidence snapshots, and degradation reasons.

- [ ] **Step 4: Run bureau and complete evidence regressions**

Run:

```powershell
python -m pytest backend/tests/test_bureau_runtime_skills.py backend/tests/test_bureaus_agent.py -q
python -m pytest backend/tests/test_agent_evidence_protocol.py -q
```

Expected: all tests pass; existing evidence behavior and `opinion` compatibility remain unchanged.

- [ ] **Step 5: Commit only if separately authorized**

After Git preflight, stage only Task 5 files and use `feat: execute bureau-specific runtime skills`.

---

### Task 6: Integrate Six Ministry Skills and Typed Bureau Reports

**Files:**

- Modify: `backend/app/agents/ministries/agent.py`
- Modify: `backend/app/agents/ministries/prompts.py`
- Test: `backend/tests/test_ministry_runtime_skills.py`
- Modify tests: `backend/tests/test_ministries_agent.py`

**Interfaces:**

- Consumes: `BureauReport` values from Task 5 and ministry Skill lookup.
- Produces: internal `MinistryReport`; preserves current department, bureau opinions, and opinion response fields.

- [ ] **Step 1: Write failing selection, conflict, and permission tests**

```python
def test_ministry_report_references_real_bureau_reports() -> None:
    result = invoke_ministry_agent(...)
    assert result.runtime_report.bureau_report_refs == tuple(
        item.runtime_report.report_id for item in result.bureau_opinions
    )

def test_ministry_skill_preserves_unresolved_bureau_conflict() -> None:
    result = synthesize_ministry_reports(conflicting_reports)
    assert result.conflicts

def test_ministry_has_no_evidence_service() -> None:
    skill = registry.get_by_agent("hubu")
    assert RuntimeService.EVIDENCE_PROTOCOL not in skill.allowed_services
```

- [ ] **Step 2: Run focused ministry tests and observe failure**

Run: `python -m pytest backend/tests/test_ministry_runtime_skills.py backend/tests/test_ministries_agent.py -q`

Expected: typed report assertions fail before integration.

- [ ] **Step 3: Add ministry Skill resolution and synthesis**

Resolve exactly one ministry Skill before selecting bureaus. Deterministically validate selected bureau identities against the existing ministry registry. Feed only compact bureau report summaries and references into ministry synthesis. Retain missing or failed bureau entries in `unresolved_items`; never synthesize a report for an uninvoked bureau.

- [ ] **Step 4: Run ministry and bureau regressions**

Run:

```powershell
python -m pytest backend/tests/test_ministry_runtime_skills.py backend/tests/test_ministries_agent.py backend/tests/test_bureau_runtime_skills.py backend/tests/test_bureaus_agent.py -q
```

Expected: all focused and lower-layer tests pass.

- [ ] **Step 5: Commit only if separately authorized**

After Git preflight, stage only Task 6 files and use `feat: synthesize ministry runtime reports`.

---

### Task 7: Integrate the Junjichu Council Skill and Preserve LangGraph Topology

**Files:**

- Modify: `backend/app/agents/junjichu/agent.py`
- Modify: `backend/app/agents/junjichu/prompts.py`
- Modify: `backend/app/agents/chancellor/graph.py`
- Test: `backend/tests/test_junjichu_runtime_skill.py`
- Modify tests: `backend/tests/test_junjichu_agent.py`
- Regression: `backend/tests/test_chancellor_graph.py`

**Interfaces:**

- Consumes: ordered `MinistryReport` values and approved department route.
- Produces: internal `CouncilReport`; adapts it to the current Chancellor graph state and API response.

- [ ] **Step 1: Write failing order, disagreement, and graph-node tests**

```python
def test_council_report_keeps_approved_order_and_disagreements() -> None:
    report = invoke_junjichu_council(approved_departments=("户部", "刑部"), ...)
    assert report.runtime_report.participating_ministries == ("户部", "刑部")
    assert report.runtime_report.disagreements

def test_skill_integration_does_not_add_bureau_langgraph_nodes() -> None:
    graph = build_chancellor_graph()
    assert set(graph.nodes) == {
        "decide_route", "handle_single_ministry", "run_junjichu_council",
        "finalize_chancellor",
    }
```

- [ ] **Step 2: Run Junjichu and graph tests and observe failure**

Run: `python -m pytest backend/tests/test_junjichu_runtime_skill.py backend/tests/test_junjichu_agent.py backend/tests/test_chancellor_graph.py -q`

Expected: runtime CouncilReport assertions fail; existing graph tests identify the compatibility surface.

- [ ] **Step 3: Resolve and execute the council Skill**

Validate that the participating ministries and sequence exactly equal the approved route before invoking any ministry. Pass compact typed ministry reports to synthesis. Preserve consensus, disagreements, dependencies, options, and matters for Chancellor decision. Adapt the result to current `ministry_opinions` and finalization inputs without changing public response fields.

- [ ] **Step 4: Run the complete decree-agent focused suite**

Run:

```powershell
python -m pytest backend/tests/test_junjichu_runtime_skill.py backend/tests/test_junjichu_agent.py backend/tests/test_ministry_runtime_skills.py backend/tests/test_ministries_agent.py backend/tests/test_bureau_runtime_skills.py backend/tests/test_bureaus_agent.py backend/tests/test_chancellor_graph.py -q
```

Expected: all tests pass and graph node names remain unchanged.

- [ ] **Step 5: Commit only if separately authorized**

After Git preflight, stage only Task 7 files and use `feat: add council runtime skill synthesis`.

---

### Task 8: Migrate the 20 Legacy Capabilities Safely

**Files:**

- Modify: `backend/app/agents/bureaus/capabilities.py`
- Test: `backend/tests/test_downstream_runtime_skill_compatibility.py`
- Modify tests: `backend/tests/test_bureau_capabilities.py`

**Interfaces:**

- Consumes: old `capability_id` values and new bureau Skill registry.
- Produces: `skill_id_for_legacy_capability(capability_id) -> str` and temporary compatibility lookups.

- [ ] **Step 1: Write failing migration coverage tests**

```python
def test_every_legacy_capability_maps_to_its_bureau_skill() -> None:
    for capability in CAPABILITY_PROFILES:
        skill = registry.get(skill_id_for_legacy_capability(capability.capability_id))
        assert skill.agent_id == bureau_agent_id(capability.department, capability.bureau)

def test_all_39_bureaus_work_without_legacy_capability() -> None:
    assert len({skill.agent_id for skill in registry.skills if skill.layer is AgentLayer.BUREAU}) == 39
```

- [ ] **Step 2: Run migration tests and observe failure**

Run: `python -m pytest backend/tests/test_downstream_runtime_skill_compatibility.py backend/tests/test_bureau_capabilities.py -q`

Expected: missing compatibility mapping failure.

- [ ] **Step 3: Add an explicit immutable compatibility map**

Map every existing capability ID to the approved Skill ID of its owning bureau. Keep capability purpose and guardrails available as analysis modes inside that Skill, but remove any runtime path that appends both old capability instructions and new Skill instructions to one model call.

- [ ] **Step 4: Run migration and cross-layer regressions**

Run:

```powershell
python -m pytest backend/tests/test_downstream_runtime_skill_compatibility.py backend/tests/test_bureau_capabilities.py backend/tests/test_accounting_report_cross_layer.py -q
```

Expected: all 20 mappings pass, all 39 bureaus remain covered, and accounting report behavior remains compatible.

- [ ] **Step 5: Commit only if separately authorized**

After Git preflight, stage only Task 8 files and use `refactor: map legacy capabilities to bureau skills`.

---

### Task 9: Complete Integration, Documentation, and Final Acceptance

**Files:**

- Modify: `docs/product/tasks/2026-08-03-independent-runtime-skills-for-all-agents.md`
- Modify only if necessary: relevant agentic architecture documentation already referenced by root `AGENTS.md`
- Test: all files created or modified by Tasks 2–8

**Interfaces:**

- Consumes: complete implementation and all focused test evidence.
- Produces: implementation report, review evidence, and a reproducible 10-round acceptance ledger.

- [ ] **Step 1: Run a self-review before broad verification**

Inspect `git diff --stat`, `git diff --check`, and `git diff -- backend/app/agents backend/tests docs`. Confirm no frontend/API schema/ADR 0028 changes, no new network access, no credential handling, and no unrelated edits.

- [ ] **Step 2: Run focused downstream tests**

Run:

```powershell
python -m pytest backend/tests/test_downstream_runtime_skill_models.py backend/tests/test_downstream_runtime_skill_registry.py backend/tests/test_downstream_runtime_skill_executor.py backend/tests/test_bureau_runtime_skills.py backend/tests/test_ministry_runtime_skills.py backend/tests/test_junjichu_runtime_skill.py backend/tests/test_downstream_runtime_skill_compatibility.py -q
```

Expected: all pass.

- [ ] **Step 3: Run existing agent and API regression tests**

Run:

```powershell
python -m pytest backend/tests/test_bureaus_agent.py backend/tests/test_bureau_capabilities.py backend/tests/test_agent_evidence_protocol.py backend/tests/test_ministries_agent.py backend/tests/test_junjichu_agent.py backend/tests/test_chancellor_graph.py backend/tests/test_chancellor_runtime_registry.py backend/tests/test_chancellor_runtime_agent.py backend/tests/test_accounting_report_cross_layer.py -q
```

Expected: all pass with no new warnings attributable to this change.

- [ ] **Step 4: Run backend-wide quality checks**

Run from the repository root using the backend commands documented in `backend/AGENTS.md`. At minimum:

```powershell
python -m ruff check backend/app backend/tests
python -m pytest backend/tests -q
```

Expected: Ruff passes and the complete backend suite passes.

- [ ] **Step 5: Run the repository harness checks**

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: all four Node checks report PASS. `git diff --check` may retain Git line-ending warnings on stderr, but its actual exit code must be exactly `0`; any nonzero exit fails the round.

- [ ] **Step 6: Execute 10 consecutive final acceptance rounds**

Define one PowerShell round as the exact commands in Steps 2–5, in the same order and against an unchanged worktree. Run rounds 1 through 10. For each round, append to the product task:

```text
Round N | PASS/FAIL | exact commands | test counts | timestamp | evidence location
```

If any command fails, or any code, configuration, dependency, or acceptance command changes, reset the ledger and restart at round 1.

Use `scripts/run_task9_acceptance.ps1` as the auditable runner. Its manifest records the SHA-256 algorithm, canonical aggregation format, complete included-file hashes, explicit runtime-evidence/status exclusions, and the exact command matrix. Every command stores sanitized complete stdout/stderr in separate evidence files with timestamps and exit code. Every formal round records complete start/end fingerprints. Runtime evidence and mutable acceptance-status documents may be excluded only as listed in the manifest; production code, tests, dependency/configuration inputs, the runner and its test, harness entrypoints, governance baseline, design, and this plan remain fingerprinted.

- [ ] **Step 7: Complete the product-task implementation and acceptance sections**

Record changed files, actual skills used, all commands and results, unrun external checks, and residual risks. Real model, real MCP, production DB, production writes, and paid services must remain explicitly unrun unless separately authorized.

- [ ] **Step 8: Commit the final implementation only if separately authorized**

Perform the mandatory absolute-path/branch/HEAD/status preflight, stage only reviewed files, and use a user-approved commit strategy. Do not push, open a PR, merge, or deploy without additional explicit authorization.

---

## Execution Notes

- Recommended sequence is Tasks 1–9 in order; Tasks 5–7 depend on the contracts, registry, and executor.
- A reviewer may reject any task independently without invalidating already accepted lower-level contracts.
- Keep compatibility adapters until Task 9 proves all existing consumers pass. Removing old outward `opinion` fields is outside this plan.
- Do not turn the Skill definitions into long general-purpose prompts. Store only role-specific methods, data requirements, guardrails, and output expectations that differ across Agents.
- No task authorizes Git writes or external side effects by itself.
