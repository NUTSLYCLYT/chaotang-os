# Task: Controlled Tool Use for bureau Agents

> This task must preserve `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`. If implementation conflicts with that baseline, the task becomes `Blocked`; implementation may not change or bypass the baseline.

## Status

<!-- ACCEPTANCE-FP-BEGIN:STATUS -->Accepted<!-- ACCEPTANCE-FP-END:STATUS -->

## Product Definition

- User confirmation: the user confirmed the complete design in `docs/superpowers/specs/2026-08-03-bureau-agent-tool-use-design.md` on 2026-08-03.
- Problem: the 39 bureau Agents need bounded, professional read-only Tool Use without transferring identity, approval, execution, evidence, or audit authority to the model.
- Target users: users submitting decrees through the existing Chancellor flow, and operators maintaining or auditing bureau Agent behavior.
- Goal: give exactly 39 bureau Agents controlled access to four shared read-only tools, with one explicit professional Tool Policy per bureau. The model proposes calls; the system validates, approves, executes, gates results, and returns only a final `BureauReport` to upper layers.
- Non-goals: Tool Use for ministries, Junjichu, or the Chancellor; arbitrary SQL, code, Shell, filesystem, network, direct MCP, or write operations; a second Evidence path; new LangGraph business nodes; production-service enablement.

## Acceptance Criteria

<!-- ACCEPTANCE-FP-BEGIN:AC-01 -->- [x]<!-- ACCEPTANCE-FP-END:AC-01 --> **Task 2:** Structured proposal/result/status/audit contracts exist for exactly four read-only tools: `request_evidence`, `read_approved_materials`, `inspect_approved_data`, and `compute_analysis`; model-supplied authority, provider, credential, executor, URL, database, and audit fields are rejected or ignored in favor of system-owned values.
<!-- ACCEPTANCE-FP-BEGIN:AC-02 -->- [x]<!-- ACCEPTANCE-FP-END:AC-02 --> **Task 3:** A shared descriptor registry exposes the four tools without granting permissions, and startup validation proves exactly 39 distinct bureau Runtime Skills each own one explicit, unique, professionally scoped Tool Policy; missing, duplicate, unknown-tool, cross-domain, or generic-fallback policies fail closed.
<!-- ACCEPTANCE-FP-BEGIN:AC-03 -->- [x]<!-- ACCEPTANCE-FP-END:AC-03 --> **Task 4:** `ToolPolicyGate` derives Agent, Skill, and case/decree identity from canonical system context, overrides and validates model identity fields, enforces arguments, data domains, approved refs, business state, duplicate rules, and budgets, and causes zero downstream effects when authorization fails.
<!-- ACCEPTANCE-FP-BEGIN:AC-04 -->- [x]<!-- ACCEPTANCE-FP-END:AC-04 --> **Task 5:** `ToolExecutor` and `ResultGate` execute only approved descriptor/handler pairs inside the existing `run_authorized_runtime_operation` boundary; results are schema-checked, scoped, bounded, redacted, referenced, and audited without exposing credentials, raw exceptions, provider responses, paths, or secret data.
<!-- ACCEPTANCE-FP-BEGIN:AC-05 -->- [x]<!-- ACCEPTANCE-FP-END:AC-05 --> **Task 6:** All four handlers are read-only and accept only canonical approved references and restricted adapters. `request_evidence` is solely an adapter over the existing ADR 0028 Evidence Protocol; no arbitrary SQL/code/Shell/filesystem/network/direct MCP/write operation or production database dependency is introduced.
<!-- ACCEPTANCE-FP-BEGIN:AC-06 -->- [x]<!-- ACCEPTANCE-FP-END:AC-06 --> **Task 7:** Each bureau invocation supports the existing zero-tool final-response path and at most four tool calls across at most two proposal/result rounds; duplicates, recursive/automatic execution from Tool Results, third rounds, and budget overflow are rejected or produce an explicit degraded final result.
<!-- ACCEPTANCE-FP-BEGIN:AC-07 -->- [x]<!-- ACCEPTANCE-FP-END:AC-07 --> **Task 8:** Production integration preserves `invoke_bureau_agent(...) -> str`, the existing plain-string bureau API, ministry aggregation, Junjichu review, Chancellor behavior, and the four-node LangGraph topology. Ministries, Junjichu, and the Chancellor receive only the final `BureauReport`, never Tool Policy, Tool Executor, Tool Results, approved-data readers, Evidence/MCP sessions, or credentials.
<!-- ACCEPTANCE-FP-BEGIN:AC-08 -->- [x]<!-- ACCEPTANCE-FP-END:AC-08 --> **Tasks 4-8:** Negative and compatibility tests prove the model proposes but never authorizes or executes; system-derived identity prevails; denied activity has zero model/handler/Evidence/data/calculation side effects; the existing ADR 0028 evidence, adoption, citation, snapshot, retry, degradation, and archive semantics remain unchanged.
<!-- ACCEPTANCE-FP-BEGIN:AC-09 -->- [x]<!-- ACCEPTANCE-FP-END:AC-09 --> **Task 9:** A dedicated acceptance runner records a reproducible frozen-version fingerprint and command evidence. The same final code, configuration, documentation, and acceptance flow pass at least 10 complete consecutive rounds; any failure or substantive code/configuration/acceptance-flow change resets counting to round 1.
<!-- ACCEPTANCE-FP-BEGIN:AC-10 -->- [x]<!-- ACCEPTANCE-FP-END:AC-10 --> **Task 9:** Real model, real MCP, production database, production write, credentials, paid-service, and external-network checks remain explicitly unauthorized and unrun unless separately authorized; offline acceptance does not imply those integrations work or are approved.

