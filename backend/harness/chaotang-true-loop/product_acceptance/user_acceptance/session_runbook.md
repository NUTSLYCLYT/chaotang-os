# W08 User Acceptance Session Runbook

Purpose: collect final R0-W08 human acceptance evidence from target-profile
users without engineer guidance.

## Scope

Each participant must run the existing contract review loop:

```text
upload contract
-> parse MissionContract
-> review RiskItem evidence
-> supplement evidence or acknowledge the gap
-> decide risk
-> generate ContractReviewPack
-> download artifacts
-> reopen Shiguan audit replay
```

Allowed surfaces:

- `/shangshufang`
- `/shiguan`

Forbidden during the session:

- engineer instruction beyond the initial task prompt
- developer-authored or synthetic participant records as final evidence
- mock backend, screenshot-only proof, or manual database edits
- deployment, database migration, or listener 3050 operation claims

## Participant Criteria

Accepted:

- manufacturing, procurement, sales, operations, finance, legal operations, or
  management users who can plausibly review B2B contract risk
- not involved in this repository, product design, implementation, QA, or prompt
  work

Rejected:

- repository contributors
- agent operators who know the implementation
- users coached through the flow step by step

## Session Procedure

1. Assign an anonymous `participant_id` such as `user-001`.
2. Provide the participant with a Chinese manufacturing/B2B contract sample.
3. Give the participant `participant_task_card.zh-CN.md` as the only task
   prompt.
4. Start the timer when the participant first sees `/shangshufang`.
5. Record first value time when the participant first reaches an actionable risk
   review or evidence-backed decision.
6. Let the participant complete the canonical loop without engineering help.
7. Record evidence IDs from the completed session:
   `contract_review_pack_id`, `artifact_manifest_id`, `archive_receipt_id`, and
   browser evidence reference.
8. Deidentify notes before writing the final JSON record.
9. Validate the record file with:

```bash
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json
```

10. Run final preflight:

```bash
python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py \
  --closeout-preflight \
  --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json
```

## Success Threshold

W08 user acceptance is ready for closeout only when:

- 5 participant records are present.
- at least 4 participants complete successfully.
- every participant is non-development and unassisted.
- median first value time for successful users is at most 180 seconds.
- successful records include ContractReviewPack, ArtifactManifest,
  ArchiveReceipt, and browser evidence references.
