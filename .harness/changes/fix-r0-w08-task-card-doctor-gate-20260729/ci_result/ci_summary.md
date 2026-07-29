# CI Summary: fix-r0-w08-task-card-doctor-gate-20260729

Status: VERIFIED_PARTIAL

Base:
- EXT HEAD: `4bea049ab53c748ecbe4a83a7d90047386a4b41d`
- Scope: backend harness manifest gate for W08 participant task card

TDD Evidence:
- RED: `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py` returned `1 failed`; the W08 participant task card was not declared in `chaotang-true-loop.required`.
- GREEN: `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py` returned `1 passed` after adding the required manifest entry.

Verification:
- Focused regression set: `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py backend/tests/test_w08_product_acceptance_harness.py` returned `18 passed`.
- W08 closeout preflight: `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1` returned command exit 0 with inner decision BLOCKED because `records/` contains no approved user acceptance JSON.
- Backend doctor: `cd backend && python3 scripts/harness_doctor.py` returned `0 errors, 0 warnings` and listed `product_acceptance/user_acceptance/participant_task_card.zh-CN.md` as required.
- Root doctor: `node scripts/harness-doctor.mjs` returned `0 errors, 0 warnings`.
- Authority: `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` returned GO / APPROVED_WORK_PACKAGE.
- Diff hygiene: `git diff --check` returned clean.

Decision:
- The W08 participant task card is now a backend doctor-enforced required surface.
- W08 remains blocked until real approved user acceptance evidence is supplied.
