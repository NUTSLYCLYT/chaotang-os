# CI Summary: fix-r0-w08-task-card-content-gate-20260729

Status: VERIFIED_PARTIAL

Base:
- EXT HEAD: `fbace9e9344bd59cad66899428393953769f47c8`
- Scope: W08 participant task card content gate

TDD Evidence:
- RED: `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py` returned `1 failed, 1 passed`; the task card did not name canonical W08 acceptance objects.
- GREEN: `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py` returned `2 passed` after updating the task card.

Verification:
- Focused regression set: `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py backend/tests/test_w08_product_acceptance_harness.py` returned `19 passed`.
- W08 closeout preflight: `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1` returned command exit 0 with inner decision BLOCKED because `records/` contains no approved user acceptance JSON.
- Backend doctor: `cd backend && python3 scripts/harness_doctor.py` returned `0 errors, 0 warnings`.
- Root doctor: `node scripts/harness-doctor.mjs` returned `0 errors, 0 warnings`.
- Authority: `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` returned GO / APPROVED_WORK_PACKAGE.

Decision:
- The task card now names MissionContract, RiskItem, ContractReviewPack, ArtifactManifest, and ArchiveReceipt.
- W08 remains blocked until real approved user acceptance evidence is supplied.
