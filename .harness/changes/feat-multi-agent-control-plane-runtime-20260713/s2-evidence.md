# S2 resource-lock evidence

## Implemented core

- v2 migration creates `resource_locks` with a Task foreign key, a closed state `CHECK`, and task plus state/expiry indexes.
- Additive v3 migration adds `protected_paths_json`. Build locks require explicit absolute protected paths under the worktree or git-common runtime root. Each entry stores its original absolute input and acquisition-time canonical target. Reclaim scans both every frozen canonical directory and each original input's current canonical target, so an active symlink switch cannot hide either the old running build or the new active build.
- Acquire validates Task existence, owner, leasable state, expiry and exact declared resource inside the same `BEGIN IMMEDIATE` transaction.
- Holder facts are rebuilt from `/proc` through the S1 registered-process adapter. Heartbeat and release reject stale nonce/epoch and dead or replaced resident holders.
- Recovery follows `active → suspect → fenced → reclaimed`; fencing requires actor, reason and evidence.
- Break-glass requires actor, reason, evidence, ticket and a future ticket expiry, consumes a new fencing epoch and writes an audit event.
- Port evidence maps listening socket inodes through `/proc/*/fd` to PID, PGID and process start ticks before reclaim. Build evidence scans same-user process file descriptors below every frozen protected path, its acquisition-time canonical target, and the active symlink's current target; an unrelated open handle keeps reclaim fail-closed.
- The test CLI accepts `--test-db` only with both explicit test environment guards, allowing real child-process tests to share a temporary database without mutating the real control plane.

## Current verification

```bash
node --test scripts/resource-lock.nodetest.mjs
```

Result: 10 passed, 0 failed, 29.758 seconds; `git diff --check` clean. The S1 regression suite separately passed 23/23 in 25.700 seconds against schema v3.

Covered: 200 in-process contenders; 200 barrier-synchronized rounds using 400 real detached CLI processes across port/build/release/integration with exactly one winner per round; stale nonce/epoch and non-finite heartbeat TTL; Task authorization; FK/CHECK/index presence; break-glass TTL; explicit fenced state; socket inode-to-PID attribution; `builds/<release>/next`, switched active symlink, and old-running-build file-handle rejection; real v1→v3 state-preserving migration plus snapshot restoration after a simulated unknown-version failure; and heartbeat/suspect, release/suspect, reclaim/acquire races using real barrier-synchronized CLI processes.

## Test-isolation incident

An earlier development run mistakenly targeted the real git-common-dir control database and created test-labelled task/audit/lock records. They were not silently deleted because audit history is append-only. The final authoritative run uses only a temporary shared database through the doubly guarded test adapter.

The authoritative 200-round test snapshots the real database device/inode plus a stable SHA-256 over ordered full rows from `tasks`, `leases`, `resource_locks`, `control_meta`, and the complete audit checkpoint before and after. All must remain identical. Incident recovery is documented separately under `.harness/changes/incident-s2-real-db-test-pollution-20260713/`.

The full-database hash guard runs only in a declared control-plane maintenance/test window. It intentionally fails if any concurrent legitimate writer changes the database; Mandatory rollout must schedule this destructive-isolation proof or replace it with transaction provenance that can distinguish legitimate writes.
