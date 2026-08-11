# Asynchronous Decree Jobs: Review and Frozen-Interface Integration Brief

Date: 2026-08-05
Scope: persistent state machine, leases/recovery, owner APIs, BFF boundary, and the remaining POST/lifespan/browser integration.
Safety: no production access, provider call, credential read, commit, push, or deployment was performed.

## Current result

The non-accounting job substrate is implemented and locally reviewable. It persists jobs in SQLite WAL, enforces owner-scoped status/cancellation, runs one claimed job through durable checkpoints, renews active leases, recovers expired leases, bounds model and side-effect retries to one retry, and fails closed at the 30-minute deadline. The frontend client and BFF status/cancel routes reject malformed persisted success data and convert unexpected downstream exceptions to a sanitized `503`.

The synchronous decree POST, concrete executor, FastAPI lifespan worker, submit BFF, and page polling are intentionally not connected yet. Those files overlap the accounting-report task or depend on its frozen `prepare/archive/publish` contract.

## Review findings and disposition

| Severity | Finding | Disposition |
| --- | --- | --- |
| High | A 90-second lease could expire during a blocking graph/model invocation. | Fixed with persisted lease renewal plus a worker heartbeat; executor boundaries also observe lease loss. |
| High | Deadline was checked only before claim, allowing a late model result to archive and report success. | Fixed with deadline checks after execution and before each durable side-effect stage. |
| High | Side-effect checkpoint failures could be reclaimed without a retry bound; permanent errors were not terminal. | Fixed: one transient retry is persisted via the checkpoint error marker; the next failure and every permanent failure are terminal. |
| High | A new transport key used to replay the same draft was not permanently bound, so later key reuse could create another job. | Fixed with an owner-scoped idempotency-key alias table populated transactionally and migrated from existing rows. |
| Medium | Checkpoint methods could skip or regress states while holding the same lease. | Fixed with exact expected-state guards and atomic lease release on completion. |
| Medium | A `SUCCEEDED` status accepted any object as the result at the frontend trust boundary. | Fixed by reusing the strict synchronous `SubmitDecreeData` parser. |
| Medium | Injected/unexpected BFF client exceptions escaped instead of returning a stable response. | Fixed with sanitized `503 unavailable` responses. |

Residual risk accepted by the user: the existing DeepSeek key will not be rotated for this task. This does not relax redaction, request-count, timeout, production, or cost gates.

## Exact TDD integration brief after accounting freeze

### 1. POST returns 202 without executing the graph

Touch only after task 3 freezes its interfaces: `backend/app/api/decrees.py`, its tests, and the accepted-response models.

RED tests first:

1. A valid current draft plus `Idempotency-Key` returns `202`, `Location: /api/v1/decree-jobs/{id}`, `Retry-After: 1`, and `{job_id,state,status_url,cancel_url,accepted_at,replayed}`.
2. The POST does not construct an execution agent, invoke a graph, archive a reply, or publish an artifact.
3. Same owner/key/request returns the same job with `replayed=true`; same owner/key/different canonical request returns `409`.
4. A lost-response retry still replays after draft authority was committed. Therefore lookup by owner/key/request hash occurs before a new authority reservation.
5. Cross-owner keys are independent; invalid/missing key, stale draft, malformed fingerprint, and database failure retain sanitized `4xx/503` behavior.
6. Acceptance sequence is: canonicalize request -> replay lookup -> reserve current draft authority -> validate route snapshot -> persist job and route snapshot -> commit authority reservation. Any pre-persist failure releases the reservation.

Canonical request hashing must be server-side SHA-256 over a versioned JSON shape containing only owner ID, draft version, draft fingerprint, and decree text. The approved route is separately serialized from the authoritative reservation; the browser cannot supply or override it.

### 2. Executor and FastAPI lifespan

Split the present synchronous body without changing its business order:

- `execute`: reconstruct the frozen accounting session from the job/run ID, invoke the approved route, count every provider request before dispatch, and persist the strict response checkpoint.
- `archive`: call Shiguan with deterministic `reply_id=job_id`; replay must return the existing owner-scoped reply.
- `publish`: call only the frozen idempotent accounting publication interface and expose attachments only after every expected artifact is published.

RED tests first:

