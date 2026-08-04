# Controlled Tool Use for bureau Agents

## Status

Accepted - 2026-08-03

## Context

The repository has one immutable Runtime Skill per downstream Agent and a shared executor that validates Agent identity, service permissions, and report contracts before effects occur. Exactly 39 bureau Agents now need bounded analytical Tool Use, while ADR 0028 must remain the only Evidence path and existing bureau, ministry, Junjichu, Chancellor, and LangGraph contracts must remain compatible.

A model cannot be trusted to grant itself identity, permissions, budgets, data scope, execution authority, credentials, provider access, or audit fields. Tool support therefore cannot be a direct model-to-handler, model-to-database, or model-to-MCP connection, and it cannot create a second execution boundary alongside the existing Agent authorization boundary.

## Decision

A Tool Call is an untrusted model proposal, never authority. Canonical Agent, Runtime Skill, case, and decree identity are derived from system context. The system overrides and validates model identity fields; the model cannot select permissions, credentials, providers, executors, URLs, database objects, audit metadata, or result status.

The `ToolPolicyGate`, `ToolExecutor`, handlers, `ResultGate`, and system-owned audit execute inside the existing `run_authorized_runtime_operation` boundary. Authorization must precede model proposal and every handler, Evidence, data, calculation, and audit side effect. Failed authorization is fail-closed and leaves downstream effect counts at zero.

Tool descriptors are shared and describe four phase-1 read-only capabilities: `request_evidence`, `read_approved_materials`, `inspect_approved_data`, and `compute_analysis`. Descriptors grant no authority. Each of the 39 bureau Runtime Skills owns a separate explicit professional Tool Policy controlling tools, arguments, data domains, required approved references, and result/call/round budgets. Missing, duplicate, unknown, cross-domain, or fallback policy configuration fails closed.

`request_evidence` is an adapter over the existing ADR 0028 Evidence Protocol. It preserves the existing fact-slot, source-order, adoption, citation, snapshot, retry, degradation, and archive semantics and returns controlled Evidence references, never raw MCP responses. It is not a second Evidence or MCP path and does not amend ADR 0028.

Only sanitized, schema-valid, case-scoped, size-bounded Tool Results may return to the bureau model for synthesis. Upper layers receive only the final `BureauReport`; ministries, Junjichu, and the Chancellor do not receive Tool descriptors, policies, calls, executors, results, approved-data readers, Evidence/MCP sessions, credentials, or provider configuration. The existing plain-string bureau API and zero-tool path remain valid.

The final `BureauReport` carries the ordered, redacted `audit_refs` emitted by the bounded Tool Loop. The field defaults to an empty tuple for zero-tool and legacy serialized reports; it never contains raw arguments, results, exceptions, credentials, or provider details.

No LangGraph business node is added. The existing four-node topology continues to orchestrate the Chancellor flow, and Tool Use remains an internal bounded bureau operation. Phase 1 is read-only and fail-closed: it provides no arbitrary SQL, code, Shell, filesystem, general network, direct MCP, or write operation.

Alternatives considered and rejected:

- Direct model function, database, MCP, or network access was rejected because it would make model output operational authority and expose credentials or unrestricted data scope.
- One generic policy shared by all bureaus was rejected because shared descriptors must not collapse 39 professional permission and data-domain boundaries.
- A second Evidence toolchain was rejected because it would bypass ADR 0028 governance, adoption, citation, and snapshot rules.
- New Tool or bureau LangGraph nodes were rejected because Tool Use is internal to a bureau invocation and upper layers must remain isolated from Tool objects.
- Write-capable phase-1 tools were rejected because the confirmed scope is controlled read-only analysis and production writes require a separate decision and authorization.

This ADR records architecture only. It does not authorize real models, real MCP, production databases, production writes, credentials, paid services, external networks, deployment, or any other production service. It does not authorize modifying, bypassing, or replacing ADR 0028.

## Consequences

- Benefit: model reasoning can request bounded professional information and deterministic analysis without acquiring execution authority.
- Benefit: shared descriptors and handlers avoid duplicated implementations, while 39 explicit Tool Policies preserve bureau-specific least privilege.
- Benefit: existing Agent authorization, Evidence governance, upper-layer report contracts, zero-tool behavior, plain-string API, and four-node topology remain intact.
- Benefit: denial, execution, result shaping, and audit behavior can be tested independently with stable system-owned identities and reason codes.
- Cost: every bureau policy, descriptor, handler, gate, result schema, and budget requires startup validation and negative testing; policy evolution is intentionally explicit.
- Cost: phase 1 cannot answer requests requiring an unavailable approved reader, direct production integration, arbitrary queries, or writes; such requests must be blocked or degraded rather than bypass controls.
- Risk: a faulty adapter could create a hidden second Evidence/MCP path or leak Tool objects upward. Integration and compatibility tests must prove the single boundary and final-report-only contract.
- Governance: later production-service enablement, write capability, new topology, or changes to ADR 0028 require separate user authorization and, when architectural, a new or revised ADR.

## Verification

### Approved in-memory data boundary

`invoke_bureau_agent_with_report` accepts optional keyword-only
`approved_data_inputs`. Callers provide logical names and values with exactly
`columns`, `rows`, `values`, and `unit`, never canonical identifiers. Only after
runtime authorization does the boundary deep-copy each payload and mint its
case/decree-scoped `approved-data:` ref. Inspect and compute receive only Policy
Gate-selected refs; legacy `approved_data_refs` remains reference-only.

- `node scripts/check_harness.mjs`
- `git diff --check -- docs/product/tasks/2026-08-03-bureau-agent-tool-use.md docs/decisions/0037-bureau-agent-controlled-tool-use.md`
- Tasks 2-8 provide focused contract, policy, authorization, executor, handler, loop, integration, Evidence, upper-layer, and four-node topology tests.
- Task 9 runs one frozen final implementation and acceptance flow for at least 10 complete consecutive passing rounds, resetting to round 1 after any failure or substantive change.
