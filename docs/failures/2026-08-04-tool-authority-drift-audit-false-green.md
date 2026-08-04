# Tool authority drift audit false green

## Summary

Current Tool Policy or Tool Descriptor drift was correctly prevented from reaching a
handler, but the Executor raised a raw `ValueError` before publishing the required
system-owned failure audit. Earlier tests asserted an empty audit snapshot and thus
encoded this missing observability as success.

## Root Cause

Issuance validation, current-authority validation, and unified failure publication
were ordered as separate boundaries. Policy and descriptor fingerprint mismatches
were checked after issuance but before the Executor initialized its common audit
path, so they bypassed `_error` and `_publish`. The tests checked only effect safety
(`handler == 0`) and treated `snapshot == ()` as universally desirable, failing to
distinguish untrusted pre-authority rejection from drift of an already sealed call.

## Prevention

Keep direct forged or unissued calls outside the audit boundary. Once issuance is
verified, route context, current Policy, current Descriptor, handler, execution, and
result-gate failures through the same redacted system-owned audit publisher and raise
`ToolExecutionError`. Authority drift must preserve its original stable reason even
when a custom audit sink fails and publication falls back to the internal sink.

## Detection

`backend/tests/test_bureau_tool_executor.py` mutates every Policy authority category
and the current Descriptor, then requires zero handler calls, exactly one locatable
redacted audit, stable reason codes, safe budget accounting, and sink-failure fallback.
It separately requires forged/unissued calls to leave the snapshot empty.
`backend/tests/test_bureau_tool_loop.py` verifies drift becomes an audited degraded
outcome instead of escaping as raw `ValueError`. `node scripts/check_harness.mjs`
checks this record's required structure, while the focused and full backend suites
execute the behavioral detectors.

## Evidence

- [Tool Executor](../../backend/app/agents/runtime_skills/tool_executor.py)
- [Executor regression tests](../../backend/tests/test_bureau_tool_executor.py)
- [Loop regression tests](../../backend/tests/test_bureau_tool_loop.py)
- [ADR 0028](../decisions/0028-decree-evidence-flow-governance-baseline.md)
- [Task 8 report](../../.superpowers/sdd/bureau-agent-tool-use-task-8-report.md)
