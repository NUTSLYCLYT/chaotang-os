# Codex Independent QA Pass 2: Rejected Candidate ac3a9865

| Field | Value |
| --- | --- |
| Session ID | `019f9e54-42d5-7373-9fb3-c49a81a37275` |
| Isolation | `FRESH_NO_FORK_CONTEXT` |
| Write access | `DENIED` |
| Candidate H | `ac3a98650608c7d76450f00f939f27a7fb35e33c` |
| Tree | `e371ab93ecd5e4c76be88a8e8747dd9df616701c` |
| Review base | `55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca` |
| Review package SHA-256 | `fc4b72f215ff087fe9ee18dd6edad4c88e588ba0de86d797f539585c53f77841` |
| Verdict | `NO_GO` |
| HIGH | `2` |
| MEDIUM | `0` |

## Findings

1. Nineteen rejected candidates imply 38 excluded sessions, but the validator
   binds only 34 canonical UUIDs. A corrected exclusion set would itself fail
   the current exact-equality validation.
2. Activation history is limited to commits reachable from current `HEAD`.
   After W07 reaches `MERGED_AND_VERIFIED`, rolling `HEAD` and the local EXT ref
   back to the previously valid ACTIVE activation removes the terminal event
   from the reachable graph and can replay the old authority. No external
   monotonic anchor records the terminal state.

## Verification

Exact H, tree, base, and package SHA-256 matched. Syntax checks,
`git diff --check`, amendment checker, v1/v2 checks, and root doctor passed.
W07 returned `STOP / NO_ACTIVE_WORK_PACKAGE`. No deployment claim was made.

```text
VERDICT NO_GO
HIGH 2
MEDIUM 0
session isolation FRESH_NO_FORK_CONTEXT
write access DENIED
```
