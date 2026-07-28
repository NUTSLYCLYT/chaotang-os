# W08 Product Acceptance

R0-W08 Product Acceptance Hardening validates the contract-review product loop:

```text
upload -> parse -> review -> evidence supplementation -> risk decision
-> ContractReviewPack -> authorized download -> Shiguan audit replay
```

This entry lives under the existing `chaotang-true-loop` harness so it extends
the single true-loop verification line instead of creating a second harness
mainline.

`RUNNABLE_MINIMUM` starts with one versioned Chinese manufacturing/B2B golden
contract that proves the acceptance evidence shape is real and repeatable. It
does not claim final W08 completion.

Current W08 hardening status:

- 36 golden contracts validate the product acceptance matrix.
- 10 real-backend browser flows validate the canonical loop across
  `/shangshufang` and `/shiguan`.
- Final W08 closeout still requires five non-developer user tests with at
  least four successful unassisted completions.

User acceptance evidence is validated with:

```bash
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json
```

The repository intentionally does not include completed user records. Real
records must be gathered from target-profile users who were not involved in
development and must remain deidentified.
