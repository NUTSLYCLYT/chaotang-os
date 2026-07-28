# Dev Swarm Task 1 Report: Bureau Capability Contract

## Scope

Implemented the static, empty capability-package directory for the existing bureau
registry. The implementation adds no bureau identities, prompt execution, model
calls, network access, persistence, scheduling, or business-flow changes.

## Files changed

- `backend/app/agents/bureaus/capabilities.py` — new immutable capability contract,
  empty static directory, load-time validation, and public lookups.
- `backend/app/agents/bureaus/__init__.py` — exports the new public capability symbols
  while preserving existing exports.
- `backend/tests/test_bureau_capabilities.py` — focused public-contract tests.
- `docs/superpowers/sdd/dev-swarm-task-1-report.md` — this report.

## TDD evidence

### RED

Command run from `backend/` before production code:

```powershell
.venv\Scripts\python.exe -m pytest tests/test_bureau_capabilities.py
```

Result: expected failure, `5 failed in 1.70s`.

The failures were `AttributeError` for the absent `CapabilityProfile`,
`CAPABILITY_PROFILES`, `capability_profiles_for`, and `capability_profile_for`
symbols, plus the expected missing public exports. This confirms the tests failed
because the requested feature did not yet exist.

### GREEN

Command run from `backend/` after the minimal implementation:

```powershell
.venv\Scripts\python.exe -m pytest tests/test_bureau_capabilities.py
```

Result: `5 passed in 0.10s`.

## Verification

Commands run from `backend/`:

```powershell
.venv\Scripts\python.exe -m ruff check app\agents\bureaus\capabilities.py app\agents\bureaus\__init__.py tests\test_bureau_capabilities.py
.venv\Scripts\python.exe -m pytest tests\test_bureau_capabilities.py tests\test_bureaus_agent.py
```

Results:

- Ruff: `All checks passed!`
- Pytest: `44 passed in 1.67s`

## Self-review

- `CapabilityProfile` is a frozen, slotted dataclass with exactly the seven required
  fields.
- `CAPABILITY_PROFILES` is the sole static directory and intentionally starts empty.
- Pair lookups first resolve through the existing `bureau_profile_for`, so unknown and
  cross-department identities fail closed while valid, unpackaged bureaus return `()`.
- ID lookups fail closed with `ValueError` when no entry exists.
- Module-load validation rejects invalid profile types, empty scalar fields,
  empty/blank deliverables or guardrails, duplicate IDs, duplicate compound identity
  tuples, and references to unknown bureaus.
- Existing bureau registry contents and all ADR 0028-governed flows were untouched.

## Concerns

None. The directory is intentionally empty until Task 2 supplies the approved
capability mapping; the validation remains active for those future static entries.
