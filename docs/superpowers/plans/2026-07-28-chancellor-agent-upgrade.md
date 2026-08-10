# Chancellor Agent Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Chancellor Agent into an intent compiler that investigates with the smallest useful department set, presents one editable draft edict, and creates a Mission only after the user clicks 【下旨】.

**Architecture:** Add a pre-issuance `ChancellorDraftSession`/revision lifecycle separate from the existing `DecisionTask`/Mission lifecycle. Keep the existing routing, Outbox, Junjichu, department execution, return-memorial, and archive paths after issuance. The backend remains authoritative for completeness, permissions, semantic preservation, idempotency, Mission creation, and audit; the frontend only renders backend facts and exposes the two primary actions 【拟旨】 and 【下旨】.

**Tech Stack:** Python backend contracts/services/routers/tests, TypeScript/React frontend adapters/components/tests, existing SQLite/ORM persistence, existing Harness doctors and browser evidence.

## Global Constraints

- Do not modify product code until `node scripts/execution-authority-v2.mjs --authorize --work-package <approved-R0-Wxx>` returns `GO`; current state is `STOP` because the active packet EXT ref does not match pinned HEAD.
- The pre-issuance path must not create `DecisionTask`, Mission, department notifications, or execution-state transitions.
- Public statuses are exactly `CLARIFYING`, `DRAFT_READY`, `NEEDS_INPUT`, `PARTIAL`, `ISSUE_BLOCKED`, `ISSUED`, `EXECUTING`, and `RETURNED`.
- Only 【拟旨】 and 【下旨】 are primary user actions; “确认拟旨”“确认需求”“润色”“确认发起” must not remain primary buttons.
- Automatic polishing may change presentation only; semantic changes must emit `CONTENT_CHANGED` and return to clarification.
- Department selection, permissions, routing, completeness, and Mission creation are server-authoritative.
- Preserve raw user input, every draft revision, superseded revisions, evidence provenance, and append-only audit events.
- No new dependency, no product/production operation, no push/merge/deploy in this plan.

---

### Task 1: Establish the draft-session contract and public state adapter

**Files:**
- Create: `backend/src/chancellor/draft_contracts.py`
- Modify: `backend/src/chancellor/contracts.py`
- Modify: `backend/src/chancellor/decree_status.py`
- Test: `backend/tests/test_chancellor_draft_contracts.py`
- Test: `backend/tests/test_chancellor_public_status.py`

**Interfaces:**
- Produce `ChancellorDraftSession`, `DraftRevision`, `IntentEvidence`, `DepartmentRecommendation`, `DraftCompleteness`, and `IssueBlocker` types.
- Produce `to_public_chancellor_status(internal_state) -> Literal[...]`.
- `DraftRevision` must include `draft_session_id`, `revision`, `status`, `semantic_digest`, `supersedes_revision`, and immutable input/evidence snapshots.

- [ ] **Step 1: Write failing contract tests** for all eight public statuses, required draft fields, immutable revision identity, and rejection of unknown public statuses.
- [ ] **Step 2: Run focused tests** with `pytest backend/tests/test_chancellor_draft_contracts.py backend/tests/test_chancellor_public_status.py -q`; expect failures because the contracts do not exist.
- [ ] **Step 3: Implement the smallest typed contracts and mapping adapter** without changing post-issuance execution semantics.
- [ ] **Step 4: Re-run focused tests** and verify all pass.
- [ ] **Step 5: Run existing Chancellor contract tests** to prove `RouteDecisionV2` compatibility.

### Task 2: Build intent analysis, minimal confirmation, and adaptive department planning

**Files:**
- Create: `backend/src/chancellor/intent_compiler.py`
- Create: `backend/src/chancellor/department_planner.py`
- Modify: `backend/src/shangshufang_loop.py`
- Test: `backend/tests/test_chancellor_intent_compiler.py`
- Test: `backend/tests/test_chancellor_department_planner.py`

**Interfaces:**
- `compile_intent(raw_inputs, context) -> IntentAnalysis`.
- `select_minimal_departments(intent, risk, evidence_gaps) -> list[DepartmentRecommendation]`.
- `build_confirmation_edict(analysis, recommendations) -> DraftRevision`.

