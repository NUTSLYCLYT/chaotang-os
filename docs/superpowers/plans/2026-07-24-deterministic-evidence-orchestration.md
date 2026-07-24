# Deterministic Evidence Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mainland A-share last-price decrees acquire canonical evidence deterministically and return a verified answer even when later model formatting fails.

**Architecture:** A provider-neutral fact-plan compiler recognizes the supported Mainland last-price slice and produces the only allowed `DataGapDraft`. The evidence protocol investigates that plan before asking a bureau model to write an opinion, then uses a deterministic evidence renderer if expression or synthesis nodes fail. Non-market decrees continue through the existing model-driven evidence protocol unchanged.

**Tech Stack:** Python 3.11+, FastAPI, LangGraph, Pydantic v2, pytest, Ruff, existing Jinyiwei coordinator/MCP contracts.

## Global Constraints

- Phase one only delivers Mainland China `LAST_PRICE`; news, statistics, encyclopedia and regulatory-file compilers are not implemented here.
- The canonical fact is exactly `MARKET_QUOTE + LAST_PRICE + CN + CNY + number`, with `data_scope = EXTERNAL_PUBLIC`.
- Shiguan remains first; only missing or stale material may fall through to an administrator-approved read-only MCP.
- Production code must not contain a company-to-provider-symbol literal map or provider-specific branching above `backend/app/jinyiwei/`.
- Explicit Hong Kong, United States, B-share or other overseas requests must not be silently converted into Mainland A-share requests.
- A deterministic answer may be rendered only from a verified, resolved current-evidence item; no evidence means no price.
- Existing credential, network, freshness, citation, source approval and evidence-freezing boundaries remain strict.
- Runtime databases, real credentials and private dotenv files must not be read or modified by offline tests.
- Real acceptance is read-only and may use only the already authorized model and MCP query path.
- This working tree is already dirty; preserve every unrelated user change.
- Do not stage, commit, push, deploy or migrate data without a new explicit user authorization.

---

### Task 1: Canonical Mainland Last-Price Fact Plan

**Files:**
- Create: `backend/app/agents/fact_plans.py`
- Create: `backend/app/agents/market_fact_plan.py`
- Create: `backend/tests/test_market_fact_plan.py`
- Modify: `backend/app/agents/market_intent.py`
- Modify: `backend/tests/test_market_intent.py`
- Modify: `backend/app/jinyiwei/instruments.py`
- Modify: `backend/tests/test_jinyiwei_instruments.py`

**Interfaces:**
- Consumes: `DataGapDraft`, `RequiredFact`, `FreshnessRequirement`, `FactCategory`, `DataScope`, `MarketMetric`, `extract_instrument_hints()`, `has_out_of_scope_market_hint()`.
- Produces:

```python
class FactPlanDisposition(StrEnum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    PLANNED = "PLANNED"
    REJECTED = "REJECTED"


@dataclass(frozen=True, slots=True)
class FactPlanResult:
    disposition: FactPlanDisposition
    draft: DataGapDraft | None = None
    source_scope: tuple[SourceType, ...] = ()
    reason: str | None = None


def compile_mainland_last_price_plan(
    *,
    decree_text: str,
    node_id: str,
    entity_extractor: Callable[[str], str | None] | None = None,
) -> FactPlanResult: ...
```

- `PLANNED` always contains one required fact with key `market_quote:last_price`.
- `PLANNED` always has `source_scope == (SourceType.SHIGUAN, SourceType.MCP)`.
- `REJECTED` reasons are limited to `market_out_of_scope`, `entity_ambiguous`, and `data_plan_invalid`.

- [ ] **Step 1: Write failing canonical-plan tests**

Add tests that assert the exact draft, not only individual hints:

