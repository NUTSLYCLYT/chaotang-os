# Incident: S2 tests wrote to the real control-plane database

| 字段 | 值 |
| --- | --- |
| Change ID | incident-s2-real-db-test-pollution-20260713 |
| 类型 | incident |
| 状态 | CONTAINED |
| Owner | Control Plane Maintainer |
| 创建日期 | 20260713 |

Status: contained and audited on 2026-07-13.

## Impact

An early S2 real-process test used the git-common-dir database instead of a temporary shared test database. It created `task-s2-*`, resource-lock and audit records. No records were silently deleted.

Initial cleanup supplied by the project owner examined 206 candidate locks: 150 were safely reclaimed and 56 remained fenced because OS socket/process/file-descriptor evidence still reported occupancy.

Additional development retries increased the retained history. Before the final recovery API ran, the database contained 550 `task-s2-*` tasks and S2 locks grouped as 197 reclaimed and 56 fenced.

## Recovery

Recovery used the audited `recoverS2TestPollution` API with:

- actor: `codex-s2-recovery`
- ticket: `INC-S2-REAL-DB-20260713`
- reason: `S2 test isolation incident cleanup`
- evidence: `206 initial candidates; 150 reclaimed; 56 OS-blocked fenced at first cleanup`

Result:

```json
{"cancelledTasks":550,"reclaimed":0,"quarantined":56}
```

All 550 test tasks were changed to structured `cancelled` status with an incident audit event. The 56 OS-blocked locks were not reclaimed; their owner is now `incident-quarantine`, their state remains `fenced`, and each has a dedicated audit event. This deliberately fails closed.

## Quarantine recheck conditions

The 56 quarantined locks may be reconsidered only under a new incident ticket and audited transaction. Port locks require the recorded socket inode to have no live PID owner and the port to have no listener. Build locks require the recorded holder/PGID to be absent and no same-user process to hold an FD under any frozen protected path or the current active-symlink target. Release/integration locks require holder PID-instance and PGID absence. Any unreadable or ambiguous OS evidence remains blocked; no count-based or age-based cleanup is permitted.

## Prevention

`harness-lock.mjs --test-db` now requires both `NODE_ENV=test` and `CHAOTANG_CONTROL_PLANE_TEST_ADAPTER=1`. The authoritative 200-round process test captures the real database device/inode and stable SHA-256 digests over ordered full rows from `tasks`, `leases`, `resource_locks`, `control_meta`, and `audit_events`; it runs entirely against a temporary shared database and requires every real-database digest to remain identical. This guard is run in a declared control-plane maintenance/test window so legitimate concurrent writes are not misclassified as pollution.
