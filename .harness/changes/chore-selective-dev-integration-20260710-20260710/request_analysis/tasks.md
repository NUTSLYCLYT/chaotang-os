# Tasks: selective origin/dev integration

## Task 1

- Goal: inspect `origin/dev` and classify mergeable functionality.
- Input: `git log HEAD..origin/dev`, `git diff HEAD..origin/dev`, merge-tree preview.
- Output: selected/deferred change list.
- Acceptance: BFF and UI-heavy changes are identified before integration.

## Task 2

- Goal: protect current API contract alignment work.
- Input: dirty worktree with API contract artifacts.
- Output: local checkpoint commit.
- Acceptance: current contract artifacts can be recovered without relying on a failing stash.

## Task 3

- Goal: selectively integrate safe backend/non-UI changes.
- Input: safe commits from `origin/dev`.
- Output: local commits preserving the no-UI/no-BFF boundary.
- Acceptance: no `frontend/src/app/api/**` additions and no page/component UI changes are kept.

## Task 4

- Goal: verify contract and boundary state after integration.
- Input: selected integration commits.
- Output: audit and test results.
- Acceptance: audits pass or report only known pre-existing UI blockers.