```python
def test_byd_price_decree_compiles_one_canonical_fact() -> None:
    result = compile_mainland_last_price_plan(
        decree_text="帮我看看比亚迪的股票价格",
        node_id="bureau:户部:投资司",
    )

    assert result.disposition is FactPlanDisposition.PLANNED
    assert result.reason is None
    assert result.source_scope == (SourceType.SHIGUAN, SourceType.MCP)
    assert result.draft is not None
    assert result.draft.requesting_agent == "bureau:户部:投资司"
    assert result.draft.required_facts == (
        RequiredFact(
            key="market_quote:last_price",
            description="查询比亚迪在中国大陆证券市场的最新可得价格",
            category=FactCategory.MARKET_QUOTE,
            data_scope=DataScope.EXTERNAL_PUBLIC,
            subject="比亚迪",
            jurisdiction="CN",
            expected_unit="CNY",
            expected_shape="number",
            market_metric=MarketMetric.LAST_PRICE,
        ),
    )
    assert result.draft.freshness.max_age_seconds == 3600
```

Also cover `贵州茅台的股价是多少`, `查询 600519.SH 股票价格`, a non-market decree,
explicit `1211.HK`, `港股价格`, `AAPL.US`, a recognizable B-share ticker, empty
extracted entity, and an ambiguous decree whose injected extractor returns `None`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_market_fact_plan.py tests/test_market_intent.py -q
```

Expected: collection fails because `app.agents.fact_plans` and
`app.agents.market_fact_plan` do not exist.

- [ ] **Step 3: Implement the plan result types and supported-slice predicate**

Create `fact_plans.py` with the exact enum/dataclass above. In `market_intent.py`, add:

```python
def is_mainland_last_price_intent(text: str) -> bool:
    return (
        requested_market_metrics(text) == (MarketMetric.LAST_PRICE,)
        and not has_out_of_scope_market_hint(text)
    )
```

Import `has_out_of_scope_market_hint` from `app.jinyiwei.instruments`. Do not add a
provider name, endpoint or company code.
Extend that shared helper with the provider-neutral explicit overseas suffix form
`<symbol>.US`; it must reject `AAPL.US` without treating ordinary prose ending in
`.us` as a ticker.

- [ ] **Step 4: Implement deterministic subject extraction and plan compilation**

In `market_fact_plan.py`, use this order:

```python
def _market_subject(
    decree_text: str,
    entity_extractor: Callable[[str], str | None] | None,
) -> str | None:
    hints = extract_instrument_hints(decree_text)
    if len(hints) == 1:
        hint = hints[0]
        suffix = {
            AShareExchange.SSE: ".SH",
            AShareExchange.SZSE: ".SZ",
            AShareExchange.BSE: ".BJ",
            None: "",
        }[hint.exchange]
        return f"{hint.ticker}{suffix}"
    if len(hints) > 1:
        return None
    for pattern in _COMPANY_PATTERNS:
        match = pattern.search(decree_text)
        if match is not None:
            subject = _normalize_subject(match.group("subject"))
            if subject:
                return subject
    if entity_extractor is None:
        return None
    extracted = entity_extractor(decree_text)
    return _normalize_subject(extracted or "") or None
```

`_COMPANY_PATTERNS` must recognize company spans before `的股票/股票/股价/证券行情` and
strip only a fixed set of request prefixes such as `帮我看看`, `查询`, `查看`, `请问`,
not arbitrary suffixes. Compilation returns `NOT_APPLICABLE` unless the decree requests
exactly `LAST_PRICE`; returns `REJECTED/market_out_of_scope` before extracting a subject;
and constructs `DataGapDraft` directly with the exact canonical fields.
The `PLANNED` result sets source scope to exactly Shiguan then MCP; rejected and
not-applicable results keep an empty source scope.

- [ ] **Step 5: Verify GREEN and focused lint**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_market_fact_plan.py tests/test_market_intent.py tests/test_jinyiwei_instruments.py -q
.\.venv\Scripts\python.exe -m ruff check app/agents/fact_plans.py app/agents/market_fact_plan.py app/agents/market_intent.py app/jinyiwei/instruments.py tests/test_market_fact_plan.py tests/test_market_intent.py tests/test_jinyiwei_instruments.py
```

Expected: all selected tests pass and Ruff exits 0.

- [ ] **Step 6: Self-review without Git mutation**

