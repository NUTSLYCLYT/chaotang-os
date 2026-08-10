# EXT-A9-E1 Jinyiwei Security Coverage Matrix

Baseline: `feature-chaotang-ext@4f28d048296140431108bb429c1e2dbebc922363`

This matrix audits the current EXT implementation. It does not authorize
runtime remediation.

| Boundary | Current control | Evidence | Status | Severity | Required action |
| --- | --- | --- | --- | --- | --- |
| Authentication | All three `/api/intel/*` endpoints depend on `get_current_user` | `backend/web/routers/jinyiwei.py` | COVERED | - | Preserve focused auth tests |
| Outbound SSRF | Server targets are constants for Tavily and SEC; query/ticker cannot select a URL | `jinyiwei_search.py`, `sec_edgar.py` | COVERED | - | Keep adapters fixed-host |
| Secret handling | Tavily key comes from `TAVILY_API_KEY`; SEC uses no API key | source modules | COVERED | - | Never persist/log key |
| Timeout/fail closed | 8-second timeout; external failure returns empty or unverified evidence | source modules + tests | COVERED | - | Preserve deterministic fallback |
| Tenant evidence isolation | Reads/writes resolve current tenant; unique key includes tenant | evidence store, model, tests | COVERED | - | Preserve cross-tenant negative test |
| `fill-gap` ownership | Route compares only task `user_id`; `DecisionTask.tenant_id` and shared ownership helper already exist | router + `decision_task_access.py` | GAP_CANDIDATE | P1 | RED test, then reuse tenant + user helper |
| Caller source trust | Raw caller `tier="一手"` is accepted as primary and can persist `jinyiwei_verified` | vet + endpoint test | GAP_CANDIDATE | P1 | Separate caller assertion from server provenance |
| Tavily corroboration | Multiple URL strings can become multi-source corroboration without claim-level excerpt verification | search + vet | GAP_CANDIDATE | P2 | Normalize domains and retain pending until corroboration contract |
| Request validation | Body is `dict[str, Any]`; no query/claim/source length or count limits | router | GAP_CANDIDATE | P2 | Add typed schema and bounded fields |
| Cost/rate control | Expensive search endpoints do not call existing rate limiter | router + `direct_rate_limit.py` | GAP_CANDIDATE | P2 | Add user/tenant scoped `intel` budget |
| Error exposure | `gather_intel` exception text is returned to caller | router | GAP_CANDIDATE | P2 | Generic response, detailed server log |
| Persistence reliability | Database uniqueness prevents concurrent duplicate evidence | model + evidence-store test | COVERED | - | Preserve concurrency test |
| Evidence query safety | Rejected evidence is never returned; pending is opt-in | evidence store | COVERED | - | Preserve negative tests |
| SEC cache | Cache contains public ticker map under runtime `var`; stale cache is preferred to fabricated data | `sec_edgar.py` | COVERED_WITH_LIMIT | P3 | Document local cache trust boundary |
| Production enforcement | No evidence of distributed quota or production deployment | repository evidence only | NOT_CLAIMED | - | Do not represent local controls as production |

## Selected Product Decisions

1. Keep caller-provided findings as a useful offline intake path.
2. Treat caller trust metadata as an assertion, not as server verification.
3. Require server provenance or durable human approval before tenant-shared
   `jinyiwei_verified`.
4. Reuse the current DecisionTask ownership helper; do not add another rule.
5. Keep one evidence store and one task/status system.

## Exit Gate

The security remediation candidate may enter EXT only after:

- P1 and approved P2 tests demonstrate RED then GREEN;
- focused Jinyiwei/SEC/department tests pass;
- backend and root doctors pass;
- independent security review reports HIGH 0 / MEDIUM 0;
- Codex acceptance is performed on the exact candidate commit/tree.
