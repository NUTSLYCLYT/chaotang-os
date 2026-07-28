# Stable Decree Deterministic Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the real decree flow tolerate safely isolatable model-content drift at every synthesis layer and prove the final `/study` flow with at least 10 consecutive successful submissions.

**Architecture:** Keep ADR 0028’s graph topology unchanged. Add one shared classifier for model-call versus model-content failures, deterministic fallbacks at ministry/council/finalizer boundaries, and sanitized stage/code diagnostics in the existing case lifecycle; rejected model content never enters downstream state or archives.

**Tech Stack:** Python 3.11+, FastAPI, LangGraph, Pydantic, SQLite, pytest, Ruff, Next.js BFF tests, Node.js harness.

## Global Constraints

- Do not modify or bypass `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.
- Do not add unlimited retries, a backup model, or static `dev` business output.
- Only provider network/auth/config/SDK failures, identity failures, broken invariants, and unknown program errors may fail the whole decree.
- Never log or persist decree text, prompts, model output, exception text, API keys, session tokens, or private user data.
- Rejected model content must not enter fallbacks, downstream prompts, evidence adoption, HTTP success responses, or Shiguan archives.
- The task remains `In Progress` until the same decree succeeds through the real complete flow at least 10 consecutive times.
- Real acceptance is serial; any failure stops the run and resets the next attempt to zero.
- Git commit, push, PR, deploy, and release require separate explicit authorization.

---

## File Structure

- Create `backend/app/agents/synthesis_failures.py`: stable stage/error-code types and exception-chain classification only.
- Modify `backend/app/agents/ministries/agent.py`: deterministic selector and ministry-synthesis fallbacks.
- Modify `backend/app/agents/junjichu/agent.py`: deterministic council synthesis fallback.
- Modify `backend/app/agents/chancellor/graph.py`: deterministic route/finalizer fallback and diagnostic propagation.
- Modify `backend/app/agents/junjichu/agent.py`: extend `CaseLifecycleObserver.fail` with sanitized optional diagnostics.
- Modify `backend/app/api/decrees.py`: persist sanitized failure stage/code through the lifecycle observer.
- Modify `backend/app/junjichu_cases/models.py` and `backend/app/junjichu_cases/storage.py`: store fixed diagnostic stage/code without raw exceptions.
- Test in the existing focused test modules; do not create production test-only hooks.
- Update the existing product task and failure memory with fresh RED/GREEN and real-run evidence.

### Task 1: Shared sanitized failure classification

**Files:**
- Create: `backend/app/agents/synthesis_failures.py`
- Create: `backend/tests/test_synthesis_failures.py`

**Interfaces:**
- Produces: `SynthesisStage = Literal["route", "bureau", "ministry", "council", "finalize", "archive"]`.
- Produces: `SynthesisFailureCode = Literal["schema_invalid", "content_unsupported", "provider_unavailable", "state_invalid"]`.
- Produces: `classify_synthesis_failure(exc: BaseException) -> SynthesisFailureCode`.
- Produces: `is_locally_degradable(exc: BaseException) -> bool`.

- [ ] **Step 1: Write failing classification tests**

```python
def test_schema_errors_are_locally_degradable() -> None:
    exc = ValueError("SECRET MODEL BODY")
    assert classify_synthesis_failure(exc) == "schema_invalid"
    assert is_locally_degradable(exc) is True


def test_provider_failure_in_cause_chain_is_not_degradable() -> None:
    provider = EvidenceProtocolError("model_unavailable")
    wrapped = MinistryAgentInvocationError("sanitized")
    wrapped.__cause__ = provider
    assert classify_synthesis_failure(wrapped) == "provider_unavailable"
    assert is_locally_degradable(wrapped) is False
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_synthesis_failures.py -q`

Expected: FAIL because `app.agents.synthesis_failures` does not exist.

- [ ] **Step 3: Implement fixed-code cause-chain classification**

```python
SynthesisStage = Literal["route", "bureau", "ministry", "council", "finalize", "archive"]
SynthesisFailureCode = Literal[
    "schema_invalid", "content_unsupported", "provider_unavailable", "state_invalid"
]

_PROVIDER_CODES = frozenset({"model_unavailable"})
_CONTENT_CODES = frozenset({
    "uncited_fact_dependency",
    "unsupported_factual_dependency",
    "response_invalid",
    "adoption_invalid",
    "evidence_binding_invalid",
})

def _chain(exc: BaseException) -> Iterator[BaseException]:
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        yield current
        current = current.__cause__ or current.__context__