Confirm production files contain no `比亚迪`, `贵州茅台`, Tencent/WeStock name, endpoint,
OAuth value or company-to-code mapping. Record RED/GREEN commands in the product task;
do not stage or commit.

---

### Task 2: Precompiled Investigation and Verified Quote Renderer

**Files:**
- Create: `backend/app/agents/evidence_rendering.py`
- Create: `backend/tests/test_evidence_rendering.py`
- Modify: `backend/app/agents/evidence_protocol.py`
- Modify: `backend/tests/test_agent_evidence_protocol.py`
- Modify: `backend/app/jinyiwei/extractor.py`
- Modify: `backend/tests/test_jinyiwei_extractor.py`

**Interfaces:**
- Consumes: Task 1 `DataGapDraft`, existing `AgentEvidenceSession`, `EvidencePack`,
  `EvidencePackStatus`, `EvidenceItem`.
- Produces:

```python
@dataclass(frozen=True, slots=True)
class EvidenceBackedOpinion:
    opinion: str
    evidence_ids: tuple[str, ...]


def render_mainland_last_price(pack: EvidencePack) -> EvidenceBackedOpinion: ...
```

and two optional keyword parameters on the existing adapter:

```python
def invoke_bureau_with_evidence(
    ...,
    session: AgentEvidenceSession,
    fact_plan: FactPlanResult | None = None,
    evidence_renderer: Callable[[EvidencePack], EvidenceBackedOpinion] | None = None,
) -> T: ...
```

When `fact_plan` is present, the function does not call the model to obtain a first
`NEEDS_DATA` envelope. It claims the same investigation budget, creates the same
`DataGapRequest`, invokes the same coordinator, freezes the same pack and then makes
at most one evidence-backed bureau-expression call.

- [ ] **Step 1: Write failing protocol tests**

Add tests proving:

```python
def test_precompiled_plan_skips_model_generated_data_gap() -> None:
    result = invoke_bureau_with_evidence(
        node_id=NODE_ID,
        department="户部",
        bureau="投资司",
        matter_type="MEMORIAL",
        decree_text="帮我看看任意公司的股票价格",
        messages=BASE_MESSAGES,
        chat_model=model_returning_valid_cited_ready,
        legacy_parser=parse_opinion,
        fallback=render_unavailable,
        session=session,
        fact_plan=canonical_plan("任意公司"),
        evidence_renderer=render_mainland_last_price,
    )

    assert len(model_returning_valid_cited_ready.calls) == 1
    assert coordinator.requests[0].required_facts == canonical_plan(
        "任意公司"
    ).draft.required_facts
    assert coordinator.requests[0].source_scope == (
        SourceType.SHIGUAN,
        SourceType.MCP,
    )
    assert result == "模型引用意见"
```

Add separate tests for model exception, invalid JSON, invalid citation and second
`NEEDS_DATA` after successful investigation. Each must return the deterministic opinion,
record exactly the renderer's evidence IDs through `session.record_selection()`, preserve
one investigation, and never call the coordinator twice. Add negative tests for
`UNAVAILABLE`, unresolved fact, conflicts, historical-only evidence, wrong unit, non-number
value and missing current evidence; renderer must raise `EvidenceProtocolError` with a
stable safe reason and must not produce a price.

Add security regressions proving:

- a `PARTIAL` precompiled pack never reaches the expression model or renderer and never
  records adoption, even if the scripted model would return a valid `READY`;
- a forged `FactPlanResult` is rejected unless source scope is exactly
  `(SourceType.SHIGUAN, SourceType.MCP)`;
- renderer ignores future, stale, `UNVERIFIED`, `REFUTES`, NaN and Decimal candidates
  even when their timestamps sort after a valid quote.

Add a Shiguan regression in `test_jinyiwei_extractor.py`: a source document containing
complete locked `adopted_evidence` for the requested quote is reused without calling the
extractor model. A locked fact key/category/subject mismatch must fail closed and must not
be rebound to the new request.

