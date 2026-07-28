# Task 1: 建立能力包契约与静态注册表

Read this file as the complete requirements for this task.

## Allowed paths

- `backend/app/agents/bureaus/capabilities.py` (new)
- `backend/app/agents/bureaus/__init__.py`
- `backend/tests/test_bureau_capabilities.py` (new)

## Required behavior

1. Define a frozen, slotted `CapabilityProfile` dataclass with exactly these fields:
   `capability_id`, `department`, `bureau`, `source_label`, `purpose`, `deliverables`, `guardrails`.
2. Define `CAPABILITY_PROFILES: tuple[CapabilityProfile, ...]` as the single static directory. It starts empty in this task; Task 2 populates the approved mapping. Do not add a new bureau or modify `BUREAU_PROFILES`.
3. Provide `capability_profiles_for(department, bureau)` and `capability_profile_for(capability_id)`.
   - The pair lookup must validate that `(department, bureau)` resolves through the existing `bureau_profile_for` and must raise `ValueError` for unknown/cross-department identity.
   - The ID lookup raises `ValueError` when missing.
   - A valid bureau with no package returns `()`.
4. Validate the static directory at module load: non-empty unique IDs; non-empty fields; non-empty deliverables and guardrails; each bound bureau exists; no duplicate `(department, bureau, capability_id)`. Validation errors must fail closed.
5. Export the new public symbols from `app.agents.bureaus` without changing existing exports.

## Tests: TDD required

Before production code, write focused tests for dataclass immutability/slots, valid no-package bureau lookup, unknown and cross-department failures, unknown capability IDs, and public exports. Run the test and record the expected RED failure. Then implement the smallest code and re-run it GREEN. Tests must use real public functions and no network, credentials, or databases.

## Global constraints

- Do not modify ADR 0028, the Chancellor graph, ministries, Jinyiwei, Shiguan, API routes, databases, event buses, YAML configuration, or introduce old `dev` imports.
- No model invocation, network access, persistence, background scheduling, or additional bureau identities.
- Do not commit, stage, reset, checkout, or otherwise perform Git write operations. The controller lacks separate user authorization for commits. Preserve unrelated worktree changes.

## Report

Write a full report to `docs/superpowers/sdd/dev-swarm-task-1-report.md` containing files changed, RED and GREEN command/output evidence, test result, self-review, and concerns. Return only status, one-line test result, concerns, and that report path.
