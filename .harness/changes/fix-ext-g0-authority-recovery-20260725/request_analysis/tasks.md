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
- [x] Record Product Owner's W06-only recovery approval with strict JSON evidence bound to exact
  base `8feae838f09ad5202b21332d4280b989ab776bd7`, tree
  `9d63f98041e5e13174dbba4c0b9d27eef1471bf9`, and the documented exclusions.
- [x] Add a digest-bound proposed activation artifact and read-only independent-review request;
  leave `execution-authority.v2.json` untouched and do not create `exact-h-final.md`.
- [x] Add fail-closed strict JSON parsing and semantic binding tests for old-package review reuse,
  negative owner decision, candidate/tree mismatch, owner digest mismatch, and review verdict
  mismatch.
- [x] Stop at `REVIEW_REQUEST_READY / NOT_ACTIVE / NOT_DEPLOYED`; no W06 product implementation,
  activation, merge, push, deployment, migration, or listener operation occurred.
