# Codex Independent QA Pass 1: Rejected Candidate ac3a9865

| Field | Value |
| --- | --- |
| Session ID | `019f9e54-18be-7961-acbb-d4b24a99f422` |
| Isolation | `FRESH_NO_FORK_CONTEXT` |
| Write access | `DENIED` |
| Candidate H | `ac3a98650608c7d76450f00f939f27a7fb35e33c` |
| Tree | `e371ab93ecd5e4c76be88a8e8747dd9df616701c` |
| Review base | `55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca` |
| Review package SHA-256 | `fc4b72f215ff087fe9ee18dd6edad4c88e588ba0de86d797f539585c53f77841` |
| Verdict | `NO_GO` |
| HIGH | `0` |
| MEDIUM | `1` |

## Finding

The immutable rejection set omits four prior reviewer identities. The
validator pins 34 canonical UUIDs, while the eighteenth and nineteenth
candidate reviews record four `/root/...` session aliases. The UUID-only
review format prevents literal alias reuse, but the evidence does not bind
those aliases to canonical platform session identities and therefore cannot
prove that the four underlying sessions are excluded.

## Verification

Exact H, tree, 268,892-byte package, SHA-256, ancestry, and hardened Git-diff
byte equality passed. Syntax checks, root doctor, `git diff --check`, v1 STOP,
v2 structural check, and W07 `STOP / NO_ACTIVE_WORK_PACKAGE` passed. No
deployment claim was made.

```text
VERDICT NO_GO
HIGH 0
MEDIUM 1
session isolation FRESH_NO_FORK_CONTEXT
write access DENIED
```
