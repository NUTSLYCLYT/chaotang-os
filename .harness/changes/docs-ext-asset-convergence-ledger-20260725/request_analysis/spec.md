# Specification: EXT Asset Capture

## Objective

Create a reproducible, read-only inventory that turns selected non-EXT sources
into named Packet inputs without treating those sources as integration
authority.

## Allowed Changes

Only these five governance files may be created:

- `summary.md`
- `request_analysis/spec.md`
- `request_analysis/tasks.md`
- `asset-ledger.md`
- `ci_result/ci_summary.md`

All files are under
`.harness/changes/docs-ext-asset-convergence-ledger-20260725/`.

## Forbidden Changes

- Business, test, manifest, authority, runtime, or deployment code changes
- Whole-branch merge or bulk cherry-pick
- Copying a dirty worktree
- Ref or worktree deletion
- Push, deployment, database migration, or listener takeover
- Reclassifying source presence as completed functionality
- Activating a Packet from this documentation alone

## Evidence Model

Each retained asset group records:

1. Source worktree or immutable ref.
2. Source `HEAD` and committed tree.
3. Dirty status summary.
4. SHA-256 of `git diff --binary HEAD -- <ordered tracked paths>` for
   worktree-only tracked changes.
5. SHA-256 per retained untracked file.
6. Range patch SHA-256 for a committed candidate when the useful change is
   represented by commits outside the accepted EXT baseline.
7. Owner, target Packet, disposition, and explicit receiving conditions.

The empty binary diff digest is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
Hashes identify bytes; they do not validate behavior.

## Dispositions

### KEEP

The capability aligns with the R0 target and has enough source identity and
evidence to enter an isolated Packet. KEEP never means direct integration.

### REBUILD

The capability or test idea is valuable, but its historical implementation,
scope, or dependency shape is not acceptable as an integration source. The
owner must write a fresh test-first implementation against current EXT.

### ARCHIVE

The source is historical, superseded, generated, temporary, or already
absorbed. It is preserved until a separate retirement decision but cannot feed
an implementation Packet directly.

## Receiving Gate

A target Packet may receive an asset only when:

- It starts from the latest locally accepted EXT commit in a clean isolated
  worktree.
- Its owner declares exact files and out-of-scope boundaries.
- The owner reproduces the captured source identity or explains a byte change.
- Tests fail before implementation where the asset is being rebuilt.
- Relevant unit, contract, harness, and browser checks pass.
- Window 6 performs an independent read-only review.
- Codex records acceptance before hunk-level integration.
- Integration does not claim push, deployment, migration, or production
  listener ownership.

## Rollback

This change adds documentation only. Rollback is the removal or revert of this
single governance Packet commit. Source worktrees and refs are deliberately
untouched.
