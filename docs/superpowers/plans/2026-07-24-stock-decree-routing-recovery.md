# Stock Decree Routing Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an explicit stock-price decree reliably reach 户部·投资司, request missing market data through `NEEDS_DATA`, and recover through Jinyiwei instead of returning the generic Chancellor 502.

**Architecture:** Keep the LLM as the general router, but apply one provider-neutral policy module at the Chancellor and ministry boundaries for explicit market-quote intents. Keep the evidence protocol fail-closed, adding exactly one static correction turn only when a first `READY` response is rejected as `unsupported_factual_dependency`.

**Tech Stack:** Python 3.11+, LangGraph, Pydantic, pytest, Ruff, Node.js harness checks.

## Global Constraints

- Follow `AGENTS.md`, `backend/AGENTS.md`, and the approved design in `docs/superpowers/specs/2026-07-24-stock-decree-routing-recovery-design.md`.
- Preserve all existing uncommitted local-OAuth and market-freshness changes.
- Do not access the real network or credentials during normal tests.
- Do not stage, commit, push, merge, deploy, or remove this harness-owned worktree without separate authorization.
- Do not add Tencent, WeStock, security codes, endpoints, or provider-specific branches to generic routing or evidence code.
- The market guard applies only when both a security-market term and a quote-query term are present.
- Non-market routing and bureau selection must remain byte-for-byte equivalent at their public return boundaries.
- Protocol correction is allowed once only for `unsupported_factual_dependency`; all other failures keep current fail-closed behavior.
- The correction message must not include the rejected model response, exception text, evidence body, headers, account data, or credentials.
- Codex-only: do not use Claude CLI, Claude runner, or `gstack-claude`.

---

### Task 1: Provider-neutral market-intent policy

**Files:**
- Create: `backend/app/agents/market_intent.py`
- Create: `backend/tests/test_market_intent.py`
- Create: `docs/product/tasks/2026-07-24-stock-decree-routing-recovery.md`

**Interfaces:**
- Produces: `is_market_quote_intent(text: str) -> bool`
- Produces: `normalize_market_quote_route(*, decree_text: str, route_type: str, rationale: str, departments: Sequence[str]) -> tuple[str, str, tuple[str, ...]]`
- Produces: `prioritize_market_quote_bureaus(*, department: str, decree_text: str, bureaus: Sequence[str]) -> tuple[str, ...]`
- The product task is `Ready`, references the approved design, and restricts implementation to the files in this plan.

- [ ] **Step 1: Write the failing policy tests**

```python
def test_stock_price_intent_normalizes_to_single_household_ministry() -> None:
    assert normalize_market_quote_route(
        decree_text="帮我看看比亚迪的股票价格",
        route_type="multi",
        rationale="模型误判",
        departments=("吏部", "工部"),
    ) == (
        "single",
        "证券行情查询由户部办理",
        ("户部",),
    )


@pytest.mark.parametrize(
    "text",
    ["调整产品价格", "安排人员投资培训", "查看公司新闻", "评估年度预算"],
)
def test_non_market_text_does_not_match(text: str) -> None:
    assert not is_market_quote_intent(text)


def test_market_bureau_policy_puts_investment_first_without_duplicates() -> None:
    assert prioritize_market_quote_bureaus(
        department="户部",
        decree_text="查询 BYD stock price",
        bureaus=("预算司", "投资司"),
    ) == ("投资司", "预算司")
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_market_intent.py -q
```

Expected: collection fails because `app.agents.market_intent` does not exist.

- [ ] **Step 3: Implement the smallest policy module**

Use immutable term groups and pure functions:

```python
_SECURITY_TERMS = ("股票", "股价", "证券", "行情", "stock", "share", "ticker")
_QUOTE_TERMS = ("价格", "现价", "报价", "多少", "quote", "price")


def is_market_quote_intent(text: str) -> bool:
    normalized = text.casefold()
    return any(term in normalized for term in _SECURITY_TERMS) and any(
        term in normalized for term in _QUOTE_TERMS
    )
```

`normalize_market_quote_route` returns its original values unchanged when the predicate is false. `prioritize_market_quote_bureaus` changes only 户部 market intents, removes any existing `投资司`, and prepends it once.

