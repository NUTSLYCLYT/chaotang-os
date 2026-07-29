# EXT-A9-E1 P1 Runtime Scope Amendment

## Approval

- Owner: project owner
- Date: 2026-07-30
- Direction: continue the reviewed EXT-A9-E1 work as a Harness-governed
  long-running task from P1, leaving an acceptance checkpoint for the next day.
- Machine gate: `R0-W08` must return `GO / APPROVED_WORK_PACKAGE` at execution
  start on BASE. The isolated candidate may reach `PRE_INTEGRATION_PASS`; after
  a separately approved exact-H local integration, fresh integrated-HEAD W08 GO
  is required before final `PASS`.

## Allowed Changes

- `backend/web/routers/jinyiwei.py`
- `backend/src/jinyiwei_agent.py`
- `backend/src/real_department_engines.py`
- `backend/tests/test_jinyiwei_endpoint.py`
- `backend/tests/test_jinyiwei_agent.py`
- `backend/tests/test_real_department_engines.py`
- `backend/tests/test_swarm_execution_loop_api.py`
- `backend/tests/test_chaotang_assemble.py`
- `backend/tests/conftest.py`
- `frontend/src/features/intel/lib/jinyiwei-brief-contract.ts`
- `frontend/src/features/intel/lib/jinyiwei-brief-contract.nodetest.ts`
- `frontend/src/features/intel/components/JinyiweiBriefScroll.tsx`
- `frontend/src/features/intel/components/JinyiweiVerdictRail.tsx`
- `frontend/e2e/jinyiwei-source-trust.spec.ts`
- this Packet's plan, CI, review, and acceptance evidence

## Required Behavior

1. `fill-gap` must use the canonical tenant + user DecisionTask ownership helper.
2. `DecisionTask.tenant_id IS NULL` must fail closed; no inference or migration.
3. A request whose authenticated `CurrentUser.tenant_id` is `None` must fail
   closed; the route must not use a default-tenant fallback for authorization.
4. Caller findings remain visible as pending in the direct response but are not
   persisted to the tenant-shared evidence pool.
5. `source_authority` is internal and mandatory with no default.
6. Every production caller explicitly selects `server_adapter` or
   `caller_asserted`.
7. Unknown `source_authority` values fail before search, archive, or persistence.
8. Frontend must not label `CALLER_FINDINGS` as live or as a valid real-source
   result; it must visibly retain the pending/caller-asserted boundary.
9. Existing server-adapter behavior, offline tests, tenant isolation, rejected
   evidence filtering, and duplicate prevention must remain green.

## Forbidden Changes

- P2 input schema, rate limiting, Tavily corroboration, source URL normalization,
  or generic-error implementation
- `backend/src/jinyiwei_vet.py`
- evidence-store downgrade/upgrade semantics or database schema
- any frontend file outside the five listed consumption/test files
- new page, Agent, BFF, task/status, W09, deployment, migration, push, or listener
  3050 changes

## Commit And Review Boundary

- Runtime and focused tests form one atomic commit.
- Packet evidence may be a later docs-only commit.
- Review pins exact base, runtime candidate, tree, changed paths, reviewer
  identity, and report digest.
- Independent review is read-only. HIGH or MEDIUM findings block acceptance.
- Existing persisted caller-derived rows are not migrated or reclassified. P1
  prevents new pollution and records the historical-data residual risk.
