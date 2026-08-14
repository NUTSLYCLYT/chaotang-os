# Main Flow Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (only if the user explicitly requests
> subagents) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deterministic decree-to-accounting-artifact main flow strictly
and reproducibly green from declared project dependencies, then prove the exact
final version with ten consecutive complete synthetic rounds.

**Architecture:** Keep ADR 0028 and production behavior unchanged. Correct the
test runner's default input and standalone import bootstrap, remove ordinary
tests' dependency on ignored runtime residue, and restore dependencies from the
existing manifests. Verification proceeds from focused red-green cycles through
full repository checks and a final ten-round local synthetic gate.

**Tech Stack:** Python 3.11+, pytest, FastAPI/Uvicorn, openpyxl, Node.js 22+,
Next.js 16, TypeScript, npm, PowerShell, repository harness scripts.

## Global Constraints

- Do not modify, bypass, or replace
  `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`.
- Do not change decree routing, accounting intent semantics, delivery enums,
  artifact authorization, archive behavior, or production APIs.
- Do not add or upgrade dependencies; restore only `backend/pyproject.toml` and
  `frontend/package-lock.json` declarations.
- Do not call real DeepSeek, paid APIs, external evidence sources, or production
  systems.
- Preserve all pre-existing working-tree changes and generated/runtime ignore
  boundaries.
- Do not stage or commit unless the user separately authorizes the exact Git
  write. Use review checkpoints in place of the commit steps normally suggested
  by `writing-plans`.
- Any failed final round, or any material code/configuration/acceptance-flow
  change after counting starts, resets the consecutive count to round one.
- Allowed implementation paths are `backend/tests/` and the task evidence
  sections under `docs/product/tasks/`; expanding beyond them requires a fresh
  scope decision. Dependency directories remain ignored local state.

---

### Task 1: Restore the declared local test environments

**Files:**

- Verify only: `backend/pyproject.toml`
- Verify only: `frontend/package.json`
- Verify only: `frontend/package-lock.json`
- Create locally, ignored: `backend/.venv/`
- Recreate locally, ignored: `frontend/node_modules/`

**Interfaces:**

- Consumes: Python `>=3.11`, Node.js `>=22`, committed dependency declarations.
- Produces: `backend/.venv/Scripts/python.exe` and complete npm binaries including
  `frontend/node_modules/.bin/eslint.cmd`.

- [ ] **Step 1: Capture the immutable source baseline and environment versions**

Run from `D:\workspace\chaotang-os`:

```powershell
git status --short
git diff -- docs/decisions/0028-decree-evidence-flow-governance-baseline.md
python --version
node --version
npm --version
```

Expected: existing user changes are visible; the ADR diff is empty; Python is
3.11 or newer; Node is 22 or newer.

- [ ] **Step 2: Create the backend virtual environment and install declared development dependencies**

Run:

```powershell
python -m venv backend/.venv
Set-Location backend
.venv/Scripts/python.exe -m pip install --upgrade pip
.venv/Scripts/python.exe -m pip install -e ".[dev]"
Set-Location ..
```

Expected: all commands exit 0 without changing `backend/pyproject.toml`.

- [ ] **Step 3: Prove timezone and test tools come from the virtual environment**

Run:

```powershell
backend/.venv/Scripts/python.exe -c "from zoneinfo import ZoneInfo; print(ZoneInfo('Asia/Shanghai'))"
backend/.venv/Scripts/python.exe -m pytest --version
backend/.venv/Scripts/python.exe -m ruff --version
```

Expected: first command prints `Asia/Shanghai`; pytest and Ruff print versions;
no `PYTHONTZPATH` override is set.

- [ ] **Step 4: Restore the frontend exactly from the lockfile**

Run:

```powershell
Set-Location frontend
npm ci
Test-Path node_modules/.bin/eslint.cmd
Set-Location ..
```

Expected: `npm ci` exits 0 and `Test-Path` prints `True`; neither frontend
manifest changes.

- [ ] **Step 5: Review the environment-only result**

Run:

```powershell
git diff -- backend/pyproject.toml frontend/package.json frontend/package-lock.json
git status --short
```

Expected: dependency manifests have no diff and ignored dependency directories
do not appear in status. Do not commit.

