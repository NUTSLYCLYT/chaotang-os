# Bureau Agent Controlled Tool Use Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all 39 bureau Agents model-proposed, system-approved, read-only Tool Use while preserving the existing Evidence Protocol, Runtime Skill authorization boundary, legacy APIs, and four-node LangGraph topology.

**Architecture:** Extend each bureau `RuntimeSkillDefinition` with an explicit `BureauToolPolicy`, add one shared descriptor registry and a fail-closed `ToolPolicyGate → ToolExecutor → ResultGate` pipeline inside the existing authorized bureau operation, then run at most two model/tool rounds before constructing the existing `BureauReport`. `request_evidence` remains an adapter over the existing Evidence Protocol; upper layers receive only the final report and never receive Tool clients, results, or privileged sessions.

**Tech Stack:** Python 3.14, Pydantic v2 frozen contracts, pytest, Ruff, existing DeepSeek structured invocation adapter, existing Evidence Protocol and runtime-skill registry/executor, PowerShell acceptance runner, Node harness checks.

## Global Constraints

- Scope is exactly the 39 bureau Agents; ministries, Junjichu, and Chancellor do not gain Tool Use.
- The model proposes Tool Calls; only system code may validate, approve, execute, retry, assign timestamps, or assign audit state.
- Phase 1 tools are read-only: `request_evidence`, `read_approved_materials`, `inspect_approved_data`, and `compute_analysis`.
- No arbitrary SQL, Python, JavaScript, Shell, filesystem paths, generic network calls, direct MCP clients, credentials, provider selection, or write operations.
- `request_evidence` must reuse ADR 0028 and the existing Evidence Protocol; it may not create a second evidence path.
- Defaults are at most 4 calls, 2 proposal/result rounds, no repeated normalized tool+arguments, and no Tool Result-triggered recursive execution.
- Every denial happens before the underlying handler, Evidence, MCP, database reader, calculator, or model continuation side effect.
- Ministry and Junjichu receive only `BureauReport`; existing plain-string bureau API and zero-tool path remain compatible.
- LangGraph remains exactly four business nodes.
- All new contracts are frozen and `extra="forbid"`; all unknown enum values, fields, tools, operations, domains, and references fail closed.
- Final acceptance uses one frozen code/config/command fingerprint and must pass 10 complete consecutive rounds; any failure or substantive change resets the count to zero.
- Real models, real MCP, production database/write paths, credentials, paid services, and external network remain unauthorized unless the user separately approves them.
- Git commits shown below are execution checkpoints, not authorization; do not stage, commit, push, merge, or create a PR without current explicit user approval.

## File Map

- Create `backend/app/agents/runtime_skills/tool_models.py`: frozen Tool descriptor, policy, proposal, decision, result, budget, and audit contracts.
- Create `backend/app/agents/runtime_skills/tool_registry.py`: four authoritative descriptors and exact 39-agent policy registry validation.
- Create `backend/app/agents/runtime_skills/tool_policy.py`: identity, schema, scope, domain, duplicate, and budget gate.
- Create `backend/app/agents/runtime_skills/tool_executor.py`: handler protocol, approved-call dispatch, Result Gate, redacted audit sink, and stable errors.
- Create `backend/app/agents/runtime_skills/tool_handlers.py`: fixed adapters for approved materials/data/calculation and the existing Evidence Protocol.
- Create `backend/app/agents/runtime_skills/tool_loop.py`: bounded model proposal/result loop and final synthesis handoff.
- Modify `backend/app/agents/runtime_skills/models.py`: add `tool_policy` only to bureau Runtime Skills without changing ministry/council report contracts.
- Modify `backend/app/agents/runtime_skills/registry.py`: attach and construction-time validate all 39 policies.
- Modify `backend/app/agents/runtime_skills/roles/bureaus/professional.py`: define explicit professional tool domains and constraints per bureau.
- Modify `backend/app/agents/bureaus/prompts.py`: advertise only the current bureau's descriptor projections and strict Tool Call/final-report envelopes.
- Modify `backend/app/agents/bureaus/agent.py`: place the bounded tool loop inside the existing authorized bureau operation and preserve legacy behavior.
- Modify `backend/app/agents/runtime_skills/__init__.py`: export stable public Tool Use contracts only.
- Create `backend/tests/test_bureau_tool_models.py`: contract validation.
- Create `backend/tests/test_bureau_tool_registry.py`: four descriptors, 39 policies, and startup failures.
- Create `backend/tests/test_bureau_tool_policy.py`: fail-closed authorization, scope, duplicate, and budget behavior.
- Create `backend/tests/test_bureau_tool_executor.py`: handler isolation, Result Gate, audit, redaction, timeout, empty, and truncation behavior.
- Create `backend/tests/test_bureau_tool_handlers.py`: deterministic handler and Evidence adapter behavior.
- Create `backend/tests/test_bureau_tool_loop.py`: bounded model/tool loop and correction behavior.
- Create `backend/tests/test_bureau_tool_use_integration.py`: all 39 bureau behavior matrix, upper-layer isolation, legacy API, and four-node regressions.
- Modify `scripts/run_task9_acceptance.ps1` only if a generic successor is required; otherwise create `scripts/run_bureau_tool_use_acceptance.ps1` and its self-test without rewriting historical Task 9 evidence.
- Create `docs/product/tasks/2026-08-03-bureau-agent-tool-use.md`: product contract, allowed paths, implementation evidence, and acceptance ledger.
- Create an ADR under `docs/decisions/` because Tool Use changes the Runtime Skill execution architecture; preserve ADR 0028 as an immutable dependency.

