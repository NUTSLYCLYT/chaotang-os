# Bureau Page Evidence Envelope Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the conflicting bare-opinion contract from page evidence calls while preserving direct bureau calls and strict evidence validation.

**Architecture:** The bureau prompt builder exposes an explicit output mode so each model call receives exactly one output contract. `AgentEvidenceSession` tracks bare-envelope corrections by bureau `node_id`, while all investigation, recovery, deadline, validation, and archive behavior remains unchanged.

**Tech Stack:** Python 3.11+, Pydantic, pytest, ruff, FastAPI backend, existing DeepSeek chat-model adapter.

## Global Constraints

- Preserve ADR 0028: only bureau nodes may investigate, and one decree archives exactly one `REPLY`.
- Direct bureau calls continue to return and parse `{"opinion":"..."}`.
- Evidence-session calls accept only strict `READY/NEEDS_DATA` envelopes.
- Do not relax factual-claim, evidence-binding, adopted-ID, investigation, recovery, extraction, or deadline checks.
- Do not add API fields, external sources, dependencies, or frontend changes.
- Do not commit, push, publish, or deploy without separate explicit authorization.

---

### Task 1: Make the bureau prompt output contract mode-aware

**Files:**
- Modify: `backend/app/agents/bureaus/prompts.py`
- Test: `backend/tests/test_bureaus_agent.py`

**Interfaces:**
- Consumes: `department: str`, `bureau: str`.
- Produces: `bureau_system_prompt(department: str, bureau: str, *, evidence_session: bool = False) -> str`.
- Compatibility: omitting `evidence_session` preserves the direct-call prompt exactly.

- [ ] **Step 1: Write failing prompt-contract tests**

Add tests that assert the default prompt contains the bare opinion schema and no evidence envelope, while the evidence prompt excludes the bare schema:

```python
def test_direct_bureau_prompt_contains_only_bare_opinion_contract() -> None:
    prompt = bureau_system_prompt("工部", "技术司")
    assert '{"opinion":"<non-empty opinion>"}' in prompt
    assert '"status":"READY"' not in prompt


def test_evidence_bureau_prompt_excludes_bare_opinion_contract() -> None:
    prompt = bureau_system_prompt(
        "工部",
        "技术司",
        evidence_session=True,
    )
    assert '{"opinion":"<non-empty opinion>"}' not in prompt
    assert "Return exactly one JSON object" not in prompt
```

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_bureaus_agent.py -k "direct_bureau_prompt_contains_only or evidence_bureau_prompt_excludes" -v
```

Expected: the evidence-mode call fails because the keyword argument is not yet accepted.

- [ ] **Step 3: Implement the minimal mode-aware prompt**

In `prompts.py`, isolate the existing final output instruction and include it only in direct mode:

```python
def bureau_system_prompt(
    department: str,
    bureau: str,
    *,
    evidence_session: bool = False,
) -> str:
    # Keep the existing identity, capability, guardrail, and safety sections.
    sections = [identity_section, capability_section, guardrail_section]
    if not evidence_session:
        sections.append(
            'Return exactly one JSON object: '
            '{"opinion":"<non-empty opinion>"}.'
        )
    return "\n\n".join(sections)
```

Use the file's current local variable names and preserve section ordering; do not restructure the capability registry.

- [ ] **Step 4: Run prompt and capability tests and verify GREEN**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_bureaus_agent.py backend/tests/test_bureau_capabilities.py -v
```

Expected: PASS.

### Task 2: Select the evidence prompt before the first page model call

**Files:**
- Modify: `backend/app/agents/bureaus/agent.py`
- Test: `backend/tests/test_bureaus_agent.py`

**Interfaces:**
- Consumes: optional `evidence_session: AgentEvidenceSession | None`.
- Produces: the first system message uses `bureau_system_prompt(..., evidence_session=True)` only when a session is present.
- Preserves: direct invocation message shape and `BureauOpinion` parsing.

- [ ] **Step 1: Strengthen the existing session-enabled prompt test**

Update `test_session_enabled_bureau_alone_receives_evidence_protocol_prompt` so the captured first system message must contain the evidence protocol and must not contain the bare schema:

```python
system_content = captured_messages[0]["content"]
assert "READY" in system_content
assert "NEEDS_DATA" in system_content
assert '{"opinion":"<non-empty opinion>"}' not in system_content
```

