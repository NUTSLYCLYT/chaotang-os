# CI Summary: fix-r0-w08-task-prompt-ref-gate-20260729

Status: VERIFIED_PARTIAL

Base:
- EXT HEAD: `7fc2867b641851146ba3f8f4a9155d37745a18e8`
- Scope: W08 final user acceptance task prompt reference gate

TDD Evidence:
- RED: `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` returned `1 failed, 17 passed`; a complete five-user payload without `task_prompt_ref` incorrectly passed.
- GREEN: `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` returned `18 passed` after adding fail-closed validation and updating fixtures/templates.

Verification:
- Focused regression set: `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py backend/tests/test_w08_product_acceptance_harness.py` returned `20 passed`.
- W08 closeout preflight: `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1` returned command exit 0 with inner decision BLOCKED because no approved user acceptance JSON exists under `records/`.
- Backend doctor: `cd backend && python3 scripts/harness_doctor.py` returned `0 errors, 0 warnings`.
- Root doctor: `node scripts/harness-doctor.mjs` returned `0 errors, 0 warnings`.
- Authority: R0-W08 returned GO; R0-W09 returned STOP / BLOCKED_DEPENDENCY.
- Diff hygiene: `git diff --check` returned clean.

Decision:
- Final W08 user acceptance payloads now require `task_prompt_ref: "participant_task_card.zh-CN.md"`.
- W08 remains blocked until real approved non-developer user evidence is supplied.