- [ ] **Step 4: Create the Ready product task**

Copy the repository template headings exactly. Record the 2026-07-24 user confirmation, the reproduced exception chain, the approved design path, the allowed files from this plan, TDD requirements, Codex-only mode, and pending implementation/acceptance fields.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_market_intent.py -q
.venv\Scripts\python.exe -m ruff check app/agents/market_intent.py tests/test_market_intent.py
cd ..
git diff --check -- backend/app/agents/market_intent.py backend/tests/test_market_intent.py docs/product/tasks/2026-07-24-stock-decree-routing-recovery.md
```

Expected: all commands exit zero.

---

### Task 2: Chancellor route normalization

**Files:**
- Modify: `backend/app/agents/chancellor/graph.py`
- Modify: `backend/tests/test_chancellor_graph.py`

**Interfaces:**
- Consumes: `normalize_market_quote_route(...)` from Task 1.
- Preserves: current strict JSON/schema/known-ministry validation before applying the market policy.
- Produces: the normalized state used by the existing `single`/`multi` LangGraph conditional edge.

- [ ] **Step 1: Write failing graph tests**

Add a test whose first fake-model response is a structurally valid wrong route:

```python
def test_market_quote_decree_overrides_valid_but_wrong_model_route() -> None:
    # Monkeypatch graph_module.invoke_ministry_agent with a fixed valid
    # MinistryOpinion so this task tests only the Chancellor branch choice.
    responses = iter([
        _multi_route_response(["吏部", "工部"]),
        _final_response("行情回奏"),
    ])
    result = build_chancellor_graph(
        chat_model=lambda _messages: next(responses)
    ).invoke({"decree_text": "帮我看看比亚迪的股票价格"})
    assert result["route_type"] == "single"
    assert result["departments"] == ["户部"]
    assert "军机处（召集）" not in result["processing_path"]
```

Also add a non-market regression proving a valid multi route remains multi and keeps the selected departments.

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_chancellor_graph.py -k "market_quote_decree or non_market_route" -q
```

Expected: the market test follows the model's wrong multi route and fails.

- [ ] **Step 3: Apply the policy after existing structural validation**

In `_decide_route`, after all current `route_type`, rationale, department, duplicate, and cardinality checks pass:

```python
route_type, rationale, normalized_departments = normalize_market_quote_route(
    decree_text=state["decree_text"],
    route_type=route_type,
    rationale=rationale.strip(),
    departments=departments,
)
departments = list(normalized_departments)
```

Do not normalize malformed JSON or invalid/unknown department responses; those continue to fail closed.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_chancellor_graph.py -q
.venv\Scripts\python.exe -m ruff check app/agents/chancellor/graph.py tests/test_chancellor_graph.py
```

Expected: all selected tests pass.

---

### Task 3: Investment Bureau capability and selection guard

**Files:**
- Modify: `backend/app/agents/bureaus/profiles.py`
- Modify: `backend/app/agents/ministries/agent.py`
- Modify: `backend/tests/test_bureaus_agent.py`
- Modify: `backend/tests/test_ministries_agent.py`

**Interfaces:**
- Consumes: `prioritize_market_quote_bureaus(...)` from Task 1.
- Preserves: the ministry model's ordered selection for non-market decrees.
- Produces: an ordered bureau list with `投资司` exactly once at index zero for 户部 market intents.

- [ ] **Step 1: Write failing profile and ministry tests**

```python
def test_investment_bureau_declares_market_quote_capability() -> None:
    profile = next(
        item for item in bureau_profiles_for("户部") if item.bureau == "投资司"
    )
    assert "证券行情" in profile.responsibilities
    assert "股票价格" in profile.responsibilities


def test_household_market_decree_prepends_investment_bureau() -> None:
    # The selector deliberately returns only 预算司.
    # Capture bureau invocation order and assert it starts with 投资司, then 预算司.
```

Add a non-market test showing `["预算司"]` remains exactly `["预算司"]`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_bureaus_agent.py tests/test_ministries_agent.py -k "market_quote_capability or market_decree_prepends or non_market_bureau" -q
```