Keep the direct-call test assertion that its system message equals
`bureau_system_prompt("刑部", "合同司")`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_bureaus_agent.py::test_session_enabled_bureau_alone_receives_evidence_protocol_prompt -v
```

Expected: FAIL because the current evidence system message still embeds the bare-opinion requirement.

- [ ] **Step 3: Build the correct base prompt once**

Change the prompt selection in `invoke_bureau_agent`:

```python
system_prompt = bureau_system_prompt(
    department,
    bureau,
    evidence_session=evidence_session is not None,
)
```

Continue passing that prompt to `invoke_bureau_with_evidence`; do not change its evidence-protocol suffix, fallback, identity checks, or response parser.

- [ ] **Step 4: Run bureau-agent tests and verify GREEN**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_bureaus_agent.py -v
```

Expected: PASS.

### Task 3: Isolate envelope-correction claims by bureau node

**Files:**
- Modify: `backend/app/agents/evidence_protocol.py`
- Test: `backend/tests/test_agent_evidence_protocol.py`

**Interfaces:**
- Replaces: `claim_envelope_correction() -> bool`.
- Produces: `claim_envelope_correction(node_id: str) -> bool`.
- Semantics: the first claim for each valid bureau node returns `True`; later claims for the same node return `False`; access remains lock-protected.

- [ ] **Step 1: Write the failing per-node budget test**

Replace the old global-budget expectation with:

```python
def test_envelope_correction_budget_is_once_per_bureau_node() -> None:
    session = make_session()
    first = bureau_node_id("工部", "技术司")
    second = bureau_node_id("工部", "质量司")

    assert session.claim_envelope_correction(first) is True
    assert session.claim_envelope_correction(first) is False
    assert session.claim_envelope_correction(second) is True
    assert session.claim_envelope_correction(second) is False
```

Update the atomic concurrency test to call one `node_id` 64 times and assert exactly one `True`. Add a second-node assertion to prove isolation.

- [ ] **Step 2: Run focused budget tests and verify RED**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_agent_evidence_protocol.py -k "envelope_correction_budget or envelope_and_protocol_correction_claims" -v
```

Expected: FAIL because the current method accepts no node ID and uses one global boolean.

- [ ] **Step 3: Implement a lock-protected per-node set**

In `AgentEvidenceSession.__init__`:

```python
self._envelope_correction_nodes: set[str] = set()
```

Replace the method with:

```python
def claim_envelope_correction(self, node_id: str) -> bool:
    with self._lock:
        if node_id in self._envelope_correction_nodes:
            return False
        self._envelope_correction_nodes.add(node_id)
        return True
```

At the bare-opinion handling call site:

```python
if not session.claim_envelope_correction(node_id):
    return _fallback(fallback, "model_synthesis_invalid")
```

Do not change `_protocol_correction_claimed`, investigation counters, recovery counters, or deadlines.

- [ ] **Step 4: Update existing test call sites**

For tests that intentionally pre-consume the budget, pass the same bureau node later used by `invoke_bureau_with_evidence`. For concurrency tests, pass a fixed valid bureau node. Do not add a compatibility overload because silent global behavior would reintroduce ambiguity.

- [ ] **Step 5: Run the evidence protocol suite and verify GREEN**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_agent_evidence_protocol.py -v
```

Expected: PASS.

### Task 4: Regression and real page verification

**Files:**
- Verify: `backend/app/agents/bureaus/prompts.py`
- Verify: `backend/app/agents/bureaus/agent.py`
- Verify: `backend/app/agents/evidence_protocol.py`
- Verify: `backend/tests/test_bureaus_agent.py`
- Verify: `backend/tests/test_agent_evidence_protocol.py`
- Verify: `docs/failures/2026-07-29-real-bureau-output-envelope-conflict.md`

**Interfaces:**
- Consumes: local backend on `127.0.0.1:8000`, frontend on `localhost:3000`, configured real DeepSeek adapter.
- Produces: fresh offline and page-level evidence that the contract conflict is gone.

- [ ] **Step 1: Run backend lint and all backend tests**

Run:

```powershell
backend\.venv\Scripts\python.exe -m ruff check backend
backend\.venv\Scripts\python.exe -m pytest backend/tests -q
```

Expected: both commands exit 0.

- [ ] **Step 2: Run repository harness checks**

Run:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
git diff --check
```

Expected: all commands exit 0. Existing unrelated user changes remain untouched.

- [ ] **Step 3: Restart local services from the modified source if needed**

Confirm `GET http://127.0.0.1:8000/health` and `http://localhost:3000/study` load. If an existing backend process does not auto-reload, stop only that exact workspace process and restart it with:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Run the command from `backend/`. Do not expose either service beyond loopback.