def classify_synthesis_failure(exc: BaseException) -> SynthesisFailureCode:
    codes = {str(item) for item in _chain(exc)}
    if codes & _PROVIDER_CODES:
        return "provider_unavailable"
    if codes & _CONTENT_CODES:
        return "content_unsupported"
    if any(isinstance(item, (ValueError, StructuredOutputError)) for item in _chain(exc)):
        return "schema_invalid"
    return "state_invalid"

def is_locally_degradable(exc: BaseException) -> bool:
    return classify_synthesis_failure(exc) in {"schema_invalid", "content_unsupported"}
```

- [ ] **Step 4: Run focused tests and Ruff**

Run: `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_synthesis_failures.py -q`

Expected: PASS.

Run: `cd backend && .\.venv\Scripts\python.exe -m ruff check app/agents/synthesis_failures.py tests/test_synthesis_failures.py`

Expected: `All checks passed!`

### Task 2: Deterministic ministry synthesis boundaries

**Files:**
- Modify: `backend/app/agents/ministries/agent.py`
- Modify: `backend/tests/test_ministries_agent.py`

**Interfaces:**
- Consumes: `is_locally_degradable(exc)` from Task 1.
- Produces: `_fallback_bureau_selection(department: str) -> list[str]`.
- Produces: `_fallback_ministry_opinion(department: str, bureau_opinions: Sequence[BureauOpinion]) -> str`.

- [ ] **Step 1: Add RED tests for malformed selector and synthesis responses**

```python
@pytest.mark.parametrize("selector_response", ["plain text", "{}", '{"bureaus":[]}'])
def test_selector_content_drift_uses_deterministic_registered_bureau(
    selector_response: str,
) -> None:
    result = invoke_ministry_agent(
        "吏部",
        DECREE,
        RATIONALE,
        SequencedModel([selector_response, READY_BUREAU, VALID_SYNTHESIS]),
    )
    assert [item["bureau"] for item in result["bureau_opinions"]]


def test_ministry_synthesis_content_drift_discards_rejected_body() -> None:
    result = invoke_ministry_agent(
        "工部",
        DECREE,
        RATIONALE,
        SequencedModel([VALID_SELECTOR, READY_BUREAU, '{"opinion":"SECRET-REJECTED"}']),
    )
    assert result["opinion"]
    assert "SECRET-REJECTED" not in result["opinion"]
```

- [ ] **Step 2: Verify RED**

Run: `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_ministries_agent.py -q`

Expected: the new cases fail with `MinistryAgentInvocationError`.

- [ ] **Step 3: Add deterministic fallbacks**

```python
def _fallback_bureau_selection(department: str) -> list[str]:
    profiles = bureau_profiles_for(department)
    if not profiles:
        raise MinistryAgentInvocationError("No registered bureau is available.")
    return [profiles[0].bureau]

def _fallback_ministry_opinion(
    department: str, bureau_opinions: Sequence[BureauOpinion]
) -> str:
    bureau_names = "、".join(item["bureau"] for item in bureau_opinions)
    return f"{department}已汇总{bureau_names}司议；当前仅形成规范性办理建议，不形成未经证据支持的事实结论。"
```

Catch only `is_locally_degradable(exc)` around selector/synthesis parsing, record
`model_synthesis_degraded:ministry:<department>`, and use these helpers. Let model
invocation exceptions and unknown errors propagate unchanged.

- [ ] **Step 4: Verify ministry behavior and provider failure closure**

Run: `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_ministries_agent.py -q`

Expected: PASS, including existing provider-failure tests.

### Task 3: Deterministic council and Chancellor finalization

**Files:**
- Modify: `backend/app/agents/junjichu/agent.py`
- Modify: `backend/app/agents/chancellor/graph.py`
- Modify: `backend/tests/test_junjichu_agent.py`
- Modify: `backend/tests/test_chancellor_graph.py`

**Interfaces:**
- Consumes: `is_locally_degradable(exc)` from Task 1.
- Produces: `_fallback_council_verdict(ministry_opinions: Sequence[MinistryOpinion]) -> str`.
- Produces: `_fallback_finalization(state: ChancellorGraphState) -> tuple[str, list[str]]`.

- [ ] **Step 1: Add RED tests for council and finalizer drift**

```python
def test_council_schema_drift_uses_verified_ministry_inputs() -> None:
    opinions, verdict = run_junjichu_council(
        DECREE, RATIONALE, ["吏部", "工部"], malformed_council_model
    )
    assert [item["department"] for item in opinions] == ["吏部", "工部"]
    assert verdict
    assert "SECRET-REJECTED" not in verdict


