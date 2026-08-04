# 39 Bureau Independent Runtime Skill Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every authoritative bureau Runtime Skill into one independently owned Python file without changing any runtime behavior or authority.

**Architecture:** Introduce frozen shared specification types and one explicit central registry. Each of 39 modules exports one complete `SKILL`; compatibility facades derive the old maps from the central registry.

**Tech Stack:** Python 3, Pydantic/dataclasses, pytest, Ruff, Node harness, PowerShell acceptance runner.

## Global Constraints

- Preserve all current Agent IDs, Skill IDs, Policy IDs, versions, text, operations, domains, constraints, budgets, report types, and registration order exactly.
- No dynamic discovery, filename inference, generic policy, fallback, or automatic completion.
- Do not modify or bypass ADR 0028, controlled Tool Use, upper-layer isolation, or the four-node graph.
- Existing modified/untracked user work must be preserved; no Git write without separate authorization.
- Final acceptance requires at least 10 consecutive complete rounds on one unchanged fingerprint.

---

### Task 1: Freeze the migration oracle

**Files:**
- Create: `backend/tests/test_bureau_independent_skill_files.py`
- Reference: `backend/app/agents/runtime_skills/roles/bureaus/professional.py`
- Reference: `backend/app/agents/runtime_skills/registry.py`

**Interfaces:**
- Produces a canonical snapshot helper that serializes all 39 current Skill IDs, methods, policies, ordering, and fingerprints.

- [ ] Write tests that record exactly 39 authoritative identities and reject missing, duplicate, extra, reordered, or field-mutated definitions.
- [ ] Run `python -m pytest backend/tests/test_bureau_independent_skill_files.py -q` and verify RED because the independent registry does not exist.
- [ ] Add only test-side canonical serialization of the current authoritative data; do not change production definitions.
- [ ] Run the test and retain a migration oracle that passes against the old layout and can compare the new layout later.

### Task 2: Add shared frozen specification and explicit registry shell

**Files:**
- Create: `backend/app/agents/runtime_skills/roles/bureaus/skill_spec.py`
- Create: `backend/app/agents/runtime_skills/roles/bureaus/skill_registry.py`
- Create: `backend/app/agents/runtime_skills/roles/bureaus/skills/__init__.py`
- Test: `backend/tests/test_bureau_independent_skill_files.py`

**Interfaces:**
- Produces `BureauRuntimeSkillSpec` and immutable `BUREAU_SKILL_SPECS`.

- [ ] Write RED tests for frozen fields, exact identity validation, duplicate Agent/Skill/Policy IDs, and a registry count other than 39.
- [ ] Implement frozen shared types without copying business definitions.
- [ ] Implement an initially explicit registry interface that accepts only declared `SKILL` objects and fails closed on all set/identity mismatches.
- [ ] Run targeted tests and Ruff.

### Task 3: Migrate 吏部 and 户部 files

**Files:**
- Create: `backend/app/agents/runtime_skills/roles/bureaus/skills/libu_*.py`
- Create: `backend/app/agents/runtime_skills/roles/bureaus/skills/hubu_*.py`
- Modify: `backend/app/agents/runtime_skills/roles/bureaus/skill_registry.py`
- Test: `backend/tests/test_bureau_independent_skill_files.py`

**Interfaces:**
- Each file exports exactly one `SKILL: BureauRuntimeSkillSpec`.

- [ ] Add RED tests asserting explicit module ownership and exact migration-oracle equality for the two departments.
- [ ] Move Skill ID, method, and policy for each bureau into its module without editing content.
- [ ] Add explicit imports in stable authoritative order.
- [ ] Run department snapshot, registry, Tool Policy, and Ruff tests.

### Task 4: Migrate 礼部 and 兵部 files

**Files:**
- Create: `backend/app/agents/runtime_skills/roles/bureaus/skills/libu_rites_*.py`
- Create: `backend/app/agents/runtime_skills/roles/bureaus/skills/bingbu_*.py`
- Modify: `backend/app/agents/runtime_skills/roles/bureaus/skill_registry.py`
- Test: `backend/tests/test_bureau_independent_skill_files.py`

- [ ] Establish RED module-count and snapshot checks for these departments.
- [ ] Move definitions verbatim into one-file-per-bureau modules.
- [ ] Register each module explicitly and preserve global order.
- [ ] Run snapshot, Tool Policy, registry, and Ruff tests.

### Task 5: Migrate 刑部 and 工部 files

**Files:**
- Create: `backend/app/agents/runtime_skills/roles/bureaus/skills/xingbu_*.py`
- Create: `backend/app/agents/runtime_skills/roles/bureaus/skills/gongbu_*.py`
- Modify: `backend/app/agents/runtime_skills/roles/bureaus/skill_registry.py`
- Test: `backend/tests/test_bureau_independent_skill_files.py`

- [ ] Establish RED checks requiring the final 39 modules and 39 explicit imports.
- [ ] Move definitions verbatim and complete the central registry.
- [ ] Prove all 39 migrated specifications equal the oracle and all IDs are unique.
- [ ] Run snapshot, registry, Tool Policy, and Ruff tests.

### Task 6: Convert old modules to compatibility facades

**Files:**
- Modify: `backend/app/agents/runtime_skills/roles/bureaus/professional.py`
- Modify: six department ID modules under `roles/bureaus/`
- Modify: `backend/app/agents/runtime_skills/registry.py`
- Modify: `backend/app/agents/runtime_skills/tool_registry.py`
- Test: `backend/tests/test_bureau_independent_skill_files.py`
- Test: existing bureau registry tests.

- [ ] Write RED tests proving old exports equal central derived maps and contain no independent definition dictionaries.
- [ ] Replace old bodies with derived compatibility exports.
- [ ] Make the Runtime Skill and Tool registries consume the central specification while preserving output order and fingerprints.
- [ ] Run Task 1–6 tests, import-cycle probes, Ruff, and `git diff --check`.

### Task 7: Production regression and documentation verification

**Files:**
- Modify: `docs/product/tasks/2026-08-04-independent-bureau-skill-files.md`
- Modify: Harness required-file checks only if needed for durable new architecture files.

- [ ] Run 39-bureau runtime, Tool registry, Tool loop, production integration, Evidence, ministry, Junjichu, Chancellor, and graph tests.
- [ ] Run the full backend suite and Ruff.
- [ ] Run all four Harness/self-test commands and diff check.
- [ ] Independently review the actual modified/untracked tree for definition drift, fallback, duplicate sources, import cycles, and test false-greens.

### Task 8: Frozen ten-round acceptance

**Files:**
- Record evidence under `.superpowers/sdd/` without adding runtime evidence to Git.
- Modify the product task acceptance fields only after independent reviews approve.

- [ ] Freeze a manifest containing all 39 Skill modules, shared types, registries, tests, ADR 0038, design, plan, product task, runner, and Harness configuration.
- [ ] Run one complete preflight.
- [ ] Execute the exact final matrix for 10 consecutive complete rounds on one fingerprint; reset to zero on any failure or substantive change.
- [ ] Independently recompute manifest hashes, rounds, commands, streams, and continuity.
- [ ] Mark the product task Accepted only after code and evidence reviews both approve.
