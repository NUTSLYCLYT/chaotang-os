# Tasks

## Task 1: RED baseline

- Run the focused adoption and migration tests on the EXT baseline.
- Capture the failing assertions without changing runtime code.

## Task 2: TDD implementation

- Extract only the schema-adoption hunk needed for post-adoption artifact tables and later identity fields.
- Update only focused migration-head expectations to the actual EXT head.

## Task 3: Verification

- Rerun focused tests.
- Rerun the full backend suite.
- Run root, frontend, and backend Harness Doctor checks.
- Run `git diff --check` and changed-path review.

## Task 4: Review gate

- Produce the exact diff and test evidence.
- Do not integrate into EXT until a separate user-controlled integration approval is issued.
