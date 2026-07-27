# Task 6 BFF smoke diagnosis

## Scope and safety

- Investigated only on loopback: FastAPI `127.0.0.1:8121` and production-mode
  Next.js `127.0.0.1:3121`.
- Used a new temporary SQLite database under `.superpowers/sdd/e2e-diagnosis-temp/`.
- No private environment file was read and no real model client or outbound model
  request was used.

## Reproduction evidence

FastAPI was launched through a small one-off Python launcher.  **Before**
`uvicorn.run(...)`, that launcher set `app.shiguan.db._DEFAULT_DB_PATH` to the
temporary SQLite path and replaced `app.api.decrees.get_chancellor_graph` with
a deterministic fake graph returning a complete valid `single` result.  Next
was built and launched in production mode with only
`BACKEND_BASE_URL=http://127.0.0.1:8121`.

The BFF registration response was:

```text
HTTP 201
{"user":{"id":"<generated UUID>","username":"account_a","email":"account_a@example.test"}}
Set-Cookie: courtos_session=<opaque ID>; Path=/; HttpOnly; SameSite=Lax; Secure
```

Using that cookie, the exact decree BFF result was:

```text
HTTP 200
{"status":"ok","chancellor":"丞相","routeType":"single","rationale":"deterministic local smoke graph","processingPath":["Chancellor","Personnel","Chancellor"],"departments":["吏部"],"ministryOpinions":[{"department":"吏部","bureauOpinions":[{"bureau":"考功司","opinion":"local fake opinion"}],"opinion":"local fake ministry opinion"}],"councilVerdict":null,"finalVerdict":"local fake final verdict","recommendations":["first local recommendation","second local recommendation","third local recommendation"]}
```

Relevant FastAPI access logs:

```text
POST /api/v1/auth/register HTTP/1.1" 201 Created
POST /api/v1/decrees/chancellor HTTP/1.1" 200 OK
```

Next emitted no error output.  The original Task 6 attempt did not retain its
response body or service logs, so its precise non-200 body cannot be recovered
from `task-6-report.md`; that report only records “non-200”.

## Root cause

The production BFF and decree implementation are not the failure point.  They
work with the required complete fake graph when the replacement is installed
in the process that serves FastAPI.

`get_chancellor_graph` is a module-level in-memory callable.  A monkeypatch in
the smoke-driver process does **not** cross into a separately started
`uvicorn app.main:app` process.  Such a child therefore retains the real
`get_chancellor_graph`, which constructs the DeepSeek-backed graph instead of
the fake one.  This violates the local-smoke requirement and explains the
reported non-200 result (normally the existing sanitized 503 configuration
mapping when no model configuration is available).

This is a **test-harness defect**, not a production-code defect.  No production
fix or regression test was added: the BFF route already has focused tests for
authenticated 200, 401, 422, 502, and 503 mapping, and the backend endpoint
already has fake-graph coverage.

## Required harness correction

Start FastAPI through a launcher in the *same* interpreter that:

1. points Shiguan/auth storage at a temporary SQLite file;
2. replaces `app.api.decrees.get_chancellor_graph` with a complete valid fake;
3. then invokes `uvicorn.run("app.main:app", ...)`.

Do not apply the replacement in a parent process and then launch a fresh plain
`uvicorn` child.

## Fresh checks

| Check | Result |
| --- | --- |
| Production Next build + loopback FastAPI/Next authenticated BFF smoke | PASS: registration 201, decree 200, backend 201/200 logs |
| `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_decrees_api.py` | PASS: 39 passed (one existing Starlette/httpx deprecation warning) |
| `frontend npm test -- src/app/api/decrees/chancellor/route.test.ts` | PASS: 12 passed |

The full two-account archive/isolation sequence was not rerun because this
diagnosis task was limited to the failed decree creation step.  Its next run
should use the corrected same-process launcher above.
