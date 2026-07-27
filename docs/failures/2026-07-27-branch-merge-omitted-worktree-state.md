# Branch merge omitted source worktree state

## Summary

The migration from `codex/harness-only-worktree` merged its visible branch tip
but omitted the source worktree's complete court visual implementation. The
target passed tests and harness checks while 108 source worktree entries were
not represented.

## Root Cause

The source branch had been reset from commit
`734b0aad07eb9b48469e9263e24cdd68fee1c4e4` back to
`df037478d50f4681103a4d62de4f959e51a55856`. The later commit contained the
complete court visual migration, but the target merge used `df037478` as its
second parent.

The pre-merge audit compared branch commits and did not inspect the source
worktree's tracked modifications, deletions, or untracked files. Git merge
does not include dirty state from another worktree, so the ancestry check was
true while the requested working functionality was incomplete.

## Prevention

- Resolve whether “branch functionality” means committed ancestry or the
  source worktree snapshot before integration.
- Preflight every source worktree with `git status --porcelain=v1 -uall`,
  reflog inspection, and a content inventory before choosing a merge base.
- When a source worktree is dirty, preserve it and integrate through an
  explicit reviewed snapshot or semantic patch; never assume its branch ref
  represents all work.
- Compare the final target against required behaviors and source artifacts,
  not only against the source branch tip.

## Detection

Add an integration checklist that fails completion when the selected source
worktree has unaccounted tracked changes, deletions, or untracked files.
Record the source path, branch ref, HEAD, porcelain count, and disposition of
every entry.

Harness coverage for a migrated product surface must name its controller,
visual workspace, route tests, and required assets. A passing generic frontend
suite is insufficient when the suite itself still expects placeholder pages.

## Evidence

- Target merge `a6f199931086635f4d254fc940e06c57f758080c` uses
  `df037478d50f4681103a4d62de4f959e51a55856` as its source parent.
- Source reflog retains `734b0aad07eb9b48469e9263e24cdd68fee1c4e4`,
  `feat: complete court visual migration`, with 91 changed files.
- The source worktree currently reports 43 modified, 4 deleted, and 61
  untracked entries.
- The target lacks the `court-visuals`, `dadian-visual`,
  `junjichu-visual`, `ministries-visual`, `shiguan-visual`, and
  `study-visual` feature families from the source worktree.
- `frontend/src/app/court-entry-pages.test.ts` in the target still accepts the
  Junjichu placeholder and legacy ministry views.