- [ ] **Step 4: Test one real single-bureau decree through `/study`**

Submit a decree whose requested work is fully normative and scoped to one known bureau. Verify:

- the processing path includes the selected bureau;
- the bureau produces a visible opinion or a stable evidence-specific failure;
- no failure is attributable to the conflicting bare-opinion contract;
- exactly one `REPLY` is archived.

- [ ] **Step 5: Test one real multi-bureau decree through `/study`**

Submit a decree selecting at least two bureaus. Verify each bureau receives its own input/output cycle and that one bureau's correction opportunity does not consume another's. Confirm the finalizer completes when all required opinions are valid and the decree archives exactly one `REPLY`.

- [ ] **Step 6: Self-review the final diff**

Run:

```powershell
git diff -- backend/app/agents/bureaus/prompts.py backend/app/agents/bureaus/agent.py backend/app/agents/evidence_protocol.py backend/tests/test_bureaus_agent.py backend/tests/test_agent_evidence_protocol.py docs/superpowers docs/failures
```

Check that:

- evidence mode has one output contract;
- direct mode remains compatible;
- strict validation is unchanged;
- only per-node envelope correction state changed;
- no secret, runtime database, account data, or browser artifact was added.

### Task 5: Recognize explicit normative obligation clauses

**Files:**
- Modify: `backend/app/agents/evidence_protocol.py`
- Test: `backend/tests/test_agent_evidence_protocol.py`

**Interfaces:**
- Consumes: individual opinion clauses passed to `_is_normative_proposal`.
- Produces: explicit obligation/prohibition clauses are normative without weakening observation and evidence checks.
- Preserves: all READY envelope, factual-claim, adopted-ID, evidence-binding, investigation, recovery, and deadline behavior.

- [ ] **Step 1: Add failing acceptance tests**

Add a parameterized test using the real READY parser path:

```python
@pytest.mark.parametrize(
    "opinion",
    [
        "必须在方案设计完成后进行技术评审",
        "不得在验收通过前发布",
        "不应以口头承诺替代书面验收依据",
        "严禁绕过质量门禁",
        "禁止在缺陷未关闭时进入下一阶段",
        "未经技术司评审不得进入详细设计阶段",
    ],
)
def test_ready_allows_explicit_normative_obligations(opinion: str) -> None:
    result = invoke_ready_without_evidence(opinion)
    assert result.opinion == opinion
```

Keep or add rejection coverage for:

```python
@pytest.mark.parametrize(
    "opinion",
    [
        "当前必须返工的项目有三个",
        "最新数据显示必须提高预算",
        "根据公告不得继续交易",
        "今日已完成全部质量验收",
    ],
)
def test_normative_words_cannot_hide_observed_facts(opinion: str) -> None:
    with pytest.raises(EvidenceProtocolError):
        invoke_ready_without_evidence(opinion)
```

Use the existing local test helpers and exact exception expectations instead of creating production-only hooks.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_agent_evidence_protocol.py -k "explicit_normative_obligations or normative_words_cannot_hide_observed_facts" -v
```

Expected: obligation cases fail under the current narrow prefix pattern, while observation cases remain rejected.

- [ ] **Step 3: Extend only the normative lead pattern**

Update `_NORMATIVE_LEAD_PATTERN` so its Chinese branch includes:

```python
r"^(?:建议|应当|应该|宜|可以|可(?:将)?|可考虑|有必要|须|需要|必须|不得|不应(?:当)?|严禁|禁止)"
r"|^未经.{1,80}不得"
```

Do not alter `_EPISTEMIC_PATTERN`, `_OBSERVATION_ASSERTION_PATTERN`,
`_OBJECTIVE_FACT_TERM_PATTERN`, `_OBSERVED_VALUE_OR_TIME_PATTERN`, or the order of checks in
`_is_normative_proposal`.

- [ ] **Step 4: Run focused and full evidence tests and verify GREEN**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_agent_evidence_protocol.py -k "explicit_normative_obligations or normative_words_cannot_hide_observed_facts" -v
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_agent_evidence_protocol.py -v
```

Expected: focused tests and the complete evidence protocol suite pass.

- [ ] **Step 5: Repeat full offline and real page verification**

Run backend ruff, all backend tests, harness checks, and `git diff --check` from Task 4. Restart only the loopback backend process if it is older than the modified source. Submit the same single-bureau and multi-bureau normative decrees through `/study`; confirm no bureau is degraded solely because its opinion uses the newly accepted obligation prefixes, and confirm each decree archives exactly one `REPLY`.
### Task 6: Require structured normative declarations