- [ ] **Step 1: Write RED tests** covering facts vs inference vs unknowns, ranked intent candidates, one highest-impact confirmation field, and minimum department sets.
- [ ] **Step 2: Run the focused tests** and confirm RED.
- [ ] **Step 3: Implement deterministic rules around the existing Chancellor routing service; do not let user preferences or client department lists become authorization.**
- [ ] **Step 4: Add adaptive escalation rules:** low-risk uses the smallest set; high-risk adds御史台; strategic forecasts add钦天监 and史馆; legal/money/security force higher processing depth.
- [ ] **Step 5: Run focused and existing golden-case tests** and verify no route regressions.

### Task 3: Persist draft revisions without creating a Mission

**Files:**
- Create: `backend/src/chancellor/draft_session_store.py`
- Modify: `backend/web/routers/shangshufang.py`
- Modify: `backend/src/decision_task_kernel.py` only where the formal-task boundary is enforced
- Test: `backend/tests/test_chancellor_draft_session_api.py`
- Test: `backend/tests/test_draft_does_not_create_mission.py`

**Interfaces:**
- `create_draft_session(...) -> ChancellorDraftSession`.
- `append_draft_revision(session_id, revision_input) -> DraftRevision`.
- `get_current_draft_revision(session_id) -> DraftRevision`.

- [ ] **Step 1: Write RED integration tests** proving `/draft-edict` creates only a draft session and leaves Mission/DecisionTask counts unchanged.
- [ ] **Step 2: Run the tests** and capture the current violation where `/draft-edict` creates `DecisionTask`.
- [ ] **Step 3: Add draft-session persistence and revision supersession.** Preserve the compatibility response fields needed by existing clients, but return a draft-session identity rather than a formal task identity for the new flow.
- [ ] **Step 4: Ensure user disagreement appends a revision and marks the prior revision `SUPERSEDED`; old revisions cannot issue.
- [ ] **Step 5: Re-run draft API and existing router tests.

### Task 4: Add semantic-preserving polishing and content-change blocking

**Files:**
- Create: `backend/src/chancellor/semantic_guard.py`
- Modify: `backend/web/routers/shangshufang.py`
- Modify: `frontend/src/features/shangshufang/ShangshufangPage.tsx` only after backend contract is accepted
- Test: `backend/tests/test_chancellor_semantic_guard.py`
- Test: `backend/tests/test_polish_content_changed.py`

**Interfaces:**
- `extract_semantic_fields(draft) -> SemanticSnapshot`.
- `polish_draft(draft) -> PolishResult`.
- `PolishResult.content_changed` must be authoritative on the server.

- [ ] **Step 1: Write RED tests** for wording-only changes, target/scope/department/permission/output changes, duplicate fields, and fallback polish.
- [ ] **Step 2: Run focused tests** and confirm RED.
- [ ] **Step 3: Implement semantic snapshots and comparison over goal, scope, exclusions, departments, inputs, outputs, permissions, acceptance criteria, and stop conditions.
- [ ] **Step 4: Route `CONTENT_CHANGED` to `CLARIFYING`; only unchanged semantics may reach `DRAFT_READY`.
- [ ] **Step 5: Run existing polish tests and record provenance/source labels for model or fallback output.

### Task 5: Make 【下旨】 the single atomic execution gateway

**Files:**
- Create: `backend/src/chancellor/issue_service.py`
- Modify: `backend/web/routers/shangshufang.py`
- Modify: `backend/src/execution/decree_dispatcher.py`
- Test: `backend/tests/test_chancellor_issue_service.py`
- Test: `backend/tests/test_issue_idempotency.py`

**Interfaces:**
- `issue_draft(session_id, revision, content_digest, actor, idempotency_key) -> IssueResult`.
- `IssueResult` returns `mission_id`, `task_id`, `edict_revision`, route snapshot, and public status.

- [ ] **Step 1: Write RED tests** for incomplete drafts, stale revisions, digest mismatch, permission blocks, duplicate requests, and successful atomic issue.
- [ ] **Step 2: Run tests** and confirm no Mission is created on any failed gate.
- [ ] **Step 3: Implement one transaction that validates the latest draft, persists the final edict snapshot, creates Mission/DecisionTask, stores route and permission snapshots, writes audit, and enqueues the Outbox event.
- [ ] **Step 4: Make repeated idempotency keys return the original Mission without duplicate notifications.
- [ ] **Step 5: Re-run dispatcher, routing, mission-confirmation, and single-writer tests.

### Task 6: Upgrade the frontend to the two-button editable-edict experience

