# Task 1 Report: 108-entry migration completeness gate

## Status

Implemented and locally verified. The checker test suite is GREEN. The real
default and live-source gates are intentionally RED because all 108 entries
remain explicitly `pending` until Tasks 2-7 assign truthful dispositions.

## Files

- Created `docs/migrations/2026-07-27-only-worktree-dispositions.json`.
- Created `scripts/check_migration_completeness.mjs`.
- Created `scripts/check_migration_completeness.test.mjs`.
- Modified `.github/workflows/harness.yml`.
- Created this report.

No source-worktree file was modified.

## Frozen inventory

- Source worktree:
  `D:\workspace\chaotang-os-harness-only-worktree`
- Source HEAD:
  `df037478d50f4681103a4d62de4f959e51a55856`
- Restore commit:
  `734b0aad07eb9b48469e9263e24cdd68fee1c4e4`
- Entries: 108 unique paths.
- Status totals: 43 modified, 4 deleted, 61 untracked.
- Layer totals: 58 restore-identical, 37 post-restore-modified, 13
  dirty-only-added.
- Canonical inventory SHA-256:
  `69f98bd4669489f3988c4be116440b5ee7eef594141c88aa05f9611c85f7dc6d`

Layer classification compares the current file's Git blob ID with the restore
tree. A path deleted both in the current source snapshot and in the restore
commit is restore-identical; this accounts for the four tracked deletions and
produces the required 58/37/13 totals.

## TDD evidence

### RED

Command:

```powershell
node --test scripts/check_migration_completeness.test.mjs
```

Observed before creating the checker:

```text
tests 11
pass 9
fail 2
Error: Cannot find module
  'D:\workspace\chaotang-os-harness-only\scripts\check_migration_completeness.mjs'
```

The two complete 108-entry positive cases failed for the expected missing
implementation. The eight required invalid cases plus the unknown-key case
already exited non-zero.

### GREEN

Command:

```powershell
node --test scripts/check_migration_completeness.test.mjs
```

Fresh result after implementation:

```text
tests 11
pass 11
fail 0
duration_ms 24527.1438
```

The suite covers:

- complete 108-entry default mode;
- complete 108-entry `--source-worktree` mode;
- missing disposition;
- duplicate source path;
- count drift;
- unknown source entry;
- missing target path;
- a deleted source target that still exists;
- empty superseded/rejected reason;
- source SHA drift;
- unknown manifest keys.

## Real gate evidence

Commands:

```powershell
node scripts/check_migration_completeness.mjs
node scripts/check_migration_completeness.mjs --source-worktree D:\workspace\chaotang-os-harness-only-worktree
```

Both returned the expected application exit code 1:

```text
migration completeness: entries[0] has missing or invalid disposition: pending
...
migration completeness: entries[107] has missing or invalid disposition: pending
migration completeness check failed with 108 error(s)
```

There were no inventory, canonical hash, source HEAD, status, source SHA, or
source-layer drift errors. No entry was falsely marked `integrated`.

## Additional verification

All of these passed:

```text
node --check scripts/check_migration_completeness.mjs
node --check scripts/check_migration_completeness.test.mjs
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check -- .github/workflows/harness.yml scripts/check_migration_completeness.mjs scripts/check_migration_completeness.test.mjs docs/migrations/2026-07-27-only-worktree-dispositions.json
```

Independent manifest audit result:

```json
{
  "entries": 108,
  "unique": 108,
  "statuses": { "M": 43, "D": 4, "??": 61 },
  "layers": {
    "restoreIdentical": 58,
    "postRestoreModified": 37,
    "dirtyOnlyAdded": 13
  },
  "pending": 108,
  "canonicalMatches": true
}
```

## Self-review

- The manifest, count object, and every entry use exact key allowlists.
- Canonical inventory hashing recursively sorts object keys, so formatting and
  property order cannot change the identity.
- Integrated and superseded entries require target paths. Integrated
  deletions invert the existence check and fail if the deleted target survives.
- Superseded and rejected entries require a contract-specific, non-generic
  reason.
- Live mode verifies absolute source path usage, source HEAD, exact dirty path
  set, statuses, file SHA-256 values, restore-layer classification, and unknown
  source entries.
- Target paths reject absolute paths, backslashes, and `..` traversal.
- CI runs the checker tests before the intentionally failing real gate.
- Temporary fixture repositories use real Git history and filesystem state;
  the tests do not mock checker behavior.

## Concerns

1. CI is intentionally RED until Tasks 2-7 replace all 108 `pending`
   dispositions and Task 8 supplies final verification evidence.
2. Repository-wide `git diff --check` currently reports
   `.superpowers/sdd/task-1-brief.md:97: new blank line at EOF`. That file was
   already modified by the parent orchestration and is outside Task 1's
   allowed file set. Task 1's own diff check passes.
3. Windows Git emitted an informational LF-to-CRLF warning for the workflow
   file during diff checking; it did not produce a whitespace error.
