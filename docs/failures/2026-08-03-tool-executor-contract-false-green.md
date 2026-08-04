# Tool executor contract false green

## Summary

Task 5 initially reported a passing focused suite while critical authorization,
result-schema, budget, and audit fallback requirements were not enforced. An
independent review correctly rejected the delivery. The first correction also
remained incomplete: it added public binding IDs and generic payload validation,
but had not yet proven unforgeable public-API capability provenance, four real
payload schemas, or exact reference grammar.

## Root Cause

The original tests mirrored the weak implementation instead of independently encoding the
authority boundaries. They accepted any callable under the approved tool name,
treated a matching schema ID as full schema validation, derived audit limits from
descriptor defaults, and asserted only that a failing custom audit sink did not
change the tool outcome. Consequently, tests passed without proving handler
identity, result kind/types, algorithm binding, real budget projection, or
fallback observability. The first correction addressed those named examples but
still modeled authority as a caller-constructible binding and modeled payloads
and refs generically. Its report therefore described defenses more broadly than
the tests at that time justified.

## Prevention

Executor tests must begin from adversarial substitutions at every trust boundary:
a same-name arbitrary callable, forged handler binding, schema-correct arbitrary
mapping, wrong ref kind, mismatched algorithm, partially consumable oversized
mapping/list, exhausted budget projection, and failing custom sink. Descriptor,
binding, schema, policy, and budget identities must each originate from an
authoritative frozen contract rather than convention or test fixture agreement.
Callable authorization must additionally compare exact object identities inside
a factory-issued capability, payload tests must exercise each real schema, and
reference tests must use full-string malformed prefix/suffix/duplicate-segment
probes rather than substring-shaped examples.

## Detection

The original and first-correction focused suites were insufficient detection and
must not be cited as complete evidence. The latest adversarial RED set adds
caller-constructed/copy/replacement/fake capability probes, four exact payload
schema probes, and fullmatch malformed-ref probes. The Task 5 combined pytest and
Ruff commands are the automated detection gate; `node scripts/check_harness.mjs`
verifies this failure record's required structure but does not replace the
focused security tests. This paragraph records the intended final defense; only
fresh command output recorded below may establish that it passed.

## Evidence

- Governing design: `docs/superpowers/specs/2026-08-03-bureau-agent-tool-use-design.md`
- Architecture decision: `docs/decisions/0037-bureau-agent-controlled-tool-use.md`
- Task brief: `.superpowers/sdd/bureau-agent-tool-use-task-5-brief.md`
- Initial false-green report: `.superpowers/sdd/bureau-agent-tool-use-task-5-report.md`
- Reviewer rejection: handler identity, schema registry, nested redaction,
  algorithm binding, deterministic truncation, budget projection, audit fallback,
  timeout and eviction coverage were all incomplete.
- First-correction residual review: public IDs remained forgeable, generic data
  mappings were not four real schemas, and substring ref checks were not a parser.
- Latest RED evidence: importing the missing `AuthorizedToolHandlerSet` failed
  test collection; after capability work began, the payload/envelope algorithm
  mismatch test independently failed with `DID NOT RAISE` before its cross-check
  was implemented.
- Latest post-implementation evidence: the Task 2–5/downstream matrix passed 238
  tests, scoped Ruff passed, scoped `git diff --check` exited zero, and
  `node scripts/check_harness.mjs` passed 72 baseline files. These results apply
  to the final three-boundary correction, not retroactively to either earlier
  false-green state.
- That 238-test correction was subsequently found incomplete as well: the
  signer remained publicly exported, accepted caller-provided binding/expected
  pairs as self-proof, and stored bindings in a mutable dict. The final Critical
  defense therefore removes every package/public signer export, accepts one
  trusted-adapter mapping only inside the executor module, constructs bindings
  internally, freezes them as a tuple of frozen dataclasses, and signs capability
  ID plus tool/descriptor/handler IDs and callable object identities with a
  module-random HMAC key. Execution recomputes the signature every time. Only
  the fresh matrix recorded after these probes may establish the corrected state.
- Final Critical evidence: Task 2–5/downstream passed 241 tests in 5.76s; scoped
  Ruff passed; scoped `git diff --check` exited zero; and the harness passed 72
  baseline files. These are the first results that include non-public signing,
  immutable bindings, and HMAC tamper probes together.
