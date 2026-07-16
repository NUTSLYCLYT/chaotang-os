# Packet review local feedback gate

## Status and trust boundary

`LOCAL_FEEDBACK_ONLY` — this is a local workflow guard, not a security boundary.

It is bypassable with `git push --no-verify`, local hook tampering, another Git client, or another
machine. The repository does not have an external reviewer public key, a protected verifier, or a
verified Gitee required check. Only an external signature plus protected required check may be called
`ENFORCED`.

The gate applies prospectively after activation commit
`d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f`; it does not reinterpret P0–P4 history. If the remote
predecessor does not yet contain that commit, the only permitted bootstrap candidate is the exact
activation SHA. A candidate containing any commit after activation is rejected and must use the
reviewed shape below.

## Install and inspect

Installation is explicit; merging the files does not mutate `.git/hooks`:

```bash
node scripts/install-packet-review-hooks.mjs
node scripts/packet-review-pre-push.mjs --status
```

Uninstall only this subhook:

```bash
node scripts/install-packet-review-hooks.mjs --uninstall
```

The installer resolves hooks through `git rev-parse --git-path hooks`, supports linked worktrees and
`core.hooksPath`, and copies a managed verifier snapshot into the shared hooks directory so an older
sibling worktree does not need to contain the scripts. It replays pre-push stdin to every executable
`pre-push.d` hook and refuses to overwrite or remove an unmanaged/symlinked dispatcher, packet-review
subhook, or verifier snapshot. Reinstall validates the snapshot's exact internal layout and atomically
activates a fully built and validated bundle, so a failed refresh leaves the previous bundle intact.
It never follows an existing snapshot symlink or rewrites a multiply linked managed file.

## Candidate shape

For a protected ext update, the local candidate must have this exact shape:

```text
B  remote predecessor / PREDECESSOR_INTEGRATION_SHA
|\
| H  implementation HEAD; adds exactly one root change
| |
| R  review-only commit; parent is H
|/
M  local candidate; parents are B,R and M.tree == R.tree
```

Rules:

1. `H` descends from `B` and adds exactly one `.harness/changes/<change-id>/summary.md`.
2. The summary contains exactly one machine line: `Packet ID: P5` (use the actual Packet ID).
3. An independent NO_GO review may add a versioned Markdown report to the task branch, but it must not
   issue a GO approval envelope.
4. The final GO commit `R` adds only:
   - `.harness/changes/<change-id>/packet_review/review-vN.md`
   - `.harness/changes/<change-id>/packet_review/approval-vN.json`
5. The report contains exactly one terminal verdict line, and its final non-empty line is exactly
   `PACKET_REVIEW_GO`.
6. The approval follows `.harness/contracts/packet-review-approval.schema.json` and binds the exact
   40-character `B` and `H`, report path, report SHA-256, Packet ID, and change ID.
7. `M` must be a clean no-ff merge. Any conflict-resolution or post-review tree change requires a new
   implementation HEAD and another review.
8. One push may introduce only one Packet approval and one root change.

Example envelope (replace every value; do not copy historical SHAs):

```json
{
  "schema_version": 1,
  "status": "LOCAL_FEEDBACK_ONLY",
  "review_version": 1,
  "packet_id": "P5",
  "change_id": "fix-alembic-single-authority-20260716",
  "predecessor_integration_sha": "0000000000000000000000000000000000000000",
  "reviewed_head_sha": "0000000000000000000000000000000000000000",
  "report_path": ".harness/changes/fix-alembic-single-authority-20260716/packet_review/review-v1.md",
  "report_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "verdict": "PACKET_REVIEW_GO"
}
```

The verifier reads all candidate material with `git show <sha>:<path>` and recomputes the report digest;
it does not trust the dirty worktree.

## Verification

```bash
node --test scripts/packet-review-local-feedback.nodetest.mjs
node scripts/packet-review-pre-push.mjs --status
node scripts/harness-doctor.mjs
```
