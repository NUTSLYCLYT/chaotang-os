# Decree Worker No-Reply Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every accepted decree job has a live consumer or an unready service signal, and that the browser reaches a visible terminal result.

**Architecture:** Keep ADR 0039's persistent SQLite queue and single FastAPI lifespan worker. Default the worker on, expose a read-only liveness check to readiness, and retain sequential owner-scoped browser polling through terminal state.

**Tech Stack:** Python 3.12, FastAPI, SQLite, pytest, Next.js App Router, TypeScript, Node test runner.

## Global Constraints

- Preserve ADR 0028 and ADR 0039 without changing public business topology.
- Do not call the real model, external network, or production storage.
- Preserve explicit `CHAOTANG_DECREE_JOB_WORKER_ENABLED=false` for tests and maintenance.
- Do not commit, push or deploy without separate authorization.
- Final acceptance must pass the identical command set 10 consecutive times; reset after any implementation, configuration or acceptance-flow change.

---

### Task 1: Prove the lifecycle regression

**Files:**
- Modify: `backend/tests/test_decree_async_integration.py`
- Modify: `backend/tests/test_readiness.py`

**Interfaces:**
- Consumes: `app.main.lifespan`, `app.main.readiness`, `DecreeJobWorker.is_alive()`.
- Produces: regression evidence for default startup and readiness failure.

- [ ] Run the two new tests against the parent revision using an isolated temporary copy; expect default-lifespan or worker-readiness assertions to fail.
- [ ] Run `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_decree_async_integration.py backend/tests/test_readiness.py -q`; expect PASS on the working tree.

### Task 2: Keep the minimal worker lifecycle implementation

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/decree_jobs/worker.py`

**Interfaces:**
- Produces: `_worker_enabled() -> bool` with default `True`; `DecreeJobWorker.is_alive() -> bool`; `/readyz` stable `worker_not_running` response.

- [ ] Confirm `_worker_enabled()` returns true only when unset or explicitly true, and false for explicit false values.
- [ ] Confirm `is_alive()` reads thread state without starting, stopping or mutating the worker.
- [ ] Confirm readiness checks worker liveness only after existing preflight succeeds.
- [ ] Re-run Task 1 tests; expect PASS.

### Task 3: Verify browser terminal handling

**Files:**
- Modify: `frontend/src/app/study/studySubmission.test.ts` only if a terminal branch lacks coverage.
- Modify: `frontend/src/app/study/studySubmission.ts` only if the failing test proves a gap.

**Interfaces:**
- Consumes: accepted envelope and job status BFF responses.
- Produces: one sequential poll loop that stops on `SUCCEEDED`, `FAILED`, or `CANCELLED`.

- [ ] Run `npm --prefix frontend test -- --test-name-pattern='202 acceptance|polling|terminal|回奏|下旨'`; expect terminal-state tests PASS.
- [ ] If a terminal branch is missing, add one failing test, verify RED, implement only that branch, then verify GREEN.

### Task 4: Full verification and ten-round acceptance

**Files:**
- Modify: `docs/product/tasks/2026-08-11-fix-decree-worker-no-reply.md`

**Interfaces:**
- Produces: fresh reproducible evidence and final acceptance record.

- [ ] Run backend full pytest, Ruff and compileall.
- [ ] Run frontend test, lint, typecheck and build.
- [ ] Run `node scripts/check_harness.mjs`, both harness self-tests, product-flow self-test and `git diff --check`.
- [ ] Define the fixed acceptance round as focused backend lifecycle/readiness tests plus focused frontend polling tests plus harness check.
- [ ] Execute that exact round 10 consecutive times, recording PASS/FAIL; reset to round 1 after any failure or relevant change.
- [ ] Update the product task Implementation Report and Acceptance Review with commands, results, unrun items and remaining risks.

## Self-Review

- Coverage: default worker startup, readiness truthfulness, terminal polling, ADR invariants and 10-round acceptance each map to a task.
- Placeholder scan: no implementation placeholder is left; conditional code work is permitted only after a newly observed failing terminal branch.
- Type consistency: the plan uses existing `DecreeJobWorker.is_alive() -> bool` and existing public job terminal states.
