# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Session | `019f9ce3-9a79-79d1-ab66-caf35bb82778` |
| Candidate | `50e05e85f791b8e90c2272155637110426a02b0f` |
| Tree | `97ee9f6a2e2d9da0b16f744e3be0ff603d4e6caf` |
| Package SHA-256 | `8350e3566375d3aa28e7305f668b3a3f59b56666848ed9317b389b7e2a59e791` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `2` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Findings

1. A terminal W07 ledger entry could be changed back to `ACTIVE` and accepted
   as a new first activation.
2. Active-packet owner, review, and activation-intent digests still consumed
   UTF-8 strings rather than raw bytes.
3. Authority readers checked paths with `lstat` and then reopened them, leaving
   a check/use race.

The original reviewer output is retained in the coordinating session record.