---

### Task 2: Make the formal default decree strictly request a report

**Files:**

- Modify: `backend/tests/run_accounting_synthetic_acceptance.py:30`
- Modify: `backend/tests/run_accounting_synthetic_acceptance.py:676-679`
- Test: `backend/tests/test_accounting_report_intent.py`

**Interfaces:**

- Consumes: `detect_accounting_report_intent(text: str) -> ReportIntent` and
  `AccountingRequestKind.ACCOUNTING_REPORT`.
- Produces: `ACCOUNTING_DECREE`, an unambiguous 2025 management-report request
  used by the formal runner while preserving strict `deliveryKind ==
  "accounting_report"`.

- [ ] **Step 1: Write the failing default-contract test**

Add this import to `backend/tests/test_accounting_report_intent.py`:

```python
from tests.run_accounting_synthetic_acceptance import ACCOUNTING_DECREE
```

Add this test immediately after the existing exact-analysis test:

```python
def test_synthetic_acceptance_default_decree_is_explicit_report() -> None:
    intent = detect_accounting_report_intent(ACCOUNTING_DECREE)

    assert intent.request_kind is AccountingRequestKind.ACCOUNTING_REPORT
    assert intent.kind is report_models.ReportIntentKind.EXPLICIT_PERIOD
    assert intent.period == ReportPeriod(2025, 2025)
```

- [ ] **Step 2: Run the test and verify the existing default is rejected**

Run from `backend/`:

```powershell
.venv/Scripts/python.exe -m pytest tests/test_accounting_report_intent.py::test_synthetic_acceptance_default_decree_is_explicit_report -q
```

Expected: FAIL because the current default classifies as
`AccountingRequestKind.ACCOUNTING_ANALYSIS`.

- [ ] **Step 3: Replace only the runner default and its diagnostic label**

In `backend/tests/run_accounting_synthetic_acceptance.py`, use:

```python
ACCOUNTING_DECREE = "请户部会计司根据本地财务数据生成2025年管理层综合财务报告"
```

Change the final success label from `explicit-analysis-2025` to
`explicit-report-2025`. Keep the existing strict line unchanged:

```python
assert decree["deliveryKind"] == "accounting_report"
```

- [ ] **Step 4: Run focused intent and runner-contract tests**

Run:

```powershell
.venv/Scripts/python.exe -m pytest tests/test_accounting_report_intent.py tests/test_synthetic_accounting_acceptance_app.py::test_acceptance_runner_supports_frozen_decree_and_round_cli -q
```

Expected: PASS. The old exact-analysis test also remains PASS because it retains
its own analysis text and production intent semantics are unchanged.

- [ ] **Step 5: Review the isolated change**

Run from the repository root:

```powershell
git diff -- backend/tests/run_accounting_synthetic_acceptance.py backend/tests/test_accounting_report_intent.py
git diff --check
```

Expected: only the test, default decree, and accurate success label changed. Do
not commit.

---

### Task 3: Make late helper loading independent of invocation mode

**Files:**

- Modify: `backend/tests/run_accounting_synthetic_acceptance.py:27-30`
- Modify: `backend/tests/run_accounting_synthetic_acceptance.py:658-661`
- Test: `backend/tests/test_synthetic_accounting_acceptance_app.py`

**Interfaces:**

- Consumes: repository-derived `BACKEND: Path` and the sibling module function
  `_run_dynamic_layout_matrix(root: Path, *, corrupt_case: str | None = None)`.
- Produces: `_load_dynamic_layout_matrix()` returning the callable in both direct
  script and `tests.*` module contexts.

- [ ] **Step 1: Write a failing direct-script-context import regression**

Add this test after
`test_acceptance_runner_supports_frozen_decree_and_round_cli`:

```python
def test_acceptance_runner_loads_dynamic_matrix_from_script_context(
    tmp_path: Path,
) -> None:
    runner_path = Path(__file__).with_name("run_accounting_synthetic_acceptance.py")
    probe = (
        "import runpy\n"
        f"namespace = runpy.run_path({str(runner_path)!r}, run_name='acceptance_probe')\n"
        "loader = namespace['_load_dynamic_layout_matrix']\n"
        "print(loader().__name__)\n"
    )

    completed = subprocess.run(
        [sys.executable, "-c", probe],
        cwd=tmp_path,
        check=True,
        capture_output=True,
        text=True,
    )

    assert completed.stdout.strip() == "_run_dynamic_layout_matrix"
```

