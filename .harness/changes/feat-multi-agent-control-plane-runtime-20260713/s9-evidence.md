# S9 Failure Injection, Recovery and Break-glass evidence

Status: `IMPLEMENTED_LOCAL / INDEPENDENT REVIEW GO (0 CRITICAL / 0 HIGH / 0 MEDIUM)`. This is not production READY or ENFORCED.

## Recovery controls

- Lease-holder `SIGKILL` retains exclusivity until TTL and permits exactly one contender only after transactional expiry.
- Resident identity now binds machine ID, boot ID, real PID-namespace inode, PID, PGID, `/proc` start ticks and cwd. Resource credentials separately bind the nonce and fencing epoch. Reboot/container/PID/cwd drift fails closed.
- S5 candidate interruption keeps the prior atomic active pointer unchanged and precisely removes only the failed candidate. A real detached build process is killed with `SIGKILL` inside an isolated PID/proc namespace, then the expired lock is fenced, reclaimed only after the process group and protected-path FD scan is clear, and rebuilt. Existing S5 lifecycle tests also cover interruptions and half builds.
- S5/S6 wrapper tests prove start/readiness failure stops the newly recorded PID/PGID only, retains the immutable previous build, and never uses broad kill. Gate interruption remains durable and resumable without public READY authority.
- S6 tests prove two real Commander processes admit one locked owner, interrupted Commander fencing/recovery, and resume at a newer epoch.
- Control-plane open/integrity failure preserves the database bytes under an owner-only recovery directory and returns `STOP`; it never deletes or silently reinitializes the authority database. Real SQLite page exhaustion and filesystem read-only mutation failures preserve a mode-0600 pre-operation snapshot.
- S8 negative tests cover external checkpoint damage, ledger truncation, whole-chain rewrite, old database rollback and fail-closed local-only authority.

## Break-glass contract

- A ticket is valid for at most 30 minutes and binds one full commit SHA, one release ID, operator, reason, evidence, exact force-unlock resource operation, and the existing production gate command.
- Two different actors with two independently pinned Ed25519 public keys must sign identical canonical ticket bytes. Duplicate keys/actors, replay, expiry, future issue time, changed command or mismatched commit/release fail closed.
- SQLite schema v8 records ticket use before the gate. The ticket is single-use even after gate/operation failure. Immutable identity columns and the global audit stream cannot be updated or deleted.
- Production execution rejects caller-injected trust/gate/operation adapters, requires a clean tracked HEAD, loads trust through the Git object database, validates public-key fingerprints and distinct trust domains, and invokes the gate through absolute `/usr/bin/corepack`.
- A successful ticket still executes the original production gate; nonzero exit, absent GREEN, or any `SKIP` prevents the emergency operation. An independently protected atomic replay authority must claim the ticket before mutation and record completion before the local terminal update.
- The fencing transaction persists one stable operation-outcome SHA-256. First completion, `operation_applied` crash recovery and the local consumed audit reuse those exact bytes; recovery never fences twice.
- A stateful owner-only replay fixture proves atomic `O_EXCL` claim, idempotent same-outcome completion, changed-outcome rejection, and rejection after the local SQLite database is rolled back to its pre-claim snapshot.
- The checked-in trust file is deliberately `EXTERNAL_REQUIRED` with no public keys or replay adapter. Production execution therefore fails closed until both protected approver public keys and the external replay command digest are pinned by a reviewed administrator change.

## Fault matrix evidence mapping

| Fault | Evidence |
| --- | --- |
| Agent killed with lease | `recovery-drill` lease/TTL test + S1 dead-holder tests |
| PID reuse / reboot / namespace drift | `recovery-drill` identity test + S2 nonce/fencing negatives |
| Interrupted build | `recovery-drill` real Git/SQLite immutable build + S5 50-round fault test |
| Health failure after start | S5 safe wrapper readiness/precise-stop tests |
| Interrupted gate | S6 failed/resume/terminal-pending tests; public READY rejected |
| Two Commanders | S6 two-real-process singleton test |
| Corrupt SQLite / anchor | `recovery-drill` byte-preservation test + S8 tamper matrix |
| Force unlock audit | S1/S2 actor/reason/evidence tests + signed single-use S9 ticket audit |
| Machine/container restart | machine/boot/namespace identity negative test |
| Disk full / read-only filesystem | real SQLite `max_page_count` FULL and mode-0555 parent tests |

## Verification

```bash
node --test scripts/recovery-drill.nodetest.mjs
node --test scripts/multi-agent-lease.nodetest.mjs scripts/resource-lock.nodetest.mjs scripts/release-commander.nodetest.mjs scripts/release-evidence.nodetest.mjs
node --experimental-strip-types --test frontend/scripts/safe-prod-lifecycle.nodetest.ts
node --test --test-concurrency=1 frontend/scripts/safe-prod-wrappers.nodetest.mjs
node scripts/harness-doctor.mjs
python3 backend/scripts/harness_doctor.py
git diff --check
```

Observed local results: recovery drill `14/14`, combined control-plane regression `77/77` before the final two replay cases were added, targeted stable-outcome/rollback replay `3/3`, resource-lock regression `10/10`, safe production lifecycle `8/8`; wrapper tests, both harness doctors and `git diff --check` exited zero. Independent read-only review returned GO with no CRITICAL, HIGH or MEDIUM findings.

S10 rollout and its twenty real production releases remain future evidence and cannot be synthesized by this drill.