**Files:**
- Modify: `backend/app/agents/bureaus/agent.py`
- Modify: `backend/app/agents/evidence_protocol.py`
- Test: `backend/tests/test_bureaus_agent.py`
- Test: `backend/tests/test_agent_evidence_protocol.py`

**Interfaces:**
- Consumes: `READY.result.opinion` and `READY.result.factual_claims`.
- Produces: ordered `FactualClaim` declarations completely cover the opinion; each declaration may cover one or more contiguous clauses, and pure recommendations use `basis=NORMATIVE`.
- Preserves: the legacy parser still receives only `{"opinion": ...}` after validation.

- [ ] **Step 1: Write failing structured-contract tests**

Add tests through the real READY path that require claims for every opinion clause. Cover a valid numbered
imperative opinion plus failures for an empty list, a missing clause, an extra declaration, and a partial
text match.

```python
def test_nonempty_ready_requires_exact_claim_for_every_clause() -> None:
    with pytest.raises(EvidenceProtocolError, match="unsupported_factual_dependency"):
        _invoke(
            AgentEvidenceSession(coordinator=Coordinator()),
            lambda _messages: _ready("必须评审；不得绕过验收", factual_claims=[]),
        )


def test_structured_normative_claims_allow_imperative_and_numbered_clauses() -> None:
    opinion = "1. 设置评审门禁；2. 未经验收不得发布"
    claims = [
        normative_claim("1. 设置评审门禁"),
        normative_claim("2. 未经验收不得发布"),
    ]
    assert invoke_ready(opinion, claims) == {"opinion": opinion}
```

- [ ] **Step 2: Write failing fact-disguise tests**

Use `basis=NORMATIVE` and assert rejection for:

```python
[
    "必须对当前三个项目返工",
    "建议根据最新公告调整方案",
    "不得依据当前数据形成结论",
    "今日已完成全部验收",
]
```

Assert acceptance for:

```python
[
    "不得以口头承诺作为书面验收依据办理交付",
    "建议将测试覆盖率目标设为80%",
    "每个阶段设置书面准入条件",
]
```

- [ ] **Step 3: Verify RED**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_agent_evidence_protocol.py -k "structured_normative or nonempty_ready_requires or fact_disguise" -v
```

Expected: empty-declaration and imperative cases fail under the current lead-prefix classifier.

- [ ] **Step 4: Replace lead inference with exact structured coverage**

In `_has_unsupported_factual_dependency`, build normalized maps for opinion clauses and declarations and
require exact set equality. Reject duplicate normalized declarations before comparing. For each
`NORMATIVE` claim, call a focused `_normative_claim_contains_factual_assertion(claim.claim)` predicate.
The predicate rejects epistemic, observation, time-plus-count, objective-fact-plus-observed-value, and
causal-source wrapping signals; it does not require a sentence-leading recommendation keyword.

Keep USER_PROVIDED grounding and ARCHIVED/CITED evidence-binding checks unchanged.

- [ ] **Step 5: Update the evidence system prompt**

Change the `READY/NOT_REQUIRED` example in `_evidence_protocol_prompt` to include one complete
`NORMATIVE` declaration:

```json
{
  "status": "READY",
  "result": {
    "opinion": "<complete normative clause>",
    "factual_claims": [{
      "claim": "<same complete normative clause>",
      "basis": "NORMATIVE",
      "evidence_ids": [],
      "fact_key": null,
      "category": null,
      "subject": null
    }]
  },
  "adopted_evidence_ids": [],
  "fact_basis": "NOT_REQUIRED"
}
```

Explicitly state that declarations must provide complete ordered coverage, each declaration may cover one
or more contiguous clauses, and an empty list is invalid for a nonempty opinion. Update bureau prompt tests
to lock this contract.

- [ ] **Step 6: Run focused and complete protocol tests**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_agent_evidence_protocol.py -k "structured_normative or nonempty_ready_requires or fact_disguise" -v
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_bureaus_agent.py backend/tests/test_agent_evidence_protocol.py -v
```

Expected: all pass.

- [ ] **Step 7: Run full offline and real page verification**

Run backend ruff, all backend tests, all harness checks, and `git diff --check`. Restart the exact
loopback backend process so it loads the new source. Submit the established single-bureau and three-bureau
normative decrees through `/study`. Success requires visible bureau opinions without
`model_synthesis_invalid`, while unsupported external facts must still fail closed, and each decree must
archive exactly one `REPLY`.