- [ ] **Step 2: Verify RED**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_evidence_rendering.py tests/test_agent_evidence_protocol.py -q
```

Expected: failure because the renderer and optional adapter arguments are absent.

- [ ] **Step 3: Implement the renderer**

`render_mainland_last_price()` must:

```python
fact = pack.request.required_facts[0]
items = tuple(pack.evidence_by_fact.get(fact.key, ()))
```

Reject unless the pack is `RESOLVED`, the one canonical
`MARKET_QUOTE/LAST_PRICE/CN` fact is resolved, conflicts are empty, and at least one item
simultaneously:

- has `unit == "CNY"` and a finite `int | float` non-boolean value;
- has `stance == SUPPORTS`;
- has quality `PRIMARY` or `AUTHORITATIVE`;
- has source type `SHIGUAN` or `MCP`;
- passes shared `is_evidence_fresh()` at `pack.investigation_completed_at`.

Select only from that eligible subset, deterministically by parsed
`(as_of, retrieved_at, evidence_id)` descending. Render only fields present in that
selected item:

```text
<subject>最新可得价格为 <value> CNY（行情时间：<as_of>；来源：<publisher>）。
该数值是来源在所示时间的最新可得行情，不等同于此刻实时成交价，也不构成投资建议。
```

Return exactly the selected evidence ID. Do not use `excerpt`, raw MCP payload or URL.

- [ ] **Step 4: Extract one shared investigation helper**

Refactor the current budget/request/coordinator/freeze block into a private helper that
accepts a validated `DataGapDraft`. Both the existing model-generated path and the new
precompiled path must call it. Preserve:

- the decree-wide deadline;
- maximum investigation and extraction counts;
- the 30-second external timeout ceiling;
- `source_scope = _SOURCE_SCOPE` for the old model-generated path;
- `source_scope = fact_plan.source_scope` for the precompiled path;
- safe `evidence_unavailable` fallback for coordinator exceptions;
- `record_investigation_result()` before `freeze_pack()`.

No production behavior outside the precompiled branch may change.
`_validated_precompiled_draft()` must reject every source scope other than the exact
`(SourceType.SHIGUAN, SourceType.MCP)` tuple. Before any expression-model call, the
precompiled branch must require `pack.status == RESOLVED`, all requested facts resolved,
no unresolved facts and no conflicts; otherwise return the sanitized evidence fallback
without model execution, renderer execution or adoption.

- [ ] **Step 5: Reuse complete locked Shiguan evidence deterministically**

In `StructuredEvidenceExtractor.extract()`, before the model path, detect a Shiguan
`SourceDocument` whose adopted evidence entries all contain the complete locked
fact-key/category/subject metadata required by the existing validation path. Reuse the
immutable `EvidenceItem` values through that same validation path without calling the
model. Do not create a looser match, change locked identity, or treat ordinary unstructured
Shiguan text as deterministic. A mismatch remains a failed extraction so the coordinator
may continue to approved MCP; it must not mutate or rebind the snapshot.

- [ ] **Step 6: Add evidence-expression degradation**

After a successful precompiled investigation, attempt the normal evidence message and
`READY` parsing once. Catch only sanitized model/structured-output/evidence-protocol
failures in this expression stage. If an `evidence_renderer` exists, render, verify
`session.knows_all(rendered.evidence_ids)`, call
`session.record_selection(node_id, rendered.evidence_ids)`, and return
`legacy_parser({"opinion": rendered.opinion})`. Do not render after an investigation
failure.

- [ ] **Step 7: Track internal degradation without changing HTTP schemas**

Append `degradation_reasons: tuple[str, ...] = ()` to `AgentEvidenceSnapshot`. Add
`AgentEvidenceSession.record_degradation(node_id: str)` that records the stable value
`model_synthesis_degraded:<node_id>` once in invocation order. The renderer fallback
records its bureau node. Existing direct snapshot construction remains compatible through
the default field.

- [ ] **Step 8: Verify GREEN and regression**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_evidence_rendering.py tests/test_agent_evidence_protocol.py tests/test_jinyiwei_extractor.py tests/test_jinyiwei_coordinator.py -q
.\.venv\Scripts\python.exe -m ruff check app/agents/evidence_rendering.py app/agents/evidence_protocol.py app/jinyiwei/extractor.py tests/test_evidence_rendering.py tests/test_agent_evidence_protocol.py tests/test_jinyiwei_extractor.py
```

