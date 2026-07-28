# R0-W08 Readiness Dashboard

Generated: 2026-07-29

## Exact State

| Field | Value |
| --- | --- |
| Integration target | local `feature-chaotang-ext` |
| Exact HEAD | `4a81b9a885547b6b4199230521d157dac29ff1f8` |
| Exact tree | `54e0805bbbc8b91145762a3df5123c3e4353419a` |
| Authority command | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` |
| Authority result | `GO / APPROVED_WORK_PACKAGE` |
| Closeout decision | `BLOCKED` |

## Gate Matrix

| Gate | Required | Current Evidence | Status |
| --- | --- | --- | --- |
| Golden contracts | 36 manufacturing/B2B contracts | `run_w08_acceptance.py --closeout-preflight` reports 36 cases, no failures | PASS |
| Real backend browser flow | 10 flows | Four W08 browser batches report 1 + 3 + 3 + 3 flows | PASS |
| User acceptance | 5 non-developer users, at least 4 successes | `records/` contains no approved JSON record | BLOCKED |
| ContractReviewPack download | Covered in golden/browser gates | Browser flow evidence includes download step | PASS_FOR_PRELIGHT |
| Shiguan audit replay | Covered in golden/browser gates | Browser flow evidence includes reopen audit step | PASS_FOR_PRELIGHT |

## Current Blocking Failure

`python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight`

returns:

```json
{
  "decision": "BLOCKED",
  "failures": [
    "records/ must contain exactly one approved user acceptance JSON file"
  ]
}
```

## Required Next Evidence

Create exactly one approved JSON file under:

`backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/`

The record must satisfy:

- schemaVersion `w08-user-acceptance.v1`
- mode `FINAL_USER_ACCEPTANCE`
- 5 participant records
- 0 development participants
- 0 engineer-guided successful sessions
- at least 4 successful completions
- successful median first value time at or below 180 seconds
- successful records include ContractReviewPack, ArtifactManifest, ArchiveReceipt, and browser evidence references
- no fixture payload and no `fixture-` participant or evidence IDs

## Required Commands After Real Records Exist

```bash
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json

python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --closeout-preflight

python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py
cd backend && python3 scripts/harness_doctor.py
node scripts/harness-doctor.mjs
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
```

## Non-Goals

This dashboard does not prove or perform:

- production deployment
- database migration
- listener 3050 takeover
- R0 release candidate creation
- W09 activation

## Decision

R0-W08 is automation-ready but not closeout-ready. The only currently known closeout blocker is missing real non-developer user acceptance evidence.