**Files:**
- Modify: `frontend/src/core/courtos/interaction/chancellor-concierge.ts`
- Modify: `frontend/src/lib/jiqun-api.ts`
- Modify: `frontend/src/features/shangshufang/components/DecreeInput.tsx`
- Modify: `frontend/src/features/shangshufang/ShangshufangPage.tsx`
- Test: `frontend/src/core/courtos/interaction/interaction.nodetest.ts`
- Test: `frontend/src/features/shangshufang/edict-draft-flow.nodetest.ts`

**Interfaces:**
- Typed adapter for draft-session creation, revision append, current draft retrieval, and issue request.
- UI state must derive from backend public status and blocker fields.

- [ ] **Step 1: Write RED browser/component tests** proving only 【拟旨】 and 【下旨】 are primary actions, 【下旨】 is disabled before `DRAFT_READY`, and user edits create a new revision.
- [ ] **Step 2: Remove separate primary “润色/确认拟旨/确认发起” actions; represent “内容不变，润色即可” as a secondary draft choice or natural-language command.
- [ ] **Step 3: Render one待确认拟旨 card with editable pending fields, department rationale, evidence summary, risks, and version diff.
- [ ] **Step 4: Connect 【下旨】 only to the server issue endpoint; never create a Mission from client state.
- [ ] **Step 5: Run frontend contract tests and Playwright evidence against live backend facts.

### Task 7: Add evidence, red-team, prediction, and history hooks

**Files:**
- Create: `backend/src/chancellor/evidence_budget.py`
- Create: `backend/src/chancellor/prediction_contracts.py`
- Create: `backend/src/chancellor/audit_events.py`
- Modify: `backend/src/chancellor/draft_session_store.py`
- Test: `backend/tests/test_chancellor_evidence_budget.py`
- Test: `backend/tests/test_prediction_contracts.py`
- Test: `backend/tests/test_chancellor_audit_replay.py`

**Interfaces:**
- `choose_evidence_budget(risk, complexity) -> EvidenceBudget`.
- `create_prediction_contract(...) -> PredictionContract`.
- `replay_chancellor_audit(session_id) -> ReplayResult`.

- [ ] **Step 1: Write RED tests** for evidence levels E0–E5, mandatory counter-evidence on major predictions, failure conditions, monitoring metrics, and append-only replay.
- [ ] **Step 2: Implement budgeted investigation and provenance labels without fabricating unavailable sources.
- [ ] **Step 3: Add post-result fields for actual outcome, prediction score, failure reason, and controlled learning candidate.
- [ ] **Step 4: Ensure history suggestions cannot silently rewrite prompts or permissions.
- [ ] **Step 5: Run evidence and audit tests.

### Task 8: Harness, compatibility, and acceptance verification

**Files:**
- Modify: `backend/tests/test_chancellor_golden_cases.py`
- Modify: `backend/tests/test_chancellor_router.py`
- Modify: `frontend/src/features/shangshufang/api/contract-baseline.nodetest.ts`
- Modify: relevant `.harness/changes/` record and product documentation

- [ ] **Step 1: Add end-to-end golden cases:** vague request, disagreement, unchanged polish, semantic-change block, high-risk block, and successful issue.
- [ ] **Step 2: Run backend authority tests, amendment checker, backend doctor, and relevant Harness gates.
- [ ] **Step 3: Run frontend type/lint/unit checks and Playwright browser evidence; do not substitute mock evidence for live backend evidence.
- [ ] **Step 4: Verify pre-issue Mission count, post-issue transaction atomicity, status mappings, event order, idempotency, immutable revisions, whitespace, and prohibited paths.
- [ ] **Step 5: Obtain independent review and Codex acceptance from the exact candidate state before claiming completion.

## Verification and stop conditions

- Stop immediately if execution authority remains `STOP`, a required source is missing, a test or doctor fails, a public status is invented, a pre-issue Mission is created, semantic polishing changes scope silently, or a path leaves the approved allowlist.
- Do not activate, sign, push, merge, deploy, change Gitee rules, use production data, or release Window 2–5 without separate explicit authorization.

## Plan self-review

- The plan covers the approved design: intent candidates, one-card confirmation, minimal departments, evidence budget, red-team review, action-oriented predictions, draft/mission separation, semantic polish guard, two-button UI, audit/versioning, and controlled learning.
- Every implementation task has concrete files, interfaces, RED/GREEN verification, and a bounded deliverable.
- Current execution authority is still `STOP`; implementation is not authorized by this plan alone.