- [ ] **Step 2: Run the regression and verify the helper is absent**

Run from `backend/`:

```powershell
.venv/Scripts/python.exe -m pytest tests/test_synthetic_accounting_acceptance_app.py::test_acceptance_runner_loads_dynamic_matrix_from_script_context -q
```

Expected: FAIL because `_load_dynamic_layout_matrix` does not exist in the
runner namespace.

- [ ] **Step 3: Add the minimal repository-root bootstrap and loader**

Add this function after the `BACKEND` and `FRONTEND` constants:

```python
def _load_dynamic_layout_matrix():
    backend_import_root = str(BACKEND)
    if backend_import_root not in sys.path:
        sys.path.insert(0, backend_import_root)
    from tests.synthetic_accounting_acceptance_app import _run_dynamic_layout_matrix

    return _run_dynamic_layout_matrix
```

Replace the late import and call with:

```python
os.environ["CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"] = tmp
dynamic_matrix = _load_dynamic_layout_matrix()(Path(tmp) / "dynamic-layouts")
```

Keep the import late so the runner establishes its isolated environment before
the synthetic application module is loaded.

- [ ] **Step 4: Run the import regression and existing dynamic matrix tests**

Run:

```powershell
.venv/Scripts/python.exe -m pytest tests/test_synthetic_accounting_acceptance_app.py -q
```

Expected: PASS, including the new direct-script-context probe and all dynamic
layout cases.

- [ ] **Step 5: Exercise both real invocation modes for one round each**

Build the frontend first, then run from `backend/`:

```powershell
Set-Location ../frontend
npm run build
Set-Location ../backend
$env:CHAOTANG_ACCEPTANCE_ROUND='1'
.venv/Scripts/python.exe tests/run_accounting_synthetic_acceptance.py --rounds 1
.venv/Scripts/python.exe -m tests.run_accounting_synthetic_acceptance --rounds 1
Remove-Item Env:CHAOTANG_ACCEPTANCE_ROUND -ErrorAction SilentlyContinue
```

Expected: both commands exit 0, print `explicit-report-2025`, and report the same
dynamic-layout case set. Do not begin the formal ten-round count yet.

---

### Task 4: Remove ordinary-suite dependence on ignored formal residue

**Files:**

- Modify: `backend/tests/test_synthetic_accounting_acceptance_app.py:3-8`
- Modify: `backend/tests/test_synthetic_accounting_acceptance_app.py:547-590`
- Verify only: `.gitignore:31`
- Verify only: `backend/tests/run_accounting_synthetic_acceptance.py`

**Interfaces:**

- Consumes: tracked runner source and pytest temporary directories.
- Produces: an ordinary acceptance test module that never reads pre-existing
  `.superpowers/` files; formal round evidence remains generated runtime output.

- [ ] **Step 1: Add a failing clean-boundary regression before removing stale tests**

Add this test after
`test_acceptance_runner_records_external_formal_round_number`:

```python
def test_ordinary_acceptance_tests_do_not_require_ignored_runtime_evidence() -> None:
    source = Path(__file__).read_text(encoding="utf-8")
    ignored_runtime_root = "." + "superpowers"

    assert ignored_runtime_root not in source
```

- [ ] **Step 2: Run it and prove the current module names the ignored path**

Run from `backend/`:

```powershell
.venv/Scripts/python.exe -m pytest tests/test_synthetic_accounting_acceptance_app.py::test_ordinary_acceptance_tests_do_not_require_ignored_runtime_evidence -q
```

Expected: FAIL because the two stale tests contain `.superpowers` path literals.

- [ ] **Step 3: Remove only the two residue-dependent assertions**

Delete these complete tests:

```python
test_formal_wrapper_constructs_decree_from_ascii_base64
test_formal_round_summary_records_native_exit_code
```

Also remove the now-unused imports:

```python
import base64
import hashlib
import re
```