Expected: all selected tests pass and Ruff exits 0.

- [ ] **Step 9: Self-review without Git mutation**

Confirm the old no-plan path still has byte-for-byte-compatible public arguments and test
semantics, no raw exception enters a fallback string, and no renderer runs without frozen
current evidence. Record evidence; do not stage or commit.

---

### Task 3: Deterministic Market Routing and Layered Model Degradation

**Files:**
- Modify: `backend/app/agents/bureaus/agent.py`
- Modify: `backend/app/agents/ministries/agent.py`
- Modify: `backend/app/agents/chancellor/graph.py`
- Modify: `backend/tests/test_bureaus_agent.py`
- Modify: `backend/tests/test_ministries_agent.py`
- Modify: `backend/tests/test_chancellor_graph.py`
- Modify: `backend/app/agents/market_fact_plan.py`
- Modify: `backend/tests/test_market_fact_plan.py`
- Modify: `backend/app/agents/evidence_protocol.py`
- Modify: `backend/tests/test_agent_evidence_protocol.py`

**Interfaces:**
- Consumes: Task 1 compiler and predicate; Task 2 precompiled protocol and renderer.
- Produces: Supported Mainland last-price decrees use static `single → 户部 → 投资司`
  routing and retain the existing successful HTTP response shape.

- [ ] **Step 1: Write failing route-bypass tests**

Add tests with a fake model whose first call raises if it receives the Chancellor routing
prompt or ministry bureau-routing prompt. For a supported Mainland last-price decree:

```python
result = graph.invoke({"decree_text": "帮我看看比亚迪的股票价格"})
assert result["route_type"] == "single"
assert result["departments"] == ["户部"]
assert [item["bureau"] for item in result["ministry_opinions"][0]["bureau_opinions"]] == [
    "投资司"
]
```

The fake may still receive the bureau-expression, ministry-synthesis and finalizer calls.
Add a non-market control proving existing model routing still executes.
Non-`LAST_PRICE` market requests continue to use the pre-existing ADR 0023 model-after
route normalization and investment-bureau priority; Task 3 must not remove or redefine
that already-approved behavior.

- [ ] **Step 2: Write failing degradation tests**

Using a fake coordinator that returns one verified current MCP quote, inject failures
separately at:

1. bureau expression;
2. ministry synthesis;
3. Chancellor finalization.

For each case assert a completed graph result, one adopted evidence ID, exactly one
investigation, one `锦衣卫（调查）` path entry, a final verdict containing price and `CNY`,
and three unique non-factual recommendations. Add a negative control where investigation
is unavailable; it must not return a price-bearing success.

- [ ] **Step 3: Verify RED**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_chancellor_graph.py -q
```

Expected: the supported market route still calls routing models and expression failures
propagate.

- [ ] **Step 4: Bypass only the supported route decisions**

In Chancellor `_decide_route`, initialize the evidence session as today, then before the
model routing call:

```python
if is_mainland_last_price_intent(state["decree_text"]):
    return {
        "chancellor_rationale": "明确的中国大陆证券最新价查询，由户部办理。",
        "route_type": "single",
        "departments": ["户部"],
        "evidence_session": evidence_session,
        "processing_path": ["上书房", "丞相（首次分流）"],
    }
