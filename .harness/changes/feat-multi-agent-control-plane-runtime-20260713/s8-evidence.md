# S8 Release Evidence Ledger and Runtime Identity evidence

Status: `IMPLEMENTED_LOCAL / INDEPENDENT REVIEW GO`. This is not READY or ENFORCED.

## Controls

- Git provenance comes from `rev-parse`, `cat-file` and the Git object database; tracked staged/unstaged dirt is recomputed independently.
- Artifact identity is recomputed over the concrete immutable release's `next/`, `public/` and runtime `next.config.ts` using the same stable algorithm as S5.
- Runtime identity follows the production socket inode to its unique PID, then validates PID/start ticks/PGID/cwd and derives commit/build ID/digest from that process's concrete build directory. Environment-provided SHA is not accepted.
- Release evidence appends in an SQLite `BEGIN IMMEDIATE` transaction with sequence, previous hash and record hash. UPDATE/DELETE triggers fail closed.
- An Ed25519 checkpoint chain is stored outside the SQLite database with a repository-pinned public key/fingerprint. Private key files must be owner-owned mode `0600`.
- Tail deletion, old database rollback, record mutation, whole-chain rewrite and invalid signature are negative-tested.
- The repository-pinned current signer is explicitly `independent=false`; it can detect ordinary/local damage but cannot authorize Release Commander READY. A CI protected independent key/root must replace it through review before READY is possible.

## First independent review remediation

The first independent review returned `NO-GO` with four HIGH and three MEDIUM findings. The implementation now:

- hashes the complete schema-shaped non-recursive evidence payload, including repository/worktree, rollback, verified Commander lock epoch, PID/socket, base URL, persisted gate path/digest, checks and timeline;
- writes the gate report atomically as a mode-0600 control-plane artifact using Git object DB and runtime identity facts, then re-reads and hashes its exact bytes;
- validates the active `release:production` owner/task/fencing epoch/nonce from SQLite instead of accepting a fabricated lease label;
- hard-rejects all external/independent READY claims until a real protected online authority with latest-head verification exists; local verification always returns `readyEligible=false`;
- samples socket inode/PID/PGID/start ticks before and after artifact verification;
- checks the raw signing-key path for absoluteness before canonicalization;
- makes an identical release payload append/finalize idempotent while rejecting reuse of a release ID for a different payload.

## Verification

Focused/combined verification after remediation: 33/33 node tests, S5 wrappers 8/8, S5 lifecycle 13/13, TypeScript 0 errors, root/backend doctors 0 errors. The final independent re-review returned `GO` with no remaining CRITICAL/HIGH/MEDIUM.
