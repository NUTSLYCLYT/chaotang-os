# Asynchronous Decree Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the synchronous decree request with an owner-scoped, persistent asynchronous job that survives service restarts and exposes polling and bounded cancellation.

**Architecture:** A dedicated SQLite job store owns acceptance, idempotency, leases, checkpoints and terminal results. A single application worker executes the existing decree orchestration, persists the completed model result before archival, and finishes Shiguan and artifact side effects idempotently. The BFF returns `202`, polls the owner-scoped status endpoint and resumes an active job after reload.

**Tech Stack:** Python 3.12, FastAPI, SQLite WAL, pytest, Next.js App Router, TypeScript, Node test runner.

## Global Constraints

- Preserve ADR 0028: one decree entry, approved routing, one final Chancellor reply, Shiguan archive, bureau-only evidence acquisition.
- `POST /api/v1/decrees/chancellor` returns `202`; execution never starts inside the request.
- Worker concurrency is one; leases prevent duplicate execution after restart.
- Transient execution failures receive at most one retry and retain cumulative budgets.
- Global execution deadline is 30 minutes.
- Owner-only cancellation is honored only before archival begins; archival and publication always finish idempotently.
- Never persist credentials, session tokens, raw provider messages or unnecessary financial details.
- Do not modify task3's accounting loader or artifact contract until that interface is frozen.
- Do not commit, push or deploy in this delegated task.

---

### Task 1: Persistent job store

**Files:**
- Create: `backend/app/decree_jobs/models.py`
- Create: `backend/app/decree_jobs/storage.py`
- Create: `backend/app/decree_jobs/__init__.py`
- Test: `backend/tests/test_decree_job_storage.py`

**Interfaces:**
- Produces: `DecreeJobStore.accept`, `get_for_owner`, `claim_next`, `renew_lease`, `request_cancel`, `checkpoint_result`, `complete`, `fail`.
- Invariants: owner-scoped idempotency, one job per draft fingerprint, atomic leases, expired lease recovery, one retry maximum.

- [ ] Write storage tests for acceptance, replay, conflicting payload, owner 404, lease ownership, retry exhaustion, cancellation and restart recovery.
- [ ] Run `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_decree_job_storage.py -q`; expect failure because `app.decree_jobs` does not exist.
- [ ] Implement the minimal models and SQLite store.
- [ ] Re-run the focused test; expect PASS.

### Task 2: Worker state machine

**Files:**
- Create: `backend/app/decree_jobs/worker.py`
- Test: `backend/tests/test_decree_job_worker.py`

**Interfaces:**
- Consumes: `DecreeJobStore` and an injected blocking executor callable.
- Produces: `DecreeJobWorker.run_once`, `start`, `stop`.
- State flow: `QUEUED -> RUNNING -> RESULT_READY -> ARCHIVING -> PUBLISHING -> SUCCEEDED`, with `RETRY_WAIT`, `CANCELLED` and `FAILED` terminal handling.

- [ ] Write failing tests for one-job concurrency, transient retry once, cumulative counters, deadline closure, cancellation boundary and recovery from every persisted checkpoint.
- [ ] Run the focused worker tests and verify RED.
- [ ] Implement the smallest worker loop and cooperative stop/cancel token.
- [ ] Re-run the focused tests; expect PASS.

### Task 3: Idempotent business side effects

**Files:**
- Test: `backend/tests/test_shiguan_archive_decree.py`

**Interfaces:**
- Consumes: the existing `reply_id` argument with `reply_id=job_id`.
- Produces: replay-safe archive returning the existing reply for the same owner, ID and immutable payload.

- [ ] Add a failing test proving two archive attempts for one job create exactly one `REPLY`.
- [ ] Run the test; if it passes against the existing implementation, record that no production change or migration is necessary.
- [ ] Make the async executor pass `job_id` as the deterministic `reply_id`.
- [ ] Verify focused Shiguan tests PASS.

### Task 4: FastAPI acceptance, status, cancellation and lifecycle

**Files:**
- Modify: `backend/app/api/decrees.py`
- Create: `backend/app/api/decree_jobs.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_decrees_api.py`
- Create: `backend/tests/test_decree_jobs_api.py`

**Interfaces:**
- `POST /api/v1/decrees/chancellor` -> `202` accepted envelope and `Location`.
- `GET /api/v1/decree-jobs/{job_id}` -> owner-scoped state/result.
- `POST /api/v1/decree-jobs/{job_id}/cancel` -> owner-scoped cancellation request.

- [ ] Add failing API tests proving POST does not construct or invoke the graph, replays an idempotency key, and returns 404 across owners.
- [ ] Verify RED.
- [ ] Extract the existing synchronous body into an injected job executor and persist the route snapshot at acceptance.
- [ ] Wire a single worker through FastAPI lifespan and verify focused tests PASS without network or real models.

### Task 5: BFF and browser polling

**Files:**
- Modify: `frontend/src/lib/backendClient.ts`
- Modify: `frontend/src/lib/backendClient.test.ts`
- Modify: `frontend/src/app/api/decrees/chancellor/route.ts`
- Modify: `frontend/src/app/api/decrees/chancellor/route.test.ts`
- Create: `frontend/src/app/api/decree-jobs/[id]/route.ts`
- Create: `frontend/src/app/api/decree-jobs/[id]/route.test.ts`
- Modify: `frontend/src/app/study/decreeStatus.ts`
- Modify: `frontend/src/app/study/decreeStatus.test.ts`
- Modify: `frontend/src/app/study/studySubmission.ts`
- Modify: `frontend/src/app/study/studySubmission.test.ts`
- Modify: `frontend/src/app/study/StudyClient.tsx`

**Interfaces:**
- Browser state: `idle | enqueueing | queued | running | success | error`.
- `sessionStorage` stores only owner-isolated job ID and idempotency key.
- Polling honors `Retry-After`, stops at terminal state and resumes after reload.

- [ ] Add failing pure tests for accepted response parsing, polling transitions, reload recovery, 401 redirect and terminal stop.
- [ ] Verify RED with `npm test -- <focused files>`.
- [ ] Implement BFF translation and browser polling with a 15-second POST timeout.
- [ ] Verify focused tests PASS.

### Task 6: Documentation and final acceptance

**Files:**
- Create: `docs/decisions/0039-persistent-asynchronous-decree-jobs.md`
- Modify: `backend/AGENTS.md`
- Modify: `frontend/AGENTS.md`
- Modify: `ARCHITECTURE.md` only if its component map requires the new job domain.

- [ ] Record the accepted decision, trade-offs and executable verification commands.
- [ ] Run backend pytest, Ruff and compile checks.
- [ ] Run frontend tests, lint, typecheck and build.
- [ ] Run harness checks and the fake/synthetic cross-layer acceptance.
- [ ] Run the unchanged final acceptance flow for 10 consecutive rounds; restart the count after any implementation or acceptance change.
- [ ] Do not invoke the real provider until the fake matrix is green and the separate one-smoke budget gate is explicitly entered.
