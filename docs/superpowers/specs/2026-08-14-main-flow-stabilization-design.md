# Main Flow Stabilization Design

## Status

Approved — 2026-08-14. The user selected the self-contained
acceptance-baseline approach (方案 A) and subsequently confirmed this written
specification.

## Problem

The deterministic decree main flow can complete successfully, but the repository
cannot reproduce a fully green acceptance result from a clean checkout:

- the synthetic accounting runner's default decree expresses analysis while the
  runner strictly expects a report delivery;
- the documented script-path invocation reaches a late `tests.*` import that is
  unavailable in that invocation mode;
- two tracked tests require formal-round evidence under ignored `.superpowers/`
  paths; and
- the current local dependency directories are incomplete, so frontend lint and
  backend timezone loading do not represent the locked project environment.

These are acceptance and environment reproducibility defects. The successful
module-mode synthetic run shows that they do not justify changing the decree
business flow or ADR 0028.

## Goals

- Make the documented synthetic acceptance command exercise one unambiguous
  management-report decree and keep its delivery-kind assertion strict.
- Support both direct script-path and Python module invocation without depending
  on the caller's import-path accident.
- Make the tracked backend suite independent of ignored local evidence.
- Restore frontend and backend dependencies strictly from committed manifests
  and lock data.
- Obtain fresh, repeatable evidence and ten consecutive complete acceptance
  rounds from one unchanged final version.

## Non-Goals

- Changing ADR 0028, decree routing, accounting intent semantics, delivery-kind
  enums, artifact authorization, or archive behavior.
- Accepting both analysis and report merely to make the runner green.
- Committing generated workbooks, databases, logs, formal-round JSON, virtual
  environments, or `node_modules`.
- Calling a real model, paid API, external evidence source, or production system.
- Refactoring the broader test or acceptance architecture.

## Task Profile and Route

Task profile: the objective and roots are known; changes are reversible and
primarily test-side, but they cross dependency setup, backend tests, the
frontend/backend acceptance runner, and a long verification chain.

Selected route: Superpowers.

Reason: a smaller workflow would not adequately protect the strict contract,
clean-checkout reproducibility, and ten-round final gate.

Quality gates: preserve ADR 0028; reproduce each defect; add or adjust regression
tests before the fix; restore only declared dependencies; run fresh focused and
full verification; complete ten consecutive unchanged acceptance rounds.

Escalation: stop and seek new approval if the fix requires a business-contract
change, a new dependency, production or external access, destructive cleanup, or
modification of ADR 0028.

## Design

### 1. Strict acceptance intent

The runner's default decree will explicitly request a 2025 management-level
financial report. Its expected delivery remains `accounting_report`. A focused
regression test will prove that the default decree is classified as a report.
Custom `--decree` input will not weaken the default formal acceptance contract.

### 2. Invocation-independent imports

The runner will resolve its sibling synthetic-application helper explicitly for
the active package context. Both supported entry points must reach the same
dynamic-layout matrix:

- `python tests/run_accounting_synthetic_acceptance.py`
- `python -m tests.run_accounting_synthetic_acceptance`

The implementation must not depend on adding an untracked `tests/__init__.py` or
on a machine-specific `PYTHONPATH`.

### 3. Self-contained tracked tests

Tests will validate the formal-round contract using tracked source plus
temporary test-owned files. They will not read `.superpowers/sdd/...` evidence
from a developer's previous run. Runtime formal evidence remains ignored and may
be written only to its existing runtime location. Missing local evidence must no
longer make the ordinary backend suite fail or pass differently across machines.

### 4. Declared environment restoration

The frontend environment will be restored with `npm ci`, preserving
`package-lock.json`. The backend environment will be created from the repository
setup contract so the already-declared `tzdata` dependency is present. No
manifest or lockfile change is expected; any required dependency change is an
escalation condition.

### 5. Evidence isolation

Synthetic databases, artifacts, logs, and round evidence remain under temporary
or ignored runtime paths. Tests must clean up processes they start and must not
write user data or production state. Existing unrelated working-tree changes are
preserved.

## Error Handling

- A delivery-kind mismatch remains a hard failure with the expected and actual
  kinds visible in test output.
- Import failure in either documented invocation mode is a hard regression.
- Missing generated formal evidence is not an ordinary-suite prerequisite; the
  formal runner itself is responsible for generating and validating its round
  evidence.
- Dependency restoration failure is reported as an environment failure and is
  not hidden by changing tests or package manifests.
- Any failed final round resets the consecutive count to round one. Any material
  code, configuration, or acceptance-flow change also resets the count.

## Verification Design

Implementation follows red-green-refactor for each root cause:

1. Prove the default decree currently classifies as analysis while the runner
   expects a report; then protect the corrected strict report default.
2. Reproduce the documented script-path import failure; then prove both
   invocation modes reach and pass the dynamic-layout matrix.
3. Reproduce the two clean-checkout failures with the ignored evidence absent;
   then prove the focused tests pass using only tracked and temporary inputs.
4. Restore declared dependencies and run frontend lint plus backend timezone
   collection without machine-specific path overrides.

Fresh verification for the final unchanged version includes:

- focused backend acceptance tests;
- full backend test suite and Ruff;
- frontend lint, typecheck, full tests, and build;
- `node scripts/verify_integration.mjs`;
- all four repository harness commands; and
- ten consecutive complete synthetic accounting acceptance rounds, each with
  command, PASS/FAIL result, and isolated evidence recorded.

The ten-round gate is deterministic and uses fake-wired/local synthetic services;
it does not authorize real DeepSeek calls or external network evidence.

## Acceptance Criteria

- The default synthetic decree unambiguously requests a management report and
  produces strict `accounting_report` delivery.
- Both documented invocation modes complete the same acceptance coverage.
- A clean checkout's backend suite does not depend on ignored formal evidence.
- Frontend lint and backend tests run from declared project dependencies without
  ad hoc timezone path injection.
- Focused, full, integration, build, and harness checks all pass on the final
  version.
- The exact final version completes ten consecutive synthetic main-flow rounds.
- ADR 0028 and production/business behavior remain unchanged.