def test_multi_finalizer_schema_drift_returns_three_safe_recommendations() -> None:
    result = build_chancellor_graph(chat_model=malformed_finalizer_model).invoke(
        {"decree_text": DECREE}
    )
    assert result["final_verdict"]
    assert len(result["recommendations"]) == 3
    assert len(set(result["recommendations"])) == 3
    assert "SECRET-REJECTED" not in json.dumps(result, ensure_ascii=False)
```

- [ ] **Step 2: Verify RED**

Run: `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_junjichu_agent.py tests/test_chancellor_graph.py -q`

Expected: new tests fail at strict synthesis parsing.

- [ ] **Step 3: Implement deterministic safe synthesis**

```python
_SAFE_RECOMMENDATIONS = (
    "明确岗位职责、权限边界与交付标准",
    "按里程碑评审开发成果并保留验证记录",
    "涉及投资决策时另行完成合规与风险审查",
)

def _fallback_council_verdict(opinions: Sequence[MinistryOpinion]) -> str:
    departments = "、".join(item["department"] for item in opinions)
    return f"军机处已会审{departments}意见；仅确认协同办理顺序，不形成未经证据支持的事实判断。"

def _fallback_finalization(state: ChancellorGraphState) -> tuple[str, list[str]]:
    departments = "、".join(state["departments"])
    summary = f"已完成{departments}分层办理；当前回奏仅保留规范性安排与证据边界。"
    return summary, list(_SAFE_RECOMMENDATIONS)
```

Use these only when parsing/validation is locally degradable. Record
`model_synthesis_degraded:junjichu:council` or
`model_synthesis_degraded:chancellor:finalize`. Provider and state failures remain
`ChancellorGraphInvocationError`.

- [ ] **Step 4: Verify graph regressions**

Run: `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_junjichu_agent.py tests/test_chancellor_graph.py tests/test_decrees_api.py -q`

Expected: PASS.

### Task 4: Sanitized lifecycle diagnostics

**Files:**
- Modify: `backend/app/agents/junjichu/agent.py`
- Modify: `backend/app/api/decrees.py`
- Modify: `backend/app/junjichu_cases/models.py`
- Modify: `backend/app/junjichu_cases/storage.py`
- Modify: `backend/tests/test_junjichu_case_lifecycle.py`
- Modify: `backend/tests/test_junjichu_cases_api.py`
- Modify: `backend/tests/test_decrees_api.py`

**Interfaces:**
- Changes: `CaseLifecycleObserver.fail(*, stage: SynthesisStage = "route", code: SynthesisFailureCode = "state_invalid") -> None`.
- Changes: `fail_case(..., failure_stage: str, failure_code: str) -> None`.
- Produces persisted fixed fields `failure_stage` and `failure_code`; public API exposure remains unchanged unless already authorized by its response model.

- [ ] **Step 1: Add RED persistence and leakage tests**

```python
def test_failed_case_persists_only_fixed_stage_and_code(tmp_path) -> None:
    observer = storage_observer(tmp_path)
    observer.start(...)
    observer.fail(stage="ministry", code="schema_invalid")
    case = list_cases(owner_user_id="owner", db_path=tmp_path / "cases.sqlite3")[0]
    assert case.failure_stage == "ministry"
    assert case.failure_code == "schema_invalid"
    assert "SECRET" not in repr(case)


def test_http_error_does_not_expose_internal_diagnostic(fake_provider) -> None:
    response = client.post(DECREE_URL, json={"decree_text": "旨意"})
    assert response.status_code == 502
    assert set(response.json()) == {"status", "reason", "message"}
```

- [ ] **Step 2: Verify RED**

Run: `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_junjichu_case_lifecycle.py tests/test_junjichu_cases_api.py tests/test_decrees_api.py -q`

Expected: failure fields/signature are absent.

- [ ] **Step 3: Add fixed-column migration and observer mapping**

```python
_ALLOWED_FAILURE_STAGES = frozenset({"route", "bureau", "ministry", "council", "finalize", "archive"})
_ALLOWED_FAILURE_CODES = frozenset({"schema_invalid", "content_unsupported", "provider_unavailable", "state_invalid"})

def fail(self, *, stage: str = "route", code: str = "state_invalid") -> None:
    if stage not in _ALLOWED_FAILURE_STAGES or code not in _ALLOWED_FAILURE_CODES:
        stage, code = "route", "state_invalid"
    fail_case(
        self._case_id,
        owner_user_id=self._owner_user_id,
        failure_stage=stage,
        failure_code=code,
    )