## Delivery Constraints

- Scope: exactly 39 bureau Agents. The only allowed implementation paths are `backend/app/agents/runtime_skills/**`; necessary bureau integration and prompts under `backend/app/agents/bureaus/**`; related `backend/tests/**`; the relevant ADR, product task, design, plan, and progress documents under `docs/**`; and the dedicated bureau Tool Use acceptance runner and evidence paths under `scripts/**` and `.superpowers/sdd/bureau-agent-tool-use-*`.
- Compatibility: preserve the current plain-string bureau API, ministry, Junjichu, Chancellor, zero-tool path, four-node graph, and ADR 0028 Evidence Protocol and archive semantics.
- Risks and limits: phase 1 is read-only and fail-closed. No arbitrary SQL/code/Shell/filesystem/network/direct MCP/write operation is authorized. Real model/MCP/production DB/write/credentials/paid/external-network checks require separate authorization.
- Skill plan: use `codex-engineering-workflow`; use `brainstorming` only for newly unresolved product design, `test-driven-development` for Tasks 2-8 behavior changes, and `verification-before-completion` before completion claims.
- Codex-only: yes. Do not use Claude CLI, Claude delivery runner mode, or `gstack-claude`.

## Affected Modules

- 模块：shared Tool contracts/registry/policy/gate/executor/result/audit/handlers/loop; bureau integration and prompts; compatibility and acceptance tests; product and architecture documentation.
- 允许路径：the exact path families listed in Delivery Constraints; no other production area is authorized.
- 依赖模块：existing downstream Runtime Skill registry/executor, bureau Agent entrypoint, ADR 0028 Evidence Protocol, final `BureauReport`, and existing upper-layer orchestration.

## Technical Plan

- Architecture boundary: Tool Calls are untrusted model proposals. System gates own canonical identity and authorization; the gate, executor, handlers, result gate, and audit operate inside the current Agent authorization closure.
- Interfaces and dependencies: shared descriptors describe capabilities; 39 explicit policies grant bounded professional access; restricted handlers consume only approved refs/adapters; upper layers consume only final reports.
- Implementation order: Task 2 contracts; Task 3 registry/policies; Task 4 policy gate; Task 5 executor/result/audit; Task 6 handlers; Task 7 bounded loop; Task 8 bureau integration and compatibility; Task 9 frozen acceptance.
- Verification plan: run focused contract, policy, authorization, executor, handler, loop, integration, Evidence, upper-layer, topology, lint, backend regression, harness, and diff checks from the plan; then run the unchanged acceptance matrix for 10 consecutive complete rounds with per-round evidence.
- Technical risks: forged model authority, cross-bureau data access, duplicate or recursive calls, unbounded results, sensitive exception leakage, a second Evidence/MCP path, Tool leakage to upper layers, topology drift, and false-green acceptance. Tests and fail-closed startup/runtime gates must cover each risk.

## Implementation Report

<!-- ACCEPTANCE-FP-BEGIN:IMPLEMENTATION -->
- Change summary: Tasks 1-9 implement the four read-only tools, 39 explicit bureau
  policies, fail-closed policy/executor/result gates, restricted handlers, bounded
  tool loop, bureau integration, compatibility, and the auditable acceptance runner.
- Security remediation: server-owned audit references, sealed constant-memory
  issuance, current Descriptor/Policy identity revalidation, audited authority-drift
  failure handling, and exact post-acceptance fingerprint normalization are complete.
- Review: the independent whole-branch review and independent Evidence review both
  returned `APPROVED` for the final accepted candidate.
- Verification: frozen fingerprint
  `97c08d5aa1fa186083eda45edef8178fd3565826303b6887b277d8b117943e6b`
  passed 10 consecutive formal rounds and all 90 formal commands.
- Actual skills used: `using-superpowers`, `codex-engineering-workflow`,
  `systematic-debugging`, `test-driven-development`, `record-failure`, and
  `verification-before-completion` across the implementation and acceptance tasks.
- Unrun items and reasons: real model/MCP/production DB/write/credentials/paid/external-network checks are unauthorized unless separately approved.
- Residual risks: real model/MCP/production integrations remain unverified and
  unauthorized; offline acceptance does not authorize them.
<!-- ACCEPTANCE-FP-END:IMPLEMENTATION -->

## Acceptance Review

<!-- ACCEPTANCE-FP-BEGIN:ACCEPTANCE-REVIEW -->
- Acceptance result: `Accepted`.
- Accepted fingerprint: `97c08d5aa1fa186083eda45edef8178fd3565826303b6887b277d8b117943e6b`.
- Formal evidence: 10/10 consecutive rounds and 90/90 commands passed with zero
  nonzero exits, fingerprint drift, missing streams, byte mismatches, or secret hits.
- Independent reviews: whole-branch `APPROVED`; Evidence `APPROVED`.
- Historical runs `7d7d2538...`, `2fbc7e11...`, and `519a4228...` are invalid and
  non-counting after substantive changes or evidence-contract rejection.
- Minor historical detail: candidate `858c64d3...` stopped during preflight at the
  harness marker-compatibility check, completed zero formal rounds, and is non-counting.
- Post-document checks are recorded separately with `formal_round=false` and must
  preserve the accepted fingerprint under the exact 13-block normalization contract.
<!-- ACCEPTANCE-FP-END:ACCEPTANCE-REVIEW -->
