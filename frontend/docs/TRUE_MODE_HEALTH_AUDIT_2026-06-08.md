# True Mode Health Audit: 2026-06-08

> Day 5 deliverable. Scope: read-only health check for the selected true loop. Do not print secrets. Do not treat non-mainline worktrees as evidence.

## Mainline Boundary

Frontend mainline:

```text
/home/ubuntu/workspace/chaotang-web-lyt
dev port: 3002
prod port: 3050
```

Backend/harness mainline:

```text
/home/ubuntu/workspace/jiqun_ai
preferred API port: 8081
```

Important correction during this audit:

- Port `3002` was initially occupied by `/home/ubuntu/workspace/tt/chaotang-web-lyt`, an old/experimental worktree.
- That server was stopped because it cannot count as mainline evidence.
- The frontend mainline was then started with `pnpm dev` from `/home/ubuntu/workspace/chaotang-web-lyt`.
- The true-loop E2E was rerun against the mainline server and passed.

## Probes Run

```bash
ss -tlnp
curl --noproxy '*' -sS --max-time 8 http://127.0.0.1:3002/api/health
curl --noproxy '*' -sS --max-time 8 http://127.0.0.1:3002/api/court/true-chain-health
curl --noproxy '*' -sS --max-time 8 http://127.0.0.1:3002/api/court/operating-loop/health
curl --noproxy '*' -sS --max-time 8 http://127.0.0.1:8081/api/health
curl --noproxy '*' -sS --max-time 8 http://127.0.0.1:8081/api/swarm/config
curl --noproxy '*' -sS --max-time 8 http://127.0.0.1:8081/api/tasks
```

Frontend verification:

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 NO_PROXY=127.0.0.1,localhost pnpm test:e2e e2e/true-loop-contract.spec.ts
```

## Current Runtime Status

| Check | Result | Evidence |
|---|---|---|
| Mainline frontend on `3002` | ready | `pnpm dev` from `/home/ubuntu/workspace/chaotang-web-lyt` |
| Frontend `/api/health` | ok | `jiqunHealth`, `swarmConfig`, `taskRegistry` are ok; optional `legalAgent` is down |
| Frontend `/api/court/true-chain-health` public layer | needs_auth | public probe sees Next BFF only; authenticated probe required for full dependency details |
| Frontend `/api/court/operating-loop/health` | degraded | BFF ready, jiqun reachable, persistent DB missing, queue missing |
| Backend expected port `8081` | reachable but degraded | `/api/health` returns `mcp_web_search: up`, `deepseek_key: configured`, `litellm: down` |
| Backend `/api/swarm/config` | ready | returns 17 configured swarms including `ai_ops`, `shiguan_archive`, and product/business bindings |
| Backend `/api/tasks` | ready/empty | returns no running or recent tasks |
| Host port `8082` | not jiqun | returns `{"detail":"Not Found"}` for jiqun health/config paths; owned by `claude-code-api/server.py` |
| Legal agent `18003` | down | frontend `/api/health` reports legalAgent down |
| Build ledger file | ready after recent E2E | operating-loop health shows `buildLedgerFile: ready`, `ledgerEntries: 2` |

## Health Output Summary

`GET /api/health`:

```json
{
  "status": "ok",
  "deps": {
    "jiqunHealth": "ok",
    "swarmConfig": "ok",
    "taskRegistry": "ok",
    "legalAgent": "down"
  }
}
```

`GET /api/court/true-chain-health`:

```json
{
  "status": "needs_auth",
  "liveReady": {
    "frontend": true,
    "backend": false,
    "database": false,
    "swarmRun": false,
    "requiredDependencies": false
  },
  "summary": {
    "ready": 1,
    "missing": 1,
    "requiredDown": 1
  }
}
```

`GET /api/court/operating-loop/health`:

```json
{
  "status": "degraded",
  "services": {
    "nextBff": "ready",
    "jiqun": "reachable",
    "buildLedgerFile": "ready",
    "persistentDb": "missing",
    "queue": "missing",
    "authMode": "dev_or_bff"
  },
  "operatingLoop": {
    "shangshufangSuggestions": "ready",
    "junjichuDispatch": "backend",
    "hubuBudgetTracking": "static_plus_ledger",
    "shiguanRetrospective": "static_plus_ledger",
    "feedbackToShangshufang": "client_synced_ledger",
    "ledgerEntries": 2
  }
}
```

`GET /api/health` on `jiqun_ai`:

```json
{
  "status": "degraded",
  "checks": {
    "mcp_web_search": "up",
    "litellm": "down",
    "deepseek_key": "configured"
  }
}
```

## Real / Fallback / Missing

Real now:

- Frontend mainline starts on `3002`.
- Selected true-loop E2E passes against the mainline frontend.
- Shangshufang UI can express live swarm evidence and Shiguan replay artifact.
- Backend mainline is reachable at `127.0.0.1:8081`.
- Frontend BFF can reach jiqun `/api/health`, `/api/swarm/config`, and `/api/tasks`.
- Swarm config is available and includes `shiguan_archive`.
- Operating-loop build ledger file exists and has entries.

Fallback now:

- `shangshufangSuggestions`: ready, but not proven DB-backed.
- `hubuBudgetTracking`: `static_plus_ledger`.
- `shiguanRetrospective`: `static_plus_ledger`.
- `feedbackToShangshufang`: `client_synced_ledger`.

Missing/down now:

- LiteLLM gateway is down at the backend model boundary (`127.0.0.1:4000`).
- Persistent DB is missing for shared tasks, retrospectives, budgets, and ledger records.
- Durable queue is missing for async agent runs, retries, and scheduled daily briefs.
- Public true-chain probe cannot complete authenticated dependency checks.
- Legal agent is down; it is optional for this first loop but blocks legal-specific workflows.

Not evidence:

- `/home/ubuntu/workspace/tt/chaotang-web-lyt` running on `3002`.
- `127.0.0.1:8082`; this is `claude-code-api/server.py`, not the jiqun backend.
- Any passing browser test run against the old `tt` worktree.

## Day-5 Verdict

The selected true-loop contract is testable, the frontend mainline renders it, and the frontend BFF can reach the backend mainline on `8081`. The system is still not in real production mode: the immediate blockers are the LiteLLM/model gateway boundary, the missing production DB boundary, and the missing durable queue boundary.

## Next Required Step

Day 6 should be a boundary-hardening day, not a feature day:

1. Make backend startup deterministic and documented for `127.0.0.1:8081`.
2. Fix or explicitly bypass the LiteLLM gateway in true-loop dev mode.
3. Re-run:
   - `curl --noproxy '*' http://127.0.0.1:8081/api/health`
   - `curl --noproxy '*' http://127.0.0.1:8081/api/swarm/config`
   - `curl --noproxy '*' http://127.0.0.1:3002/api/health`
   - `curl --noproxy '*' http://127.0.0.1:3002/api/court/operating-loop/health`
4. Run the authenticated true-chain probe.
5. Add the DB boundary before the queue boundary, because retrospectives, ledger records, and audit events need durable state before async retries matter.
