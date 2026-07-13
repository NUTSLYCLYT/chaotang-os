# Commands and observed results

Read-only pre-recovery summary:

```text
database: /home/ubuntu/Projects/chaotang-os/.git/chaotang-harness/control-plane.sqlite3
device/inode: 2096/401769
user_version: 3
task-s2-* tasks: 550
resource locks: fenced=56, reclaimed=197
matching audit events: 766
```

Audited recovery invocation:

```bash
node - <<'NODE'
import {recoverS2TestPollution} from './scripts/lib/resource-lock.mjs';
console.log(recoverS2TestPollution({
  actor: 'codex-s2-recovery',
  reason: 'S2 test isolation incident cleanup',
  evidence: '206 initial candidates; 150 reclaimed; 56 OS-blocked fenced at first cleanup',
  ticket: 'INC-S2-REAL-DB-20260713'
}));
NODE
```

Observed result: `cancelledTasks=550, reclaimed=0, quarantined=56`.

No raw SQL cleanup or deletion was used. The API performed Task cancellation and resource quarantine inside `BEGIN IMMEDIATE` and wrote audit events before commit.
