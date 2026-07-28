# W08 User Acceptance Rules

These rules define whether a real user session may be counted toward final
R0-W08 product acceptance.

## Countable Session

A session is countable only if all are true:

- The participant is a target-profile non-developer.
- The participant receives no engineer guidance after the task prompt.
- The participant uses the real backend browser flow.
- The participant uses `/shangshufang` and `/shiguan`.
- Evidence is deidentified before commit.

## Successful Session

A countable session is successful only if all are true:

- The participant completes upload, parse, review, supplement, decide, delivery,
  download, and audit replay.
- The generated ContractReviewPack is downloadable.
- The audit replay is opened from `/shiguan`.
- The final record includes ContractReviewPack, ArtifactManifest,
  ArchiveReceipt, and browser evidence references.
- `first_value_seconds` is a positive number.

## Failed Session

A session must be marked unsuccessful when any are true:

- The user abandons before ContractReviewPack generation.
- The user cannot download artifacts.
- The user cannot reopen `/shiguan` audit replay.
- The participant required engineer step-by-step help.
- Evidence contains identifying information that was not deidentified.

Failed sessions may remain in the final record. W08 requires at least four
successful completions out of five participant records.

## Not Evidence

The following cannot close W08:

- local automated tests alone
- screenshots without JSON record and evidence IDs
- mock backend browser flows
- developer or agent operator sessions
- production deployment claims
- database migration claims
- listener 3050 claims