Expected: the profile lacks the new responsibilities and the selector invokes 预算司 first.

- [ ] **Step 3: Implement the minimal capability and guard**

Change only the 投资司 profile responsibilities to:

```python
("投资评审", "收益测算", "风险分析", "退出路径", "证券行情", "股票价格", "市场数据", "估值观察")
```

After the existing ministry selection has passed schema and membership validation:

```python
selected_bureaus = list(
    prioritize_market_quote_bureaus(
        department=department,
        decree_text=decree_text,
        bureaus=selected_bureaus,
    )
)
```

- [ ] **Step 4: Verify GREEN**

Run the two full files plus scoped Ruff. Expected: all tests and Ruff pass.

---

### Task 4: One bounded unsupported-dependency correction

**Files:**
- Modify: `backend/app/agents/evidence_protocol.py`
- Modify: `backend/tests/test_agent_evidence_protocol.py`

**Interfaces:**
- Consumes: the existing `EvidenceProtocolError("unsupported_factual_dependency")`.
- Produces: `_unsupported_dependency_correction(node_id: str) -> Message`.
- Preserves: one investigation claim, one investigation/resume turn, binding validation, deadline checks, and all existing fallback reasons.

- [ ] **Step 1: Write the failing correction-success test**

Provide a three-response model sequence:

1. `READY` with an uncited current-price opinion that triggers `unsupported_factual_dependency`;
2. valid `NEEDS_DATA` for `MARKET_QUOTE`;
3. valid cited `READY` after the fake coordinator returns evidence.

Assert:

```python
assert result == {"opinion": "有证据的行情意见"}
assert len(model_calls) == 3
assert "NEEDS_DATA" in model_calls[1][-1]["content"]
assert rejected_ready_body not in model_calls[1][-1]["content"]
assert coordinator.calls[0][0].required_facts[0].category is FactCategory.MARKET_QUOTE
```

- [ ] **Step 2: Write failing fail-closed tests**

Add separate tests proving:

- corrected `READY` is rejected and total calls equal two;
- `model_unavailable`, `response_invalid`, `adoption_invalid`, and `evidence_binding_invalid` do not receive a correction call;
- a second `NEEDS_DATA` after investigation keeps the existing fallback and does not trigger correction;
- the correction message contains no rejected response, evidence pack, exception text, token-like marker, or provider name.

- [ ] **Step 3: Verify RED**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_agent_evidence_protocol.py -k "unsupported_dependency_correction" -q
```

Expected: the first unsupported `READY` raises immediately and only one model call is recorded.

- [ ] **Step 4: Implement one exact correction branch**

Wrap only the first `_parse_ready(...)` call:

```python
try:
    ready = _parse_ready(first, legacy_parser, session, node_id, original_messages)
except EvidenceProtocolError as exc:
    if str(exc) != "unsupported_factual_dependency":
        raise
    corrected = _call_and_parse(
        chat_model,
        [*original_messages, _unsupported_dependency_correction(node_id)],
    )
    if not _is_needs_data(corrected):
        raise EvidenceProtocolError("unsupported_factual_dependency") from None
    first = corrected
    ready = None
```

The static correction message identifies only `node_id`, repeats the existing `NEEDS_DATA` schema requirement, and explicitly forbids `READY`. Never append the rejected response.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_agent_evidence_protocol.py -q
.venv\Scripts\python.exe -m ruff check app/agents/evidence_protocol.py tests/test_agent_evidence_protocol.py
```

Expected: all tests and Ruff pass.

---

### Task 5: End-to-end regression, ADR, and operating contract

**Files:**
- Modify: `backend/tests/test_chancellor_graph.py`
- Create: `docs/decisions/0023-market-decree-routing-and-bounded-protocol-correction.md`
- Modify: `ARCHITECTURE.md`
- Modify: `backend/AGENTS.md`
- Modify: `scripts/check_harness.mjs`
- Modify: `docs/product/tasks/2026-07-24-stock-decree-routing-recovery.md`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: one offline graph regression covering the complete path and an ADR with exact headings `Status`, `Context`, `Decision`, `Consequences`, and `Verification`.

- [ ] **Step 1: Add the offline graph regression**

