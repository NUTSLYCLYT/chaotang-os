# Codex Independent QA Pass 2: Rejected Candidate

| Field | Value |
| --- | --- |
| Session | `019f9c33-5b1f-7360-a217-1c3d827045d5` |
| Candidate | `a3652c91eaf02f868e8741ed9cf8e1c87db80ec8` |
| Tree | `3a5b928e41e43044a33c190e43565d44ef791b83` |
| Package SHA-256 | `da068313616f240ece9aee8a76c7f4e7c7b03a3f0ceaec68e01d2624a33b918d` |
| Verdict | `NO_GO` |
| HIGH | `2` |
| MEDIUM | `2` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Findings

1. Overlay evidence integrity was outside the sole v2 authority decision.
2. Opaque and reusable evidence could fabricate two independent reviews.
3. Expiry was declarative rather than ledger-driven.
4. Root doctor rejected the newly tracked `.gitattributes`.

The original reviewer output is retained in the coordinating session record.
