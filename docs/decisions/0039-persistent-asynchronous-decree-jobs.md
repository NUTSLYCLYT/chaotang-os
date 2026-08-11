# ADR 0039: Persistent Asynchronous Decree Jobs

## Status

Accepted — 2026-08-05

## Context

The decree endpoint currently performs routing, ministry work, Chancellor synthesis, Shiguan archival and optional artifact publication inside one HTTP request. ADR 0029 raised the synchronous timeout to 900 seconds only as a transition and identified asynchronous execution as the durable fix. An in-process `BackgroundTasks` queue cannot recover accepted work after a service restart and cannot reliably prevent duplicate replies.

The immutable governance baseline in ADR 0028 still applies: the decree remains the only business entry, its approved route remains authoritative, the Chancellor produces exactly one final reply, Shiguan archives that reply, and only bureau nodes may acquire evidence.

## Decision

`POST /api/v1/decrees/chancellor` accepts a validated and authorized decree, persists an owner-scoped job and returns `202 Accepted` with an opaque job ID. It does not execute the model graph in the request.

A dedicated SQLite database in WAL mode stores job input snapshots, owner-scoped idempotency keys, draft fingerprints, states, leases, retry counts, cumulative provider budgets, a 30-minute deadline, safe result checkpoints and stable error codes. A single worker claims jobs through expiring database leases. A transient failure may be retried once; retries never reset the deadline or budget.

The public job states are `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED` and `CANCELLED`. Internal checkpoints distinguish model completion, archival and artifact publication. Cancellation is owner-only and cooperative at model or department stage boundaries. Once archival begins, the worker ignores cancellation and completes Shiguan and artifact side effects idempotently.

Job status and cancellation endpoints derive ownership only from authentication and return `404` for missing and cross-owner identifiers. Accepted jobs continue after logout. Credentials, session tokens, raw provider messages and unnecessary financial details are never persisted.

Shiguan archival is keyed by owner and job execution ID so recovery cannot create a second `REPLY`. Artifact links appear only after every expected artifact is `PUBLISHED`. The Junjichu case ledger remains a multi-department business projection and is not used as the queue.

## Consequences

The browser receives a fast acknowledgement and polls persisted state instead of holding a 900-second request open. Refreshes, lost responses and service restarts can resume the same work without creating a second decree job or final reply. SQLite keeps the Beta deployment self-contained, while the lease protocol also protects against an accidentally started second application instance.

Execution is at-least-once before the durable result checkpoint, so provider work can repeat after a hard crash. Durable checkpoints and idempotent archival/publication prevent repeated business side effects, but exact provider request deduplication is not promised. Multi-host deployment with a shared external queue is deferred; the Beta must run with one application worker and keep the database on a local filesystem.

The accounting loader and artifact content contract remain owned by the periodless-report task. Async integration must consume that frozen contract serially and must not independently reinterpret financial years or source data.

## Verification

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests/test_decree_job_storage.py backend/tests/test_decree_job_worker.py backend/tests/test_decree_jobs_api.py backend/tests/test_decrees_api.py -q
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
backend/.venv/Scripts/python.exe -m ruff check backend/app backend/tests
Set-Location frontend; npm test; npm run lint; npm run typecheck; npm run build
Set-Location ..; node scripts/check_harness.mjs; node scripts/check_harness.mjs --self-test
```

The fake/synthetic browser-compatible acceptance flow must pass ten consecutive rounds on the same final revision. Any code, configuration or acceptance-flow change resets the count. The separately authorized real-provider smoke remains limited to one single-department accounting flow and eight cumulative provider requests; exceeding any budget fails closed.