```

Add nullable SQLite columns using the module’s existing idempotent schema initialization
pattern. Never persist `str(exc)`. At each graph boundary classify the caught exception and
call `observer.fail(stage=<fixed stage>, code=<classified code>)` exactly once.

- [ ] **Step 4: Verify lifecycle and API contracts**

Run: `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_junjichu_case_lifecycle.py tests/test_junjichu_cases_api.py tests/test_decrees_api.py -q`

Expected: PASS and HTTP response shape unchanged.

### Task 5: Offline regression gate and documentation

**Files:**
- Modify: `docs/product/tasks/2026-07-28-fix-decree-model-invocation.md`
- Modify: `docs/failures/2026-07-28-decree-bare-opinion-false-acceptance.md`

**Interfaces:**
- Consumes all production/test interfaces from Tasks 1–4.
- Produces fresh verification evidence while keeping task status `In Progress`.

- [ ] **Step 1: Run expanded backend regression**

Run: `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_synthesis_failures.py tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_junjichu_agent.py tests/test_chancellor_graph.py tests/test_decrees_api.py tests/test_junjichu_case_lifecycle.py tests/test_junjichu_cases_api.py tests/test_shiguan_adopted_evidence.py -q`

Expected: all selected tests PASS.

- [ ] **Step 2: Run frontend BFF and study tests**

Run: `cd frontend && npm test`

Expected: PASS using the repository’s configured test runner.

- [ ] **Step 3: Run static and harness gates**

Run: `cd backend && .\.venv\Scripts\python.exe -m ruff check app tests`

Expected: `All checks passed!`

Run: `node scripts/check_harness.mjs`

Expected: PASS.

Run: `git diff --check`

Expected: exit 0; line-ending warnings are allowed, whitespace errors are not.

- [ ] **Step 4: Record evidence without claiming completion**

Add exact command results, test counts, diagnostic behavior, and remaining 10-run gate to
the existing task and failure memory. Keep `## Status` as `In Progress`.

### Task 6: Real `/study` ten-consecutive-success acceptance

**Files:**
- Modify after evidence: `docs/product/tasks/2026-07-28-fix-decree-model-invocation.md`
- Modify after evidence: `docs/failures/2026-07-28-decree-bare-opinion-false-acceptance.md`

**Interfaces:**
- Consumes the running frontend session, authenticated owner session, backend HTTP endpoint, Junjichu case store, and Shiguan archive store.
- Produces an acceptance ledger containing only run number, HTTP status, structural booleans/counts, case terminal status, archive count delta, and timestamps.

- [ ] **Step 1: Restart and identify exact processes**

Before restarting, resolve port listeners and verify executable path/command line. Restart
only the expected backend/frontend processes, then require backend `/health` 200 and the
frontend study route reachable. Do not print environment variables or credentials.

- [ ] **Step 2: Capture owner-scoped baseline counts**

Using the authenticated browser session, record only the current owner’s Shiguan `REPLY`
count and Junjichu case count. Do not print session IDs, user IDs, decree text from storage,
archive bodies, or evidence bodies.

- [ ] **Step 3: Execute serial full-flow submissions**

Submit the exact decree:

```text
我要招两个人做量化炒股，然后让他们去开发
```

For each run require:

```python
assert response.status == 200
assert body["routeType"] == "multi"
assert body["departments"] == ["吏部", "工部"]
assert len(body["ministryOpinions"]) == 2
assert all(item["bureauOpinions"] and item["opinion"].strip() for item in body["ministryOpinions"])
assert body["councilVerdict"].strip()
assert body["finalVerdict"].strip()
assert len(body["recommendations"]) == 3
assert len({item.strip() for item in body["recommendations"]}) == 3
```

After each HTTP success, require exactly one new owner-scoped `REPLY` and one corresponding
completed Junjichu case. Run serially. On the first failure, stop immediately, preserve only
the sanitized stage/code evidence, and return to Task 1–4 as indicated; the next acceptance
attempt starts at zero.

- [ ] **Step 4: Require at least 10 consecutive successes**

Do not mark complete at 9/10. Continue until the same final code revision has at least 10
consecutive full-flow successes with no intervening failure.

- [ ] **Step 5: Re-run offline gates after the successful sequence**

Run the expanded backend regression, frontend tests, Ruff, Harness, and `git diff --check`
again. Expected: all PASS.

- [ ] **Step 6: Update acceptance status**

Only after Steps 1–5 pass, change the product task to `Accepted` and record:

- exact consecutive count,
- code revision/worktree state,
- structural pass totals,
- owner-scoped archive delta,
- completed case delta,
- offline command results,
- any remaining provider-availability limitation.

Do not include response bodies, archive bodies, credentials, tokens, or private identifiers.
