# Chancellor Draft Edict Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a runtime Chancellor draft flow that loads `chancellor-draft-edict`, produces versioned case-driven drafts, and gates the existing decree flow behind the current `DRAFT_READY` draft.

**Architecture:** A new backend `chancellor_draft` package owns Skill loading, strict model parsing, canonical draft serialization, and fingerprints. A dedicated authenticated FastAPI endpoint and Next.js BFF expose the flow; `/study` keeps draft state separate from consultation and submits only the visible current draft to the existing decree endpoint.

**Tech Stack:** Python 3.12+, FastAPI, LangGraph-compatible injected chat model, Pydantic, Next.js App Router, React, TypeScript, Node `node:test`.

## Global Constraints

- Do not change ADR 0028's post-decree execution topology.
- Drafting must not call decree, ministries, Junjichu, Jinyiwei, Shiguan, or Mission creation.
- Only `DRAFT_READY` with the current fingerprint can enable decree submission.
- Tests use injected fake models and in-memory fetch; no real model, network, decree, or archive.
- Preserve all unrelated dirty-worktree changes.
- Do not commit without separate user authorization.

---

### Task 1: Runtime Skill loader and draft model parser

**Files:**
- Create: `backend/app/agents/chancellor_draft/__init__.py`
- Create: `backend/app/agents/chancellor_draft/skill_loader.py`
- Create: `backend/app/agents/chancellor_draft/models.py`
- Create: `backend/tests/test_chancellor_draft_skill_loader.py`

**Interfaces:**
- Produces: `load_chancellor_draft_skill(repo_root: Path | None = None) -> str`
- Produces: `parse_draft_model_output(raw: object, previous_version: int) -> ChancellorDraftResult`

- [ ] Write tests that reject missing, oversized, wrong-name, anchor-incomplete and non-UTF-8 Skill files, and accept the repository Skill.
- [ ] Run `backend/.venv/Scripts/python.exe -m pytest tests/test_chancellor_draft_skill_loader.py -q` and verify failure because the package is missing.
- [ ] Implement fixed-path resolution, 64 KiB limit, frontmatter/name/anchor validation, strict status and draft-field parsing, canonical JSON serialization and SHA-256 fingerprint.
- [ ] Re-run the test and verify PASS.

### Task 2: Draft graph and authenticated FastAPI endpoint

**Files:**
- Create: `backend/app/agents/chancellor_draft/graph.py`
- Create: `backend/app/api/chancellor_draft.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_chancellor_draft_graph.py`
- Create: `backend/tests/test_chancellor_draft_api.py`

**Interfaces:**
- Consumes: validated Skill text and strict alternating messages.
- Produces: `build_chancellor_draft_graph(chat_model=None, skill_text=None, dotenv_path=None)`
- Produces: `POST /api/v1/chancellor-drafts`

- [ ] Write graph tests asserting the system prompt contains the loaded Skill and that one fake model call returns the strict case/draft contract.
- [ ] Write API tests for authentication, input bounds, success, validation zero-call, config/model failure sanitization, and proof that decree/ministry/archive modules are not imported.
- [ ] Run both test files and verify failure because graph/API do not exist.
- [ ] Implement the minimal graph, request/response models, handlers and router registration.
- [ ] Re-run both test files and verify PASS.

### Task 3: Next.js backend client and authenticated BFF

**Files:**
- Modify: `frontend/src/lib/backendClient.ts`
- Modify: `frontend/src/lib/backendClient.test.ts`
- Create: `frontend/src/app/api/drafts/chancellor/route.ts`
- Create: `frontend/src/app/api/drafts/chancellor/route.test.ts`

**Interfaces:**
- Produces: `submitChancellorDraft(messages, options) -> Promise<SubmitChancellorDraftResult>`
- Produces: browser endpoint `POST /api/drafts/chancellor`

- [ ] Add failing client tests for strict success parsing, status/draft consistency, timeout, network and malformed response.
- [ ] Add failing BFF tests for 401-before-backend, malformed request rejection, Bearer-only forwarding and stable error mapping.
- [ ] Run the targeted Node tests and verify failure because exports/files are missing.
- [ ] Implement client types/parser and BFF using the existing server-only authentication pattern.
- [ ] Re-run targeted tests and verify PASS.

### Task 4: Study draft state and case-driven UI

