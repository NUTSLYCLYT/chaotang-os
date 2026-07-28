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

Final W08 closeout still requires 36 golden contracts, 10 real-backend browser
runs, and five non-developer user tests with at least four successful
completions.
