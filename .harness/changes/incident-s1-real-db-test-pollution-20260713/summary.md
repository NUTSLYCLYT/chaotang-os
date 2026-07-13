# Incident: S1 tests wrote to the real control-plane database

| 字段 | 值 |
| --- | --- |
| Change ID | incident-s1-real-db-test-pollution-20260713 |
| 类型 | incident |
| 状态 | CONTAINED |
| Owner | Control Plane Maintainer |
| 创建日期 | 20260713 |

## Impact and frozen allowlist

Early S1 real-child and worktree tests used the real git-common-dir database. The recovery allowlist was frozen by the exact ordered predicate `task_id LIKE 'task-s1-%' ORDER BY task_id`:

- exact ID count: 2,806
- SHA-256 of newline-joined ordered IDs: `4fd18c593577279332bae187d1b470185896cd5cdd20707318b88350e247bbc5`
- pre-recovery Task states: 1,403 `leased`, 1,403 `ready`
- related Lease states: 1,100 `fenced`, 303 `released`; no active Lease was reclaimed

## Audited containment

One `BEGIN IMMEDIATE` transaction changed precisely the frozen 2,806 Tasks to `cancelled` and appended audit event `incident.s1_tasks_cancelled` with actor `codex-s1-recovery`, incident ID `INC-S1-REAL-DB-20260713`, count and digest. Audit and Lease history were retained. Result: 2,806 `cancelled`.

The one-time recovery code was not added to the repository. S1 child-process tests now use a doubly guarded temporary shared database.