**Files:**
- Create: `frontend/src/app/study/chancellorDraftStatus.ts`
- Create: `frontend/src/app/study/chancellorDraftStatus.test.ts`
- Create: `frontend/src/app/study/chancellorDraftSubmission.ts`
- Create: `frontend/src/app/study/chancellorDraftSubmission.test.ts`
- Create: `frontend/src/app/study/chancellorDraftPersistence.ts`
- Create: `frontend/src/app/study/chancellorDraftPersistence.test.ts`
- Modify: `frontend/src/app/study/StudyClient.tsx`
- Modify: `frontend/src/app/study/StudyClient.test.ts`
- Modify: `frontend/src/app/study/study.module.css`

**Interfaces:**
- Produces: account-scoped draft state and persistence under `chaotang:draft:v1:<encoded userId>`.
- Consumes: `POST /api/drafts/chancellor`.

- [ ] Add failing pure tests for case sections, version replacement, stale response suppression, account isolation, malformed cache rejection and `DRAFT_READY` gating.
- [ ] Add failing source tests proving the page exposes only【拟旨】and【下旨】as core actions and renders the complete draft before enabling decree.
- [ ] Run targeted tests and verify failure.
- [ ] Implement state, submission, persistence and minimal StudyClient wiring without merging consult and draft histories.
- [ ] Re-run targeted tests and verify PASS.

### Task 5: Current-draft decree gate and governance

**Files:**
- Modify: `frontend/src/app/study/studySubmission.ts`
- Modify: `frontend/src/app/study/studySubmission.test.ts`
- Modify: `scripts/check_harness.mjs`
- Modify: `docs/product/tasks/2026-07-29-chancellor-draft-edict-flow.md`

**Interfaces:**
- Consumes: current `DRAFT_READY` draft text, version and fingerprint.
- Produces: existing decree request using only the visible canonical draft text.

- [ ] Add failing tests that block non-ready, stale-fingerprint and edited-after-ready submissions and accept the unchanged current draft.
- [ ] Run targeted tests and verify failure.
- [ ] Implement the pure decree gate and connect it to the existing submission callback.
- [ ] Add Skill and ADR files to Harness required files and content anchors.
- [ ] Run backend targeted tests, frontend targeted tests, full backend pytest, frontend lint/typecheck/test/build, Harness normal/self-test and `git diff --check`.
- [ ] Fill the task Implementation Report and Acceptance Review with actual evidence; do not claim unrun checks.

### Task 6: Move issuing into the completed draft scroll

**Files:**
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- Modify: `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- Modify: `frontend/src/app/study/StudyClient.test.ts`

**Interfaces:**
- Consumes: `draftResult`, `draftPending`, `canSubmit`, `onDraft`, `onSubmit`
- Produces: one draft action in the composer and one issue action at the bottom of the draft scroll

- [ ] Write a failing source-contract test asserting the composer contains `draft-edict-button` but not `submit-decree-button`, and the one `submit-decree-button` occurs inside the `chancellor-draft-result` branch after the complete draft.
- [ ] Run `node --test src/features/study-visual/DevStudyWorkspace.test.ts`; expect failure because the old composer still contains the issue button.
- [ ] Keep the textarea, attachment control and 【拟旨】 in the composer; move `submit-decree-button` below the complete draft in the scroll, reusing `props.canSubmit` and `props.onSubmit`.
- [ ] Run `node --test src/features/study-visual/DevStudyWorkspace.test.ts src/app/study/StudyClient.test.ts`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`; every command must exit 0.

### Approved upgrade: conservative direct draft

- Design source: `docs/superpowers/specs/2026-07-29-chancellor-draft-edict-flow-design.md`
- Execution plan: `docs/superpowers/plans/2026-07-29-chancellor-conservative-direct-draft.md`
- Runtime evidence: record only after Skill, backend, frontend, real-model, authority-boundary, Harness, and diff checks have actually run.

#### Runtime verification evidence — 2026-07-29

- Skill validation passed.
- Backend full suite: `2008 passed, 1 skipped`; Ruff passed.
- Frontend full suite: `399 passed`; lint, typecheck, and production build passed.
- The real vague-intent check returned `DRAFT_READY`, empty material gaps, three assumptions, and non-empty decree text.
- The real check invoked only the draft graph; no decree, Mission, or `REPLY` action occurred.
- Existing focused tests cover the visible expert draft, temporary boundaries, bottom-only issue action, source-edit invalidation, current version/fingerprint, and one-time authority.
- An existing authenticated `/study` browser page was identified read-only; no form input or click was performed, so the real issue action remains an explicit external/manual verification item.
