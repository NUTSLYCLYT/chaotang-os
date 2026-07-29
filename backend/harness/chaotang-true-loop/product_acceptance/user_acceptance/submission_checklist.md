# W08 User Acceptance Submission Checklist

Before requesting W08 closeout, the Product Acceptance Owner must provide:

- one approved JSON file under `user_acceptance/records/`
- no closeout evidence JSON outside `user_acceptance/records/`
- `approval.status` is `APPROVED`
- `approval.owner` and `approval.evidence_review_id` are populated
- `approval.approved_at` is a UTC ISO-8601 timestamp ending with `Z`
- 5 participant records
- at least 4 successful completions
- no development participants
- no engineer-guided sessions counted as successful
- deidentified feedback and evidence references
- validation output from `--user-acceptance`
- preflight output from `--closeout-preflight --user-acceptance`
- default preflight output from `--closeout-preflight` after the approved record
  is the only JSON file under `records/`

## Required Commands

```bash
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json

python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --closeout-preflight \
  --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json

python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --closeout-preflight
```

Closeout preflight rejects explicit `--user-acceptance` paths outside
`user_acceptance/records/`.

## Closeout Boundary

Passing this checklist makes W08 eligible for closeout review. It does not mean:

- production was deployed
- database was migrated
- external listener 3050 was changed
- R0 release candidate was produced