```

In `invoke_ministry_agent`, supported `户部` requests use the static route rationale
`明确的中国大陆证券最新价查询，由投资司办理。` and `["投资司"]` without calling the
ministry routing model. Every other department/decree retains the existing parser and
validation.

- [ ] **Step 5: Attach the precompiled plan only to 投资司**

In `invoke_bureau_agent`, when `(department, bureau) == ("户部", "投资司")`, compile the
plan with `node_id`. Pass `fact_plan` and `render_mainland_last_price` only for
`PLANNED`. Map `REJECTED` to a sanitized `BureauAgentInvocationError` whose cause contains
only the stable reason. `NOT_APPLICABLE` continues through the old evidence protocol.

Wire the compiler's third-stage `entity_extractor` to a narrow helper in
`market_fact_plan.py`. The helper:

- is called only when explicit ticker and conservative company-span extraction failed;
- asks for exactly `{"entity_type":"name|ticker","value":"<entity>"}`;
- validates strict JSON and exact keys without retaining or echoing raw output;
- allows one static format-correction call after an invalid first response, with a budget
  independent from `AgentEvidenceSession.claim_protocol_correction()`;
- does not retry transport/model exceptions;
- rejects blank, out-of-scope, multi-ticker or request-like values as `None`.

Add an integration test whose wording cannot be safely parsed by the regex, whose first
entity response is invalid and second is valid, and prove exactly two entity calls followed
by one investigation. Standard company wording and explicit codes must make zero entity
model calls.

- [ ] **Step 6: Add ministry synthesis fallback**

Wrap only the synthesis call and parsing block. If it fails and all of the following are
true:

- department is `户部`;
- the decree is a supported Mainland last-price request;
- `evidence_session.snapshot().adopted_evidence_ids` is non-empty;
- `evidence_session.has_adopted_fact(...)` confirms the selected evidence belongs to
  `bureau:户部:投资司` and the canonical
  `market_quote:last_price/MARKET_QUOTE/LAST_PRICE/CN/CNY/number` fact;
- the ordered bureau opinions are non-empty;

return a ministry opinion formed by joining the existing bureau opinion strings without
adding facts, then record `model_synthesis_degraded:ministry:户部`. Otherwise preserve
`MinistryAgentInvocationError`.

- [ ] **Step 7: Add finalizer fallback**

If finalization fails and the state is the supported single-department market path with
non-empty adopted evidence, use the sole ministry opinion as `final_verdict` and exactly:

```python
[
    "请核对行情时间与交易时段后再使用该价格。",
    "请结合自身风险承受能力独立判断。",
    "本回奏仅提供行情信息，不构成投资建议。",
]
```

Preserve the existing processing-path suffix. Any other finalization failure remains a
`ChancellorGraphInvocationError`. Record
`model_synthesis_degraded:chancellor:finalize` and return a fresh evidence snapshot so
the internal graph result contains the degradation without changing the HTTP schema.

Add a generic `AgentEvidenceSession.has_adopted_fact(...)` query that checks the
node-specific selection, adopted set, current `evidence_by_fact`, resolved pack and exact
required-fact metadata while holding the session lock. Both ministry and finalizer gates
must use it. A prefilled session containing an unrelated adopted ID must not enable either
fallback.

- [ ] **Step 8: Verify GREEN and broad agent regression**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest tests/test_market_fact_plan.py tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_chancellor_graph.py tests/test_decrees_api.py tests/test_junjichu_agent.py -q
.\.venv\Scripts\python.exe -m ruff check app/agents/market_fact_plan.py app/agents/evidence_protocol.py app/agents/bureaus/agent.py app/agents/ministries/agent.py app/agents/chancellor/graph.py tests/test_market_fact_plan.py tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_chancellor_graph.py
```

Expected: all selected tests pass and Ruff exits 0.

- [ ] **Step 9: Self-review without Git mutation**

Confirm every fallback gate requires adopted evidence, multi-department behavior is
unchanged, no model output or exception text is exposed, and a failed investigation
cannot become HTTP 200 with a price. Record evidence; do not stage or commit.

---

### Task 4: Architecture Contract, Harness and End-to-End Acceptance

**Files:**
- Modify: `docs/decisions/0025-deterministic-evidence-orchestration.md`
- Modify: `docs/product/tasks/2026-07-24-deterministic-evidence-orchestration.md`
- Modify: `ARCHITECTURE.md`
- Modify: `backend/AGENTS.md`
- Modify: `scripts/check_harness.mjs`
- Modify: `backend/tests/test_chancellor_graph.py`

**Interfaces:**
- Consumes: Tasks 1–3 completed behavior.
- Produces: Durable ADR and executable repository gates for the new trust boundary.

