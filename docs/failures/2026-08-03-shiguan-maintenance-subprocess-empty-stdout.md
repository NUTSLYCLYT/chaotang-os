# Shiguan maintenance subprocess empty stdout interrupted final acceptance

## Summary

On 2026-08-03, the Task 9 pre-acceptance complete backend suite failed once because `test_maintenance_check_emits_desensitized_json` received empty `stdout` from the Shiguan maintenance subprocess and attempted to decode it as JSON. The acceptance run stopped at `0/10`; later runs of the exact test, the only identified preceding `cwd`-pollution candidate followed by the test, and the complete backend suite all passed.

## Root Cause

The hardened oracle later captured the concrete child failure: return code `1` with `ModuleNotFoundError: app`. The test launched `python -m app.shiguan.maintenance` without an explicit child working directory, so module discovery depended on the parent process's ambient cwd and `PYTHONPATH`. Running pytest successfully did not establish that a fresh child interpreter could import the backend package from its inherited directory.

The original JSON-first oracle then replaced that import failure with a secondary `JSONDecodeError`, obscuring the actionable boundary. The diagnostic ordering gap explains the initial opacity; the ambient import-path dependency is the concrete execution root cause. No production maintenance defect was demonstrated.

## Prevention

The test oracle is now hardened. A private parser checks the subprocess `returncode` before reading `stdout`; nonzero exits never echo any `stderr` text. The stable assertion contains only the return code, the UTF-8 byte length, and a SHA-256 digest so repeated failures can be correlated without disclosing paths, URLs, credentials, tokens, traceback text, or other unknown secret forms. Successful processes receive distinct stable diagnostics for empty and invalid JSON output. The test still performs no retry, so the first failure remains visible.

The maintenance subprocess is now launched through one test-private helper with `cwd` fixed to the resolved backend root. It does not inject or overwrite `PYTHONPATH`, so user environment values remain untouched and `python -m app.shiguan.maintenance` has a deterministic, cross-platform import root.

An initial line-oriented regex sanitizer was rejected during P1 review because quoted POSIX paths, UNC paths, authorization headers, token formats, and unforeseen secret shapes could bypass a blacklist. The zero-body policy removes that parser-class risk rather than expanding the blacklist.

Any recurrence must preserve the new assertion, `cwd`, and relevant import-path context before rerunning anything, then restart the final acceptance count from round 1 as required.

## Detection

The existing complete backend suite, `backend\.venv\Scripts\python.exe -m pytest backend/tests -q`, detected the event and remains the full-suite regression gate. The real subprocess test now changes the parent cwd to the repository root, removes `PYTHONPATH`, asserts that the helper explicitly supplies the backend cwd, and then executes the child. Dedicated parser tests continue to prove zero stderr-body disclosure and stable success diagnostics. `node scripts/check_harness.mjs` validates this failure record's required structure.

Hardening evidence includes the original diagnostic RED/GREEN cycle, the P1 zero-body cycle, and the import-isolation RED where `cwd=None` violated the child contract followed by GREEN with `cwd=BACKEND_ROOT`. Complete target-file, backend-suite, and static-check evidence is recorded in the Task 9 diagnostic-fix report.

## Evidence

- [Task 9 failure investigation](../../.superpowers/sdd/independent-runtime-skills-task-9-failure-investigation.md): exact focused test passed (`1 passed`), the identified `cwd` candidate plus target test passed (`2 passed`), and the complete backend suite passed (`2358 passed, 1 skipped`).
- [Task 9 acceptance report](../../.superpowers/sdd/independent-runtime-skills-task-9-report.md): original complete-suite failure (`1 failed, 2357 passed, 1 skipped`) and acceptance stop at `0/10`.
- [Task 9 product task](../product/tasks/2026-08-03-independent-runtime-skills-for-all-agents.md): acceptance status and fail-fast record.
- [Target subprocess test](../../backend/tests/test_shiguan_migrations.py) and [maintenance entry point](../../backend/app/shiguan/maintenance.py): detection boundary and subprocess output producer.
- [ADR 0028 governance baseline](../decisions/0028-decree-evidence-flow-governance-baseline.md): immutable decree/evidence-flow baseline preserved during the investigation.
