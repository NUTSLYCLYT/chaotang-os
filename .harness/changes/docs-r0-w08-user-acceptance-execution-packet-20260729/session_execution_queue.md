# W08 User Acceptance Session Execution Queue

This queue coordinates the five required non-developer sessions for R0-W08.
It is not final acceptance evidence. Final evidence must be a single approved
JSON file under:

`backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/`

## Gate State

- Work package: `R0-W08`
- Current gate: `BLOCKED_ON_REAL_USER_RECORDS`
- Required participants: 5
- Required successes: at least 4
- Median first value target: <= 180 seconds
- Allowed surfaces: `/shangshufang`, `/shiguan`
- Forbidden: engineer-guided completion, fixture records, screenshots-only
  evidence, production claims, database migration, listener 3050 operation

## Session Queue

| Participant | Target profile | Contract sample | Host | Status | Evidence ref |
| --- | --- | --- | --- | --- | --- |
| user-001 | manufacturing_contract_operator | TBD | TBD | WAITING | TBD |
| user-002 | manufacturing_contract_operator | TBD | TBD | WAITING | TBD |
| user-003 | manufacturing_contract_operator | TBD | TBD | WAITING | TBD |
| user-004 | manufacturing_contract_operator | TBD | TBD | WAITING | TBD |
| user-005 | manufacturing_contract_operator | TBD | TBD | WAITING | TBD |

## Host Checklist

1. Confirm the participant is not a repository contributor, implementer, QA
   reviewer, prompt author, or agent operator for this system.
2. Give the participant only
   `backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/participant_task_card.zh-CN.md`.
3. Start timing when `/shangshufang` is visible.
4. Do not guide the participant through clicks, page structure, or expected
   answers after the session begins.
5. Record first value time when the participant first reaches an actionable
   risk review or evidence-backed decision.
6. Record these IDs for every successful session:
   `contract_review_pack_id`, `artifact_manifest_id`, `archive_receipt_id`,
   and `browser_evidence_ref`.
7. Deidentify notes before preparing the final JSON record.

## Closeout Commands

Run these only after the final approved record JSON exists under `records/`:

```bash
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json

python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --closeout-preflight \
  --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json

python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --closeout-preflight
```
