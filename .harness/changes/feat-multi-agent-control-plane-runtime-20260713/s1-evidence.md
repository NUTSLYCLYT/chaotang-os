# S1 Task Registry + Lease Manager evidence

## Scope implemented

- Runtime database location derives from `git rev-parse --git-common-dir`; production callers cannot override it. A database override requires both `NODE_ENV=test` and `CHAOTANG_CONTROL_PLANE_TEST_ADAPTER=1`.
- The common migration registry owns v0→v1 task/lease/audit tables and additive v1→v2 resource-lock table creation. Unknown higher versions fail closed. Before rollback, `snapshotControlPlaneDb` checkpoints WAL and creates a restorable database snapshot.
- SQLite uses WAL, `synchronous=FULL`, foreign keys, busy timeout, startup `integrity_check`, and `BEGIN IMMEDIATE` for mutations.
- Task creation enforces the frozen contract semantics, rejects caller-supplied system fields, duplicate values, unknown dependencies, self-dependency, malformed paths/resources and duplicate IDs. Dependencies must already exist, so v1 cannot insert a cyclic forward reference.
- Task creation retains the caller's original read/write paths and also freezes their canonical resolution in hidden control metadata. Acquire compares only against the frozen authorization and fails closed if any original path now resolves differently, including a symlink target swap.
- Acquire re-reads the Task inside its write transaction. A path lease must be equal to or below a declared path; write cannot use `read_paths`, and a parent lease cannot enlarge scope. Non-path resources must exactly match `resources`.
- Canonical paths resolve symlinks and deepest existing ancestors, reject repository escape, detect parent/child overlap, permit read/read and reject overlaps containing a writer.
- Heartbeat and ordinary release require the acquisition nonce, PID, process start ticks and fencing epoch. Force release requires actor, reason and evidence. State changes are audited.
- CLI acquire can register a separate resident holder PID/PGID/start-ticks/cwd. Later CLI processes present only nonce and fencing epoch; the control plane independently proves that the registered holder PID instance is still alive. Status output redacts the nonce, while acquire returns it once to the caller.
- Port, build, release and integration leases are internally exclusive and reject read mode.
- Successful acquisitions consume monotonically increasing fencing epochs.

## TDD evidence

Initial RED: `node --test scripts/multi-agent-lease.nodetest.mjs` failed because the S1 modules did not exist.

Latest complete run before this evidence update:

```bash
node --test scripts/multi-agent-lease.nodetest.mjs
```

Result: 23 passed, 0 failed, 23.888 seconds; `git diff --check` was clean. This run included 100 barrier-synchronized races using 200 real Node child processes; every race produced exactly one winner. It also created three real detached temporary Git worktrees, verified common database path plus repository device/inode identity, and made the worktrees compete with exactly one winner.

All S1 module calls without an explicit fixture, every child CLI, and every worktree child now share one doubly guarded temporary database. The S1 and S2 suites were also executed together under Node's default file-level parallelism: 33 passed, 0 failed in 28.347 seconds. The S2 stable-content guard proved the real database was unchanged during the joint run.

Historical S1 real-database pollution and its exact-ID audited cancellation are recorded under `.harness/changes/incident-s1-real-db-test-pollution-20260713/`.

Additional covered negatives: unauthorized parent scope, undeclared or duplicate resources, empty paths, past task expiry, non-leasable task state, non-path read mode and double ownership, production database override, stale nonce/fencing, dead registered holder, missing force-release evidence, write/write and parent/child conflict, symlink bypass, repository escape, corrupt database and unknown schema version. Three independent CLI processes prove acquire→heartbeat→release around one resident holder.

Barrier tests also exercise heartbeat/expire, expire/acquire and force-release/acquire races and assert that no outcome creates multiple active owners.

Registry presentation coverage proves `create → acquire → list` reports the structured `leased` status while preserving the original path spelling and hiding internal canonical metadata.

Migration/restore coverage: v0 bootstraps through v2, an existing v1 state survives additive v2 migration, WAL reopen retains fencing state, and a checkpointed rollback snapshot reopens with retained task state and `integrity_check=ok`.

## Honest boundary

This evidence proves the tested single-machine local-filesystem control plane. It does not claim NFS or multi-host safety, OS-level prevention of direct file writes, or that downstream attestation/release steps are already enforced.
