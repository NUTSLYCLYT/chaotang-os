# W08 User Acceptance Evidence

This directory defines the final human acceptance evidence gate for R0-W08.

W08 cannot close until a reviewer supplies one approved JSON record file under
`records/` and validates it with `run_w08_acceptance.py --user-acceptance`.

Execution materials:

- `session_runbook.md`: how to run each user session.
- `observer_checklist.md`: what to observe and record per participant.
- `acceptance_rules.md`: what counts as a valid and successful session.
- `submission_checklist.md`: what must be submitted before closeout review.
- `fixtures/`: valid JSON examples for tests and reviewer rehearsal only.

Required threshold:

- 5 target-profile participants.
- 0 participants involved in development.
- 0 assisted sessions or engineer-guided completions.
- At least 4 successful completions.
- Median first value time for successful users at or below 180 seconds.
- Each successful record includes ContractReviewPack, ArtifactManifest,
  ArchiveReceipt, and browser evidence references.

This is a local evidence format. It does not prove production deployment,
database migration, or listener 3050 takeover.