- [ ] **Step 1: Audit and complete the end-to-end graph matrix**

Use the real `AgentEvidenceSession` with an injected fake coordinator and a scripted
model. The model must never receive market route or bureau-selection prompts. Assert:

```python
assert result["processing_path"] == [
    "上书房",
    "丞相（首次分流）",
    "户部",
    "户部·投资司",
    "锦衣卫（调查）",
    "户部（部级补充）",
    "丞相（最终汇总）",
]
assert result["adopted_evidence_ids"] == ("evidence-market-1",)
assert "CNY" in result["final_verdict"]
```

Parameterize valid-model, invalid-bureau-expression, invalid-ministry-synthesis and
invalid-finalizer cases.
Each degraded case also asserts the exact node-specific
`model_synthesis_degraded:*` entry and that no successful investigation is repeated.
The three degraded cases must return actual malformed JSON or wrong-schema/wrong-type
payloads at the respective model nodes. A `RuntimeError` alone is insufficient because it
does not prove that strict JSON/schema drift degrades safely.
Task 3 may already provide this exact matrix. If all assertions exist, do not duplicate
tests merely to manufacture a RED; cite the existing test names in the report. Add only a
missing assertion or case that changes observable coverage.

- [ ] **Step 2: Create a real harness RED before durable-rule changes**

First add self-test coverage that expects the new spec, plan, task and ADR required files
plus the canonical fact-plan/renderer static guards. Run:

```powershell
node scripts/check_harness.mjs --self-test
```

Expected: fail because the production `REQUIRED_FILES` and guard checks are not yet
synchronized. Then add the minimal production harness entries and rerun to GREEN. Run the
existing deterministic-market graph matrix separately and make only integration
corrections if it reveals a real composition failure.

- [ ] **Step 3: Record ADR 0025**

Create the ADR with the exact required headings:

```markdown
## Status

Accepted — 2026-07-24

## Context

Describe the observed model-contract drift after successful read-only MCP evidence acquisition.

## Decision

Record canonical fact plans, Shiguan-first investigation, provider-neutral adapters,
evidence-gated deterministic rendering and supported-path layered degradation.

## Consequences

Record fewer model calls and elimination of post-evidence global 502s, plus the cost of
maintaining category compilers and conservative rejection of ambiguous entities.

## Verification

List the exact focused, full-suite, Ruff, harness and real read-only acceptance commands.
```

- [ ] **Step 4: Synchronize durable rules and harness**

Add one concise rule to `ARCHITECTURE.md` and `backend/AGENTS.md`: system-owned fact
fields cannot be supplied by a model, and evidence-backed fallback requires frozen,
resolved current evidence. Add the spec, plan, task and ADR to `REQUIRED_FILES`. Add
static harness assertions for:

- `FactPlanDisposition`;
- exact canonical `CN/CNY/number/LAST_PRICE` fields;
- renderer gating on resolved current evidence;
- no company-to-code mapping in the new agent files;
- ADR required sections.

The Python lexical helper must mask comments, single-quoted strings, double-quoted
strings, and triple-quoted strings/docstrings before locating calls. Renderer assertions
must inspect the real `render_mainland_last_price` function body rather than unrelated
helpers or dead examples. Harness self-tests must reject canonical `RequiredFact` text
hidden in a normal string/docstring and resolved/freshness snippets hidden in an unrelated
function or an unreachable/dead block inside the renderer itself. The guard must verify
that the resolved/current checks participate in the renderer's reachable execution path;
mere token presence anywhere inside the function body is insufficient.

- [ ] **Step 5: Run fresh offline verification**

Run:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check .
Set-Location ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: all pytest tests pass with only previously known warnings, Ruff exits 0,
harness groups pass, and diff check exits 0.

- [ ] **Step 6: Run static safety scans**

Search new/changed generic agent files for provider names, endpoints, OAuth/Bearer/token
values, company-to-code literals and reads of `backend/data`. Expected: zero prohibited
matches. Test fixtures may contain fictional company names and evidence IDs only.

- [ ] **Step 7: Run the authorized real read-only acceptance**

