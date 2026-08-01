# Real-model Structured Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every decree model boundary fail-closed while allowing at most three schema-validated attempts and exposing only a stable failing-stage code.

**Architecture:** Add one backend-only strict structured invocation helper that calls an injected chat model, validates the complete response, and appends a schema-specific correction instruction after a validation failure. Bureau, ministry-routing, and Chancellor finalization callers opt into the helper without changing their public interfaces, prompts, authority checks, routing rules, evidence flow, or HTTP response bodies.

**Tech Stack:** Python 3.12, FastAPI, LangGraph, Pydantic, pytest, Ruff.

## Global Constraints

- ADR 0028 remains unchanged: `/study` is the only decree entry, MCP remains bureau-only through Evidence Protocol, and one successful decree archives exactly one `REPLY`.
- A structured model node gets at most three total model calls; provider exceptions are never retried.
- Every attempt must pass the existing strict parser and the node's full schema validator.
- Raw model output, prompts, credentials, exception text, and MCP details must never enter audit logs.
- No frontend files or public API contracts change.
- Acceptance requires at least ten successful real browser decrees, not ten offline test repetitions.

---

### Task 1: Strict structured invocation helper

**Files:**
- Create: `backend/app/agents/structured_invocation.py`
- Test: `backend/tests/test_structured_invocation.py`

**Interfaces:**
- Consumes: `DeepSeekChatModel`, a message list, and `validator(raw: object) -> T`.
- Produces: `invoke_strict_structured(chat_model, messages, validator, *, stage, max_attempts=3) -> T` and sanitized `StructuredInvocationError` with `failure_stage` and stable `failure_code`.

- [ ] **Step 1: Write the failing tests**

```python
def test_retries_two_schema_failures_then_returns_validated_value():
    model = SequenceModel(["not-json", '{"wrong":true}', '{"opinion":"ok"}'])
    assert invoke_strict_structured(model, MESSAGES, validate_opinion, stage="bureau") == "ok"
    assert len(model.calls) == 3

def test_provider_failure_is_not_retried():
    model = RaisingModel(RuntimeError("secret provider detail"))
    with pytest.raises(StructuredInvocationError) as caught:
        invoke_strict_structured(model, MESSAGES, validate_opinion, stage="bureau")
    assert caught.value.failure_code == "provider_unavailable"
    assert len(model.calls) == 1
    assert "secret" not in str(caught.value)

def test_exhausted_schema_retries_are_sanitized():
    model = SequenceModel(["bad", "bad", "bad"])
    with pytest.raises(StructuredInvocationError) as caught:
        invoke_strict_structured(model, MESSAGES, validate_opinion, stage="bureau")
    assert caught.value.failure_code == "schema_invalid"
    assert caught.value.failure_stage == "bureau"
```

- [ ] **Step 2: Run RED**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_structured_invocation.py -q`

Expected: FAIL because `app.agents.structured_invocation` does not exist.

- [ ] **Step 3: Implement the minimal helper**

The helper must clone the message list, make one initial call, and only after validator failure append a system correction that says to return one strict JSON object satisfying the original schema. It must retry until `max_attempts` is exhausted, preserve the last validation exception as `__cause__`, and wrap provider exceptions immediately without retry.

- [ ] **Step 4: Run GREEN**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_structured_invocation.py -q`

Expected: all tests PASS.

### Task 2: Adopt the helper at decree execution nodes

**Files:**
- Modify: `backend/app/agents/bureaus/agent.py`
- Modify: `backend/app/agents/ministries/agent.py`
- Modify: `backend/app/agents/chancellor/graph.py`
- Modify: `backend/app/agents/junjichu/agent.py`
- Test: `backend/tests/test_bureaus_agent.py`
- Test: `backend/tests/test_ministries_agent.py`
- Test: `backend/tests/test_chancellor_graph.py`
- Test: `backend/tests/test_junjichu_agent.py`

**Interfaces:**
- Preserve every existing public function signature and result schema.
- Translate `StructuredInvocationError` into each package's existing sanitized invocation error while copying only `failure_stage`.

- [ ] **Step 1: Add one RED test per node class**

Each test injects two invalid structured responses followed by one valid response and asserts the existing public function succeeds after exactly three calls. Add an exhaustion test asserting the existing sanitized exception and no raw response leakage.

- [ ] **Step 2: Run RED**

Run the four targeted test files with `-q`; expect the new retry tests to fail at one model call.

- [ ] **Step 3: Replace local one-shot parse blocks with the helper**

Keep deterministic routing shortcuts, evidence protocol, required-bureau validation, local degradation, and final response construction unchanged.

- [ ] **Step 4: Run GREEN**

Run the four targeted test files with `-q`; expect all tests PASS.

### Task 3: Stable runtime audit failure stage

**Files:**
- Modify: `backend/app/agents/chancellor_runtime/agent.py`
- Modify: `backend/app/agents/chancellor_runtime/models.py`
- Test: `backend/tests/test_chancellor_runtime_agent.py`

**Interfaces:**
- Add optional audit field `failure_stage: str | None` restricted to stable internal stage names.
- Never serialize exception messages or raw model content.

- [ ] **Step 1: Write RED tests** proving an execution error with `failure_stage="bureau"` emits that value and excludes a secret cause message.
- [ ] **Step 2: Run the targeted test and observe the expected missing-field failure.**
- [ ] **Step 3: Add the optional field and sanitized propagation.**
- [ ] **Step 4: Run the targeted test and observe PASS.**

### Task 4: Failure memory and full verification

**Files:**
- Create: `docs/failures/2026-07-31-real-model-structured-output-false-green.md`
- Modify: `docs/product/tasks/2026-07-31-single-chancellor-runtime-skills.md`

- [ ] **Step 1: Record the real-browser 502, stale-process issue, schema non-determinism, prevention, detection, and evidence.**
- [ ] **Step 2: Run Ruff and the complete backend pytest suite.**
- [ ] **Step 3: Run all four harness commands and `git diff --check`.**
- [ ] **Step 4: Restart backend, verify `/health`, then use `/study` to complete at least ten real decrees.**
- [ ] **Step 5: For every browser run verify `DRAFT_READY`, successful reply, processing path, and exactly one new current-owner `REPLY`; any failure resets acceptance to not-passed.**
- [ ] **Step 6: Update the product task with exact command counts, browser run count, failures, model costs caveat, and remaining risk.**
