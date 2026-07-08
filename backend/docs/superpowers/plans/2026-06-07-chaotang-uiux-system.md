# Chaotang UIUX System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic harness that defines and validates the top-level Chaotang OS page layout, buttons, contextual teaching, aesthetic direction, and commercial-offer UX boundaries.

**Architecture:** Add a new `harness/chaotang_uiux_system` package with YAML design rules, JSON golden page cases, a Python evaluator, and pytest coverage. It does not edit Web UI; it creates a testable contract for future UI implementation.

**Tech Stack:** Python, PyYAML, pytest, JSON golden cases, markdown reports.

---

### Task 1: UI/UX Rules Config

**Files:**
- Create: `harness/chaotang_uiux_system/uiux_rules.yaml`
- Create: `harness/chaotang_uiux_system/README.md`
- Create: `harness/chaotang_uiux_system/__init__.py`

- [ ] **Step 1: Write the config**

Define page types, five-second-test requirements, button taxonomy, visual palette, contextual teaching rules, and commercial-offer boundaries.

- [ ] **Step 2: Review config**

Run: `python - <<'PY'
import yaml
yaml.safe_load(open("harness/chaotang_uiux_system/uiux_rules.yaml", encoding="utf-8"))
print("ok")
PY`

Expected: `ok`

### Task 2: Golden Page Cases

**Files:**
- Create: `harness/chaotang_uiux_system/golden_cases/uiux_cases.json`

- [ ] **Step 1: Add cases**

Add cases for:
- `throne_home_beginner`
- `battle_report_sacred_edict`
- `task_execution_junji`
- `qintianjian_companion`
- `bad_dashboard_data_dump`

- [ ] **Step 2: Include expected outcomes**

Each case includes `expect.valid`, `expect.level`, and core findings.

### Task 3: Evaluator

**Files:**
- Create: `harness/chaotang_uiux_system/scripts/run_uiux.py`

- [ ] **Step 1: Implement loader and dataclass**

Create result dataclass with scores for first viewport, visual hierarchy, button clarity, teaching, aesthetic restraint, trust, and delight.

- [ ] **Step 2: Implement deterministic checks**

Check required page elements, button roles, bad patterns, teaching surface, commercial-offer boundaries, and visual palette constraints.

- [ ] **Step 3: Implement reports**

Write `artifacts/latest.json`, `artifacts/latest.md`, and optional ledger.

### Task 4: Tests

**Files:**
- Create: `tests/test_chaotang_uiux_system.py`

- [ ] **Step 1: Test config standards**

Verify core pages, button taxonomy, and palette rules exist.

- [ ] **Step 2: Test golden cases**

Verify good cases pass and the bad dashboard fails.

- [ ] **Step 3: Test commercial offer UX**

Verify commercial offers must be optional, capability-based, and cannot override primary actions.

- [ ] **Step 4: Test report output**

Verify JSON, markdown, and ledger are written.

### Task 5: Verification

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ignore artifacts**

Add `harness/chaotang_uiux_system/artifacts/`.

- [ ] **Step 2: Run tests**

Run: `pytest -q tests/test_chaotang_uiux_system.py tests/test_chaotang_business_model.py tests/test_chaotang_merit_system.py tests/test_yushi_global_gate.py`

Expected: all pass.

- [ ] **Step 3: Run drift and closeout**

Run:
```bash
python scripts/yushi_drift_monitor.py
python scripts/commit_closeout_check.py
```

Expected: no high-risk drift.