Restart only the local backend process so it loads the completed code, preserving:

```text
JINYIWEI_EXTERNAL_NETWORK_ENABLED=true
JINYIWEI_MCP_CREDENTIAL_SOURCE=local
```

Submit `帮我看看比亚迪的股票价格` through the same `/study` API path ten consecutive
times. Record status, processing path and adopted-evidence count without copying raw MCP
payloads or credentials into the repository. Expected: ten HTTP 200 responses, each with
`户部·投资司`, Jinyiwei-orchestrated non-zero adopted evidence, no unsolicited Hong Kong
metric/scope, and no generic `model_unavailable`. A non-cache pack has exactly one
`锦衣卫（调查）` path entry; a cache hit must not claim a new external investigation.

- [ ] **Step 8: Update the product task and report remaining risks**

Check each acceptance item only from fresh evidence. Record commands, counts, warnings,
real acceptance result and any remaining Shiguan migration warning. Do not claim BSE
coverage. Do not stage, commit or push.

---

### Task 5: Close the Final Semantic Evidence Trust Boundary

**Files:**
- Modify: `backend/app/agents/evidence_rendering.py`
- Modify: `backend/app/agents/evidence_protocol.py`
- Modify: `backend/app/agents/bureaus/agent.py`
- Modify: `backend/app/agents/ministries/agent.py`
- Modify: `backend/app/agents/chancellor/graph.py`
- Modify: corresponding focused tests
- Modify: approved spec, ADR 0025, product task and delivery report

**Interfaces:**
- Consumes: the canonical Mainland `LAST_PRICE` plan, frozen `EvidencePack`, and
  `render_mainland_last_price()`.
- Produces: an authoritative deterministic factual opinion that no format-valid model
  response can replace or extend with unsupported price, time, source or recommendation
  facts.

- [ ] **Step 1: Write semantic-substitution RED tests**

For the supported Mainland `LAST_PRICE` route, return structurally valid model envelopes
that cite the correct evidence ID but change the price, time or source at the bureau,
ministry and finalizer layers. Assert every final factual opinion remains byte-for-byte
equal to the deterministic renderer output, the relevant node records
`model_synthesis_degraded:*`, and the investigation is not repeated.

- [ ] **Step 2: Write selected-item eligibility RED tests**

Build a resolved pack containing one eligible supporting item plus a separately selected
numeric item that is stale, `CONTRADICTS`, `UNVERIFIED`, or from an unapproved source.
Assert `has_adopted_fact()` rejects the selected item even though another item makes the
pack resolved. Also assert the renderer-selected eligible ID passes.

- [ ] **Step 3: Make the deterministic opinion authoritative**

The canonical renderer output is the factual contract. A model expression may be parsed
for compatibility, but it may be accepted only when its factual opinion and selected
evidence IDs exactly match the renderer output; otherwise use the renderer output and
record node-specific degradation. Ministry and finalizer must apply the same exact
semantic binding. Final recommendations on this canonical route must remain the fixed
three non-factual safety recommendations. Do not let model prose add or replace price,
time, source, market, metric or investment claims.

- [ ] **Step 4: Share selected-evidence eligibility**

`has_adopted_fact()` must validate the selected evidence IDs with the same renderer
eligibility/selection logic used for the answer: resolved canonical fact, current
evidence, `SUPPORTS`, `PRIMARY`/`AUTHORITATIVE`, approved `SHIGUAN`/`MCP`, numeric CNY,
and the renderer-selected ID. Prefer an injected validator/renderer or a cycle-free
shared predicate over duplicated drift-prone checks.

- [ ] **Step 5: Synchronize the durable contract**

Amend the approved spec and ADR to state that models may not alter or append factual
content on the canonical route. Set the product task to `In Progress` until the real
ten-call criterion passes. Update harness guards/tests if needed to protect this boundary.

- [ ] **Step 6: Verify and independently review**

Run focused RED→GREEN evidence, the broad agent regression set, Ruff and diff check.
Obtain an independent review with no Critical or Important findings before running Task
4 Step 7. Do not use real network, credentials or runtime databases during this task.