Do not change `.gitignore`. Do not replace the deleted tests with a skipped test
or a permissive fallback. The tracked runner contract remains covered by the
CLI, round-number, strict-delivery, import-context, and real synthetic tests;
formal evidence is covered by Task 6.

- [ ] **Step 4: Prove the focused test module is self-contained**

Run:

```powershell
.venv/Scripts/python.exe -m pytest tests/test_synthetic_accounting_acceptance_app.py -q
.venv/Scripts/python.exe -m ruff check tests/test_synthetic_accounting_acceptance_app.py
```

Expected: both commands PASS with no ignored evidence present.

- [ ] **Step 5: Reproduce the original full-suite boundary**

Run:

```powershell
.venv/Scripts/python.exe -m pytest -q
```

Expected: no `FileNotFoundError` for
`.superpowers/sdd/run_task8_formal_rounds.ps1` or
`.superpowers/sdd/dynamic-bureau-task-8-rounds/round-01.json`. Any unrelated
failure is investigated before continuing; do not hide it. Do not commit.

---

### Task 5: Run the complete pre-formal verification matrix

**Files:**

- Verify: all modified files
- Update after evidence is complete:
  `docs/product/tasks/2026-08-14-main-flow-stabilization.md`

**Interfaces:**

- Consumes: Tasks 1-4 and the existing repository commands.
- Produces: a single unchanged candidate version eligible to enter the
  consecutive-round gate.

- [ ] **Step 1: Run backend lint and full tests**

Run from `backend/`:

```powershell
.venv/Scripts/python.exe -m ruff check .
.venv/Scripts/python.exe -m pytest -q
```

Expected: both PASS; no machine-specific timezone override is used.

- [ ] **Step 2: Run the full frontend matrix**

Run from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all four commands exit 0 using lockfile-restored dependencies.

- [ ] **Step 3: Run local frontend/backend integration**

Run from the repository root:

```powershell
node scripts/verify_integration.mjs
```

Expected: all health, unavailable-backend, healthy-BFF, and sanitized network
mapping scenarios PASS, with spawned processes cleaned up.

- [ ] **Step 4: Run every repository harness gate**

Run:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: all commands PASS. The last product-flow command is self-test only and
must not enter delivery mode or invoke Claude.

- [ ] **Step 5: Freeze the candidate evidence identity**

Run:

```powershell
$candidateFiles = @(
  'backend/tests/run_accounting_synthetic_acceptance.py',
  'backend/tests/test_accounting_report_intent.py',
  'backend/tests/test_synthetic_accounting_acceptance_app.py',
  'frontend/package-lock.json',
  'backend/pyproject.toml'
)
Get-FileHash -Algorithm SHA256 $candidateFiles | Format-Table Path,Hash
git status --short
git diff -- docs/decisions/0028-decree-evidence-flow-governance-baseline.md
```

Expected: hashes are recorded, ADR diff is empty, and status contains only known
user files plus this task's intended changes. Any subsequent material change
invalidates these hashes and requires rerunning Task 5.

---

### Task 6: Complete ten consecutive synthetic main-flow rounds

**Files:**

- Create runtime evidence, ignored:
  `.superpowers/sdd/main-flow-stabilization-rounds/round-01.log` through
  `round-10.log`
- Update: `docs/product/tasks/2026-08-14-main-flow-stabilization.md`

**Interfaces:**

- Consumes: the unchanged candidate hashes from Task 5 and the direct script-path
  acceptance command.
- Produces: ten ordered PASS logs and a task report containing commands, results,
  limitations, and residual risks.

- [ ] **Step 1: Initialize isolated ignored evidence without deleting prior data**

Run from the repository root:

```powershell
$evidenceRoot = '.superpowers/sdd/main-flow-stabilization-rounds'
if (Test-Path $evidenceRoot) {
  throw "Evidence path already exists; choose a new timestamped path instead of overwriting it."
}
New-Item -ItemType Directory -Path $evidenceRoot | Out-Null
```

Expected: a new directory is created. Existing evidence is never overwritten or
deleted.

- [ ] **Step 2: Run rounds 1-10 with fail-fast logging**

Run:

```powershell
$evidenceRoot = '.superpowers/sdd/main-flow-stabilization-rounds'
$python = (Resolve-Path 'backend/.venv/Scripts/python.exe').Path
$runner = (Resolve-Path 'backend/tests/run_accounting_synthetic_acceptance.py').Path
for ($round = 1; $round -le 10; $round++) {
  $env:CHAOTANG_ACCEPTANCE_ROUND = [string]$round
  $log = Join-Path $evidenceRoot ('round-{0:D2}.log' -f $round)
  & $python -u $runner --rounds 1 2>&1 | Tee-Object -FilePath $log
  if ($LASTEXITCODE -ne 0) {
    throw "Acceptance round $round failed; reset the count to round one after root-cause correction."
  }
}
Remove-Item Env:CHAOTANG_ACCEPTANCE_ROUND -ErrorAction SilentlyContinue
```

Expected: every invocation exits 0 and each log contains a JSON evidence object
with matching `round`, `exit_code: 0`, `status: PASS`, a workbook hash, owner
isolation proof, failed-job classification, and a passing nine-case dynamic
layout matrix.

- [ ] **Step 3: Validate all ten logs structurally**

Run:

```powershell
$evidenceRoot = '.superpowers/sdd/main-flow-stabilization-rounds'
$roundLogs = Get-ChildItem $evidenceRoot -Filter 'round-*.log' | Sort-Object Name
if ($roundLogs.Count -ne 10) { throw "Expected exactly 10 round logs." }
for ($index = 0; $index -lt 10; $index++) {
  $expectedRound = $index + 1
  $jsonLine = Get-Content $roundLogs[$index].FullName |
    Where-Object { $_.StartsWith('{') -and $_.Contains('"artifact_sha256"') } |
    Select-Object -First 1
  if (-not $jsonLine) { throw "Missing evidence JSON in $($roundLogs[$index].Name)." }
  $evidence = $jsonLine | ConvertFrom-Json
  if ($evidence.round -ne $expectedRound -or
      $evidence.exit_code -ne 0 -or
      $evidence.status -ne 'PASS' -or
      $evidence.dynamic_layout_matrix.status -ne 'PASS' -or
      -not $evidence.workbook_open) {
    throw "Invalid evidence in $($roundLogs[$index].Name)."
  }
}
Write-Output 'main-flow-formal-rounds: PASS (10/10)'
```

Expected: `main-flow-formal-rounds: PASS (10/10)`.

- [ ] **Step 4: Confirm the candidate did not change during counting**

Re-run the Task 5 hash command and compare every digest with the recorded
candidate values. Then run:

```powershell
git diff --check
git diff -- docs/decisions/0028-decree-evidence-flow-governance-baseline.md
git status --short
```

Expected: candidate hashes are identical, ADR diff is empty, and runtime logs
remain ignored. If any candidate hash differs, discard the count and restart
Task 5 followed by Task 6.

- [ ] **Step 5: Record the implementation and acceptance report**

Update `docs/product/tasks/2026-08-14-main-flow-stabilization.md`:

- set the implementation summary to the exact modified behavior;
- list every skill actually used;
- record each Task 5 command with PASS/FAIL;
- record rounds 1-10 individually with the evidence path and PASS result;
- state that real model, external-network, production-write, deploy, and Git
  commit/push were not run;
- record any warnings and residual risks; and
- mark `Acceptance Review` passed only if every criterion and all ten unchanged
  rounds passed.

- [ ] **Step 6: Run the documentation and final harness check**

Run:

```powershell
node scripts/check_harness.mjs
git diff --check
git status --short
```

Expected: harness and diff check PASS. Do not stage or commit without separate
user authorization.

---

## Final Review Checklist

- [ ] The default runner request is a strict report, not an analysis request.
- [ ] Script-path and module invocation both reach the dynamic matrix.
- [ ] No ordinary tracked test requires ignored runtime evidence.
- [ ] Backend and frontend checks use declared, restored dependencies.
- [ ] ADR 0028 has no diff.
- [ ] Focused, full, integration, build, and harness checks are fresh and green.
- [ ] Ten complete rounds passed consecutively on identical candidate hashes.
- [ ] No real model, external source, production write, deploy, stage, commit,
  push, merge, or PR action occurred without explicit authorization.
