# Real-model structured output false green

## Summary

The single-Chancellor Runtime refactor passed the complete offline backend suite and eleven repeated key-suite processes, but the first real `/study` acceptance returned `502` during draft and execution model paths. A stale Uvicorn process caused the first mismatch; after restart, real DeepSeek responses still intermittently failed strict structured-output validation.

## Root Cause

Offline tests injected perfectly shaped deterministic model responses and therefore did not exercise provider response variability. Several decree execution nodes allowed only one strict parsing attempt, while draft had one correction attempt. A syntactically or semantically invalid real response therefore failed the entire decree even when a subsequent corrected response could satisfy the unchanged schema. The initially running Uvicorn process also predated the Runtime files and lacked reload, so browser verification was not testing the current working tree until it was restarted.

## Prevention

All decree nodes that consume structured model output must use a shared, bounded strict invocation policy: at most three total attempts, schema validation after every response, no retry of provider/network exceptions, no fallback that invents missing business fields, and sanitized stage-only diagnostics. Browser acceptance must restart or positively fingerprint the current backend process before exercising the flow.

## Detection

Offline regression tests feed two invalid responses followed by one valid response into every structured node class and assert success on the third call; exhaustion and provider-failure tests assert fail-closed behavior and absence of raw response leakage. Release acceptance additionally performs at least ten real `/study` decrees and verifies a successful reply plus exactly one new current-owner `REPLY` per decree. `node scripts/check_harness.mjs` verifies this record's required sections, but it cannot replace the real-model browser gate.

## Evidence

- Business baseline: `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
- Runtime decision: `docs/decisions/0035-single-chancellor-runtime-skills.md`
- Product task: `docs/product/tasks/2026-07-31-single-chancellor-runtime-skills.md`
- Browser evidence on 2026-07-31: draft endpoint returned both `502` and `200`; formal `POST /api/v1/decrees/chancellor` returned `502` after a `DRAFT_READY` page.
- Process evidence on 2026-07-31: Uvicorn started on 2026-07-30 while `chancellor_runtime/agent.py` was modified on 2026-07-31.
- Follow-up real-browser evidence: three complete `/study` decree flows succeeded with formal replies; the current-owner Shiguan `REPLY` count reached 13 after the third new success. Later draft attempts returned `502` or exceeded the browser wait while the provider produced read timeouts or invalid structured output, so the required 11-success gate remains failed at 3/11.
- Runtime hardening added an explicit 30-second SDK request timeout, disabled SDK-level retries, fixed temperature at zero, bounded output to 2500 tokens, and supplied the complete six-ministry/39-bureau route catalog to draft generation and correction prompts. These controls improve boundedness and route validity but do not justify claiming real-model reliability without the remaining eight successful browser rounds.