1. Application lifespan starts exactly one worker with a unique process worker ID and stops/joins it on shutdown.
2. API-only tests inject a no-op/fake worker and never construct a paid provider.
3. A stored `QUEUED`, expired `RUNNING`, `RESULT_READY`, `ARCHIVING`, and `PUBLISHING` job resumes after creating a new app/store instance.
4. A lease heartbeat prevents a second worker claim during a blocking fake executor call; lease loss prevents the stale worker from checkpointing.
5. Restart after archive does not create a second reply; restart during publication does not create a second artifact.
6. Provider counts survive retry and restart. The accepted job stores an explicit request limit derived from the frozen route; an attempted request above the limit becomes `FAILED/provider_budget_exceeded` before network dispatch.

Production/Beta constraint: launch one Uvicorn application worker only. SQLite must remain on a local filesystem. The lifespan must not start a worker under tests unless explicitly injected/enabled.

### 3. Submit BFF and page polling

Touch serially after the backend contract is green: `frontend/src/lib/backendClient.ts`, `frontend/src/app/api/decrees/chancellor/route.ts`, pure polling/state helpers, then `StudyClient.tsx`.

RED tests first:

1. Submit BFF forwards the HttpOnly session and one browser-generated idempotency key, translates the accepted snake-case envelope to camelCase, preserves `Location`/`Retry-After`, and times out after 15 seconds.
2. Browser states are `idle -> enqueueing -> queued -> running -> success|error`; only terminal states stop polling.
3. Poll delay honors a valid `Retry-After`, otherwise uses bounded `1s, 2s, 3s, 5s` backoff with no overlapping requests.
4. Refresh resumes the owner-namespaced active job from `sessionStorage`; success, failure, cancellation, `401`, and opaque `404` clear it.
5. `401` follows the existing re-authentication path. Network/`503` errors retain the job and permit bounded retry; malformed status fails closed and never renders result or artifact links.
6. Cancellation is enabled only for queued/model/department phases. Once stage is `ARCHIVING` or `PUBLISHING`, UI explains that archival is finishing and does not offer cancellation.
7. A successful result passes the strict existing response parser before rendering. Attachment links appear only in `SUCCEEDED` and retain the owner-scoped download BFF behavior, including cross-user `404`.

## Accounting-task handoff boundary

Do not edit task 3's loader, intent models, artifact storage, or decree integration while its worktree is unfrozen. The serial handoff must name and freeze:

- the request/intent representation for omitted year, explicit year, and `NEEDS_INPUT`;
- how a prepared report is identified by `job_id` and reopened after service restart;
- the idempotent `publish(reply_id)` result and terminal artifact states;
- the safe response artifact schema consumed by `_build_response_from_graph_result`;
- error classifications for unavailable data versus storage/publication failure.

After freeze, first rebase the integration assumptions against task 3's actual diff, then change the POST/executor only once. Do not independently fix accounting behavior in this task.

## Local commands for the later browser gate

```powershell
# Terminal 1
Set-Location D:\workspace\chaotang-os-harness-only\backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2
Set-Location D:\workspace\chaotang-os-harness-only\frontend
npm run dev

# Focused automated gates
Set-Location D:\workspace\chaotang-os-harness-only
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_decree_job_storage.py backend/tests/test_decree_job_worker.py backend/tests/test_decree_jobs_api.py backend/tests/test_decrees_api.py -q
Set-Location frontend
node --test src/lib/backendClient.decreeJobs.test.ts
npm test
npm run typecheck
npm run build
```

Browser QA remains deferred until integration. It must run fake/synthetic first at desktop 1280 and mobile 375, cover keyboard operation, refresh/recovery, error/empty states, console/network inspection, attachments and cross-user download `404`. The unchanged final fake acceptance must pass 10 consecutive rounds on one revision.

## Real-provider final smoke budget

Only after the complete fake/synthetic matrix passes: one single-department accounting E2E, at most one E2E attempt, at most eight provider requests total including the single allowed transient retry, per-request timeout 60 seconds, and global deadline 30 minutes. Send only the minimum route/year/aggregated fields required by the frozen contract; exclude unrelated ledger rows, account names, counterparties, subject identity, credentials, and raw source files. If any counter or timeout would be exceeded, fail closed before dispatch. No production access is authorized.

## Verification evidence at this milestone

- Backend async/API/authority/archive focus: `38 passed`; Ruff: PASS.
- Frontend full suite: `492 passed`; ESLint, TypeScript and Next production build: PASS.
- Harness: 72 baseline files PASS; self-test: 46 PASS; `git diff --check`: PASS.
- A backend full-suite run observed `2889 passed, 1 skipped, 2 failed` while another workstream was editing the two affected Jinyiwei MCP files. An immediate isolated rerun of those exact two failures on the resulting workspace passed `2/2`. Because the workspace changed during the full run, this is recorded as an invalidated full-suite snapshot, not a clean full-suite claim.