---

### Task 1: Product Contract and Architecture Decision

**Files:**
- Create: `docs/product/tasks/2026-08-03-bureau-agent-tool-use.md`
- Create: `docs/decisions/0037-bureau-agent-controlled-tool-use.md`
- Reference: `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
- Reference: `docs/superpowers/specs/2026-08-03-bureau-agent-tool-use-design.md`

**Interfaces:**
- Consumes: the approved design and ADR 0028 evidence constraints.
- Produces: one `Ready` product contract with exact allowed paths and one ADR defining the single Tool Use execution boundary.

- [ ] **Step 1: Write the product contract**

Record the confirmed scope, four tools, 39 explicit policies, zero-tool compatibility, security constraints, two-round/four-call defaults, upper-layer isolation, and 10-round acceptance. Set `Status` to `Ready` because the user confirmed the complete design. Mark real model/MCP/production/network checks as unauthorized rather than silently omitting them.

- [ ] **Step 2: Write ADR 0037**

Document this decision: model output is a proposal; the system gate owns identity and approval; execution stays inside `run_authorized_runtime_operation`; Evidence remains an ADR 0028 adapter; Tool descriptors are shared while Tool Policies are per bureau; no new LangGraph nodes are introduced.

- [ ] **Step 3: Run document gates**

Run:

```powershell
node scripts/check_harness.mjs
git diff --check -- docs/product/tasks/2026-08-03-bureau-agent-tool-use.md docs/decisions/0037-bureau-agent-controlled-tool-use.md
```

Expected: harness reports `通过`; diff check exits `0`.

- [ ] **Step 4: Independent task review**

Reviewer must verify every product criterion has a later plan task and that ADR 0037 cannot be read as authorization to change ADR 0028, enable production services, or expose Tool objects to upper layers.

- [ ] **Step 5: Commit checkpoint if separately authorized**

```powershell
git add docs/product/tasks/2026-08-03-bureau-agent-tool-use.md docs/decisions/0037-bureau-agent-controlled-tool-use.md docs/superpowers/specs/2026-08-03-bureau-agent-tool-use-design.md docs/superpowers/plans/2026-08-03-bureau-agent-tool-use.md
git commit -m "docs: define controlled bureau tool use"
```

### Task 2: Frozen Tool Use Contracts

**Files:**
- Create: `backend/app/agents/runtime_skills/tool_models.py`
- Modify: `backend/app/agents/runtime_skills/models.py`
- Modify: `backend/app/agents/runtime_skills/__init__.py`
- Test: `backend/tests/test_bureau_tool_models.py`

**Interfaces:**
- Consumes: existing `_FrozenContract`, `RuntimeSkillDefinition`, `BureauReport`, and Pydantic v2.
- Produces: `ToolName`, `ToolCallStatus`, `ToolDataQuality`, `ToolDescriptor`, `BureauToolPolicy`, `ToolCallProposal`, `ApprovedToolCall`, `ToolResultEnvelope`, `ToolBudget`, `ToolAuthorizationContext`, `ToolHandlerContext`, and `ToolAuditRecord`.

- [ ] **Step 1: Write failing frozen-contract tests**

Tests must construct valid values and reject extra fields, blank IDs, unknown enum values, negative budgets, system-owned proposal fields, missing result references for factual/calculated success, and a bureau Runtime Skill without `tool_policy`. Include:

```python
def test_tool_proposal_cannot_supply_system_authority_fields() -> None:
    with pytest.raises(ValidationError):
        ToolCallProposal.model_validate({
            "tool_call_id": "tc-1",
            "tool_name": "compute_analysis",
            "purpose": "compare totals",
            "arguments": {"algorithm_id": "ratio.v1"},
            "required_for": ["finding"],
            "expected_result_schema": "ratio.v1",
            "approved": True,
        })