Use an injected sequenced model and fake evidence coordinator/session. Begin with a wrong but structurally valid Chancellor route, select only 投资司 at the ministry boundary, return an unsupported `READY`, then return `NEEDS_DATA`, a resolved market evidence pack, cited `READY`, ministry synthesis, and finalization. Task 3's focused test independently proves that a selector omission is corrected; keeping the integration selector to one bureau makes the expected full path unambiguous.

Assert:

```python
assert result["route_type"] == "single"
assert result["departments"] == ["户部"]
assert result["processing_path"] == [
    "上书房",
    "丞相（首次分流）",
    "户部",
    "户部·投资司",
    "锦衣卫（调查）",
    "户部（部级补充）",
    "丞相（最终汇总）",
]
assert result["evidence_snapshot"].adopted_evidence_ids
```

The evidence item must use `SourceType.MCP`, `FactCategory.MARKET_QUOTE`, and an actual market `as_of` older than `retrieved_at`, proving the existing latest-available policy remains active.

- [ ] **Step 2: Verify RED then GREEN**

Run the single test before completing its fixtures/integration and confirm it fails on the old path. Finish only the minimum integration needed, then run:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_chancellor_graph.py tests/test_ministries_agent.py tests/test_bureaus_agent.py tests/test_agent_evidence_protocol.py -q
```

Expected: all selected tests pass.

- [ ] **Step 3: Record ADR 0023 and update operating docs**

ADR 0023 records:

- LLM general routing remains;
- explicit market-quote intent is normalized to 户部 and prioritizes 投资司;
- the policy is provider-neutral and narrow;
- unsupported first `READY` gets exactly one static correction;
- the single-route worst-case model-call ceiling changes from 11 to 12;
- all evidence, network, credential, and read-only boundaries remain unchanged.

Update `ARCHITECTURE.md` and `backend/AGENTS.md` with the same behavior. Add ADR 0023 and `backend/app/agents/market_intent.py` to the harness required-file list. Update the product task's implementation report with actual evidence only.

- [ ] **Step 4: Run all offline gates**

```powershell
cd backend
Remove-Item Env:JINYIWEI_EXTERNAL_NETWORK_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:JINYIWEI_MCP_CREDENTIAL_SOURCE -ErrorAction SilentlyContinue
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m ruff check .
cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: every command exits zero; normal tests do not access network or credentials.

- [ ] **Step 5: Scan for secrets and provider leakage**

Scan changed generic policy/protocol files for `westock`, `tencent`, endpoints, OAuth callback values, bearer/token literals, and provider branches. Expected: zero provider-specific matches in generic code and zero credential/callback values anywhere outside ignored runtime credential storage.

- [ ] **Step 6: Restart and run bounded live acceptance**

Only after offline gates pass, preserve the already approved read-only runtime mode:

```powershell
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
$env:JINYIWEI_MCP_CREDENTIAL_SOURCE = "local"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Submit exactly one decree, “帮我看看比亚迪的股票价格”. Confirm:

- HTTP 200 instead of the generic 502;
- processing path contains `户部`, `户部·投资司`, and `锦衣卫（调查）`;
- the newest investigation has nonzero adopted evidence;
- MCP audit contains only approved read-only search/quote or minute tools;
- evidence keeps the real market `as_of`;
- logs contain no prompt/response body, token, header, account information, or callback value.

If DeepSeek is unavailable, do not loop retries; report live acceptance as externally blocked while retaining offline evidence.

- [ ] **Step 7: Independent self-review and handoff**

Review the complete diff against the approved design, update the product task acceptance fields, and report the exact uncommitted file set. Do not stage, commit, push, merge, or clean the worktree.

## Self-Review

- Spec coverage: explicit market routing, Investment Bureau priority, one bounded correction, fail-closed exclusions, call-budget update, offline/live verification, and non-goals are all assigned.
- Placeholder scan: no deferred-work marker or undefined neighboring interface remains.
- Type consistency: all tasks use the same three tuple-returning policy functions and the existing `EvidenceProtocolError` contract.
- Scope: the Shiguan migration warning, generic rule engines, and any write-capable market tools remain excluded.
