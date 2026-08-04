# Bureau Tool Handlers False Green

## Summary

Task 6 initially passed focused tests while still allowing arbitrary Evidence callables,
leaking unrelated resolved inputs to adapters, and implementing named analytical operations
as identity-free numeric list shortcuts.

## Root Cause

Tests asserted that handlers executed and produced schema-shaped output, but did not assert
capability provenance, least-privilege context contents, or the business semantics of every
fixed algorithm. The Evidence Protocol regression suite was not included in the first gate.

## Prevention

Evidence remediation occurred in three explicit stages: the original arbitrary callable, an
insufficient nominal sealed class, then the final HMAC-signed and per-call reverified capability.
Evidence tool access now requires a runtime-frozen, HMAC tamper-evident decree-bound capability signed by an Evidence
Protocol factory. Handler integration tests assert tamper rejection, narrowed contexts, plain-callable rejection,
real session/coordinator behavior, structured algorithm results, and Result Gate rejection.
The implementation does not claim Python objects are literally uncopyable: an exact-type
`object.__new__` full-slot clone is possible, but instance-identity signing makes verification
fail before effects.

## Detection

Run Task 3-6 tool tests together with `backend/tests/test_agent_evidence_protocol.py` and the
bureau runtime regressions. The sealed-adapter and semantic matrix tests fail if callable
provenance, context narrowing, or fixed algorithm meaning regresses.

## Evidence

- `backend/app/agents/evidence_protocol.py`
- `backend/app/agents/runtime_skills/tool_handlers.py`
- `backend/tests/test_agent_evidence_protocol.py`
- `backend/tests/test_bureau_tool_handlers.py`
- `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
- `docs/decisions/0037-bureau-agent-controlled-tool-use.md`