```

- [ ] **Step 2: Run RED**

Run: `python -m pytest backend/tests/test_bureau_tool_models.py -q`

Expected: FAIL because `tool_models` and the contracts do not exist.

- [ ] **Step 3: Implement the contracts**

Use frozen Pydantic models with `extra="forbid"`. Model-provided `ToolCallProposal` must not contain Agent, Skill, case authority, credential, provider, timeout, audit, timestamps, or approval state. `ApprovedToolCall` is system-owned and adds canonical Agent/Skill/case/policy identity plus normalized arguments. `ToolAuthorizationContext` contains canonical request/case/decree/Agent/Skill/policy identity, approved refs, business state, and system limits. `ToolHandlerContext` contains only the approved call, resolved approved inputs, and restricted callable adapters; it contains no model, database, MCP client, credential, filesystem, or upper-layer session. `ToolResultEnvelope` must distinguish `SUCCEEDED`, `EMPTY`, `TRUNCATED`, `DENIED`, `INVALID`, `BUDGET_EXCEEDED`, `BLOCKED`, and `FAILED`.

Add `tool_policy: BureauToolPolicy | None = None` to `RuntimeSkillDefinition`; validate `BUREAU` requires a policy and `MINISTRY/COUNCIL` forbid one. Use `model_rebuild()` to resolve the forward reference without importing executor code.

- [ ] **Step 4: Run GREEN and existing model regression**

Run:

```powershell
python -m pytest backend/tests/test_bureau_tool_models.py backend/tests/test_downstream_runtime_skill_models.py -q
python -m ruff check backend/app/agents/runtime_skills/tool_models.py backend/app/agents/runtime_skills/models.py backend/tests/test_bureau_tool_models.py
```

Expected: all tests pass and Ruff reports `All checks passed!`.

- [ ] **Step 5: Independent task review and authorized commit checkpoint**

Reviewer checks that no model-owned contract can smuggle authority. If Git is separately authorized:

```powershell
git add backend/app/agents/runtime_skills/tool_models.py backend/app/agents/runtime_skills/models.py backend/app/agents/runtime_skills/__init__.py backend/tests/test_bureau_tool_models.py
git commit -m "feat: add bureau tool use contracts"
```

### Task 3: Descriptor Registry and 39 Explicit Tool Policies

**Files:**
- Create: `backend/app/agents/runtime_skills/tool_registry.py`
- Modify: `backend/app/agents/runtime_skills/roles/bureaus/professional.py`
- Modify: `backend/app/agents/runtime_skills/registry.py`
- Test: `backend/tests/test_bureau_tool_registry.py`
- Test: `backend/tests/test_downstream_runtime_skill_registry.py`

**Interfaces:**
- Consumes: Task 2 Tool contracts and the authoritative 39-bureau professional definitions.
- Produces: `TOOL_DESCRIPTORS`, `bureau_tool_policy_for(agent_id)`, `validate_bureau_tool_registry()`, and Runtime Skills containing exact policies.

- [ ] **Step 1: Write failing registry tests**

Require exactly four descriptor names and exactly 39 policy identities. Parametrize every bureau and assert its policy is not generated from the display name alone: it has explicit allowed domains, operations, constraints, and budgets. Mutation tests must fail for missing policy, duplicate agent, unknown tool, forbidden domain, policy/Skill identity mismatch, limit above system maximum, and a ministry/council policy.

- [ ] **Step 2: Run RED**

Run: `python -m pytest backend/tests/test_bureau_tool_registry.py backend/tests/test_downstream_runtime_skill_registry.py -q`

Expected: FAIL because the descriptor/policy registry is absent and bureau Skills lack policies.

- [ ] **Step 3: Define four descriptors and 39 policies**

Descriptors are shared implementations. Policies are explicit professional data. Extend each bureau professional definition with approved domains and permitted operations; do not derive permissions through substring matching or a ministry-wide default. Defaults may be reduced per bureau but never exceed four calls, two rounds, or system row/byte caps.

- [ ] **Step 4: Wire construction-time validation**

During `build_runtime_skill_registry()`, attach the exact policy before constructing each bureau Runtime Skill. Validate the authoritative `(agent_id, skill_id, layer, services, tool_policy)` tuple. Keep the existing exact count of 46 Runtime Skills and 39 bureau professional definitions.

- [ ] **Step 5: Run GREEN and aggregate registry regression**

Run:

```powershell
python -m pytest backend/tests/test_bureau_tool_registry.py backend/tests/test_downstream_runtime_skill_registry.py backend/tests/test_bureau_runtime_skills.py -q
python -m ruff check backend/app/agents/runtime_skills backend/tests/test_bureau_tool_registry.py
```

Expected: all tests pass; no startup fallback fills missing policies.

- [ ] **Step 6: Independent review and authorized commit checkpoint**

```powershell
git add backend/app/agents/runtime_skills/tool_registry.py backend/app/agents/runtime_skills/roles/bureaus/professional.py backend/app/agents/runtime_skills/registry.py backend/tests/test_bureau_tool_registry.py backend/tests/test_downstream_runtime_skill_registry.py
git commit -m "feat: register bureau tool policies"
```

### Task 4: Fail-Closed Tool Policy Gate

**Files:**
- Create: `backend/app/agents/runtime_skills/tool_policy.py`
- Test: `backend/tests/test_bureau_tool_policy.py`

**Interfaces:**
- Consumes: `ToolCallProposal`, `ToolAuthorizationContext`, `BureauToolPolicy`, `ToolBudget`, descriptor registry, and prior approved-call fingerprints.
- Produces: `approve_tool_call(context: ToolAuthorizationContext, proposal: ToolCallProposal, budget: ToolBudget, history: tuple[str, ...]) -> ApprovedToolCall` or `ToolPolicyError(code: str, audit: ToolAuditRecord)`.

- [ ] **Step 1: Write failing authorization tests**

Cover valid approval plus wrong Agent/Skill binding, unknown tool, tool not in policy, invalid operation, forbidden field/operator/domain, cross-case ref, unapproved ref, provider/URL/SQL/code/path injection, repeated normalized call, exhausted calls/rounds/rows/bytes, forged ID collision, and disabled business state. For every rejection, a fake handler counter remains zero.

- [ ] **Step 2: Run RED**

Run: `python -m pytest backend/tests/test_bureau_tool_policy.py -q`

Expected: FAIL because `approve_tool_call` is undefined.

- [ ] **Step 3: Implement canonical validation order**

Validate in this order before producing `ApprovedToolCall`: canonical binding → descriptor exists → policy allows tool → argument schema → allowed domain/operation/fields → case/reference ownership → normalized duplicate → remaining budget → business state. Return stable codes such as `tool_not_allowed`, `tool_arguments_invalid`, `tool_scope_invalid`, `tool_reference_unapproved`, `tool_call_duplicate`, and `tool_budget_exceeded`.

- [ ] **Step 4: Run GREEN and Ruff**

Run:

```powershell
python -m pytest backend/tests/test_bureau_tool_policy.py -q
python -m ruff check backend/app/agents/runtime_skills/tool_policy.py backend/tests/test_bureau_tool_policy.py
```

Expected: all rejection cases pass without handler activity.

- [ ] **Step 5: Independent review and authorized commit checkpoint**

```powershell
git add backend/app/agents/runtime_skills/tool_policy.py backend/tests/test_bureau_tool_policy.py
git commit -m "feat: enforce bureau tool policy"
```

### Task 5: Tool Executor, Result Gate, and Safe Audit

**Files:**
- Create: `backend/app/agents/runtime_skills/tool_executor.py`
- Test: `backend/tests/test_bureau_tool_executor.py`
- Modify: `backend/app/agents/runtime_skills/__init__.py`

**Interfaces:**
- Consumes: approved calls only, `Mapping[ToolName, ToolHandler]`, `ToolHandlerContext`, Result schema registry, and optional audit sink.
- Produces: `ToolHandler = Callable[[ToolHandlerContext], Mapping[str, object]]`, `execute_approved_tool(call: ApprovedToolCall, context: ToolHandlerContext, handlers: Mapping[ToolName, ToolHandler], audit_sink: ToolAuditSink | None = None) -> ToolResultEnvelope`, bounded audit snapshot/clear helpers, and stable `ToolExecutionError`.

- [ ] **Step 1: Write failing executor tests**

Tests must prove proposals cannot be executed, handler identity matches the approved descriptor, missing/extra handlers fail closed, timeouts do not retry, empty differs from failure, oversized result becomes `TRUNCATED`, wrong schema/cross-case/unapproved refs fail, secret fields are stripped, and success/denial/failure audits are observable and redacted. Include provider exceptions containing `Bearer`, `sk-`, URLs, UNC paths, drive paths, and non-ASCII secrets.

- [ ] **Step 2: Run RED**

Run: `python -m pytest backend/tests/test_bureau_tool_executor.py -q`

Expected: FAIL because the executor does not exist.

- [ ] **Step 3: Implement approved-call-only dispatch**

Require `ApprovedToolCall`, look up a fixed handler, execute once, validate the declared result schema, verify references against canonical context, enforce row/field/byte limits, redact forbidden fields, and construct the system-owned result/audit. Keep raw handler exceptions out of returned errors, `__context__`, audit, and INFO logs.

- [ ] **Step 4: Add bounded thread-safe audit storage**

Use one `RLock` around append/snapshot/clear, a finite `deque`, and logging outside the lock. Tests use `try/finally` fixtures to restore global audit state and a bounded concurrency test without timing assumptions.

- [ ] **Step 5: Run GREEN, Ruff, and executor regression**

Run:

```powershell
python -m pytest backend/tests/test_bureau_tool_executor.py backend/tests/test_downstream_runtime_skill_executor.py -q
python -m ruff check backend/app/agents/runtime_skills/tool_executor.py backend/tests/test_bureau_tool_executor.py
```

Expected: all tests pass and no sensitive raw exception appears in captured logs.

- [ ] **Step 6: Independent review and authorized commit checkpoint**

```powershell
git add backend/app/agents/runtime_skills/tool_executor.py backend/app/agents/runtime_skills/__init__.py backend/tests/test_bureau_tool_executor.py
git commit -m "feat: execute approved bureau tools"
```

### Task 6: Four Read-Only Tool Handlers

**Files:**
- Create: `backend/app/agents/runtime_skills/tool_handlers.py`
- Test: `backend/tests/test_bureau_tool_handlers.py`
- Reference: `backend/app/agents/evidence_protocol.py`
- Reference: `backend/app/agents/bureaus/agent.py` for the existing approved-ref boundary; phase 1 introduces only injected `ApprovedMaterialReader` and `ApprovedDataReader` protocols in `tool_handlers.py`, with no direct database implementation.

**Interfaces:**
- Consumes: typed handler contexts containing only approved refs and restricted callable adapters.
- Produces: `ApprovedMaterialReader = Callable[[ToolHandlerContext], Mapping[str, object]]`, `ApprovedDataReader = Callable[[ToolHandlerContext], Mapping[str, object]]`, `EvidenceRequester = Callable[[ToolHandlerContext], Mapping[str, object]]`, and `build_bureau_tool_handlers(material_reader: ApprovedMaterialReader | None, data_reader: ApprovedDataReader | None, evidence_requester: EvidenceRequester | None) -> Mapping[ToolName, ToolHandler]` with exact callable identity supplied to the executor. `compute_analysis` is implemented internally from the fixed algorithm registry.

- [ ] **Step 1: Write failing handler tests**

Create fakes for approved materials, approved data, deterministic calculator, and Evidence Protocol. Assert each handler only receives canonical approved refs; `request_evidence` calls the existing Evidence session once; no handler receives MCP client, database connection, filesystem, model, credentials, or provider configuration. Unsupported operations and missing adapters fail before side effects.

- [ ] **Step 2: Run RED**

Run: `python -m pytest backend/tests/test_bureau_tool_handlers.py -q`

Expected: FAIL because handler adapters are absent.

- [ ] **Step 3: Implement material and data adapters**

`read_approved_materials` performs scoped lookup only. `inspect_approved_data` implements only `describe`, `filter`, `aggregate`, `compare`, `top_n`, and `lookup` against an injected approved-data reader. If the repository lacks a safe reader for a requested operation, return `BLOCKED` instead of constructing SQL or adding a production database dependency.

- [ ] **Step 4: Implement deterministic calculation registry**

Expose fixed versioned algorithms for arithmetic, percentage, year-over-year, period-over-period, share, difference, mean, median, extrema, sort, grouped aggregation, threshold, simple trend, and total consistency. Inputs are resolved approved data, not expressions. Reject non-finite numbers, division by zero, unsupported units, and unbounded collections with stable codes.

- [ ] **Step 5: Implement Evidence Protocol adapter**

Translate only an approved evidence request into the existing bureau Evidence Protocol. Preserve fact-slot, source-order, adoption, citation, snapshot, retry, and degradation semantics from ADR 0028. Return Evidence IDs and limitations, never raw MCP payloads.

- [ ] **Step 6: Run GREEN and the existing Evidence regression**

Run:

```powershell
python -m pytest backend/tests/test_bureau_tool_handlers.py backend/tests/test_agent_evidence_protocol.py backend/tests/test_bureaus_agent.py -q
python -m ruff check backend/app/agents/runtime_skills/tool_handlers.py backend/tests/test_bureau_tool_handlers.py
```

Expected: all tests pass; existing Evidence behavior remains unchanged.

- [ ] **Step 7: Independent review and authorized commit checkpoint**

```powershell
git add backend/app/agents/runtime_skills/tool_handlers.py backend/tests/test_bureau_tool_handlers.py
git commit -m "feat: add read-only bureau tool handlers"
```

### Task 7: Bounded Tool Proposal Loop

**Files:**
- Create: `backend/app/agents/runtime_skills/tool_loop.py`
- Modify: `backend/app/agents/bureaus/prompts.py`
- Test: `backend/tests/test_bureau_tool_loop.py`

**Interfaces:**
- Consumes: current bureau Skill/Policy, descriptor projections, canonical context, model adapter, Policy Gate, Executor, and handlers.
- Produces: `run_bureau_tool_loop(...) -> BureauToolLoopResult` containing final structured synthesis, accepted results, audit refs, consumed budget, and degradation reasons.

- [ ] **Step 1: Write failing loop tests**

Cover zero-tool final response, one/multiple proposals, one invalid proposal plus one correction, two rounds maximum, four calls maximum, duplicate rejection, Tool Result cannot trigger automatic execution, budget exhaustion forces degraded finalization, malformed envelope correction once, and no third model round. Assert exact model call and handler call counts.

- [ ] **Step 2: Run RED**

Run: `python -m pytest backend/tests/test_bureau_tool_loop.py -q`

Expected: FAIL because the loop and prompt envelope do not exist.

- [ ] **Step 3: Add strict model envelopes**

The model may return exactly one of two envelopes: `{"status":"TOOL_CALLS","calls":[...]}` or `{"status":"FINAL","report":{...}}`. Tool descriptors shown to the model are projections of the current policy only. Tool Results are data messages and cannot contain executable descriptors.

- [ ] **Step 4: Implement the state machine**

Parse proposal → gate each call → execute approved calls sequentially → return sanitized results → request final/corrected output. A malformed proposal consumes the single correction opportunity. Denied/failed results consume a call budget and are visible through stable codes. The loop never recursively calls itself.

- [ ] **Step 5: Run GREEN and Ruff**

Run:

```powershell
python -m pytest backend/tests/test_bureau_tool_loop.py -q
python -m ruff check backend/app/agents/runtime_skills/tool_loop.py backend/app/agents/bureaus/prompts.py backend/tests/test_bureau_tool_loop.py
```

Expected: all call-count and terminal-state tests pass.

- [ ] **Step 6: Independent review and authorized commit checkpoint**

```powershell
git add backend/app/agents/runtime_skills/tool_loop.py backend/app/agents/bureaus/prompts.py backend/tests/test_bureau_tool_loop.py
git commit -m "feat: add bounded bureau tool loop"
```

### Task 8: Bureau Production Integration and Upper-Layer Isolation

**Files:**
- Modify: `backend/app/agents/bureaus/agent.py`
- Test: `backend/tests/test_bureau_tool_use_integration.py`
- Test: `backend/tests/test_bureau_runtime_skills.py`
- Test: `backend/tests/test_bureaus_agent.py`
- Test: `backend/tests/test_ministry_runtime_skills.py`
- Test: `backend/tests/test_junjichu_runtime_skill.py`
- Test: `backend/tests/test_chancellor_graph.py`

**Interfaces:**
- Consumes: Tasks 2–7, existing restricted Evidence/report sessions, `_BureauSynthesis`, and `BureauAgentInvocationResult`.
- Produces: production Tool Use inside `invoke_bureau_agent_with_report` without changing its outward signature or `invoke_bureau_agent(...) -> str`.

- [ ] **Step 1: Write failing real-entrypoint tests**

Run the real bureau entrypoint with fake model and restricted adapters. Prove authorization occurs before proposal model/handler/Evidence/accounting effects; invalid binding/service/tool keeps every counter zero. Prove actual supplied callable identity equals the callable consumed by the Tool Executor. Inspect the authorized operation closure and reject Evidence/report sessions inside Tool Loop objects beyond the bureau adapter boundary.

- [ ] **Step 2: Add the 39-bureau behavior matrix**

For each bureau, add one policy-valid tool proposal and one zero-tool final response. Assert professional domain restrictions, final report identity, references, status, audit refs, and no generic policy fallback. Use explicit test cases generated from the authoritative registry, not name interpolation.

- [ ] **Step 3: Run RED**

Run:

```powershell
python -m pytest backend/tests/test_bureau_tool_use_integration.py backend/tests/test_bureau_runtime_skills.py -q
```

Expected: FAIL because production still executes only the current single synthesis path.

- [ ] **Step 4: Integrate inside the existing authorized operation**

Build restricted handlers only after Agent-level authorization. Invoke the bounded Tool Loop for the non-Evidence structured path and adapt Evidence proposals through the existing Evidence session. Feed only Result-Gated refs into `_result_with_runtime_report`. Preserve current legacy Evidence envelope compatibility and never perform a second model call when the model returns an immediate final response.

- [ ] **Step 5: Preserve upper-layer and topology contracts**

Ministry/Junjichu typed handlers continue receiving only restricted Agent invokers and final reports. They must not accept Tool Policy, Tool Executor, Tool Results, approved-data reader, calculator, Evidence session, or MCP client. Assert `build_graph()` still exposes exactly four business nodes.

- [ ] **Step 6: Run GREEN and broad regression**

Run:

```powershell
python -m pytest backend/tests/test_bureau_tool_use_integration.py backend/tests/test_bureau_runtime_skills.py backend/tests/test_bureaus_agent.py backend/tests/test_ministry_runtime_skills.py backend/tests/test_junjichu_runtime_skill.py backend/tests/test_chancellor_graph.py -q
python -m ruff check backend/app backend/tests
```

Expected: all tests pass; plain-string API output remains exact.

- [ ] **Step 7: Independent review and authorized commit checkpoint**

```powershell
git add backend/app/agents/bureaus/agent.py backend/tests/test_bureau_tool_use_integration.py backend/tests/test_bureau_runtime_skills.py backend/tests/test_bureaus_agent.py backend/tests/test_ministry_runtime_skills.py backend/tests/test_junjichu_runtime_skill.py backend/tests/test_chancellor_graph.py
git commit -m "feat: integrate controlled bureau tool use"
```

### Task 9: Acceptance Runner, Full Regression, and Ten Consecutive Rounds

**Files:**
- Create: `scripts/run_bureau_tool_use_acceptance.ps1`
- Create: `scripts/run_bureau_tool_use_acceptance.test.ps1`
- Modify: `docs/product/tasks/2026-08-03-bureau-agent-tool-use.md`
- Record: `.superpowers/sdd/bureau-agent-tool-use-acceptance.log`
- Record: `.superpowers/sdd/bureau-agent-tool-use-evidence/`

**Interfaces:**
- Consumes: final frozen implementation and all prior task tests.
- Produces: reproducible manifest/fingerprint, raw per-command evidence, 10 consecutive accepted rounds, product acceptance state, and post-document checks.

- [ ] **Step 1: Write runner RED tests**

Test missing runner first, then require manifest algorithm/included/excluded lists, per-command stdout/stderr/exit/timestamps/bytes, secret-pattern redaction, immediate stop on nonzero exit, `completed_rounds=0` on failure, start/end fingerprint equality, and `formal_round=false` for post-document checks.

- [ ] **Step 2: Implement and self-test the runner**

The fingerprint must include production code, tests, ADR 0037, design, plan, product acceptance criteria, runner, and harness configuration. It may exclude raw evidence and explicitly named post-acceptance status fields only. Use Windows PowerShell-compatible APIs and check `$?` for PowerShell script invocation plus `$LASTEXITCODE` for native commands.

Run: `& .\scripts\run_bureau_tool_use_acceptance.test.ps1`

Expected: self-test prints a PASS marker and proves a forced exit `7` stops at zero accepted rounds.

- [ ] **Step 3: Run one fresh preflight**

Fixed command matrix:

```powershell
python -m pytest backend/tests/test_bureau_tool_models.py backend/tests/test_bureau_tool_registry.py backend/tests/test_bureau_tool_policy.py backend/tests/test_bureau_tool_executor.py backend/tests/test_bureau_tool_handlers.py backend/tests/test_bureau_tool_loop.py backend/tests/test_bureau_tool_use_integration.py -q
python -m pytest backend/tests/test_bureaus_agent.py backend/tests/test_agent_evidence_protocol.py backend/tests/test_ministry_runtime_skills.py backend/tests/test_junjichu_runtime_skill.py backend/tests/test_chancellor_graph.py backend/tests/test_downstream_runtime_skill_compatibility.py -q
python -m ruff check backend/app backend/tests
python -m pytest backend/tests -q
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
cmd /d /c "git diff --check 2>&1"
```

Expected: all commands exit `0`; existing LF/CRLF warnings may remain on diff stderr only when exit is `0`.

- [ ] **Step 4: Freeze and execute 10 consecutive rounds**

Run the exact matrix on one fingerprint. Record Round 1 through Round 10 with start/end full fingerprint, exact commands, exits, counts, timestamps, and raw evidence paths. Any failure, fingerprint mismatch, or substantive implementation/config/runner change stops the run and resets accepted rounds to zero.

- [ ] **Step 5: Independent evidence review**

Reviewer independently recalculates every manifest hash and aggregate fingerprint; checks 10 rounds, 90 commands, zero nonzero exits, continuous boundaries, all stdout/stderr files, sampled focused/regression/full-suite counts, and historical failed attempts marked invalid/non-counting.

- [ ] **Step 6: Independent whole-branch review**

Reviewer reads actual modified and untracked files, not only commit diffs. Reject any post-authorization handler activity, hidden direct Evidence/MCP path, upper-layer Tool leak, policy fallback, model-owned authority, false-green test, topology change, or ADR 0028 alteration.

- [ ] **Step 7: Write final product state and post-document evidence**

Only after both reviews approve, mark the product task `Accepted`, check satisfied criteria, mark historical attempts invalid, and run four harness commands plus staged-aware diff check. Save stdout/stderr/exit/timestamps as `formal_round=false`; recalculate the accepted fingerprint and prove it is unchanged under the documented exclusions.

- [ ] **Step 8: Authorized final commit and push only if separately requested**

Before any Git write, print and verify absolute workspace, branch, HEAD, and status. Then, if explicitly authorized:

```powershell
git add --all
git diff --cached --check
git commit -m "feat: add controlled tool use for bureau agents"
git push origin harness-only
```

Expected: local and `origin/harness-only` resolve to the same new commit; worktree is clean.
