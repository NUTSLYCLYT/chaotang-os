# Tasks: EXT-G0 Authority Recovery

- [x] Verify the assigned branch starts at plan commit `8645873a`, whose ancestry includes exact
  EXT `8feae838f09ad5202b21332d4280b989ab776bd7`.
- [x] Add RED regression coverage requiring the three root entries to reserve v1 for `--check` and
  v2 for `--authorize --work-package <R0-Wxx>`.
- [x] Update only root governance/authority documentation and its validator; do not alter business
  code or the v2 ledger.
- [x] Repin only the three changed v1 governed-document SHA-256 entries after their final bytes are
  known.
- [x] Record `REVIEW_READY / NOT_ACTIVE` W06 scope, exclusions, owner boundary, rollback, and
  `NOT_DEPLOYED`.
- [x] Run the full required verification matrix and attach exact local results in `ci_result`.
- [x] Perform focused self-review of paths, v1 digest scope, inactive fields, and v2 quiescence.
- [x] Commit the review-ready candidate at `34110e2ff2fb5f50d24be337ab16b8eb1e5ceee8` and apply
  the scope/approval plan correction at `8c891ffdc1e3191792f342a5cd66da0c738f5e9e`. Task 2 alone
  may perform independent review and consider atomic W06 activation.
- [x] Resolve Task 1 H1-M3 without creating W06 approval: move the non-approval record to
  `owner_scope/`, add enforced root/inventory semantic markers, and retain v2 quiescence.
