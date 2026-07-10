# CI Summary: selective origin/dev integration

## Commands

- `git fetch origin dev`
- `git merge-tree --write-tree HEAD origin/dev`
- `git cherry-pick -n 3044ad6 c7999aa`
- `git cherry-pick -n 020ad06`
- `git cherry-pick -n 5d990b0`
- `git cherry-pick -n 8688fd7`
- `git cherry-pick -n 7820dc0`
- `git cherry-pick -n 2b71613`
- Verification commands pending final run.

## Results

- Full `origin/dev` merge was not performed.
- Integrated safe backend/non-UI subsets only.
- Deferred frontend BFF and UI-heavy changes.
