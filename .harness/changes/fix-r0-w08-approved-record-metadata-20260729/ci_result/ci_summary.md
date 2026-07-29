# CI Summary

Status: VERIFIED_PARTIAL

## Scope

Require closeout-only approval metadata for W08 user acceptance records.

## Commands

- Baseline: `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
  - Result: 14 passed on base `b7971bb7`.

- RED: `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
  - Result: expected failure observed, 2 failed / 14 passed.
  - Failure proved closeout preflight accepted records JSON without approval metadata.

- GREEN: `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
  - Result: 16 passed.

- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
  - Result: passed.
  - Expected inner result: BLOCKED because no approved real user acceptance JSON exists under `records/`.

- `cd backend && python3 scripts/harness_doctor.py`
  - Result: backend-harness-doctor 0 errors, 0 warnings.

- `node scripts/harness-doctor.mjs`
  - Result: project-harness-doctor 0 errors, 0 warnings.

- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
  - Result: GO / APPROVED_WORK_PACKAGE.

- `git diff --check`
  - Result: passed.

## Decision

W08 closeout now requires `approval.status = APPROVED` plus non-empty `approval.owner`, `approval.approved_at`, and `approval.evidence_review_id`. File-level `--user-acceptance` validation remains available for draft shape checks and does not by itself prove closeout approval.
